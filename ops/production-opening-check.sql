-- Read-only production-opening evidence. No account identifiers or credentials.
-- Presence of prerequisites does not approve publication or prove a live login.
with target as (
  select id from public.life_organizations
  where id = '10000000-0000-4000-8000-000000000001'::uuid
), eligible as (
  select p.id as person_id,
    exists(select 1 from auth.mfa_factors f where f.user_id = u.id
      and f.factor_type = 'totp' and f.status = 'verified') as totp_enrolled,
    exists(select 1 from life_private.credential_state c where c.user_id = u.id
      and c.policy_version = 1) as credential_policy_satisfied
  from public.life_people p
  join public.life_auth_links l on l.person_id = p.id
  join auth.users u on u.id = l.auth_user_id
  where p.active and u.deleted_at is null and u.email_confirmed_at is not null
    and (u.banned_until is null or u.banned_until <= now())
), roles as (
  select distinct e.person_id, r.role, e.totp_enrolled, e.credential_policy_satisfied
  from eligible e join public.life_role_assignments r on r.person_id = e.person_id
  join target t on t.id = r.org_id
  where r.valid_from <= now() and (r.valid_until is null or r.valid_until > now())
), policies as (
  select p.id, p.kind from public.life_policy_versions p join target t on t.id = p.org_id
  where p.status = 'APPROVED' and p.approved_by is not null and p.approved_at is not null
    and p.effective_from <= now() and (p.effective_until is null or p.effective_until > now())
), offerings as (
  select o.* from public.life_offerings o join target t on t.id = o.org_id
)
select now() as checked_at,
  (select count(*) from target) as target_organizations,
  (select count(*) from eligible) as active_confirmed_accounts,
  (select count(*) from roles where role = 'SYSTEM_ADMIN') as system_admins,
  (select count(*) from roles where role = 'SYSTEM_ADMIN' and totp_enrolled) as system_admins_with_totp,
  (select count(*) from roles where role = 'SYSTEM_ADMIN' and credential_policy_satisfied) as system_admins_with_credential_policy,
  (select count(*) from roles where role = 'COURSE_MANAGER') as course_managers,
  (select count(*) from roles where role = 'COURSE_MANAGER' and totp_enrolled) as course_managers_with_totp,
  (select count(*) from policies where kind = 'ENROLLMENT') as approved_enrollment_policies,
  (select count(*) from policies where kind = 'COMPLETION') as approved_completion_policies,
  (select count(*) from policies where kind = 'REFUND') as approved_refund_policies,
  (select count(*) from public.life_completion_rules r join policies p on p.id = r.policy_id
    where p.kind = 'COMPLETION' and r.approved_by is not null and r.approved_at is not null) as approved_completion_rules,
  (select count(*) from public.life_project_years y join target t on t.id = y.org_id
    where y.starts_on <= current_date and y.ends_on >= current_date) as current_project_years,
  (select count(*) from public.life_courses c join target t on t.id = c.org_id) as courses,
  (select count(*) from offerings where status = 'DRAFT') as draft_offerings,
  (select count(*) from offerings where status = 'PUBLISHED') as published_offerings,
  (select count(*) from offerings where status = 'PUBLISHED'
    and now() between apply_from and apply_until) as accepting_offerings;
