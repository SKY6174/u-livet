-- Included by verify-member-manual-entry.sql; synthetic data rolls back.
do $$begin
  if current_database()<>'life_member_rank_test_20260923' then raise exception 'Isolated rank/edit database required'; end if;
end$$;
reset role;
update auth.mfa_amr_claims set updated_at=now() where session_id=md5('session-1')::uuid;
update public.life_people set active=true where id=md5('member-test-1')::uuid;
insert into public.life_role_assignments(person_id,org_id,role)
select md5('member-test-1')::uuid,md5('other-org')::uuid,'COURSE_MANAGER'
where not exists(select 1 from public.life_role_assignments where person_id=md5('member-test-1')::uuid and org_id=md5('other-org')::uuid and role='COURSE_MANAGER');
set local role authenticated;
select pg_temp.actor(1);
select pg_temp.check_result((public.life_member_directory('office','',1,md5('member-test-1')::uuid)->'items'->0->>'can_edit')::boolean,'chief self edit is enabled across organizations');
select public.life_save_member(md5('member-test-1')::uuid,'office','수정한 최고관리자','DIRECTOR',null,'0522300123','+821012345678',null,null,'본인 수정 검증',0);
select pg_temp.check_result(public.life_member_directory('office','',1,md5('member-test-1')::uuid)->'items'->0 @> '{"name":"수정한 최고관리자","office_position":"DIRECTOR","office_phone":"0522300123","mobile_phone":"+821012345678","notes":"본인 수정 검증","revision":1}'::jsonb,'chief edits persist and are returned by directory');
select pg_temp.expect_error($cmd$select public.life_save_member(md5('member-test-1')::uuid,'office','충돌','DIRECTOR',null,null,null,null,null,'',0)$cmd$,'REVISION_CONFLICT');
select pg_temp.expect_error($cmd$select public.life_save_member(md5('member-test-1')::uuid,'instructor','위조',null,'EXTERNAL',null,null,null,null,'',1)$cmd$,'FORBIDDEN');
select pg_temp.expect_error($cmd$select public.life_delete_member(md5('member-test-1')::uuid,1)$cmd$,'SUPER_ADMIN_PROTECTED');
reset role;
select pg_temp.check_result((select name='수정한 최고관리자' from public.user_profiles where id=md5('member-test-1')::uuid),'linked profile name is synchronized');
select pg_temp.check_result((select count(*)=2 from public.life_audit_events where actor_id=md5('member-test-1')::uuid and entity_id=md5('member-test-1')::uuid and action='MEMBER_UPDATED'),'chief edit audited for both affiliations');
select pg_temp.check_result((select count(*)=2 from public.life_role_assignments where person_id=md5('member-test-1')::uuid),'chief edit does not add roles');
update auth.mfa_amr_claims set updated_at=now()-interval '121 minutes' where session_id=md5('session-1')::uuid;
set local role authenticated;
select pg_temp.expect_error($cmd$select public.life_save_member(md5('member-test-1')::uuid,'office','인증 필요','DIRECTOR',null,null,null,null,null,'',1)$cmd$,'MFA_REAUTH_REQUIRED');
reset role;
update auth.mfa_amr_claims set updated_at=now() where session_id=md5('session-1')::uuid;
set local role authenticated;
select pg_temp.actor(2);
select pg_temp.check_result(not (public.life_member_directory('office','',1,md5('member-test-1')::uuid)->'items'->0->>'can_edit')::boolean,'entry operator cannot edit chief');
select pg_temp.expect_error($cmd$select public.life_save_member(md5('member-test-1')::uuid,'office','위조','DIRECTOR',null,null,null,null,null,'',1)$cmd$,'FORBIDDEN');
select pg_temp.actor(4);
select pg_temp.expect_error($cmd$select public.life_save_member(md5('member-test-1')::uuid,'office','위조','DIRECTOR',null,null,null,null,null,'',1)$cmd$,'FORBIDDEN');
reset role;
insert into public.life_role_assignments(person_id,org_id,role) values(md5('member-test-3')::uuid,'10000000-0000-4000-8000-000000000001','SYSTEM_ADMIN');
set local role authenticated;
select pg_temp.actor(3);
select pg_temp.check_result(not (public.life_member_directory('office','',1,md5('member-test-1')::uuid)->'items'->0->>'can_edit')::boolean,'another office admin cannot use self edit exception');
select pg_temp.expect_error($cmd$select public.life_save_member(md5('member-test-1')::uuid,'office','위조','DIRECTOR',null,null,null,null,null,'',1)$cmd$,'FORBIDDEN');
reset role;
select pg_temp.check_result(not has_function_privilege('authenticated','life_private.chief_member_self_edit(uuid,text)','execute') and not has_function_privilege('anon','life_private.chief_member_self_edit(uuid,text)','execute'),'private permission helper cannot be called directly');

-- A name order opposite to the rank order, plus 20 researchers across pages.
insert into public.life_role_assignments(person_id,org_id,role)
select md5('member-test-'||i)::uuid,'10000000-0000-4000-8000-000000000001','COURSE_MANAGER' from generate_series(6,32) i;
update public.life_people p set name=case i
  when 6 then '정렬 하단장' when 7 then '정렬 파본부장' when 8 then '정렬 타센터장'
  when 9 then '정렬 카운영팀장' when 10 then '정렬 차책임연구원' when 11 then '정렬 자선임연구원'
  when 12 then '정렬 나연구원' when 13 then '정렬 가미등록' else '정렬 가연구원'||lpad((33-i)::text,2,'0') end
from generate_series(6,32) i where p.id=md5('member-test-'||i)::uuid;
insert into life_private.account_classifications(person_id,office_position,updated_by)
select md5('member-test-'||i)::uuid,case i when 6 then 'DIRECTOR' when 7 then 'DIVISION_HEAD' when 8 then 'CENTER_HEAD' when 9 then 'OPERATIONS_HEAD' when 10 then 'PRINCIPAL_RESEARCHER' when 11 then 'SENIOR_RESEARCHER' when 13 then null else 'RESEARCHER' end,md5('member-test-1')::uuid
from generate_series(6,32) i on conflict(person_id) do update set office_position=excluded.office_position;
set local role authenticated;
select pg_temp.actor(1);
select pg_temp.check_result((public.life_member_directory('office','정렬',1)->>'total')::int=27,'all ranked matching members counted before paging');
select pg_temp.check_result((select array_agg(item->>'id' order by ordinal) from jsonb_array_elements(public.life_member_directory('office','정렬',1)->'items') with ordinality t(item,ordinal)) =
  (select array_agg(md5('member-test-'||i)::uuid::text order by ord) from (select i,i ord from generate_series(6,11) i union all select i,44-i from generate_series(19,32) i) expected),'page one follows rank then Korean name order');
select pg_temp.check_result((select array_agg(item->>'id' order by ordinal) from jsonb_array_elements(public.life_member_directory('office','정렬',2)->'items') with ordinality t(item,ordinal)) =
  array[md5('member-test-18')::uuid::text,md5('member-test-17')::uuid::text,md5('member-test-16')::uuid::text,md5('member-test-15')::uuid::text,md5('member-test-14')::uuid::text,md5('member-test-12')::uuid::text,md5('member-test-13')::uuid::text],'page two continues name order and puts unregistered rank last');
select pg_temp.check_result((public.life_member_directory('office','가연구원',1)->>'total')::int=19 and public.life_member_directory('office','가연구원',1)->'items'->0->>'name'='정렬 가연구원01','search uses identical rank and name ordering');
select pg_temp.check_result(not (public.life_member_directory('office','정렬',1)->'items'->0 ? 'position_order'),'internal sorting key is not returned');
reset role;
