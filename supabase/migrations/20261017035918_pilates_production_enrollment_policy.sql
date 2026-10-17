begin;

-- The policy is written and approved through the existing administrator UI.
-- This repair never edits immutable policy text or historical consent evidence.
do $$
declare
  offering public.life_offerings;
  policy public.life_policy_versions;
  expected_org constant uuid := '10000000-0000-4000-8000-000000000001';
  fixture_policy constant uuid := '3f26415b-2099-469d-b25b-3116c674e341';
  expected_hash constant text := '3bed727e88c565648aff1751f42572c78e85099f5bfb50497b088240195f6b76';
begin
  select * into offering from public.life_offerings
  where id = '912a0200-12dc-4649-bd38-fb7c2ee2b9f5' for update;
  -- Fresh Preview databases do not contain this production course.
  if offering.id is null then return; end if;
  if offering.org_id <> expected_org or offering.name <> '산과 필라테스 자격증과정' then
    raise exception 'PILATES_POLICY_COURSE_MISMATCH';
  end if;

  select * into policy from public.life_policy_versions
  where org_id = expected_org and kind = 'ENROLLMENT' and version = 'PILATES-2026-10-17-v1'
  for share;
  if policy.id is null or not life_private.policy_valid(policy.id, expected_org, 'ENROLLMENT')
    or policy.title <> '산과 필라테스 자격증과정 모집·개인정보 안내'
    -- HTML form submission uses CRLF; pin the same text with LF line endings.
    or encode(extensions.digest(convert_to(replace(policy.body, E'\r\n', E'\n'), 'UTF8'), 'sha256'), 'hex') <> expected_hash then
    raise exception 'PILATES_APPROVED_POLICY_REQUIRED';
  end if;
  if offering.enrollment_policy_id = policy.id then return; end if;
  if offering.enrollment_policy_id is distinct from fixture_policy then
    raise exception 'PILATES_POLICY_LINK_CHANGED';
  end if;

  update public.life_offerings
  set enrollment_policy_id = policy.id, academic_revision = academic_revision + 1
  where id = offering.id;
  insert into public.life_audit_events(org_id, action, entity_id, details)
  values(expected_org, 'POLICY_LINK_CORRECTED', offering.id, jsonb_build_object(
    'migration', '20261017035918_pilates_production_enrollment_policy',
    'previous_policy_id', offering.enrollment_policy_id,
    'policy_id', policy.id, 'version', policy.version, 'body_sha256', expected_hash,
    'academic_revision', offering.academic_revision + 1
  ));
end $$;

commit;
