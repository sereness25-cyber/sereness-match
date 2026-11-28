begin;

create schema member_private;
revoke all on schema member_private from public, anon, authenticated;

create table public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','active','suspended','banned','withdrawing','withdrawn')),
  registration_completed boolean not null default false,
  email_verified_at timestamptz,
  age_verified_at timestamptz,
  identity_verified_at timestamptz,
  last_login_at timestamptz,
  last_active_at timestamptz,
  terms_version text,
  terms_accepted_at timestamptz,
  privacy_version text,
  privacy_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  withdrawn_at timestamptz
);

create table public.account_private (
  user_id uuid primary key references public.accounts(id) on delete cascade,
  birth_date date,
  legal_name text,
  phone_number text,
  verification_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- This first slice contains only public-capable fields. Add field-specific
-- privacy through a dedicated projection before adding further attributes.
create table public.profiles (
  user_id uuid primary key references public.accounts(id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 30),
  prefecture text check (char_length(prefecture) <= 30),
  bio text not null default '' check (char_length(bio) <= 500),
  visibility text not null default 'private' check (visibility in ('private','public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(id) on delete cascade,
  feature_code text not null,
  source text not null check (source in ('base_plan','subscription','gender_policy','points','campaign','admin')),
  source_id uuid,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  check (expires_at is null or expires_at > starts_at)
);
create index entitlements_owner_idx on public.entitlements(user_id);

create table public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null
);
create table public.admin_permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null
);
create table public.admin_role_permissions (
  role_id uuid references public.admin_roles(id) on delete cascade,
  permission_id uuid references public.admin_permissions(id) on delete cascade,
  primary key (role_id,permission_id)
);
create table public.admins (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  role_id uuid not null references public.admin_roles(id),
  is_active boolean not null default false,
  last_login_at timestamptz
);
create index admins_role_idx on public.admins(role_id);

create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(id) on delete cascade,
  verification_type text not null check (verification_type in ('age','identity')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','resubmit_required')),
  document_type text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.admins(id) on delete restrict,
  rejection_reason text,
  created_at timestamptz not null default now()
);
create index verification_owner_idx on public.verification_requests(user_id);
create unique index verification_one_pending_idx on public.verification_requests(user_id,verification_type)
  where status = 'pending';

create function member_private.active_member(member_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.accounts a join auth.users u on u.id = a.id
    where a.id = member_id and a.status = 'active' and u.email_confirmed_at is not null
  );
$$;
revoke all on function member_private.active_member(uuid) from public, anon, authenticated;
grant execute on function member_private.active_member(uuid) to authenticated;

create function member_private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
revoke all on function member_private.touch_updated_at() from public, anon, authenticated;
create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function member_private.touch_updated_at();

alter table public.accounts enable row level security;
alter table public.account_private enable row level security;
alter table public.profiles enable row level security;
alter table public.entitlements enable row level security;
alter table public.admin_roles enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.admin_role_permissions enable row level security;
alter table public.admins enable row level security;
alter table public.verification_requests enable row level security;

revoke all on public.accounts, public.account_private, public.profiles,
  public.entitlements, public.admin_roles, public.admin_permissions,
  public.admin_role_permissions, public.admins, public.verification_requests from public, anon, authenticated;

grant select on public.accounts, public.profiles,
  public.entitlements, public.admins, public.verification_requests to authenticated;
grant select (user_id,birth_date) on public.account_private to authenticated;
grant update (nickname,prefecture,bio,visibility) on public.profiles to authenticated;

create policy accounts_read_own on public.accounts for select to authenticated
  using (id = (select auth.uid()) and (select member_private.active_member(auth.uid())));
create policy private_read_own on public.account_private for select to authenticated
  using (user_id = (select auth.uid()) and (select member_private.active_member(auth.uid())));
create policy profiles_read on public.profiles for select to authenticated
  using ((select member_private.active_member(auth.uid())) and
    (user_id = (select auth.uid()) or (visibility = 'public' and member_private.active_member(user_id))));
create policy profiles_edit_own on public.profiles for update to authenticated
  using (user_id = (select auth.uid()) and (select member_private.active_member(auth.uid())))
  with check (user_id = (select auth.uid()) and (select member_private.active_member(auth.uid())));
create policy entitlements_read_own on public.entitlements for select to authenticated
  using (user_id = (select auth.uid()) and (select member_private.active_member(auth.uid())));
create policy verification_read_own on public.verification_requests for select to authenticated
  using (user_id = (select auth.uid()) and (select member_private.active_member(auth.uid())));
create policy admin_read_own_assignment on public.admins for select to authenticated
  using (auth_user_id = (select auth.uid()) and is_active and (select member_private.active_member(auth.uid())));

commit;
