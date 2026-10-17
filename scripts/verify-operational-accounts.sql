-- Local integration fixture only. Apply prerequisite/current migrations and
-- this file in ONE transaction on supabase_db_uc-life-issues. Always rolls back.
begin;
create temp table member_fixture(actor uuid,staff_user uuid,visible uuid,hidden uuid,foreign_person uuid,real_course uuid,hidden_course uuid,year integer);
grant select on member_fixture to authenticated;
do $$
declare actor uuid; staff_user uuid; org uuid; foreign_org uuid; p uuid;
 visible uuid; hidden uuid; foreign_person uuid:=gen_random_uuid(); real_course uuid:=gen_random_uuid(); hidden_course uuid:=gen_random_uuid();
 seed public.life_offerings; policy uuid; year integer;
begin
 select r.person_id,l.auth_user_id,r.org_id into actor,staff_user,org
 from public.life_role_assignments r join public.life_auth_links l on l.person_id=r.person_id
 where l.auth_user_id='b3ec6670-7950-4a2c-9562-fb266e004dd0' and r.role='COURSE_MANAGER' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()) limit 1;
 if actor is null then raise exception 'LOCAL_MANAGER_FIXTURE_REQUIRED';end if;
 -- Grant admin only inside this rolled-back local fixture.
 insert into public.life_role_assignments(person_id,org_id,role) values(actor,org,'SYSTEM_ADMIN');
 select * into seed from public.life_offerings where org_id=org limit 1;
 select extract(year from starts_on)::int into year from public.life_project_years where id=seed.project_year_id;
 select id into policy from public.life_policy_versions where org_id=org and kind='ENROLLMENT' limit 1;
 select id into foreign_org from public.life_organizations where id<>org limit 1;
 if seed.id is null or policy is null or year not between 2025 and 2029 or foreign_org is null then raise exception 'LOCAL_COURSE_FIXTURE_REQUIRED';end if;
 insert into public.life_offerings select (jsonb_populate_record(null::public.life_offerings,to_jsonb(seed)||jsonb_build_object('id',real_course,'name','member-real-course'))).*;
 insert into public.life_offerings select (jsonb_populate_record(null::public.life_offerings,to_jsonb(seed)||jsonb_build_object('id',hidden_course,'name','member-hidden-course'))).*;
 insert into life_private.non_operational_offerings(offering_id,reason) values(hidden_course,'Local fixture');
 for i in 1..52 loop
  p:=gen_random_uuid();if i=1 then visible:=p;end if;if i=46 then hidden:=p;end if;
  insert into public.life_people(id,name) values(p,case when i<=45 then 'member-visible-' else 'member-hidden-' end||lpad(i::text,2,'0'));
  insert into life_private.manual_members(person_id,org_id,member_group,email,request_id,request_fingerprint,created_by)
  values(p,org,'learner',p||'@example.invalid',gen_random_uuid(),repeat('a',64),actor);
  insert into public.life_applications(offering_id,person_id,policy_id,status) values(real_course,p,policy,'SUBMITTED');
  insert into public.life_enrollments(offering_id,person_id,application_id)
  select real_course,p,id from public.life_applications where offering_id=real_course and person_id=p;
  if i>45 then insert into life_private.non_operational_members(person_id,reason) values(p,'Local fixture');end if;
 end loop;
 -- Mixed history keeps the real person's real course and excludes the hidden course.
 insert into public.life_applications(offering_id,person_id,policy_id,status) values(hidden_course,visible,policy,'SUBMITTED');
 insert into public.life_enrollments(offering_id,person_id,application_id)
 select hidden_course,visible,id from public.life_applications where offering_id=hidden_course and person_id=visible;
 for i in 1..4 loop
  p:=gen_random_uuid();
  insert into public.life_people(id,name) values(p,'member-group-'||i);
  insert into life_private.manual_members(person_id,org_id,member_group,email,request_id,request_fingerprint,created_by)
  values(p,org,case when i<=2 then 'office' else 'instructor' end,p||case when i<=2 then '@uc.ac.kr' else '@example.invalid' end,gen_random_uuid(),repeat('b',64),actor);
  if i>2 then
   insert into life_private.account_classifications(person_id,instructor_kind,updated_by) values(p,'EXTERNAL',actor);
   insert into public.life_offering_instructors(offering_id,person_id) values(real_course,p),(hidden_course,p);
  end if;
  if i in (2,4) then insert into life_private.non_operational_members(person_id,reason) values(p,'Local fixture');end if;
 end loop;
 insert into public.life_people(id,name) values(foreign_person,'member-foreign-person');
 insert into life_private.manual_members(person_id,org_id,member_group,email,request_id,request_fingerprint,created_by)
 values(foreign_person,foreign_org,'learner',foreign_person||'@example.invalid',gen_random_uuid(),repeat('c',64),actor);
 -- A hidden admin retains identity and authorization; this is visibility only.
 insert into life_private.non_operational_members(person_id,reason) values(actor,'Local admin visibility fixture');
 update public.life_people set name='member-renamed-hidden' where id=hidden;
 insert into member_fixture values(actor,staff_user,visible,hidden,foreign_person,real_course,hidden_course,year);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff_user,'role','authenticated','aal','aal2','session_id','1a0d6d22-2dd8-433f-a086-5f932d61d162')::text,true);
 if life_private.person_id() is null then raise exception 'LOCAL_VERIFIED_MANAGER_REQUIRED';end if;
end$$;
create temp table member_preservation as
 select 'people' label,md5(jsonb_agg(to_jsonb(t) order by id)::text) hash from public.life_people t
 union all select 'manual',md5(jsonb_agg(to_jsonb(t) order by person_id)::text) from life_private.manual_members t
 union all select 'applications',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_applications t
 union all select 'enrollments',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_enrollments t
 union all select 'auth',md5(jsonb_agg(to_jsonb(t) order by id)::text) from auth.users t
 union all select 'roles',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_role_assignments t;
set local role authenticated;
do $$
declare f member_fixture; d jsonb; d2 jsonb; d3 jsonb; x jsonb; g text;
begin
 select * into f from member_fixture;
 d:=public.life_member_directory_filtered('learner','member-',1,null,null,'name','asc');
 d2:=public.life_member_directory_filtered('learner','member-',2,null,null,'name','asc');
 d3:=public.life_member_directory_filtered('learner','member-',3,null,null,'name','asc');
 if (d->>'total')::int<>45 or jsonb_array_length(d->'items')<>20 or jsonb_array_length(d2->'items')<>20 or jsonb_array_length(d3->'items')<>5 then raise exception 'PAGINATION_FAILED';end if;
 if exists(select 1 from jsonb_array_elements(d->'items') a join jsonb_array_elements(d2->'items') b on a->>'id'=b->>'id') then raise exception 'PAGE_OVERLAP';end if;
 if d#>>'{items,0,name}'<>'member-visible-01' then raise exception 'SORT_ASC_FAILED';end if;
 x:=public.life_member_directory_filtered('learner','member-',1,null,null,'name','desc');
 if x#>>'{items,0,name}'<>'member-visible-45' then raise exception 'SORT_DESC_FAILED';end if;
 x:=public.life_member_directory_filtered('learner','member-',1,f.year,null,'name','asc');
 if (x->>'total')::int<>45 then raise exception 'YEAR_FILTER_FAILED';end if;
 if exists(select 1 from jsonb_array_elements(d->'items') m cross join jsonb_array_elements(m->'current_courses') c where c->>'id'=f.hidden_course::text) then raise exception 'CURRENT_COURSE_EXPOSED';end if;
 if (d#>>'{counts,learner}')::int<>(public.life_member_directory('learner','',1,null)->>'total')::int then raise exception 'GROUP_COUNTS_FAILED';end if;
 foreach g in array array['office','instructor','learner'] loop
  x:=public.life_member_directory_filtered(g,'member-renamed-hidden',1,null,null,'name','asc');
  if (x->>'total')::int<>0 then raise exception 'HIDDEN_NAME_SEARCH_FAILED';end if;
  x:=public.life_member_directory_filtered(g,'member-group-',1,null,case when g='instructor' then 'EXTERNAL' end,'name','asc');
  if (x->>'total')::int<>(case when g='learner' then 0 else 1 end) then raise exception 'GROUP_KIND_FAILED %',g;end if;
  if g='instructor' then
   x:=public.life_member_directory_filtered(g,'member-group-',1,f.year,'EXTERNAL','name','asc');
   if (x->>'total')::int<>1 then raise exception 'INSTRUCTOR_YEAR_FAILED';end if;
   x:=public.life_member_history((x#>>'{items,0,id}')::uuid,g,1);
   if (x->>'total')::int<>1 or x#>>'{items,0,id}'<>f.real_course::text then raise exception 'TEACHING_HISTORY_FAILED';end if;
  end if;
  x:=public.life_member_excel_export_filtered(g,'member-',null,null,'name','asc');
  if jsonb_array_length(x)<>(case when g='learner' then 45 else 1 end) then raise exception 'FILTERED_EXPORT_FAILED %',g;end if;
  x:=public.life_member_excel_export(g,'member-');
  if jsonb_array_length(x)<>(case when g='learner' then 45 else 1 end) then raise exception 'LEGACY_EXPORT_FAILED %',g;end if;
 end loop;
 x:=public.life_member_directory('learner','',1,f.hidden);
 if jsonb_array_length(x->'items')<>0 then raise exception 'HIDDEN_DETAIL_EXPOSED';end if;
 x:=public.life_member_directory('learner','',1,f.visible);
 if jsonb_array_length(x->'items')<>1 then raise exception 'REAL_DETAIL_LOST';end if;
 x:=public.life_member_history(f.visible,'learner',1);
 if (x->>'total')::int<>1 or x#>>'{items,0,id}'<>f.real_course::text then raise exception 'MIXED_HISTORY_FAILED';end if;
 begin perform public.life_member_history(f.hidden,'learner',1);raise exception 'HIDDEN_HISTORY_EXPOSED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 x:=public.life_member_directory('learner','',1,f.foreign_person);
 if jsonb_array_length(x->'items')<>0 then raise exception 'FOREIGN_DETAIL_EXPOSED';end if;
 begin perform public.life_member_history(f.foreign_person,'learner',1);raise exception 'FOREIGN_HISTORY_EXPOSED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 if life_private.person_id()<>f.actor then raise exception 'HIDDEN_ACTOR_IDENTITY_CHANGED';end if;
 if has_table_privilege(current_user,'life_private.non_operational_members','SELECT') or has_function_privilege(current_user,'life_private.operational_member_scope()','EXECUTE') then raise exception 'PRIVATE_CLASSIFICATION_EXPOSED';end if;
 raise notice 'PASS member groups/counts, pagination 20/20/5, sort/search/year/kind, both exports, direct details/history and unchanged actor authorization';
end$$;
reset role;
do $$
begin
 if exists(select * from member_preservation except (
 select 'people',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_people t
 union all select 'manual',md5(jsonb_agg(to_jsonb(t) order by person_id)::text) from life_private.manual_members t
 union all select 'applications',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_applications t
 union all select 'enrollments',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_enrollments t
 union all select 'auth',md5(jsonb_agg(to_jsonb(t) order by id)::text) from auth.users t
 union all select 'roles',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_role_assignments t)) then raise exception 'ORIGINAL_RECORD_MUTATED';end if;
 raise notice 'PASS original identity/Auth/role/member/course history hash preservation';
end$$;
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
do $$begin
 begin perform public.life_member_directory_filtered('learner','',1,null,null,'name','asc');raise exception 'UNAUTHENTICATED_READ_EXPOSED';exception when raise_exception then if sqlerrm<>'AUTH_REQUIRED' then raise;end if;end;
end$$;
reset role;
-- A verified course manager still lacks account administration privileges.
select set_config('request.jwt.claims',jsonb_build_object('sub','41d6ddcd-af44-49aa-9579-c48231377a2d','role','authenticated','aal','aal2','session_id','d4880b5a-cde3-433f-9457-74a713ad5a3c')::text,true);
set local role authenticated;
do $$begin
 begin perform public.life_member_directory_filtered('learner','',1,null,null,'name','asc');raise exception 'UNAUTHORIZED_READ_EXPOSED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 raise notice 'PASS authenticated user authorization remains enforced';
end$$;
reset role;
set local role anon;
do $$begin
 begin perform public.life_member_directory('learner','',1,null);raise exception 'ANON_READ_EXPOSED';exception when insufficient_privilege then null;end;
 if has_table_privilege(current_user,'life_private.non_operational_members','SELECT') then raise exception 'ANON_CLASSIFICATION_EXPOSED';end if;
 raise notice 'PASS anonymous/private access denied';
end$$;
reset role;
rollback;
