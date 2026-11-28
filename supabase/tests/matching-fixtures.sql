begin;
insert into public.accounts(id,status,registration_completed,email_verified_at,age_verified_at)
select id,case when email='c-stopped@example.com' then 'suspended' else 'active' end,true,
  email_confirmed_at,case when email<>'c-young@example.com' then now() end
from auth.users where email in (
  'c-alice@example.com','c-bob@example.com','c-premium@example.com','c-support@example.com',
  'c-young@example.com','c-stopped@example.com','c-outsider@example.com','c-reviewer@example.com','c-other-admin@example.com'
);
insert into public.profiles(user_id,nickname,visibility)
select a.id,'架空テスト '||split_part(u.email,'@',1),'public'
from public.accounts a join auth.users u on u.id=a.id where u.email like 'c-%@example.com';
insert into public.entitlements(user_id,feature_code,source)
select id,'daily_likes_20',case when email='c-bob@example.com' then 'gender_policy' else 'subscription' end
from auth.users where email in ('c-bob@example.com','c-premium@example.com','c-support@example.com');

insert into public.admin_roles(code,name) values ('fixture_report_reviewer','架空通報担当'),('fixture_other_admin','架空担当外');
insert into public.admin_permissions(code,description) values ('reports.evidence.read','担当通報の証拠閲覧');
insert into public.admin_role_permissions(role_id,permission_id)
select r.id,p.id from public.admin_roles r cross join public.admin_permissions p
where r.code='fixture_report_reviewer' and p.code='reports.evidence.read';
insert into public.admins(auth_user_id,display_name,role_id,is_active)
select u.id,'架空管理者',r.id,true
from auth.users u join public.admin_roles r on r.code=case when u.email='c-reviewer@example.com'
  then 'fixture_report_reviewer' else 'fixture_other_admin' end
where u.email in ('c-reviewer@example.com','c-other-admin@example.com');
commit;
