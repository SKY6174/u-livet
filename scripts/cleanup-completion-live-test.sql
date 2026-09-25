-- Run only after the production review is finished. This removes the isolated
-- [검증용] organization and its synthetic records, not either real course.
begin;

create temp table completion_test_org on commit drop as
select id from public.life_organizations
where slug='uc-anchor-completion-review-test';
create temp table completion_test_offerings on commit drop as
select id from public.life_offerings
where org_id in (select id from completion_test_org);
create temp table completion_test_people on commit drop as
select person_id as id from public.life_applications
where offering_id in (select id from completion_test_offerings)
union
select created_by from public.life_completion_rules
where policy_id in (select id from public.life_policy_versions
                    where org_id in (select id from completion_test_org))
union
select approved_by from public.life_completion_rules
where policy_id in (select id from public.life_policy_versions
                    where org_id in (select id from completion_test_org));

do $guard$
begin
  if (select count(*) from completion_test_org)<>1
     or (select count(*) from completion_test_offerings)<>2 then
    raise exception 'UNEXPECTED_COMPLETION_TEST_SCOPE';
  end if;
end
$guard$;

delete from public.life_completion_approvals
where run_id in (select id from public.life_completion_runs
                 where offering_id in (select id from completion_test_offerings));
delete from public.life_completion_runs
where offering_id in (select id from completion_test_offerings);
delete from public.life_learner_document_requests
where offering_id in (select id from completion_test_offerings);
delete from public.life_attendance
where session_id in (select id from public.life_class_sessions
                     where offering_id in (select id from completion_test_offerings));
delete from public.life_class_sessions
where offering_id in (select id from completion_test_offerings);
delete from public.life_enrollments
where offering_id in (select id from completion_test_offerings);
delete from public.life_applications
where offering_id in (select id from completion_test_offerings);
delete from public.life_audit_events
where org_id in (select id from completion_test_org);
delete from public.life_offerings
where id in (select id from completion_test_offerings);
delete from public.life_course_versions
where org_id in (select id from completion_test_org);
delete from public.life_courses
where org_id in (select id from completion_test_org);

-- Approved policy/rule immutability protects real records. Temporarily suspend
-- only these guards inside this transaction to remove the isolated test rows.
alter table public.life_completion_rules disable trigger life_rules_frozen;
delete from public.life_completion_rules
where policy_id in (select id from public.life_policy_versions
                    where org_id in (select id from completion_test_org));
alter table public.life_completion_rules enable trigger life_rules_frozen;
alter table public.life_policy_versions disable trigger life_policy_freeze;
delete from public.life_policy_versions
where org_id in (select id from completion_test_org);
alter table public.life_policy_versions enable trigger life_policy_freeze;

delete from public.life_role_assignments
where org_id in (select id from completion_test_org);
delete from public.life_project_years
where org_id in (select id from completion_test_org);
delete from public.life_organizations
where id in (select id from completion_test_org);
delete from public.life_people
where id in (select id from completion_test_people)
  and name like '[검증용] %';

commit;
