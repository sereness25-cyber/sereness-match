begin;
do $$
begin
  if (select count(*) from supabase_migrations.schema_migrations
      where version in ('20261128010000','20261128020000','20261128020100','20261128020200'))<>4 then
    raise exception 'migration ledger incomplete';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relrowsecurity and c.relname in
      ('likes','daily_like_balances','skips','matches','conversations','conversation_members',
       'messages','blocks','reports','report_evidence','audit_logs'))<>11 then
    raise exception 'RLS is missing';
  end if;
  if member_private.jst_date('2026-11-28 14:59:59+00')<>'2026-11-28'::date
    or member_private.jst_date('2026-11-28 15:00:00+00')<>'2026-11-29'::date then
    raise exception 'JST boundary is wrong';
  end if;
end $$;
select set_config('test.mc_alice',(select id::text from auth.users where email='c-alice@example.com'),true);
select set_config('test.mc_bob',(select id::text from auth.users where email='c-bob@example.com'),true);
select set_config('test.mc_premium',(select id::text from auth.users where email='c-premium@example.com'),true);
select set_config('test.mc_support',(select id::text from auth.users where email='c-support@example.com'),true);
select set_config('test.mc_young',(select id::text from auth.users where email='c-young@example.com'),true);
select set_config('test.mc_stopped',(select id::text from auth.users where email='c-stopped@example.com'),true);
select set_config('test.mc_outsider',(select id::text from auth.users where email='c-outsider@example.com'),true);
select set_config('test.mc_reviewer',(select id::text from auth.users where email='c-reviewer@example.com'),true);
select set_config('test.mc_other',(select id::text from auth.users where email='c-other-admin@example.com'),true);

-- Force the final insert to fail and assert that the preceding balance change is rolled back.
create function pg_temp.fail_fixture_like() returns trigger language plpgsql as $$
begin
  if new.client_request_id='70000000-0000-0000-0000-000000000001' then
    raise exception 'fixture failure' using errcode='22000';
  end if;
  return new;
end $$;
create trigger fixture_like_failure before insert on public.likes
  for each row execute function pg_temp.fail_fixture_like();
insert into public.daily_like_balances(user_id,target_date,granted_count,used_count)
values(current_setting('test.mc_alice')::uuid,member_private.jst_date(now())-1,5,5);

set local role anon;
do $$ begin
  begin perform 1 from public.messages; raise exception 'anonymous read allowed';
  exception when insufficient_privilege then null; end;
  begin perform public.get_daily_like_balance(); raise exception 'anonymous RPC allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;

do $$
declare handle text;
begin
  foreach handle in array array['alice','bob','premium','support'] loop
    perform set_config('request.jwt.claim.sub',current_setting('test.mc_'||handle),true);
    if (select granted_count from public.get_daily_like_balance())<>(case when handle='alice' then 5 else 20 end)
      or (select used_count from public.get_daily_like_balance())<>0 then raise exception 'quota for %',handle; end if;
  end loop;
end $$;

select set_config('request.jwt.claim.sub',current_setting('test.mc_alice'),true);
do $$
declare
  b uuid:=current_setting('test.mc_bob')::uuid; p uuid:=current_setting('test.mc_premium')::uuid;
  req uuid:=gen_random_uuid(); liked uuid;
begin
  perform public.skip_member(p);
  if (select used_count from public.get_daily_like_balance())<>0 then raise exception 'skip debited balance'; end if;
  liked:=public.send_like(b,'normal',null,req);
  if public.send_like(b,'normal',null,req)<>liked then raise exception 'retry ID mismatch'; end if;
  begin perform public.send_like(b,'normal',null,gen_random_uuid()); raise exception 'duplicate accepted';
  exception when unique_violation then null; end;
  if (select used_count from public.get_daily_like_balance())<>1 then raise exception 'wrong normal debit'; end if;
  begin perform public.send_like(p,'normal',null,'70000000-0000-0000-0000-000000000001'); raise exception 'fixture did not fail';
  exception when data_exception then null; end;
  if (select used_count from public.get_daily_like_balance())<>1 then raise exception 'failed insert consumed balance'; end if;
  perform public.send_like(p,'message','架空の本文',gen_random_uuid());
  if (select used_count from public.get_daily_like_balance())<>4 then raise exception 'wrong message debit'; end if;
  begin perform public.send_like(current_setting('test.mc_support')::uuid,'message','残数不足',gen_random_uuid()); raise exception 'overspent';
  exception when raise_exception then if sqlerrm<>'daily likes exhausted' then raise; end if; end;
  begin perform public.send_like(current_setting('test.mc_young')::uuid,'normal',null,gen_random_uuid()); raise exception 'age gate missed';
  exception when insufficient_privilege then null; end;
  begin perform public.send_like(current_setting('test.mc_stopped')::uuid,'normal',null,gen_random_uuid()); raise exception 'suspension gate missed';
  exception when insufficient_privilege then null; end;
  if (select used_count from public.get_daily_like_balance())<>4 then raise exception 'failed writes consumed balance'; end if;
  perform set_config('test.mc_like',liked::text,true);
end $$;

select set_config('request.jwt.claim.sub',current_setting('test.mc_bob'),true);
do $$
declare a uuid:=current_setting('test.mc_alice')::uuid; result record; again record;
begin
  perform public.send_like(a,'normal',null,gen_random_uuid());
  if exists(select 1 from public.matches) then raise exception 'crossed likes matched'; end if;
  select * into result from public.thank_like(current_setting('test.mc_like')::uuid);
  select * into again from public.thank_like(current_setting('test.mc_like')::uuid);
  if result.conversation_id is null or again.conversation_id<>result.conversation_id
    or (select count(*) from public.conversation_members)<>2 then raise exception 'match or membership invalid'; end if;
  if (select used_count from public.get_daily_like_balance())<>1 then raise exception 'thank debited balance'; end if;
  perform set_config('test.mc_thread',result.conversation_id::text,true);
  perform set_config('test.mc_message',public.send_text_message(result.conversation_id,'架空の証拠',gen_random_uuid())::text,true);
end $$;

select set_config('request.jwt.claim.sub',current_setting('test.mc_outsider'),true);
do $$ begin
  if exists(select 1 from public.messages) then raise exception 'outsider can read'; end if;
  begin perform public.thank_like(current_setting('test.mc_like')::uuid); raise exception 'outsider thanked';
  exception when insufficient_privilege then null; end;
  begin perform public.send_text_message(current_setting('test.mc_thread')::uuid,'forbidden',gen_random_uuid()); raise exception 'outsider sent';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub',current_setting('test.mc_alice'),true);
do $$ begin
  if (select count(*) from public.messages)<>1 then raise exception 'participant cannot read'; end if;
  perform public.block_member(current_setting('test.mc_bob')::uuid);
  if exists(select 1 from public.messages) or exists(select 1 from public.profiles where user_id=current_setting('test.mc_bob')::uuid)
    then raise exception 'block visibility incorrect'; end if;
  begin perform public.send_text_message(current_setting('test.mc_thread')::uuid,'forbidden',gen_random_uuid()); raise exception 'blocked sending allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('test.mc_report',public.submit_report(current_setting('test.mc_bob')::uuid,'架空の通報',
    current_setting('test.mc_message')::uuid)::text,true);
  begin perform 1 from public.report_evidence; raise exception 'member got evidence';
  exception when insufficient_privilege then null; end;
  perform public.unblock_member(current_setting('test.mc_bob')::uuid);
  if exists(select 1 from public.messages) or exists(select 1 from public.matches) then raise exception 'unblock restored conversation'; end if;
end $$;
reset role;

update public.reports set assigned_admin_id=(select id from public.admins where auth_user_id=current_setting('test.mc_reviewer')::uuid)
where id=current_setting('test.mc_report')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.mc_other'),true);
do $$ begin
  begin perform public.read_report_evidence(current_setting('test.mc_report')::uuid,'forbidden'); raise exception 'unassigned admin viewed evidence';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.mc_reviewer'),true);
do $$ begin
  if (select snapshot->>'body' from public.read_report_evidence(current_setting('test.mc_report')::uuid,'架空の審査理由'))
     is distinct from '架空の証拠' then raise exception 'assigned reviewer evidence missing'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.audit_logs where report_id=current_setting('test.mc_report')::uuid and reason='架空の審査理由')<>1
    or not exists(select 1 from public.messages where id=current_setting('test.mc_message')::uuid)
    then raise exception 'audit or evidence retention missing'; end if;
end $$;
rollback;
