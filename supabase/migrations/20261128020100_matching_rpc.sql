begin;

-- Internal helpers are in an unexposed schema. Only session-bound predicates
-- are granted to authenticated users for evaluation by row policies.
create function member_private.is_blocked(a uuid,b uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.blocks
    where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a));
$$;
create function member_private.exchange_eligible(a uuid,b uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select a is not null and b is not null and a<>b
    and member_private.active_member(a) and member_private.active_member(b)
    and (select count(*)=2 from public.accounts where id in (a,b) and age_verified_at is not null)
    and not member_private.is_blocked(a,b);
$$;
create function member_private.can_see_peer(peer uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and not member_private.is_blocked(auth.uid(),peer);
$$;
create function member_private.can_exchange_with(peer uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select member_private.exchange_eligible(auth.uid(),peer);
$$;
create function member_private.can_read_conversation(thread uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.conversations c
    join public.matches m on m.id=c.match_id
    join public.conversation_members cm on cm.conversation_id=c.id and cm.user_id=auth.uid()
    where c.id=thread and c.status='active' and m.status='active'
      and auth.uid() in (m.user_a_id,m.user_b_id)
      and member_private.exchange_eligible(m.user_a_id,m.user_b_id)
  );
$$;
create function member_private.lock_exchange(a uuid,b uuid) returns void
language plpgsql volatile set search_path='' as $$
begin
  if a is null or b is null or a=b then
    raise exception 'invalid pair' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('sereness.match:'||least(a,b)::text||':'||greatest(a,b)::text,0)
  );
  -- Serialize with changes to suspension and age-verification rows.
  perform id from public.accounts where id in (a,b) order by id for share;
end;
$$;
create function member_private.jst_date(moment timestamptz) returns date
language sql immutable set search_path='' as $$
  select pg_catalog.timezone('Asia/Tokyo',moment)::date;
$$;
create function member_private.like_allowance(actor uuid,moment timestamptz) returns integer
language sql stable security definer set search_path='' as $$
  select case when exists (
    select 1 from public.entitlements
    where user_id=actor and feature_code='daily_likes_20'
      and source in ('subscription','gender_policy','admin')
      and starts_at<=moment and (expires_at is null or expires_at>moment)
      and (revoked_at is null or revoked_at>moment)
  ) then 20 else 5 end;
$$;

create function public.get_daily_like_balance()
returns table (target_date date, granted_count integer, used_count integer, remaining_count integer)
language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid(); current_time_at_db timestamptz:=pg_catalog.clock_timestamp();
  today date:=member_private.jst_date(current_time_at_db); allowance int; used int;
begin
  if not member_private.active_member(actor) then raise exception 'account unavailable' using errcode='42501'; end if;
  allowance:=member_private.like_allowance(actor,current_time_at_db);
  select b.used_count into used from public.daily_like_balances b where b.user_id=actor and b.target_date=today;
  used:=coalesce(used,0);
  return query select today,allowance,used,greatest(allowance-used,0);
end;
$$;

create function public.send_like(p_target uuid,p_kind text,p_body text,p_request uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid(); previous public.likes%rowtype; new_id uuid;
  body text:=btrim(p_body); debit integer; allowance integer;
  current_time_at_db timestamptz; today date;
begin
  if actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_request is null or p_kind is null or p_kind not in ('normal','message')
    or (p_kind='normal' and p_body is not null)
    or (p_kind='message' and (body is null or body !~ '[^[:space:]]' or char_length(body)>100)) then
    raise exception 'invalid like' using errcode='22023';
  end if;
  perform member_private.lock_exchange(actor,p_target);
  if not member_private.exchange_eligible(actor,p_target) then raise exception 'recipient unavailable' using errcode='42501'; end if;
  select * into previous from public.likes where sender_id=actor and client_request_id=p_request;
  if found then
    if previous.receiver_id is distinct from p_target or previous.like_type is distinct from p_kind
      or previous.message is distinct from body then raise exception 'request id reused' using errcode='22023'; end if;
    return previous.id;
  end if;
  if exists(select 1 from public.likes where sender_id=actor and receiver_id=p_target) then
    raise exception 'duplicate like' using errcode='23505';
  end if;
  if exists(select 1 from public.matches
    where user_a_id=least(actor,p_target) and user_b_id=greatest(actor,p_target)) then
    raise exception 'pair already matched' using errcode='42501';
  end if;
  current_time_at_db:=pg_catalog.clock_timestamp();
  today:=member_private.jst_date(current_time_at_db);
  allowance:=member_private.like_allowance(actor,current_time_at_db);
  debit:=case when p_kind='normal' then 1 else 3 end;
  insert into public.daily_like_balances(user_id,target_date,granted_count)
    values(actor,today,allowance) on conflict (user_id,target_date) do nothing;
  update public.daily_like_balances
    set granted_count=allowance,used_count=used_count+debit,updated_at=current_time_at_db
    where user_id=actor and target_date=today and used_count+debit<=allowance;
  if not found then raise exception 'daily likes exhausted' using errcode='P0001'; end if;
  insert into public.likes(sender_id,receiver_id,like_type,message,cost,client_request_id)
    values(actor,p_target,p_kind,body,debit,p_request) returning id into new_id;
  return new_id;
end;
$$;
create function public.skip_member(p_target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  perform member_private.lock_exchange(actor,p_target);
  if not member_private.exchange_eligible(actor,p_target) then raise exception 'recipient unavailable' using errcode='42501'; end if;
  insert into public.skips(user_id,target_user_id) values(actor,p_target) on conflict do nothing;
end;
$$;
create function public.thank_like(p_like uuid)
returns table (match_id uuid,conversation_id uuid)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); sent public.likes%rowtype; matched public.matches%rowtype; thread uuid;
begin
  select * into sent from public.likes where id=p_like and receiver_id=actor;
  if not found then raise exception 'like unavailable' using errcode='42501'; end if;
  perform member_private.lock_exchange(actor,sent.sender_id);
  if not member_private.exchange_eligible(actor,sent.sender_id) then raise exception 'like unavailable' using errcode='42501'; end if;
  select * into sent from public.likes where id=p_like;
  if sent.status not in ('pending','accepted') then raise exception 'like unavailable' using errcode='42501'; end if;
  select * into matched from public.matches
    where user_a_id=least(actor,sent.sender_id) and user_b_id=greatest(actor,sent.sender_id);
  if found then
    if matched.status<>'active' then raise exception 'match is closed' using errcode='42501'; end if;
    select c.id into strict thread from public.conversations c where c.match_id=matched.id;
  else
    insert into public.matches(user_a_id,user_b_id,source_id)
      values(least(actor,sent.sender_id),greatest(actor,sent.sender_id),p_like) returning * into matched;
    insert into public.conversations(match_id) values(matched.id) returning id into thread;
    insert into public.conversation_members(conversation_id,user_id) values(thread,actor),(thread,sent.sender_id);
  end if;
  update public.likes set status='accepted',responded_at=now() where id=p_like and status='pending';
  return query select matched.id,thread;
end;
$$;

create function public.send_text_message(p_thread uuid,p_body text,p_request uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); peer uuid; body_text text:=btrim(p_body); previous public.messages%rowtype; new_id uuid;
begin
  if p_request is null or body_text is null or body_text !~ '[^[:space:]]' or char_length(body_text)>1000 then
    raise exception 'invalid message' using errcode='22023';
  end if;
  select case when m.user_a_id=actor then m.user_b_id else m.user_a_id end into peer
    from public.conversations c join public.matches m on m.id=c.match_id
    where c.id=p_thread and actor in (m.user_a_id,m.user_b_id);
  if not found then raise exception 'conversation unavailable' using errcode='42501'; end if;
  perform member_private.lock_exchange(actor,peer);
  if not member_private.can_read_conversation(p_thread) then raise exception 'conversation unavailable' using errcode='42501'; end if;
  select * into previous from public.messages where sender_id=actor and client_request_id=p_request;
  if found then
    if previous.conversation_id is distinct from p_thread or previous.body is distinct from body_text then
      raise exception 'request id reused' using errcode='22023';
    end if;
    return previous.id;
  end if;
  insert into public.messages(conversation_id,sender_id,body,client_request_id)
    values(p_thread,actor,body_text,p_request) returning id into new_id;
  update public.conversations set last_message_at=pg_catalog.clock_timestamp() where id=p_thread;
  return new_id;
end;
$$;

create function member_private.close_pair(a uuid,b uuid,ending text) returns void
language plpgsql set search_path='' as $$
declare ended_match uuid;
begin
  update public.matches set status=ending,ended_at=now(),ended_by=a
    where user_a_id=least(a,b) and user_b_id=greatest(a,b) and status='active' returning id into ended_match;
  if found then update public.conversations set status='closed' where match_id=ended_match; end if;
  update public.likes set status='cancelled',responded_at=now()
    where status='pending' and ((sender_id=a and receiver_id=b) or (sender_id=b and receiver_id=a));
end;
$$;
create function public.end_match(p_match uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); peer uuid;
begin
  select case when user_a_id=actor then user_b_id else user_a_id end into peer
    from public.matches where id=p_match and actor in (user_a_id,user_b_id);
  if not found then raise exception 'match unavailable' using errcode='42501'; end if;
  perform member_private.lock_exchange(actor,peer);
  if not member_private.active_member(actor) then raise exception 'account unavailable' using errcode='42501'; end if;
  perform member_private.close_pair(actor,peer,'unmatched');
end;
$$;
create function public.block_member(p_target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  perform member_private.lock_exchange(actor,p_target);
  if not member_private.active_member(actor) then raise exception 'account unavailable' using errcode='42501'; end if;
  insert into public.blocks(blocker_id,blocked_id) values(actor,p_target) on conflict do nothing;
  perform member_private.close_pair(actor,p_target,'blocked');
end;
$$;
create function public.unblock_member(p_target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  perform member_private.lock_exchange(actor,p_target);
  if not member_private.active_member(actor) then raise exception 'account unavailable' using errcode='42501'; end if;
  delete from public.blocks where blocker_id=actor and blocked_id=p_target;
end;
$$;

revoke all on function member_private.is_blocked(uuid,uuid),member_private.exchange_eligible(uuid,uuid),
  member_private.lock_exchange(uuid,uuid),member_private.jst_date(timestamptz),member_private.like_allowance(uuid,timestamptz),
  member_private.close_pair(uuid,uuid,text),member_private.can_see_peer(uuid),member_private.can_exchange_with(uuid),
  member_private.can_read_conversation(uuid) from public,anon,authenticated;
grant execute on function member_private.can_see_peer(uuid),member_private.can_exchange_with(uuid),
  member_private.can_read_conversation(uuid) to authenticated;
revoke all on function public.get_daily_like_balance(),public.send_like(uuid,text,text,uuid),public.skip_member(uuid),
  public.thank_like(uuid),public.send_text_message(uuid,text,uuid),public.block_member(uuid),public.unblock_member(uuid),
  public.end_match(uuid) from public,anon,authenticated;
grant execute on function public.get_daily_like_balance(),public.send_like(uuid,text,text,uuid),public.skip_member(uuid),
  public.thank_like(uuid),public.send_text_message(uuid,text,uuid),public.block_member(uuid),public.unblock_member(uuid),
  public.end_match(uuid) to authenticated;

commit;
