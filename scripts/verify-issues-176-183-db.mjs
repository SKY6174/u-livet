// Named local stack only. Every fixture, role, PDF and policy is rolled back.
import { execFileSync } from "node:child_process";
const sql = `begin;
do $$declare candidate record; template public.life_offerings; f uuid; external_person uuid; org uuid;begin
 for candidate in select a.auth_user_id,a.person_id,r.org_id,s.id session_id from public.life_auth_links a join auth.users u on u.id=a.auth_user_id
 join auth.sessions s on s.user_id=u.id join public.life_role_assignments r on r.person_id=a.person_id
 where u.email like '%@example.invalid' and r.role='COURSE_MANAGER' order by s.created_at desc loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',candidate.auth_user_id,'role','authenticated','aal','aal1','session_id',candidate.session_id)::text,true);
  if not life_private.mfa_verified() or not life_private.has_role(candidate.org_id,'COURSE_MANAGER') then continue;end if;
  select * into template from public.life_offerings where org_id=candidate.org_id and name like '[검증용]%' limit 1;
  exit when template.id is not null;
 end loop;
 if template.id is null then raise exception 'NO_SYNTHETIC_MANAGER';end if;
 org:=candidate.org_id;
 insert into public.life_offerings(org_id,project_year_id,course_version_id,name,mode,location,capacity,status,apply_from,apply_until,starts_on,ends_on)
 values(org,template.project_year_id,template.course_version_id,'[검증용] Issues 176–183 rollback','OFFLINE','Local synthetic',20,'PUBLISHED',now()-interval '1 hour',now()+interval '1 day',current_date+2,current_date+3) returning id into f;
 insert into public.life_people(name) values('Synthetic external instructor') returning id into external_person;
 insert into life_private.instructor_pool(org_id,person_id,registration_key,kind,documents_required,created_by,updated_by) values(org,external_person,gen_random_uuid(),'EXTERNAL',true,candidate.person_id,candidate.person_id);
 perform set_config('test.f',f::text,true);perform set_config('test.p',candidate.person_id::text,true);perform set_config('test.org',org::text,true);perform set_config('test.external',external_person::text,true);
end$$;
set local role authenticated;
do $$declare f uuid:=current_setting('test.f')::uuid; p uuid:=current_setting('test.p')::uuid; request_id uuid; key uuid:=gen_random_uuid(); bytes text:=encode(convert_to('%PDF-1.7 synthetic local','UTF8'),'base64'); digest text:=encode(extensions.digest(convert_to('%PDF-1.7 synthetic local','UTF8'),'sha256'),'hex'); board jsonb;begin
 request_id:=public.life_submit_learner_document('APPLICATION',f,key,'Synthetic course','Synthetic learner','01000000000',null,null,bytes,digest);
 if public.life_submit_learner_document('APPLICATION',f,key,'Synthetic course','Synthetic learner','01000000000',null,null,bytes,digest)<>request_id then raise exception 'RETRY_NOT_IDEMPOTENT';end if;
 begin perform public.life_submit_learner_document('APPLICATION',f,gen_random_uuid(),'Synthetic course','Synthetic learner','01000000000',null,null,bytes,digest);raise exception 'EXPECTED_DUPLICATE_REJECTION';exception when raise_exception then if sqlerrm<>'DUPLICATE_APPLICATION' then raise;end if;end;
 board:=public.life_management_applications(f,'','',1);
 if (board->>'count')::int<>1 or board->'items'->0->>'document_id'<>request_id::text or board->'items'->0->>'enrollment_status' is not null then raise exception 'DOCUMENT_APPLICATION_NOT_VISIBLE';end if;
 if (public.life_management_learners(f,'',1)->>'count')::int<>1 then raise exception 'DOCUMENT_LEARNER_NOT_VISIBLE';end if;
 if jsonb_array_length(public.life_management_learner(p)->'applications')<1 then raise exception 'LEARNER_DETAIL_MISSING';end if;
 perform set_config('test.request',request_id::text,true);perform set_config('test.request_key',key::text,true);
 if not exists(select 1 from public.life_instructors(f) where person_id=current_setting('test.external')::uuid) then raise exception 'EXTERNAL_CANDIDATE_MISSING';end if;
 perform public.life_assign_instructor(f,current_setting('test.external')::uuid,true);
 if not exists(select 1 from jsonb_array_elements(public.life_operation_context(f)->'candidates') x where x->>'id'=current_setting('test.external')) then raise exception 'RESPONSIBLE_CANDIDATE_MISSING';end if;
 perform public.life_operation_assign(f,current_setting('test.external')::uuid,0);
 begin perform public.life_assign_instructor(f,current_setting('test.external')::uuid,false);raise exception 'EXPECTED_RESPONSIBLE_GUARD';exception when raise_exception then if sqlerrm<>'RESPONSIBLE_INSTRUCTOR' then raise;end if;end;
 begin perform public.life_configure_course_finance(f,1,0,null,72,'Free');raise exception 'EXPECTED_TERMS_GUARD';exception when raise_exception then if sqlerrm<>'FINANCE_TERMS_LOCKED' then raise;end if;end;
end$$;
reset role;
do $$declare f uuid:=current_setting('test.f')::uuid; p uuid:=current_setting('test.p')::uuid; policy uuid;begin
 insert into public.life_policy_versions(org_id,kind,title,version,body,status,approved_by,approved_at,effective_from)
 values(current_setting('test.org')::uuid,'ENROLLMENT','Synthetic enrollment policy',gen_random_uuid()::text,'Synthetic enrollment policy body for local test','APPROVED',p,now(),now()-interval '1 day') returning id into policy;
 update public.life_offerings set enrollment_policy_id=policy where id=f;
 insert into public.life_applications(offering_id,person_id,status,policy_id) values(f,p,'SUBMITTED',policy);
 update public.life_offerings set apply_until=now() where id=f;
end$$;
set local role authenticated;
do $$declare f uuid:=current_setting('test.f')::uuid; board jsonb; key uuid:=gen_random_uuid();begin
 board:=public.life_management_applications(f,'','',1);
 if (board->>'count')::int<>1 or board->'items'->0->>'document_id'<>current_setting('test.request') or board->'items'->0->>'id'=current_setting('test.request') then raise exception 'APPLICATION_DOUBLE_COUNTED';end if;
 begin perform public.life_submit_learner_document('APPLICATION',f,key,'Synthetic','Synthetic','01000000000',null,null,'JVBERi0xLjc=','0000000000000000000000000000000000000000000000000000000000000000');raise exception 'EXPECTED_CLOSED_REJECTION';exception when raise_exception then if sqlerrm<>'APPLICATION_CLOSED' then raise;end if;end;
 if public.life_submit_learner_document('APPLICATION',f,current_setting('test.request_key')::uuid,'Synthetic','Synthetic','01000000000',null,null,'JVBERi0xLjc=','0000000000000000000000000000000000000000000000000000000000000000')<>current_setting('test.request')::uuid then raise exception 'CLOSED_RETRY_FAILED';end if;
end$$;
reset role;
-- Change the offering, not the original application/document, to test term edits.
do $$declare source public.life_offerings; f uuid;begin
 select * into source from public.life_offerings where id=current_setting('test.f')::uuid;
 insert into public.life_offerings(org_id,project_year_id,course_version_id,name,mode,location,capacity,status,apply_from,apply_until,starts_on,ends_on)
 values(source.org_id,source.project_year_id,source.course_version_id,'[검증용] Finance rollback','OFFLINE','Local',20,'PUBLISHED',now()-interval '1 hour',now()+interval '1 day',current_date+2,current_date+3) returning id into f;
 perform set_config('test.finance',f::text,true);
 insert into public.life_role_assignments(person_id,org_id,role) values(current_setting('test.external')::uuid,source.org_id,'INSTRUCTOR');
 update life_private.instructor_pool set status='INACTIVE' where org_id=source.org_id and person_id=current_setting('test.external')::uuid;
end$$;
set local role authenticated;
do $$declare f uuid:=current_setting('test.finance')::uuid; policy uuid; body text:='Synthetic refund policy written and reviewed locally';begin
 if exists(select 1 from public.life_instructors(f) where person_id=current_setting('test.external')::uuid) then raise exception 'INACTIVE_POOL_VISIBLE';end if;
 policy:=public.life_create_recruitment_policy_draft(current_setting('test.org')::uuid,'REFUND',gen_random_uuid()::text,'Synthetic refund policy',body);
 begin perform public.life_approve_recruitment_policy_draft(policy,'Synthetic refund policy',body);raise exception 'EXPECTED_RULES_GUARD';exception when raise_exception then if sqlerrm<>'REFUND_RULES_REQUIRED' then raise;end if;end;
 perform public.life_approve_refund_policy(policy,'Synthetic refund policy',body,'[{"label":"Before class","basis":"TUITION","numerator":1,"denominator":1}]'::jsonb);
 perform public.life_configure_course_finance(f,1,10000,policy,72,'Synthetic payment instructions');
 begin perform public.life_configure_course_finance(f,1,20000,policy,72,'Changed');raise exception 'EXPECTED_REVISION_GUARD';exception when raise_exception then if sqlerrm<>'REVISION_CHANGED' then raise;end if;end;
 perform public.life_configure_course_finance(f,2,0,null,72,'Free');
 perform set_config('test.refund',policy::text,true);
end$$;
reset role;
do $$begin
 if (select tuition from public.life_offerings where id=current_setting('test.finance')::uuid)<>0 then raise exception 'FREE_TUITION_NOT_SAVED';end if;
 begin update public.life_refund_rules set numerator=0 where policy_id=current_setting('test.refund')::uuid;raise exception 'EXPECTED_IMMUTABLE_RULE';exception when raise_exception then if sqlerrm<>'FINANCE_RECORD_IMMUTABLE' then raise;end if;end;
 if has_function_privilege('authenticated','life_private.management_application_rows()','EXECUTE') or has_function_privilege('anon','public.life_configure_course_finance(uuid,bigint,bigint,uuid,integer,text)','EXECUTE') then raise exception 'EXPOSED_INTERNAL_FUNCTION';end if;
end$$;
-- Direct validator regression: optional legacy fields, integer counts and time order.
do $$declare spec jsonb:=life_private.operation_schema('plan'); c jsonb; ff jsonb; tt jsonb; schedule_row jsonb; f uuid:=current_setting('test.finance')::uuid; policy uuid;begin
 select jsonb_object_agg(x->>'key','') into ff from jsonb_array_elements(spec->'fields') x;
 select jsonb_object_agg(x->>'key','[]'::jsonb) into tt from jsonb_array_elements(spec->'tables') x;
 c:=jsonb_build_object('fields',ff||'{"capacity":"20","completionAttendancePercent":"80"}'::jsonb,'tables',tt,'photos','[]'::jsonb,'signature','');
 if not life_private.operation_content_valid(c,'plan',false) then raise exception 'VALID_EMPTY_PLAN_REJECTED';end if;
 c:=jsonb_set(c,'{tables,recruitment}','[{"category":"일반인","count":"20","ratio":"100"}]'::jsonb);
 if not life_private.operation_content_valid(c,'plan',false) then raise exception 'VALID_RECRUITMENT_REJECTED';end if;
 if life_private.operation_content_valid(jsonb_set(c,'{tables,recruitment,0,count}','"21"'::jsonb),'plan',false) or life_private.operation_content_valid(jsonb_set(c,'{tables,recruitment,0,count}','"1.5"'::jsonb),'plan',false) then raise exception 'INVALID_RECRUITMENT_ALLOWED';end if;
 select jsonb_object_agg(x->>'key','') into schedule_row from jsonb_array_elements((select x->'columns' from jsonb_array_elements(spec->'tables') x where x->>'key'='schedule')) x;
 c:=jsonb_set(c,'{tables,schedule}',jsonb_build_array(schedule_row||'{"startTime":"13:00","endTime":"12:00"}'::jsonb));
 if life_private.operation_content_valid(c,'plan',false) then raise exception 'REVERSED_TIME_ALLOWED';end if;
 select enrollment_policy_id into policy from public.life_offerings where id=current_setting('test.f')::uuid;
 update public.life_offerings set enrollment_policy_id=policy where id=f;
 perform set_config('test.enrollment_policy',policy::text,true);
end$$;
set local role authenticated;
do $$declare f uuid:=current_setting('test.finance')::uuid; a uuid;begin
 a:=public.life_apply(f,current_setting('test.enrollment_policy')::uuid);
 if public.life_apply(f,current_setting('test.enrollment_policy')::uuid)<>a then raise exception 'NATIVE_APPLICATION_DUPLICATE';end if;
 begin perform public.life_management_applications(gen_random_uuid(),'','',1);raise exception 'EXPECTED_CROSS_SCOPE_GUARD';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
end$$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
do $$begin
 begin perform public.life_management_applications(null,'','',1);raise exception 'EXPECTED_ACCESS_GUARD';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 begin perform public.life_instructors(current_setting('test.f')::uuid);raise exception 'EXPECTED_INSTRUCTOR_ACCESS_GUARD';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
end$$;
reset role;
rollback;`;
execFileSync("docker", ["exec", "-i", "supabase_db_uc-life-issues", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
console.log("PASS local RPC: duplicate/retry/deadline; unified document/application/learner views; external/inactive instructors; refund approval/rule immutability; tuition/revision/free-course; access boundaries; ROLLBACK");
