-- One-time authorized production operation, not a migration or automatic seed.
-- Authorization (2026-09-19): 기존 관리자 시범 담당 & 별도 담당자 지정
-- Run only against project uoebygejgglgiivzgyks through the administrative CLI.
-- Grants COURSE_MANAGER to the unique existing SYSTEM_ADMIN of uc-anchor.
-- No user session is fabricated. Existing MFA checks and other roles are retained.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
lock table public.life_role_assignments in share row exclusive mode;
do $$
declare
  target_org constant uuid := '10000000-0000-4000-8000-000000000001';
  operation_key constant text := 'anchor-production-opening-pilot-20260919';
  candidates uuid[];
  target_person uuid;
  target_user uuid;
  assignment_id uuid;
begin
  if auth.uid() is not null then
    raise exception 'ADMINISTRATIVE_OPERATION_ONLY';
  end if;
  if not exists(select 1 from public.life_organizations where id=target_org and slug='uc-anchor') then
    raise exception 'UNEXPECTED_ORGANIZATION';
  end if;
  if exists(select 1 from public.life_audit_events where org_id=target_org
    and action='COURSE_MANAGER_PILOT_GRANTED' and details->>'operation_key'=operation_key) then
    return;
  end if;
  select array_agg(distinct r.person_id) into candidates
  from public.life_role_assignments r
  where r.org_id=target_org and r.role='SYSTEM_ADMIN'
    and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now());
  if coalesce(cardinality(candidates),0)<>1 then
    raise exception 'EXACTLY_ONE_EXISTING_ADMIN_REQUIRED';
  end if;
  target_person := candidates[1];
  select u.id into target_user
  from public.life_people p
  join public.life_auth_links l on l.person_id=p.id
  join auth.users u on u.id=l.auth_user_id
  where p.id=target_person and p.active and u.deleted_at is null
    and u.email_confirmed_at is not null
    and (u.banned_until is null or u.banned_until<=now())
    and exists(select 1 from life_private.credential_state c where c.user_id=u.id and c.policy_version=1)
    and exists(select 1 from auth.mfa_factors f where f.user_id=u.id and f.factor_type='totp' and f.status='verified')
  for update of p,u;
  if target_user is null then
    raise exception 'ACTIVE_CONFIRMED_ADMIN_WITH_MFA_REQUIRED';
  end if;
  if exists(select 1 from public.life_role_assignments where person_id=target_person
    and org_id=target_org and role='COURSE_MANAGER' and (valid_until is null or valid_until>now())) then
    raise exception 'COURSE_MANAGER_ALREADY_ASSIGNED_OR_SCHEDULED';
  end if;
  insert into public.life_role_assignments(person_id,org_id,role,valid_from,valid_until)
  values(target_person,target_org,'COURSE_MANAGER',now(),null)
  returning id into assignment_id;
  insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
  values(target_org,null,'COURSE_MANAGER_PILOT_GRANTED',assignment_id,jsonb_build_object(
    'operation_key',operation_key,
    'authorization_source','explicit_user_instruction',
    'authorization_text','기존 관리자 시범 담당 & 별도 담당자 지정',
    'execution_context','administrative_management_api',
    'database_role',current_user,
    'role','COURSE_MANAGER',
    'purpose','pilot_operations',
    'successor_designation','pending',
    'handover_review_required',true,
    'expiry','not_specified_by_user'));
end $$;
select action,entity_id as assignment_id,created_at,details->>'purpose' as purpose
from public.life_audit_events
where org_id='10000000-0000-4000-8000-000000000001'
  and action='COURSE_MANAGER_PILOT_GRANTED'
  and details->>'operation_key'='anchor-production-opening-pilot-20260919';
commit;
