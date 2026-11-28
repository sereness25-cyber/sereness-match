begin;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003');
insert into public.match_profiles (user_id, display_name, region, discoverable)
select id, '架空会員', '秋田市', id <> '00000000-0000-0000-0000-000000000003'
from auth.users where id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003');

set local role anon;
do $$ begin
  begin
    perform 1 from public.match_profiles;
    raise exception 'anonymous read was accepted';
  exception when insufficient_privilege then null; end;
end $$;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$ begin
  if (select count(*) from public.match_profiles) <> 2 then raise exception 'hidden profile leaked'; end if;
  update public.match_profiles set display_name = '更新' where user_id = '00000000-0000-0000-0000-000000000002';
  if found then raise exception 'other user profile changed'; end if;
  if public.send_match_like('00000000-0000-0000-0000-000000000002') is not null
    then raise exception 'one-sided like created a match'; end if;
  begin
    insert into public.match_likes (sender_id,recipient_id) values
      ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001');
    raise exception 'direct like accepted';
  exception when insufficient_privilege then null; end;
end $$;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$ declare pair uuid; begin
  pair := public.send_match_like('00000000-0000-0000-0000-000000000001');
  if pair is null or pair is distinct from public.send_match_like('00000000-0000-0000-0000-000000000001')
    then raise exception 'match missing or duplicate'; end if;
  if (select count(*) from public.match_pairs) <> 1 or (select count(*) from public.match_likes) <> 2
    then raise exception 'incorrect match or like count'; end if;
  begin
    perform public.send_match_message(pair,'確認前');
    raise exception 'unverified message accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into match_private.verifications values
  ('00000000-0000-0000-0000-000000000001',now(),now()),
  ('00000000-0000-0000-0000-000000000002',now(),now()),
  ('00000000-0000-0000-0000-000000000003',now(),now());
select set_config('test.match_id',(select id::text from public.match_pairs limit 1),true);
set local role authenticated;
do $$ begin
  perform public.send_match_message(current_setting('test.match_id')::uuid,'架空のメッセージ');
  if (select count(*) from public.match_messages) <> 1 then raise exception 'message missing'; end if;
end $$;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
do $$ begin
  if exists (select 1 from public.match_messages) or exists (select 1 from public.match_pairs)
    then raise exception 'conversation leaked to non-member'; end if;
  begin
    perform public.send_match_message(current_setting('test.match_id')::uuid,'第三者');
    raise exception 'third-party message accepted';
  exception when insufficient_privilege then null; end;
end $$;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select public.block_match_member('00000000-0000-0000-0000-000000000002');
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$ begin
  if exists (select 1 from public.match_profiles where user_id = '00000000-0000-0000-0000-000000000001')
    or exists (select 1 from public.match_pairs) or exists (select 1 from public.match_messages)
    then raise exception 'blocked data still visible'; end if;
  perform public.unblock_match_member('00000000-0000-0000-0000-000000000001');
  begin
    perform public.send_match_like('00000000-0000-0000-0000-000000000001');
    raise exception 'blocked like accepted';
  exception when insufficient_privilege then null; end;
end $$;

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select public.unblock_match_member('00000000-0000-0000-0000-000000000002');
do $$ begin
  if (select count(*) from public.match_profiles) <> 2 then raise exception 'unblock failed'; end if;
  if exists (select 1 from public.match_pairs) then raise exception 'old match restored'; end if;
end $$;

rollback;
