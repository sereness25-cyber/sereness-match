begin;

select set_config('test.alice', (select id::text from auth.users where email='p2-alice@example.com'), true);
select set_config('test.bob', (select id::text from auth.users where email='p2-bob@example.com'), true);
select set_config('test.unverified', (select id::text from auth.users where email='p2-unverified@example.com'), true);
select set_config('test.suspended', (select id::text from auth.users where email='p2-suspended@example.com'), true);
select set_config('test.admin', (select id::text from auth.users where email='p2-admin@example.com'), true);

do $$ begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version='20261128010000') then
    raise exception 'migration missing from ledger';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relrowsecurity and c.relname in
      ('accounts','account_private','profiles','entitlements','verification_requests',
       'admins','admin_roles','admin_permissions','admin_role_permissions')) <> 9 then
    raise exception 'RLS missing';
  end if;
end $$;

set local role anon;
do $$ begin
  begin
    perform 1 from public.account_private;
    raise exception 'anonymous private read allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.alice'), true);
do $$ declare affected int; begin
  update public.profiles set bio='SQL test edit' where user_id=auth.uid();
  get diagnostics affected = row_count;
  if affected <> 1 or not exists (select 1 from public.profiles where user_id=auth.uid() and bio='SQL test edit') then
    raise exception 'owner edit failed';
  end if;
  update public.profiles set bio='forbidden' where user_id=current_setting('test.bob')::uuid;
  if found then raise exception 'other profile edited'; end if;
  if (select count(*) from public.profiles) <> 2 then raise exception 'search visibility incorrect'; end if;
  if (select count(*) from public.account_private) <> 1
    or exists (select 1 from public.account_private where user_id<>auth.uid())
    then raise exception 'private data leaked'; end if;
  if (select count(*) from public.entitlements) <> 1 then raise exception 'entitlement visibility incorrect'; end if;
  begin
    perform legal_name from public.account_private where user_id=auth.uid();
    raise exception 'restricted field readable';
  exception when insufficient_privilege then null; end;
  begin
    update public.accounts set age_verified_at=null where id=auth.uid();
    raise exception 'member updated own verification';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.admins (auth_user_id,display_name,role_id,is_active) values (auth.uid(),'forbidden',gen_random_uuid(),true);
    raise exception 'member self promotion allowed';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub',current_setting('test.bob'),true);
do $$ begin
  if not exists (select 1 from public.profiles where user_id=auth.uid() and bio='') then
    raise exception 'other profile changed';
  end if;
  if exists (select 1 from public.profiles where user_id=current_setting('test.alice')::uuid) then
    raise exception 'private profile leaked';
  end if;
end $$;

select set_config('request.jwt.claim.sub',current_setting('test.unverified'),true);
do $$ begin
  if not exists (select 1 from public.accounts where id=auth.uid() and age_verified_at is null) then
    raise exception 'age fixture incorrect';
  end if;
  update public.profiles set bio='age review pending' where user_id=auth.uid();
  if not found then raise exception 'age-pending member cannot edit profile'; end if;
  begin
    update public.verification_requests set status='approved' where user_id=auth.uid();
    raise exception 'member self approved';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub',current_setting('test.suspended'),true);
do $$ begin
  if exists(select 1 from public.profiles) or exists(select 1 from public.accounts) then
    raise exception 'suspended member can read protected data';
  end if;
  update public.profiles set bio='forbidden' where user_id=auth.uid();
  if found then raise exception 'suspended member can edit profile'; end if;
end $$;

select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$ begin
  if (select count(*) from public.admins where auth_user_id=auth.uid()) <> 1 then
    raise exception 'admin assignment unavailable to its owner';
  end if;
  if exists(select 1 from public.account_private) then raise exception 'admin private data overexposure'; end if;
end $$;
rollback;
