begin;

create schema match_private;
revoke all on schema match_private from public, anon, authenticated;
grant usage on schema match_private to authenticated, service_role;

create table public.match_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 30),
  region text not null check (char_length(btrim(region)) between 1 and 50),
  bio text not null default '' check (char_length(bio) <= 500),
  discoverable boolean not null default false
);
create table match_private.verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  identity_verified_at timestamptz,
  age_verified_at timestamptz
);
create table public.match_blocks (
  blocker_id uuid references public.match_profiles on delete cascade,
  blocked_id uuid references public.match_profiles on delete cascade,
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create table public.match_likes (
  sender_id uuid references public.match_profiles on delete cascade,
  recipient_id uuid references public.match_profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sender_id, recipient_id),
  check (sender_id <> recipient_id)
);
create index match_likes_recipient_idx on public.match_likes (recipient_id);
create table public.match_pairs (
  id uuid primary key default gen_random_uuid(),
  member_low uuid not null references public.match_profiles on delete cascade,
  member_high uuid not null references public.match_profiles on delete cascade,
  created_at timestamptz not null default now(),
  unique (member_low, member_high),
  check (member_low < member_high)
);
create index match_pairs_member_high_idx on public.match_pairs (member_high);
create table public.match_messages (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.match_pairs on delete cascade,
  sender_id uuid not null references public.match_profiles on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index match_messages_thread_idx on public.match_messages (pair_id, created_at, id);

alter table public.match_profiles enable row level security;
alter table public.match_blocks enable row level security;
alter table public.match_likes enable row level security;
alter table public.match_pairs enable row level security;
alter table public.match_messages enable row level security;
alter table match_private.verifications enable row level security;

revoke all on public.match_profiles, public.match_blocks, public.match_likes,
  public.match_pairs, public.match_messages, match_private.verifications from public, anon, authenticated;
grant select on public.match_profiles, public.match_blocks, public.match_likes,
  public.match_pairs, public.match_messages to authenticated;
grant insert (user_id, display_name, region, bio, discoverable),
  update (display_name, region, bio, discoverable) on public.match_profiles to authenticated;
grant select, insert, update, delete on match_private.verifications to service_role;

create function match_private.can_contact(other_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and other_id is not null and not exists (
    select 1 from public.match_blocks
    where (blocker_id = auth.uid() and blocked_id = other_id)
       or (blocker_id = other_id and blocked_id = auth.uid())
  );
$$;
create function match_private.is_verified() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from match_private.verifications
    where user_id = auth.uid() and identity_verified_at is not null and age_verified_at is not null);
$$;

create policy read_profiles on public.match_profiles for select to authenticated
using (user_id = (select auth.uid()) or (discoverable and match_private.can_contact(user_id)));
create policy create_own_profile on public.match_profiles for insert to authenticated
with check (user_id = (select auth.uid()));
create policy edit_own_profile on public.match_profiles for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy read_own_blocks on public.match_blocks for select to authenticated
using (blocker_id = (select auth.uid()));
create policy read_own_likes on public.match_likes for select to authenticated
using ((sender_id = (select auth.uid()) and match_private.can_contact(recipient_id))
    or (recipient_id = (select auth.uid()) and match_private.can_contact(sender_id)));
create policy read_own_matches on public.match_pairs for select to authenticated
using ((member_low = (select auth.uid()) and match_private.can_contact(member_high))
    or (member_high = (select auth.uid()) and match_private.can_contact(member_low)));
create policy read_own_messages on public.match_messages for select to authenticated
using ((select match_private.is_verified()) and exists (
  select 1 from public.match_pairs p where p.id = pair_id
));

-- Serialize writes concerning the same unordered pair, including blocks.
create function match_private.lock_pair(a uuid, b uuid) returns void
language sql set search_path = '' as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(least(a,b)::text || ':' || greatest(a,b)::text, 0)
  );
$$;

create function match_private.send_like(target uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  match_id uuid;
begin
  if actor is null or target is null or actor = target then
    raise exception 'invalid recipient' using errcode = '22023';
  end if;
  perform match_private.lock_pair(actor,target);
  if not match_private.can_contact(target) or not exists (
    select 1 from public.match_profiles p where p.user_id = target and p.discoverable
  ) or not exists (
    select 1 from public.match_profiles p where p.user_id = actor and p.discoverable
  ) then
    raise exception 'recipient unavailable' using errcode = '42501';
  end if;
  insert into public.match_likes (sender_id,recipient_id) values (actor,target)
    on conflict do nothing;
  if exists (select 1 from public.match_likes where sender_id = target and recipient_id = actor) then
    insert into public.match_pairs (member_low,member_high) values (least(actor,target),greatest(actor,target))
      on conflict (member_low,member_high) do nothing;
    select id into match_id from public.match_pairs
      where member_low = least(actor,target) and member_high = greatest(actor,target);
  end if;
  return match_id;
end;
$$;

create function match_private.block_member(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or target is null or actor = target then
    raise exception 'invalid target' using errcode = '22023';
  end if;
  perform match_private.lock_pair(actor,target);
  if not exists (select 1 from public.match_profiles p where p.user_id = target and p.discoverable)
    and not exists (select 1 from public.match_pairs
      where member_low = least(actor,target) and member_high = greatest(actor,target))
    and not exists (select 1 from public.match_blocks where blocker_id = actor and blocked_id = target)
    and not exists (select 1 from public.match_likes where sender_id = target and recipient_id = actor) then
    raise exception 'recipient unavailable' using errcode = '42501';
  end if;
  insert into public.match_blocks (blocker_id,blocked_id) values (actor,target) on conflict do nothing;
  delete from public.match_likes where (sender_id = actor and recipient_id = target)
    or (sender_id = target and recipient_id = actor);
  delete from public.match_pairs where member_low = least(actor,target) and member_high = greatest(actor,target);
end;
$$;

create function match_private.unblock_member(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or target is null then
    raise exception 'invalid target' using errcode = '22023';
  end if;
  perform match_private.lock_pair(auth.uid(),target);
  delete from public.match_blocks where blocker_id = auth.uid() and blocked_id = target;
end;
$$;

create function match_private.send_message(thread_id uuid, message_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  partner uuid;
  message_id uuid;
begin
  select case when p.member_low = actor then p.member_high else p.member_low end into partner
    from public.match_pairs p where p.id = thread_id and actor in (p.member_low,p.member_high);
  if partner is null then
    raise exception 'thread unavailable' using errcode = '42501';
  end if;
  perform match_private.lock_pair(actor,partner);
  if not match_private.can_contact(partner) or not match_private.is_verified()
    or not exists (select 1 from public.match_pairs p where p.id = thread_id) then
    raise exception 'thread unavailable' using errcode = '42501';
  end if;
  insert into public.match_messages (pair_id,sender_id,body)
    values (thread_id,actor,btrim(message_body)) returning id into message_id;
  return message_id;
end;
$$;

create function public.send_match_like(target uuid) returns uuid
language sql security invoker set search_path = '' as $$ select match_private.send_like(target); $$;
create function public.block_match_member(target uuid) returns void
language sql security invoker set search_path = '' as $$ select match_private.block_member(target); $$;
create function public.unblock_match_member(target uuid) returns void
language sql security invoker set search_path = '' as $$ select match_private.unblock_member(target); $$;
create function public.send_match_message(thread_id uuid, message_body text) returns uuid
language sql security invoker set search_path = '' as $$ select match_private.send_message(thread_id,message_body); $$;

revoke all on all functions in schema match_private from public, anon, authenticated;
grant execute on function match_private.can_contact(uuid), match_private.is_verified(),
  match_private.send_like(uuid), match_private.block_member(uuid), match_private.unblock_member(uuid),
  match_private.send_message(uuid,text) to authenticated;
revoke all on function public.send_match_like(uuid), public.block_match_member(uuid),
  public.unblock_match_member(uuid), public.send_match_message(uuid,text) from public, anon, authenticated;
grant execute on function public.send_match_like(uuid), public.block_match_member(uuid),
  public.unblock_match_member(uuid), public.send_match_message(uuid,text) to authenticated;

commit;
