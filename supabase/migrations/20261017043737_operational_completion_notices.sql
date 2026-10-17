begin;

-- Reuse the institution's existing approved 80% policy; preserve every original
-- policy and course version. No calculation rules or approvals are created here.
do $repair$
declare
  offering public.life_offerings;
  previous public.life_course_versions;
  policy public.life_policy_versions;
  replacement uuid;
  expected_org constant uuid := '10000000-0000-4000-8000-000000000001';
  expected_hash constant text := 'b0b615baf781135b4c4cf6e3b7aabe8648ab19d5361ea070b68f3c6b5466e541';
begin
  select * into offering from public.life_offerings
  where id = '912a0200-12dc-4649-bd38-fb7c2ee2b9f5' for update;
  if offering.id is null then return; end if;
  select * into previous from public.life_course_versions
  where id = offering.course_version_id for update;
  if offering.org_id <> expected_org or offering.name <> '산과 필라테스 자격증과정'
    or previous.course_id <> '2ce01bf4-caa7-44a9-8c3a-583d6afa868f' then
    raise exception 'COMPLETION_POLICY_COURSE_MISMATCH';
  end if;
  select * into policy from public.life_policy_versions
  where id = 'd4a18113-93f3-4f7e-8883-c6f1c22e8fab' for share;
  if policy.id is null or not life_private.policy_valid(policy.id, expected_org, 'COMPLETION')
    or policy.title <> '수료기준' or policy.version <> '2026-1'
    or encode(extensions.digest(convert_to(replace(policy.body, E'\r\n', E'\n'), 'UTF8'), 'sha256'), 'hex') <> expected_hash then
    raise exception 'COMPLETION_APPROVED_POLICY_REQUIRED';
  end if;
  if previous.completion_policy_id = policy.id then return; end if;
  if previous.id <> '999d8d43-5f3a-4c81-8825-20f00fc26fd4'
    or previous.status <> 'APPROVED'
    or previous.completion_policy_id is distinct from '7c282a46-94e7-467d-96c0-ab7d70da09d2'::uuid then
    raise exception 'COMPLETION_POLICY_LINK_CHANGED';
  end if;
  if offering.academic_sealed
    or exists(select 1 from public.life_enrollments where offering_id = offering.id)
    or exists(select 1 from public.life_completion_runs where offering_id = offering.id)
    or exists(select 1 from public.life_course_proposal_versions where course_version_id = previous.id) then
    raise exception 'COMPLETION_POLICY_REVIEW_REQUIRED';
  end if;
  perform 1 from public.life_courses where id = previous.course_id for update;
  insert into public.life_course_versions(org_id, course_id, version, summary, curriculum,
    status, completion_policy_id, approved_by)
  select previous.org_id, previous.course_id, coalesce(max(version), 0) + 1,
    previous.summary, previous.curriculum, previous.status, policy.id, previous.approved_by
  from public.life_course_versions where course_id = previous.course_id
  returning id into replacement;
  update public.life_offerings
  set course_version_id = replacement, academic_revision = academic_revision + 1
  where id = offering.id;
  insert into public.life_audit_events(org_id, action, entity_id, details)
  values(expected_org, 'COMPLETION_POLICY_LINK_CORRECTED', offering.id, jsonb_build_object(
    'migration', '20261017043737_operational_completion_notices',
    'previous_course_version_id', previous.id, 'course_version_id', replacement,
    'previous_policy_id', previous.completion_policy_id, 'policy_id', policy.id,
    'version', policy.version, 'body_sha256', expected_hash,
    'academic_revision', offering.academic_revision + 1
  ));
end $repair$;

-- Guard both ways of assigning a policy: switching an offering's version and
-- changing the policy on a version already referenced by a real offering.
create function life_private.guard_operational_completion_policy() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  selected_policy uuid;
  policy public.life_policy_versions;
  writing_guide constant text := E'인정 출석률과 지각·조퇴·결석·보강의 계산 방법\n과제·시험·실습 등 평가 항목별 통과 기준과 재평가·미제출 처리\n최종 판정·이의신청 절차, 수료증 발급 조건과 결과 통지 시점';
begin
  if tg_table_name = 'life_offerings' then
    if new.name like '[검증용]%' then return new; end if;
    select completion_policy_id into selected_policy from public.life_course_versions
    where id = new.course_version_id for share;
  else
    if not exists(select 1 from public.life_offerings
      where course_version_id = new.id and name not like '[검증용]%') then return new; end if;
    selected_policy := new.completion_policy_id;
  end if;
  if selected_policy is null then return new; end if;
  select * into policy from public.life_policy_versions
  where id = selected_policy and kind = 'COMPLETION';
  if concat_ws(E'\n', policy.title, policy.version, policy.body)
      ~* '(검증용|issue[[:space:]]*[0-9]+|dummy-[0-9]+|fixture)'
    or btrim(replace(policy.body, E'\r\n', E'\n'), E' \t\r\n') = writing_guide then
    raise exception 'NON_OPERATIONAL_COMPLETION_POLICY';
  end if;
  return new;
end $$;
revoke all on function life_private.guard_operational_completion_policy()
from public, anon, authenticated, service_role;
create trigger life_operational_completion_offering
before insert or update of course_version_id, name, status on public.life_offerings
for each row execute function life_private.guard_operational_completion_policy();
create trigger life_operational_completion_version
before update of completion_policy_id on public.life_course_versions
for each row execute function life_private.guard_operational_completion_policy();

commit;
