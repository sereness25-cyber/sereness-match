begin;

-- Profile filtering applies to the existing browse policy as well as to new tables.
alter policy profiles_read on public.profiles
  using ((select member_private.active_member(auth.uid()))
    and (user_id=(select auth.uid()) or
      (visibility='public' and member_private.active_member(user_id) and member_private.can_see_peer(user_id))));

grant select on public.likes,public.skips,public.matches,public.conversations,
  public.conversation_members,public.messages,public.blocks,public.reports to authenticated;

create policy likes_party_read on public.likes for select to authenticated using (
  status<>'cancelled' and
  ((sender_id=(select auth.uid()) and member_private.can_exchange_with(receiver_id))
    or (receiver_id=(select auth.uid()) and member_private.can_exchange_with(sender_id)))
);
create policy skips_owner_read on public.skips for select to authenticated
  using (user_id=(select auth.uid()) and (select member_private.active_member(auth.uid())));
create policy matches_party_read on public.matches for select to authenticated using (
  status='active' and
    ((user_a_id=(select auth.uid()) and member_private.can_exchange_with(user_b_id))
      or (user_b_id=(select auth.uid()) and member_private.can_exchange_with(user_a_id)))
);
create policy conversations_party_read on public.conversations for select to authenticated
  using (member_private.can_read_conversation(id));
create policy conversation_members_party_read on public.conversation_members for select to authenticated
  using (member_private.can_read_conversation(conversation_id));
create policy messages_party_read on public.messages for select to authenticated
  using (member_private.can_read_conversation(conversation_id));
create policy blocks_owner_read on public.blocks for select to authenticated
  using (blocker_id=(select auth.uid()) and (select member_private.active_member(auth.uid())));
create policy reports_owner_read on public.reports for select to authenticated
  using (reporter_id=(select auth.uid()) and (select member_private.active_member(auth.uid())));

create function public.submit_report(p_target uuid,p_reason text,p_message uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); report_id_out uuid; item public.messages%rowtype;
begin
  if actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_reason is null or p_reason !~ '[^[:space:]]' or char_length(btrim(p_reason))>500 then
    raise exception 'report reason required' using errcode='22023';
  end if;
  perform member_private.lock_exchange(actor,p_target);
  if not member_private.active_member(actor) then raise exception 'account unavailable' using errcode='42501'; end if;
  if p_message is not null then
    -- Historical membership suffices here: blocking must not prevent reporting.
    select m.* into item from public.messages m
    join public.conversation_members c on c.conversation_id=m.conversation_id and c.user_id=actor
    where m.id=p_message and m.sender_id=p_target;
    if not found then raise exception 'report target unavailable' using errcode='42501'; end if;
  end if;
  insert into public.reports(reporter_id,reported_user_id,target_type,target_id,reason)
    values(actor,p_target,case when p_message is null then 'member' else 'message' end,
      coalesce(p_message,p_target),btrim(p_reason)) returning id into report_id_out;
  if p_message is not null then
    insert into public.report_evidence(report_id,message_id,snapshot)
      values(report_id_out,item.id,jsonb_build_object('sender_id',item.sender_id,'body',item.body,'created_at',item.created_at));
  end if;
  return report_id_out;
end;
$$;
create function public.read_report_evidence(p_report uuid,p_reason text)
returns table (evidence_id uuid, message_id uuid, snapshot jsonb)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); reviewer uuid;
begin
  if p_reason is null or p_reason !~ '[^[:space:]]' or char_length(btrim(p_reason))>500 then
    raise exception 'review reason required' using errcode='22023';
  end if;
  perform id from public.accounts where id=actor for share;
  if not member_private.active_member(actor) then raise exception 'evidence unavailable' using errcode='42501'; end if;
  select a.id into reviewer from public.admins a
    join public.admin_role_permissions rp on rp.role_id=a.role_id
    join public.admin_permissions ap on ap.id=rp.permission_id and ap.code='reports.evidence.read'
    join public.reports r on r.assigned_admin_id=a.id and r.id=p_report
    where a.auth_user_id=actor and a.is_active
    for share of a,r,rp,ap;
  if not found then raise exception 'evidence unavailable' using errcode='42501'; end if;
  insert into public.audit_logs(admin_id,report_id,action,reason)
    values(reviewer,p_report,'report_evidence_read',btrim(p_reason));
  return query select e.id,e.message_id,e.snapshot from public.report_evidence e
    where e.report_id=p_report and (e.expires_at is null or e.expires_at>now());
end;
$$;
revoke all on function public.submit_report(uuid,text,uuid),public.read_report_evidence(uuid,text)
  from public,anon,authenticated;
grant execute on function public.submit_report(uuid,text,uuid),public.read_report_evidence(uuid,text)
  to authenticated;

commit;
