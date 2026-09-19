-- Read-only aggregate inspection for UC-LIFE. No keys, email addresses or names.
-- Run separately against the approved production and preview project refs.
-- DATABASE_PREREQUISITES_PRESENT is NOT permission to open public signup.
with
target as (
  select id from public.life_organizations
  where id = '10000000-0000-4000-8000-000000000001'::uuid
),
policies as (
  select p.id from public.life_policy_versions p join target t on t.id = p.org_id
  where p.kind = 'ACCOUNT_PRIVACY' and p.status = 'APPROVED'
    and p.approved_by is not null and p.approved_at is not null
    and p.effective_from <= now()
    and (p.effective_until is null or p.effective_until > now())
),
eligible as (
  select p.id as person_id, u.id as user_id,
    exists(select 1 from auth.mfa_factors f where f.user_id = u.id
      and f.factor_type = 'totp' and f.status = 'verified') as totp_enrolled
  from public.life_people p
  join public.life_auth_links l on l.person_id = p.id
  join auth.users u on u.id = l.auth_user_id
  join life_private.credential_state c on c.user_id = u.id and c.policy_version = 1
  where p.active and u.deleted_at is null and u.email_confirmed_at is not null
    and (u.banned_until is null or u.banned_until <= now())
),
roles as (
  select distinct e.person_id, r.role, e.totp_enrolled
  from eligible e join public.life_role_assignments r on r.person_id = e.person_id
  join target t on t.id = r.org_id
  where r.valid_from <= now() and (r.valid_until is null or r.valid_until > now())
),
summary as (
  select
    now() as checked_at,
    (select count(*)::int from target) as target_organizations,
    (select count(*)::int from auth.users where deleted_at is null) as auth_accounts,
    (select count(*)::int from policies) as effective_account_privacy,
    (select count(*)::int from roles where role = 'SYSTEM_ADMIN') as system_admins,
    (select count(*)::int from roles where role = 'SYSTEM_ADMIN' and totp_enrolled) as system_admins_with_totp,
    (select count(*)::int from roles where role = 'COURSE_MANAGER') as course_managers,
    (select count(*)::int from roles where role = 'COURSE_MANAGER' and totp_enrolled) as course_managers_with_totp,
    exists(select 1 from pg_trigger t where t.tgrelid = 'auth.users'::regclass
      and t.tgname = 'on_auth_user_created' and t.tgenabled in ('O','A')
      and t.tgfoid = 'public.handle_new_user()'::regprocedure) as signup_trigger_enabled,
    exists(select 1 from pg_trigger t where t.tgrelid = 'public.life_policy_versions'::regclass
      and t.tgname = 'life_policy_freeze' and t.tgenabled in ('O','A')
      and t.tgfoid = 'life_private.freeze_policy()'::regprocedure) as policy_freeze_enabled
)
select *,
  case when target_organizations = 1 and effective_account_privacy = 1
      and system_admins_with_totp > 0 and course_managers_with_totp > 0
      and signup_trigger_enabled and policy_freeze_enabled
    then 'DATABASE_PREREQUISITES_PRESENT' else 'REVIEW_REQUIRED' end as database_status
from summary;
