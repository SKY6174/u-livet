begin;

-- This is a data repair against an operator-approved version, not an approval.
do $repair$
declare
  offering public.life_offerings;
  policy public.life_policy_versions;
  expected_org constant uuid := '10000000-0000-4000-8000-000000000001';
  previous_policy constant uuid := 'de334781-f135-4cdc-a85a-f109d4cc0f3f';
  expected_hash constant text := '4f50c98e8553e0f3728d9269cf9eb8047bd052e39f0abbcaec1c58d9b1718bdd';
begin
  select * into offering from public.life_offerings
  where id = 'be13635d-2625-4f81-ab2d-7f30551289d3' for update;
  if offering.id is null then return; end if;
  if offering.org_id <> expected_org or offering.name <> '실버푸드전문가과정' then
    raise exception 'RECRUITMENT_POLICY_COURSE_MISMATCH';
  end if;
  select * into policy from public.life_policy_versions
  where org_id = expected_org and kind = 'ENROLLMENT' and version = 'SILVER-FOOD-2026-10-17-v1'
  for share;
  if policy.id is null or not life_private.policy_valid(policy.id, expected_org, 'ENROLLMENT')
    or policy.title <> '실버푸드전문가과정 모집·개인정보 안내'
    or encode(extensions.digest(convert_to(replace(policy.body, E'\r\n', E'\n'), 'UTF8'), 'sha256'), 'hex') <> expected_hash then
    raise exception 'RECRUITMENT_APPROVED_POLICY_REQUIRED';
  end if;
  if offering.enrollment_policy_id = policy.id then return; end if;
  if offering.enrollment_policy_id is distinct from previous_policy then
    raise exception 'RECRUITMENT_POLICY_LINK_CHANGED';
  end if;
  update public.life_offerings
  set enrollment_policy_id = policy.id, academic_revision = academic_revision + 1
  where id = offering.id;
  insert into public.life_audit_events(org_id, action, entity_id, details)
  values(expected_org, 'POLICY_LINK_CORRECTED', offering.id, jsonb_build_object(
    'migration', '20261017041154_operational_recruitment_notices',
    'previous_policy_id', offering.enrollment_policy_id, 'policy_id', policy.id,
    'version', policy.version, 'body_sha256', expected_hash,
    'academic_revision', offering.academic_revision + 1
  ));
end $repair$;

-- Cover publication RPCs, renames and direct policy assignments. This trigger
-- uses the caller's permissions and exposes no additional public API or grants.
create function life_private.guard_operational_enrollment_policy() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  policy public.life_policy_versions;
  writing_guide constant text := E'신청 자격, 모집기간·정원, 선발 방법과 결과 안내, 취소·문의 경로\n개인정보 처리 주체와 수집·이용 목적, 필요한 항목, 보유·이용기간\n동의를 받는 경우 거부할 권리와 거부 시 불이익; 제3자 제공·선택 동의는 필요한 경우 별도 구분';
begin
  if new.enrollment_policy_id is null or new.name like '[검증용]%' then return new; end if;
  select * into policy from public.life_policy_versions
  where id = new.enrollment_policy_id and kind = 'ENROLLMENT';
  if concat_ws(E'\n', policy.title, policy.version, policy.body)
      ~* '(검증용|issue[[:space:]]*[0-9]+|dummy-[0-9]+|fixture)'
    or btrim(replace(policy.body, E'\r\n', E'\n'), E' \t\r\n') = writing_guide then
    raise exception 'NON_OPERATIONAL_ENROLLMENT_POLICY';
  end if;
  return new;
end $$;
revoke all on function life_private.guard_operational_enrollment_policy()
from public, anon, authenticated, service_role;
create trigger life_operational_enrollment_policy
before insert or update of enrollment_policy_id, name, status on public.life_offerings
for each row execute function life_private.guard_operational_enrollment_policy();

commit;
