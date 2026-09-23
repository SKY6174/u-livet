-- Included by verify-member-manual-entry.sql with -v chief_roster_extension=1.
do $$begin
  if current_database() not in ('life_chief_roster_test_20260923','life_member_rank_test_20260923') then raise exception 'Isolated chief roster test database required'; end if;
end$$;
-- Reproduce the production condition: own office administrator plus course
-- operation in a different organization, without its SYSTEM_ADMIN permission.
update auth.mfa_amr_claims set updated_at=now() where session_id=md5('session-1')::uuid;
insert into public.life_role_assignments(person_id,org_id,role)
values(md5('member-test-1')::uuid,md5('other-org')::uuid,'COURSE_MANAGER');
set local role authenticated;
select pg_temp.actor(1);
select pg_temp.check_result((public.life_member_directory('office','',1,md5('member-test-1')::uuid)->>'total')::int=1,'chief with another organization appears exactly once');
select pg_temp.check_result((public.life_member_directory('office','',1,md5('member-test-1')::uuid)->'items'->0->>'is_super_admin')::boolean,'chief badge uses trusted operator record');
select pg_temp.check_result(not (public.life_member_directory('office','',1,md5('member-test-1')::uuid)->'items'->0->>'can_manage')::boolean,'read exception does not widen write scope');
select pg_temp.check_result((public.life_member_directory('office','',1)->>'total')::int=4,'office count includes chief consistently');
select pg_temp.check_result((public.life_member_directory('office','member1@example.invalid')->>'total')::int=1,'chief is searchable by registered email');
select pg_temp.check_result((public.life_member_directory('office','',1,md5('member-test-1')::uuid)->'items'->0->>'can_edit')::boolean,'chief may edit own office profile without widening management scope');
select pg_temp.check_result((public.life_member_directory('instructor','',1,md5('member-test-5')::uuid)->>'total')::int=0,'ordinary multi-organization member stays private');
select pg_temp.actor(2);
select pg_temp.check_result((public.life_member_directory('office','',1,md5('member-test-1')::uuid)->>'total')::int=1,'designated office operator can see chief');
select pg_temp.expect_error($cmd$select public.life_delete_member(md5('member-test-1')::uuid,0)$cmd$,'SUPER_ADMIN_PROTECTED');
select pg_temp.actor(4);
select pg_temp.check_result((public.life_member_directory('office','',1,md5('member-test-1')::uuid)->>'total')::int=0,'other organization cannot use chief exception');
reset role;
update public.life_people set active=false where id=md5('member-test-1')::uuid;
set local role authenticated;
select pg_temp.actor(2);
select pg_temp.check_result((public.life_member_directory('office','',1,md5('member-test-1')::uuid)->>'total')::int=0,'inactive chief stays hidden');
reset role;
