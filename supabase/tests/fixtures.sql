-- The Auth users are created by the integration runner before this seed.
begin;
insert into public.accounts (id,status,registration_completed,email_verified_at,age_verified_at,identity_verified_at)
select id, case when email = 'p2-suspended@example.com' then 'suspended' else 'active' end,
  true, email_confirmed_at,
  case when email in ('p2-alice@example.com','p2-bob@example.com','p2-suspended@example.com') then now() end,
  case when email = 'p2-alice@example.com' then now() end
from auth.users where email in ('p2-alice@example.com','p2-bob@example.com','p2-unverified@example.com','p2-suspended@example.com','p2-admin@example.com');

insert into public.account_private (user_id,birth_date)
select a.id, DATE '1990-01-01' from public.accounts a join auth.users u on u.id=a.id
where u.email in ('p2-alice@example.com','p2-bob@example.com');
insert into public.profiles (user_id,nickname,prefecture,visibility)
select a.id, case u.email
  when 'p2-alice@example.com' then '会員A' when 'p2-bob@example.com' then '会員B'
  when 'p2-unverified@example.com' then '年齢未確認' when 'p2-suspended@example.com' then '停止会員'
  else 'テスト管理者' end, '秋田県',
  case when u.email in ('p2-bob@example.com','p2-suspended@example.com') then 'public' else 'private' end
from public.accounts a join auth.users u on u.id=a.id;

insert into public.entitlements (user_id,feature_code,source)
select id,'basic_search','base_plan' from auth.users where email in ('p2-alice@example.com','p2-bob@example.com');

insert into public.verification_requests (user_id,verification_type,status)
select id,'age',case when email = 'p2-unverified@example.com' then 'pending' else 'approved' end
from auth.users where email in ('p2-alice@example.com','p2-unverified@example.com');
insert into public.verification_requests (user_id,verification_type,status)
select id,'identity','approved' from auth.users where email='p2-alice@example.com';

insert into public.admin_roles (code,name) values ('verification_manager','審査担当');
insert into public.admin_permissions (code,description) values ('verification.read','審査情報の閲覧候補');
insert into public.admin_role_permissions
select r.id,p.id from public.admin_roles r cross join public.admin_permissions p
where r.code='verification_manager' and p.code='verification.read';
insert into public.admins (auth_user_id,display_name,role_id,is_active)
select u.id,'テスト管理者',r.id,true from auth.users u cross join public.admin_roles r
where u.email='p2-admin@example.com' and r.code='verification_manager';
commit;
