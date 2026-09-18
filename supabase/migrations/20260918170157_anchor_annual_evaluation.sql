begin;
alter table public.life_role_assignments drop constraint life_role_assignments_role_check;
alter table public.life_role_assignments add check(role in ('INSTRUCTOR','COURSE_MANAGER','FINANCE','CERTIFIER','SYSTEM_ADMIN','PERFORMANCE'));
alter table public.life_policy_versions drop constraint life_policy_versions_kind_check;
alter table public.life_policy_versions add check(kind in ('ACCOUNT_PRIVACY','ENROLLMENT','COMPLETION','MARKETING','REFUND','SURVEY'));
create table public.life_performance_grants (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.life_organizations,person_id uuid not null references public.life_people,
 permission text not null check(permission in ('PREPARE','APPROVE')),valid_from timestamptz not null,valid_until timestamptz not null,
 approval_reference text not null check(length(trim(approval_reference))>0),check(valid_until>valid_from)
);
create table public.life_survey_policies (
 policy_id uuid primary key references public.life_policy_versions,min_responses integer not null check(min_responses between 3 and 1000),
 question_version text not null default 'SATISFACTION_V1' check(question_version='SATISFACTION_V1'),approval_reference text not null check(length(trim(approval_reference))>0)
);
create table public.life_survey_rounds (
 id uuid primary key default gen_random_uuid(),offering_id uuid not null unique references public.life_offerings,policy_id uuid not null references public.life_survey_policies,
 min_responses integer not null,question_version text not null,closes_at timestamptz not null,created_at timestamptz not null default now(),created_by uuid not null references public.life_people
);
create table public.life_survey_results (
 round_id uuid primary key references public.life_survey_rounds,summary jsonb not null,
 finalized_by uuid not null references public.life_people,finalized_at timestamptz not null default now()
);
create table life_private.survey_participation (
 round_id uuid not null references public.life_survey_rounds,person_id uuid not null references public.life_people,submitted_at timestamptz,primary key(round_id,person_id)
);
-- No respondent ID, receipt ID or timestamp is attached to the answers.
create table life_private.survey_answers (
 id uuid primary key default gen_random_uuid(),round_id uuid not null references public.life_survey_rounds,
 overall integer not null check(overall between 1 and 5),content integer not null check(content between 1 and 5),usefulness integer not null check(usefulness between 1 and 5)
);
create index life_survey_answers_round on life_private.survey_answers(round_id);
create table public.life_course_feedback (
 offering_id uuid not null references public.life_offerings,person_id uuid not null references public.life_people,
 note text not null check(length(trim(note)) between 1 and 3000),revision integer not null default 1,updated_at timestamptz not null default now(),primary key(offering_id,person_id)
);
create table public.life_course_reviews (
 id uuid primary key default gen_random_uuid(),offering_id uuid not null references public.life_offerings,revision integer not null,
 decision text not null check(decision in ('KEEP','REVISE','MERGE','RETIRE')),summary text not null check(length(trim(summary)) between 1 and 3000),
 created_by uuid not null references public.life_people,created_at timestamptz not null default now(),feedback_snapshot jsonb not null,survey_snapshot jsonb,
 unique(offering_id,revision)
);
create table public.life_improvement_actions (
 id uuid primary key default gen_random_uuid(),review_id uuid not null references public.life_course_reviews,owner_id uuid not null references public.life_people,
 plan text not null check(length(trim(plan)) between 1 and 2000),due_on date not null,
 status text not null default 'OPEN' check(status in ('OPEN','REPORTED','VERIFIED')),revision integer not null default 1,
 target_offering_id uuid references public.life_offerings,evidence_reference text,reported_by uuid references public.life_people,reported_at timestamptz,
 verified_by uuid references public.life_people,verified_at timestamptz,verification_note text,created_by uuid not null references public.life_people,created_at timestamptz not null default now()
);
create table public.life_metric_definitions (
 id uuid primary key default gen_random_uuid(),org_id uuid not null,year_id uuid not null,
 code text not null check(code ~ '^[A-Z][A-Z0-9_]{1,49}$'),version integer not null,
 title text not null check(length(trim(title)) between 1 and 150),unit text not null check(length(trim(unit)) between 1 and 20),
 source text not null check(source in ('ENROLLED_PEOPLE','ENROLLMENTS','COMPLETED_PEOPLE','COMPLETIONS','COMPLETION_RATE','EXTERNAL')),
 formula text not null check(formula in ('COUNT','RATE','DIRECT')),target numeric not null check(target>=0 and target<=1000000000),
 population text not null check(length(trim(population)) between 1 and 2000),dedup_rule text not null check(length(trim(dedup_rule)) between 1 and 2000),
 calculation text not null check(length(trim(calculation)) between 1 and 2000),evidence_requirement text not null check(length(trim(evidence_requirement)) between 1 and 2000),
 status text not null default 'DRAFT' check(status in ('DRAFT','APPROVED')),created_by uuid not null references public.life_people,created_at timestamptz not null default now(),
 approved_by uuid references public.life_people,approved_at timestamptz,approval_reference text,
 foreign key(year_id,org_id) references public.life_project_years(id,org_id),unique(year_id,code,version),
 check(source='EXTERNAL' or (source='COMPLETION_RATE' and formula='RATE') or (source not in ('COMPLETION_RATE','EXTERNAL') and formula='COUNT')),
 check(status<>'APPROVED' or (approved_by is not null and approved_at is not null and length(trim(approval_reference))>0)),check(approved_by is distinct from created_by)
);
create table public.life_metric_observations (
 id uuid primary key default gen_random_uuid(),definition_id uuid not null references public.life_metric_definitions,
 numerator numeric not null check(numerator>=0 and numerator<=1000000000),denominator numeric check(denominator>=0 and denominator<=1000000000),
 unknown_count integer not null check(unknown_count>=0),observed_on date not null,
 source_reference text not null check(length(trim(source_reference)) between 1 and 2000),evidence_reference text not null check(length(trim(evidence_reference)) between 1 and 2000),
 recorded_by uuid not null references public.life_people,recorded_at timestamptz not null default now(),sequence bigint generated always as identity unique
);
create index life_metric_observation_latest on public.life_metric_observations(definition_id,sequence desc);
create table public.life_performance_reports (
 id uuid primary key default gen_random_uuid(),org_id uuid not null,year_id uuid not null,version integer not null,supersedes_id uuid references public.life_performance_reports,
 request_key uuid not null,reason text not null check(length(trim(reason)) between 1 and 2000),snapshot jsonb not null,fingerprint text not null,
 status text not null default 'DRAFT' check(status in ('DRAFT','APPROVED')),created_by uuid not null references public.life_people,created_at timestamptz not null default now(),
 approved_by uuid references public.life_people,approved_at timestamptz,approval_reference text,
 foreign key(year_id,org_id) references public.life_project_years(id,org_id),unique(year_id,version),unique(year_id,created_by,request_key),check(approved_by is distinct from created_by)
);
create table public.life_annual_events (
 id bigint generated always as identity primary key,org_id uuid not null references public.life_organizations,entity_id uuid not null,
 actor_id uuid not null references public.life_people,action text not null,details jsonb not null default '{}',created_at timestamptz not null default now()
);
create function life_private.annual_read(o uuid) returns boolean language sql stable security definer set search_path='' as $$select life_private.has_role(o,'COURSE_MANAGER') or life_private.has_role(o,'PERFORMANCE')$$;
create function life_private.annual_can(o uuid,k text) returns boolean language sql stable security definer set search_path='' as $$
 select life_private.has_role(o,'PERFORMANCE') and exists(select 1 from public.life_performance_grants where org_id=o and person_id=life_private.person_id() and permission=k and valid_from<=now() and valid_until>now())
$$;
create function life_private.annual_lock(y uuid) returns void language sql set search_path='' as $$select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(y::text,27109))$$;
create function life_private.annual_event(o uuid,e uuid,a text,d jsonb default '{}') returns void language sql security definer set search_path='' as $$
 insert into public.life_annual_events(org_id,entity_id,actor_id,action,details) values(o,e,life_private.person_id(),a,d)
$$;
create function life_private.annual_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'IMMUTABLE_RECORD';end $$;
create trigger life_survey_result_frozen before update or delete on public.life_survey_results for each row execute function life_private.annual_immutable();
create trigger life_survey_policy_frozen before update or delete on public.life_survey_policies for each row execute function life_private.annual_immutable();
create trigger life_survey_round_frozen before update or delete on public.life_survey_rounds for each row execute function life_private.annual_immutable();
create trigger life_course_review_frozen before update or delete on public.life_course_reviews for each row execute function life_private.annual_immutable();
create trigger life_metric_observation_frozen before update or delete on public.life_metric_observations for each row execute function life_private.annual_immutable();
create function life_private.annual_approval_frozen() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or old.status='APPROVED' or new.status<>'APPROVED' or (to_jsonb(old)-array['status','approved_by','approved_at','approval_reference']) is distinct from (to_jsonb(new)-array['status','approved_by','approved_at','approval_reference']) then raise exception 'IMMUTABLE_RECORD';end if;
 return new;
end $$;
create trigger life_metric_definition_frozen before update or delete on public.life_metric_definitions for each row execute function life_private.annual_approval_frozen();
create trigger life_performance_report_frozen before update or delete on public.life_performance_reports for each row execute function life_private.annual_approval_frozen();

create function life_private.annual_survey_summary(f uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(final.summary,jsonb_build_object('id',r.id,'closes_at',r.closes_at,'closed',r.closes_at<=now(),'question_version',r.question_version,'min_responses',r.min_responses,
 'invited',(select count(*) from life_private.survey_participation where round_id=r.id),
 'responses',(select count(*) from life_private.survey_answers where round_id=r.id),
 'finalized',false,'released',false,'overall',null,'content',null,'usefulness',null))
 from public.life_survey_rounds r left join public.life_survey_results final on final.round_id=r.id where r.offering_id=f
$$;
create function life_private.annual_finalize_survey(r uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_r public.life_survey_rounds;v_org uuid;v_result jsonb;
begin
 select * into v_r from public.life_survey_rounds where id=r for update;
 if v_r.id is null or not life_private.manages(v_r.offering_id) then raise exception 'FORBIDDEN';end if;
 if v_r.closes_at>clock_timestamp() then raise exception 'SURVEY_NOT_CLOSED';end if;
 if exists(select 1 from public.life_survey_results where round_id=r) then return;end if;
 select jsonb_build_object('id',v_r.id,'closes_at',v_r.closes_at,'closed',true,'question_version',v_r.question_version,'min_responses',v_r.min_responses,
 'invited',(select count(*) from life_private.survey_participation where round_id=r),'responses',count(*),'finalized',true,'released',count(*)>=v_r.min_responses,
 'overall',case when count(*)>=v_r.min_responses then round(avg(overall),2) end,
 'content',case when count(*)>=v_r.min_responses then round(avg(content),2) end,
 'usefulness',case when count(*)>=v_r.min_responses then round(avg(usefulness),2) end) into v_result from life_private.survey_answers where round_id=r;
 insert into public.life_survey_results(round_id,summary,finalized_by) values(r,v_result,life_private.person_id());
 select org_id into v_org from public.life_offerings where id=v_r.offering_id;
 perform life_private.annual_event(v_org,r,'SURVEY_FINALIZED');
end $$;
create function life_private.annual_open_survey(f uuid,policy uuid,closes timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare v_o public.life_offerings;v_p public.life_survey_policies;v_id uuid;
begin
 select * into v_o from public.life_offerings where id=f for update;
 if v_o.id is null or not life_private.manages(f) then raise exception 'FORBIDDEN';end if;
 if v_o.ends_on>=(now() at time zone 'Asia/Seoul')::date then raise exception 'COURSE_NOT_ENDED';end if;
 select * into v_p from public.life_survey_policies where policy_id=policy;
 if v_p.policy_id is null or not life_private.policy_valid(policy,v_o.org_id,'SURVEY') then raise exception 'APPROVED_SURVEY_POLICY_REQUIRED';end if;
 if closes is null or closes<=now() or closes>now()+interval '90 days' then raise exception 'INVALID_SCHEDULE';end if;
 select id into v_id from public.life_survey_rounds where offering_id=f;
 if v_id is not null then raise exception 'SURVEY_ALREADY_EXISTS';end if;
 insert into public.life_survey_rounds(offering_id,policy_id,min_responses,question_version,closes_at,created_by) values(f,policy,v_p.min_responses,v_p.question_version,closes,life_private.person_id()) returning id into v_id;
 insert into life_private.survey_participation(round_id,person_id) select v_id,e.person_id from public.life_enrollments e join public.life_people p on p.id=e.person_id where e.offering_id=f and e.status='ACTIVE' and p.active;
 perform life_private.annual_event(v_o.org_id,v_id,'SURVEY_OPENED');return v_id;
end $$;
create function life_private.annual_answer_survey(r uuid,policy uuid,overall integer,content integer,usefulness integer,confirmed boolean) returns void language plpgsql security definer set search_path='' as $$
declare v_r public.life_survey_rounds;v_o uuid;v_p uuid:=life_private.person_id();v_time timestamptz;
begin
 if v_p is null then raise exception 'AUTH_REQUIRED';end if;
 select * into v_r from public.life_survey_rounds where id=r for update;
 select org_id into v_o from public.life_offerings where id=v_r.offering_id;
 select submitted_at into v_time from life_private.survey_participation where round_id=r and person_id=v_p for update;
 if not found then raise exception 'NOT_INVITED';end if;
 if v_time is not null then return;end if;
 if v_r.closes_at<=clock_timestamp() or exists(select 1 from public.life_survey_results where round_id=r) then raise exception 'SURVEY_CLOSED';end if;
 if policy is distinct from v_r.policy_id or not life_private.policy_valid(policy,v_o,'SURVEY') or confirmed is distinct from true then raise exception 'CONSENT_REQUIRED';end if;
 if overall is null or content is null or usefulness is null or overall not between 1 and 5 or content not between 1 and 5 or usefulness not between 1 and 5 then raise exception 'INVALID_RATING';end if;
 insert into life_private.survey_answers(round_id,overall,content,usefulness) values(r,overall,content,usefulness);
 update life_private.survey_participation set submitted_at=now() where round_id=r and person_id=v_p;
 -- Participation and ratings are not linked in an audit payload.
end $$;
create function life_private.annual_my_surveys() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if life_private.person_id() is null then raise exception 'AUTH_REQUIRED';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',o.name,'closes_at',r.closes_at,'closed',r.closes_at<=now(),'submitted_at',p.submitted_at,'policy_id',v.id,'policy_title',v.title,'policy_version',v.version,'policy_body',v.body,'policy_valid',life_private.policy_valid(v.id,o.org_id,'SURVEY'),'min_responses',r.min_responses) order by r.created_at desc) from life_private.survey_participation p join public.life_survey_rounds r on r.id=p.round_id join public.life_offerings o on o.id=r.offering_id join public.life_policy_versions v on v.id=r.policy_id where p.person_id=life_private.person_id()),'[]'::jsonb);
end $$;
create function life_private.annual_quality_feedback(f uuid,note text,revision integer) returns void language plpgsql security definer set search_path='' as $$
declare v_o public.life_offerings;v_rev integer;
begin
 select * into v_o from public.life_offerings where id=f for update;
 if v_o.id is null or not life_private.teaches(f) then raise exception 'FORBIDDEN';end if;
 if v_o.ends_on>=(now() at time zone 'Asia/Seoul')::date then raise exception 'COURSE_NOT_ENDED';end if;
 select x.revision into v_rev from public.life_course_feedback x where offering_id=f and person_id=life_private.person_id();
 if coalesce(v_rev,0) is distinct from revision then raise exception 'REVISION_CHANGED';end if;
 insert into public.life_course_feedback(offering_id,person_id,note) values(f,life_private.person_id(),note) on conflict(offering_id,person_id) do update set note=excluded.note,revision=public.life_course_feedback.revision+1,updated_at=now();
 perform life_private.annual_event(v_o.org_id,f,'INSTRUCTOR_FEEDBACK');
end $$;
create function life_private.annual_review_course(f uuid,decision text,summary text,revision integer) returns uuid language plpgsql security definer set search_path='' as $$
declare v_o public.life_offerings;v_rev integer;v_id uuid;
begin
 select * into v_o from public.life_offerings where id=f for update;
 if v_o.id is null or not life_private.manages(f) then raise exception 'FORBIDDEN';end if;
 if v_o.ends_on>=(now() at time zone 'Asia/Seoul')::date then raise exception 'COURSE_NOT_ENDED';end if;
 select coalesce(max(x.revision),0) into v_rev from public.life_course_reviews x where offering_id=f;
 if v_rev is distinct from revision then raise exception 'REVISION_CHANGED';end if;
 insert into public.life_course_reviews(offering_id,revision,decision,summary,created_by,feedback_snapshot,survey_snapshot)
 values(f,v_rev+1,decision,summary,life_private.person_id(),coalesce((select jsonb_agg(to_jsonb(x) order by person_id) from public.life_course_feedback x where offering_id=f),'[]'::jsonb),life_private.annual_survey_summary(f)) returning id into v_id;
 perform life_private.annual_event(v_o.org_id,v_id,'COURSE_REVIEWED');return v_id;
end $$;
create function life_private.annual_owner_valid(f uuid,p uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.life_offerings o join public.life_role_assignments a on a.org_id=o.org_id join public.life_people pp on pp.id=a.person_id join public.life_auth_links al on al.person_id=pp.id where o.id=f and a.person_id=p and pp.active and al.auth_user_id is not null and a.valid_from<=now() and (a.valid_until is null or a.valid_until>now()) and (a.role='COURSE_MANAGER' or (a.role='INSTRUCTOR' and exists(select 1 from public.life_offering_instructors i where i.offering_id=f and i.person_id=p and (i.valid_until is null or i.valid_until>now())))))
$$;
create function life_private.annual_add_improvement(r uuid,owner uuid,plan text,due date) returns uuid language plpgsql security definer set search_path='' as $$
declare v_f uuid;v_o uuid;v_id uuid;
begin
 select x.offering_id,o.org_id into v_f,v_o from public.life_course_reviews x join public.life_offerings o on o.id=x.offering_id where x.id=r;
 if v_f is null or not life_private.manages(v_f) then raise exception 'FORBIDDEN';end if;
 if not life_private.annual_owner_valid(v_f,owner) then raise exception 'INVALID_OWNER';end if;
 if due is null or due<(now() at time zone 'Asia/Seoul')::date or due>(now() at time zone 'Asia/Seoul')::date+730 then raise exception 'INVALID_DEADLINE';end if;
 insert into public.life_improvement_actions(review_id,owner_id,plan,due_on,created_by) values(r,owner,plan,due,life_private.person_id()) returning id into v_id;
 perform life_private.annual_event(v_o,v_id,'IMPROVEMENT_CREATED');return v_id;
end $$;
create function life_private.annual_report_improvement(i uuid,target uuid,evidence text,revision integer) returns void language plpgsql security definer set search_path='' as $$
declare v_i public.life_improvement_actions;v_o public.life_offerings;
begin
 select * into v_i from public.life_improvement_actions where id=i for update;
 select o.* into v_o from public.life_offerings o join public.life_course_reviews r on r.offering_id=o.id where r.id=v_i.review_id;
 if v_i.id is null or v_i.owner_id is distinct from life_private.person_id() or not life_private.annual_owner_valid(v_o.id,v_i.owner_id) then raise exception 'FORBIDDEN';end if;
 if v_i.revision is distinct from revision then raise exception 'REVISION_CHANGED';end if;
 if v_i.status<>'OPEN' then raise exception 'INVALID_TRANSITION';end if;
 if not exists(select 1 from public.life_offerings where id=target and org_id=v_o.org_id and starts_on>v_o.ends_on and status in ('PUBLISHED','CLOSED')) then raise exception 'INVALID_NEXT_OFFERING';end if;
 if coalesce(length(trim(evidence)),0) not between 1 and 2000 then raise exception 'EVIDENCE_REQUIRED';end if;
 update public.life_improvement_actions set status='REPORTED',revision=life_improvement_actions.revision+1,target_offering_id=target,evidence_reference=evidence,reported_by=life_private.person_id(),reported_at=now() where id=i;
 perform life_private.annual_event(v_o.org_id,i,'IMPROVEMENT_REPORTED');
end $$;
create function life_private.annual_verify_improvement(i uuid,note text,revision integer) returns void language plpgsql security definer set search_path='' as $$
declare v_i public.life_improvement_actions;v_o public.life_offerings;
begin
 select * into v_i from public.life_improvement_actions where id=i for update;
 select o.* into v_o from public.life_offerings o join public.life_course_reviews r on r.offering_id=o.id where r.id=v_i.review_id;
 if v_i.id is null or not life_private.manages(v_o.id) then raise exception 'FORBIDDEN';end if;
 if v_i.owner_id=life_private.person_id() or v_i.reported_by=life_private.person_id() then raise exception 'SELF_APPROVAL_FORBIDDEN';end if;
 if v_i.revision is distinct from revision then raise exception 'REVISION_CHANGED';end if;
 if v_i.status<>'REPORTED' then raise exception 'INVALID_TRANSITION';end if;
 if coalesce(length(trim(note)),0) not between 1 and 2000 then raise exception 'EVIDENCE_REQUIRED';end if;
 update public.life_improvement_actions set status='VERIFIED',revision=life_improvement_actions.revision+1,verified_by=life_private.person_id(),verified_at=now(),verification_note=note where id=i;
 perform life_private.annual_event(v_o.org_id,i,'IMPROVEMENT_VERIFIED');
end $$;

create function life_private.annual_facts(y uuid,a text default null) returns jsonb language sql stable security definer set search_path='' as $$
 with cohort as (
 select o.*,c.academy,c.id course_id,v.completion_policy_id,py.starts_on year_start,py.ends_on year_end
 from public.life_offerings o join public.life_course_versions v on v.id=o.course_version_id join public.life_courses c on c.id=v.course_id join public.life_project_years py on py.id=o.project_year_id
 where o.project_year_id=y and (a is null or c.academy=a)
 ), enrollment as (
 select e.*,r.id run_id,r.input_revision,r.outcome,r.evidence->>'policy_id' run_policy,ca.approved_at,
 coalesce(e.status='ACTIVE' and r.outcome='READY' and ca.run_id is not null and r.input_revision=o.academic_revision and o.academic_sealed and (r.evidence->>'policy_id')::uuid=o.completion_policy_id and life_private.policy_valid(o.completion_policy_id,o.org_id,'COMPLETION'),false) completed,
 e.status='ACTIVE' and o.ends_on<(now() at time zone 'Asia/Seoul')::date and (r.id is null or r.input_revision<>o.academic_revision or r.outcome='NEEDS_REVIEW' or (r.outcome='READY' and ca.run_id is null)) unresolved,
 exists(select 1 from public.life_completion_runs hr join public.life_completion_approvals ha on ha.run_id=hr.id where hr.enrollment_id=e.id) previously_approved
 from public.life_enrollments e join cohort o on o.id=e.offering_id left join lateral(select * from public.life_completion_runs rr where rr.enrollment_id=e.id order by rr.calculated_at desc,rr.id desc limit 1)r on true left join public.life_completion_approvals ca on ca.run_id=r.id
 ), quality as (
 select o.id,life_private.annual_survey_summary(o.id) survey,
 (select jsonb_build_object('id',r.id,'revision',r.revision,'decision',r.decision,'summary',r.summary,'created_at',r.created_at) from public.life_course_reviews r where r.offering_id=o.id order by r.revision desc limit 1) review,
 (select count(*) from public.life_improvement_actions i join public.life_course_reviews r on r.id=i.review_id where r.offering_id=o.id and i.status<>'VERIFIED') improvements_open,
 (select count(*) from public.life_improvement_actions i join public.life_course_reviews r on r.id=i.review_id where r.offering_id=o.id and i.status<>'VERIFIED' and i.due_on<(now() at time zone 'Asia/Seoul')::date) improvements_overdue
 from cohort o
 ), totals as (
 select jsonb_build_object('offerings',(select count(*) from cohort where status<>'DRAFT'),'planned_offerings',(select count(*) from cohort where status='DRAFT'),
 'course_origins',(select count(distinct course_id) from cohort where status<>'DRAFT'),
 'applications',(select count(*) from public.life_applications ap join cohort o on o.id=ap.offering_id),
 'enrolled_people',count(distinct person_id),'enrollments',count(*),'active',count(*) filter(where status='ACTIVE'),'withdrawn',count(*) filter(where status='WITHDRAWN'),
 'completed_people',count(distinct person_id) filter(where completed),'completions',count(*) filter(where completed),'completion_rate',round(100.0*count(*) filter(where completed)/nullif(count(*),0),2),
 'completion_review',count(*) filter(where unresolved or (previously_approved and not completed)),
 'unresolved',count(*) filter(where unresolved),'stale_completions',count(*) filter(where previously_approved and not completed),
 'boundary_issues',(select count(*) from cohort where status<>'DRAFT' and (starts_on<year_start or ends_on>year_end)),
 'improvements_open',(select coalesce(sum(improvements_open),0) from quality),'improvements_overdue',(select coalesce(sum(improvements_overdue),0) from quality)) value from enrollment
 ), rows as (
 select o.id,o.name,o.academy,o.status,o.starts_on,o.ends_on,o.academic_revision,
 (select count(*) from enrollment e where e.offering_id=o.id) enrollments,
 (select count(*) from enrollment e where e.offering_id=o.id and completed) completions,q.survey,q.review,q.improvements_open,q.improvements_overdue
 from cohort o join quality q on q.id=o.id
 ), proof as (
 select jsonb_build_object('offerings',coalesce((select jsonb_agg(to_jsonb(o) order by id) from cohort o),'[]'::jsonb),
 'enrollments',coalesce((select jsonb_agg(to_jsonb(e) order by id) from enrollment e),'[]'::jsonb),
 'applications',coalesce((select jsonb_agg(to_jsonb(ap) order by ap.id) from public.life_applications ap join cohort o on o.id=ap.offering_id),'[]'::jsonb),
 'quality',coalesce((select jsonb_agg(to_jsonb(q) order by id) from quality q),'[]'::jsonb),
 'actions',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.life_improvement_actions i join public.life_course_reviews r on r.id=i.review_id join cohort o on o.id=r.offering_id),'[]'::jsonb)) value
 ) select jsonb_build_object('query_version','COHORT_CURRENT_V1','totals',totals.value,'offerings',coalesce((select jsonb_agg(to_jsonb(r) order by starts_on,id) from rows r),'[]'::jsonb),'fingerprint',encode(extensions.digest(convert_to(proof.value::text,'UTF8'),'sha256'),'hex')) from totals,proof
$$;
create function life_private.annual_create_metric(y uuid,d jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_org uuid;v_id uuid;v_version integer;
begin
 select org_id into v_org from public.life_project_years where id=y;
 if v_org is null or not life_private.annual_can(v_org,'PREPARE') then raise exception 'FORBIDDEN';end if;
 if jsonb_typeof(d) is distinct from 'object' then raise exception 'INVALID_INPUT';end if;
 perform life_private.annual_lock(y);
 select coalesce(max(version),0)+1 into v_version from public.life_metric_definitions where year_id=y and code=d->>'code';
 insert into public.life_metric_definitions(org_id,year_id,code,version,title,unit,source,formula,target,population,dedup_rule,calculation,evidence_requirement,created_by)
 values(v_org,y,d->>'code',v_version,d->>'title',d->>'unit',d->>'source',d->>'formula',(d->>'target')::numeric,d->>'population',d->>'dedup_rule',d->>'calculation',d->>'evidence_requirement',life_private.person_id()) returning id into v_id;
 perform life_private.annual_event(v_org,v_id,'METRIC_DRAFTED');return v_id;
end $$;
create function life_private.annual_approve_metric(m uuid,reference text) returns void language plpgsql security definer set search_path='' as $$
declare v_m public.life_metric_definitions;
begin
 select * into v_m from public.life_metric_definitions where id=m for update;
 if v_m.id is null or not life_private.annual_can(v_m.org_id,'APPROVE') then raise exception 'FORBIDDEN';end if;
 if v_m.created_by=life_private.person_id() then raise exception 'SELF_APPROVAL_FORBIDDEN';end if;
 if coalesce(length(trim(reference)),0) not between 1 and 2000 then raise exception 'EVIDENCE_REQUIRED';end if;
 if exists(select 1 from public.life_metric_definitions where year_id=v_m.year_id and code=v_m.code and version>v_m.version) then raise exception 'REVISION_CHANGED';end if;
 if v_m.status='APPROVED' then return;end if;
 update public.life_metric_definitions set status='APPROVED',approved_by=life_private.person_id(),approved_at=now(),approval_reference=reference where id=m;
 perform life_private.annual_event(v_m.org_id,m,'METRIC_APPROVED');
end $$;
create function life_private.annual_record_metric(m uuid,n numeric,d numeric,unknown_count integer,observed date,source_ref text,evidence text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_m public.life_metric_definitions;v_y public.life_project_years;v_id uuid;
begin
 select * into v_m from public.life_metric_definitions where id=m;
 if v_m.id is null or not life_private.annual_can(v_m.org_id,'PREPARE') then raise exception 'FORBIDDEN';end if;
 if v_m.status<>'APPROVED' or v_m.source<>'EXTERNAL' or exists(select 1 from public.life_metric_definitions where year_id=v_m.year_id and code=v_m.code and version>v_m.version) then raise exception 'APPROVED_EXTERNAL_METRIC_REQUIRED';end if;
 select * into v_y from public.life_project_years where id=v_m.year_id;
 if observed is null or observed<v_y.starts_on or observed>v_y.ends_on or observed>(now() at time zone 'Asia/Seoul')::date then raise exception 'INVALID_OBSERVATION_DATE';end if;
 if v_m.formula='RATE' and (d is null or n+unknown_count>d) then raise exception 'INVALID_DENOMINATOR';end if;
 if v_m.formula<>'RATE' and d is not null then raise exception 'INVALID_DENOMINATOR';end if;
 if v_m.formula='COUNT' and n<>trunc(n) then raise exception 'INVALID_INPUT';end if;
 insert into public.life_metric_observations(definition_id,numerator,denominator,unknown_count,observed_on,source_reference,evidence_reference,recorded_by) values(m,n,d,unknown_count,observed,source_ref,evidence,life_private.person_id()) returning id into v_id;
 perform life_private.annual_event(v_m.org_id,v_id,'METRIC_OBSERVED');return v_id;
end $$;
create function life_private.annual_metric_rows(y uuid,facts jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_m public.life_metric_definitions;v_ob public.life_metric_observations;v_n numeric;v_d numeric;v_value numeric;v_unknown integer;v_reason text;v_result jsonb:='[]'::jsonb;v_totals jsonb:=facts->'totals';
begin
 for v_m in select distinct on (code) * from public.life_metric_definitions where year_id=y order by code,version desc loop
   v_ob:=null;v_n:=null;v_d:=null;v_unknown:=0;v_reason:=null;
   if v_m.source='EXTERNAL' then
     select * into v_ob from public.life_metric_observations where definition_id=v_m.id order by sequence desc limit 1;
     v_n:=v_ob.numerator;v_d:=v_ob.denominator;v_unknown:=v_ob.unknown_count;
     if v_ob.id is null then v_reason:='MISSING_SOURCE';elsif v_unknown>0 then v_reason:='UNCONFIRMED_SOURCE';end if;
   else
     v_n:=(v_totals->>case v_m.source when 'ENROLLED_PEOPLE' then 'enrolled_people' when 'ENROLLMENTS' then 'enrollments' when 'COMPLETED_PEOPLE' then 'completed_people' else 'completions' end)::numeric;
     if v_m.source='COMPLETION_RATE' then v_d:=(v_totals->>'enrollments')::numeric;end if;
     if (v_totals->>'boundary_issues')::integer>0 then v_reason:='YEAR_BOUNDARY_REVIEW';end if;
     if v_m.source in ('COMPLETED_PEOPLE','COMPLETIONS','COMPLETION_RATE') then
       v_unknown:=(v_totals->>'completion_review')::integer;
       if v_unknown>0 then v_reason:='COMPLETION_REVIEW';end if;
     end if;
   end if;
   v_value:=case when v_m.formula='RATE' then round(100*v_n/nullif(v_d,0),2) else v_n end;
   if v_value is null and v_reason is null then v_reason:='NO_DENOMINATOR';end if;
   if v_m.status<>'APPROVED' then v_reason:='DEFINITION_UNAPPROVED';end if;
   v_result:=v_result||jsonb_build_array(jsonb_build_object('definition',to_jsonb(v_m),'observation',case when v_ob.id is not null then to_jsonb(v_ob) end,'numerator',v_n,'denominator',v_d,'unknown_count',v_unknown,'value',v_value,'blocker',v_reason));
 end loop;return v_result;
end $$;
create function life_private.annual_frame(y uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_facts jsonb;v_data jsonb;
begin
 v_facts:=life_private.annual_facts(y);
 v_data:=jsonb_build_object('year',(select to_jsonb(py) from public.life_project_years py where id=y),'query_version','COHORT_CURRENT_V1','facts',v_facts,'metrics',life_private.annual_metric_rows(y,v_facts));
 return jsonb_build_object('snapshot',v_data,'fingerprint',encode(extensions.digest(convert_to(v_data::text,'UTF8'),'sha256'),'hex'));
end $$;
create function life_private.annual_create_report(y uuid,request_key uuid,reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_org uuid;v_frame jsonb;v_version integer;v_parent uuid;v_id uuid;v_old public.life_performance_reports;
begin
 select org_id into v_org from public.life_project_years where id=y;
 if v_org is null or not life_private.annual_can(v_org,'PREPARE') then raise exception 'FORBIDDEN';end if;
 perform life_private.annual_lock(y);
 select * into v_old from public.life_performance_reports where year_id=y and created_by=life_private.person_id() and life_performance_reports.request_key=annual_create_report.request_key;
 if v_old.id is not null then if v_old.reason is distinct from reason then raise exception 'IDEMPOTENCY_CONFLICT';end if;return v_old.id;end if;
 v_frame:=life_private.annual_frame(y);
 if jsonb_array_length(v_frame->'snapshot'->'metrics')=0 then raise exception 'METRICS_REQUIRED';end if;
 select coalesce(max(version),0)+1 into v_version from public.life_performance_reports where year_id=y;
 select id into v_parent from public.life_performance_reports where year_id=y and status='APPROVED' order by version desc limit 1;
 insert into public.life_performance_reports(org_id,year_id,version,supersedes_id,request_key,reason,snapshot,fingerprint,created_by) values(v_org,y,v_version,v_parent,request_key,reason,v_frame->'snapshot',v_frame->>'fingerprint',life_private.person_id()) returning id into v_id;
 perform life_private.annual_event(v_org,v_id,'REPORT_DRAFTED');return v_id;
end $$;
create function life_private.annual_approve_report(r uuid,reference text) returns void language plpgsql security definer set search_path='' as $$
declare v_r public.life_performance_reports;v_current jsonb;v_parent uuid;
begin
 select * into v_r from public.life_performance_reports where id=r;
 if v_r.id is null or not life_private.annual_can(v_r.org_id,'APPROVE') then raise exception 'FORBIDDEN';end if;
 perform life_private.annual_lock(v_r.year_id);
 select * into v_r from public.life_performance_reports where id=r;
 if v_r.created_by=life_private.person_id() then raise exception 'SELF_APPROVAL_FORBIDDEN';end if;
 if v_r.status='APPROVED' then return;end if;
 if coalesce(length(trim(reference)),0) not between 1 and 2000 then raise exception 'EVIDENCE_REQUIRED';end if;
 select id into v_parent from public.life_performance_reports where year_id=v_r.year_id and status='APPROVED' order by version desc limit 1;
 if v_parent is distinct from v_r.supersedes_id then raise exception 'REPORT_PARENT_CHANGED';end if;
 v_current:=life_private.annual_frame(v_r.year_id);
 if v_current->>'fingerprint'<>v_r.fingerprint then raise exception 'REPORT_SOURCE_CHANGED';end if;
 if exists(select 1 from jsonb_array_elements(v_r.snapshot->'metrics') m where m->>'blocker' is not null) then raise exception 'REPORT_NOT_READY';end if;
 if exists(select 1 from jsonb_array_elements(v_r.snapshot->'metrics') m where m->'observation'->>'recorded_by'=life_private.person_id()::text) then raise exception 'SELF_APPROVAL_FORBIDDEN';end if;
 update public.life_performance_reports set status='APPROVED',approved_by=life_private.person_id(),approved_at=now(),approval_reference=reference where id=r;
 perform life_private.annual_event(v_r.org_id,r,'REPORT_APPROVED');
end $$;

create function life_private.annual_quality_board(f uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_o public.life_offerings;v_manager boolean;v_staff boolean;
begin
 select * into v_o from public.life_offerings where id=f;
 v_manager:=life_private.manages(f);v_staff:=life_private.annual_read(v_o.org_id);
 if v_o.id is null or not (v_staff or life_private.teaches(f)) then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object('offering',jsonb_build_object('id',v_o.id,'name',v_o.name,'year_id',v_o.project_year_id,'ends_on',v_o.ends_on),'manager',v_manager,'teacher',life_private.teaches(f),
 'survey',life_private.annual_survey_summary(f),
 'survey_policies',case when v_manager then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'version',p.version,'body',p.body,'min_responses',sp.min_responses)) from public.life_policy_versions p join public.life_survey_policies sp on sp.policy_id=p.id where life_private.policy_valid(p.id,v_o.org_id,'SURVEY')),'[]'::jsonb) else '[]'::jsonb end,
 'feedback',coalesce((select jsonb_agg(jsonb_build_object('person_id',fb.person_id,'name',p.name,'note',fb.note,'revision',fb.revision,'updated_at',fb.updated_at) order by fb.person_id) from public.life_course_feedback fb join public.life_people p on p.id=fb.person_id where fb.offering_id=f and (v_staff or fb.person_id=life_private.person_id())),'[]'::jsonb),
 'reviews',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'revision',r.revision,'decision',r.decision,'summary',r.summary,'created_at',r.created_at,'survey_snapshot',r.survey_snapshot) order by r.revision desc) from public.life_course_reviews r where offering_id=f),'[]'::jsonb),
 'improvements',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('owner_name',p.name,'target_name',t.name) order by i.created_at) from public.life_improvement_actions i join public.life_course_reviews r on r.id=i.review_id join public.life_people p on p.id=i.owner_id left join public.life_offerings t on t.id=i.target_offering_id where r.offering_id=f and (v_staff or i.owner_id=life_private.person_id())),'[]'::jsonb),
 'owners',case when v_manager then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name) from public.life_people p where life_private.annual_owner_valid(f,p.id)),'[]'::jsonb) else '[]'::jsonb end,
 'targets',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.starts_on) from public.life_offerings o where org_id=v_o.org_id and starts_on>v_o.ends_on and status in ('PUBLISHED','CLOSED')),'[]'::jsonb));
end $$;
create function life_private.annual_options() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if life_private.person_id() is null then raise exception 'AUTH_REQUIRED';end if;
 return coalesce((select jsonb_agg(to_jsonb(y)||jsonb_build_object('org_name',o.name) order by y.starts_on desc) from public.life_project_years y join public.life_organizations o on o.id=y.org_id where life_private.annual_read(y.org_id)),'[]'::jsonb);
end $$;
create function life_private.annual_board(y uuid,a text default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_year public.life_project_years;v_frame jsonb;
begin
 select * into v_year from public.life_project_years where id=y;
 if v_year.id is null or not life_private.annual_read(v_year.org_id) then raise exception 'FORBIDDEN';end if;
 v_frame:=life_private.annual_frame(y);
 return jsonb_build_object('year',to_jsonb(v_year),'generated_at',now(),'can_prepare',life_private.annual_can(v_year.org_id,'PREPARE'),'can_approve',life_private.annual_can(v_year.org_id,'APPROVE'),
 'academies',coalesce((select jsonb_agg(distinct c.academy) from public.life_offerings o join public.life_course_versions v on v.id=o.course_version_id join public.life_courses c on c.id=v.course_id where o.project_year_id=y),'[]'::jsonb),
 'facts',case when a is null then v_frame->'snapshot'->'facts' else life_private.annual_facts(y,a) end,'metrics',v_frame->'snapshot'->'metrics',
 'reports',coalesce((select jsonb_agg(to_jsonb(x) order by version desc) from (select id,version,status,created_at,approved_at,reason,supersedes_id,fingerprint<>v_frame->>'fingerprint' stale from public.life_performance_reports where year_id=y order by version desc limit 100)x),'[]'::jsonb));
end $$;
create function life_private.annual_report(r uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_r public.life_performance_reports;v_frame jsonb;
begin
 select * into v_r from public.life_performance_reports where id=r;
 if v_r.id is null or not life_private.annual_read(v_r.org_id) then raise exception 'FORBIDDEN';end if;
 v_frame:=life_private.annual_frame(v_r.year_id);
 return to_jsonb(v_r)||jsonb_build_object('stale',v_r.fingerprint<>v_frame->>'fingerprint','can_approve',life_private.annual_can(v_r.org_id,'APPROVE'),
 'events',coalesce((select jsonb_agg(jsonb_build_object('action',action,'at',created_at) order by id) from public.life_annual_events where entity_id=r),'[]'::jsonb));
end $$;

create function public.life_open_survey(f uuid,policy uuid,closes timestamptz) returns uuid language sql security invoker set search_path='' as $$select life_private.annual_open_survey(f,policy,closes)$$;
create function public.life_answer_survey(r uuid,policy uuid,overall integer,content integer,usefulness integer,confirmed boolean) returns void language sql security invoker set search_path='' as $$select life_private.annual_answer_survey(r,policy,overall,content,usefulness,confirmed)$$;
create function public.life_finalize_survey(r uuid) returns void language sql security invoker set search_path='' as $$select life_private.annual_finalize_survey(r)$$;
create function public.life_my_surveys() returns jsonb language sql security invoker set search_path='' as $$select life_private.annual_my_surveys()$$;
create function public.life_quality_feedback(f uuid,note text,revision integer) returns void language sql security invoker set search_path='' as $$select life_private.annual_quality_feedback(f,note,revision)$$;
create function public.life_review_course(f uuid,decision text,summary text,revision integer) returns uuid language sql security invoker set search_path='' as $$select life_private.annual_review_course(f,decision,summary,revision)$$;
create function public.life_add_improvement(r uuid,owner uuid,plan text,due date) returns uuid language sql security invoker set search_path='' as $$select life_private.annual_add_improvement(r,owner,plan,due)$$;
create function public.life_report_improvement(i uuid,target uuid,evidence text,revision integer) returns void language sql security invoker set search_path='' as $$select life_private.annual_report_improvement(i,target,evidence,revision)$$;
create function public.life_verify_improvement(i uuid,note text,revision integer) returns void language sql security invoker set search_path='' as $$select life_private.annual_verify_improvement(i,note,revision)$$;
create function public.life_create_metric(y uuid,d jsonb) returns uuid language sql security invoker set search_path='' as $$select life_private.annual_create_metric(y,d)$$;
create function public.life_approve_metric(m uuid,reference text) returns void language sql security invoker set search_path='' as $$select life_private.annual_approve_metric(m,reference)$$;
create function public.life_record_metric(m uuid,n numeric,d numeric,unknown_count integer,observed date,source_ref text,evidence text) returns uuid language sql security invoker set search_path='' as $$select life_private.annual_record_metric(m,n,d,unknown_count,observed,source_ref,evidence)$$;
create function public.life_create_performance_report(y uuid,request_key uuid,reason text) returns uuid language sql security invoker set search_path='' as $$select life_private.annual_create_report(y,request_key,reason)$$;
create function public.life_approve_performance_report(r uuid,reference text) returns void language sql security invoker set search_path='' as $$select life_private.annual_approve_report(r,reference)$$;
create function public.life_quality_board(f uuid) returns jsonb language sql security invoker set search_path='' as $$select life_private.annual_quality_board(f)$$;
create function public.life_performance_options() returns jsonb language sql security invoker set search_path='' as $$select life_private.annual_options()$$;
create function public.life_performance_board(y uuid,a text default null) returns jsonb language sql security invoker set search_path='' as $$select life_private.annual_board(y,a)$$;
create function public.life_performance_report(r uuid) returns jsonb language sql security invoker set search_path='' as $$select life_private.annual_report(r)$$;
alter table public.life_survey_results enable row level security;
revoke all on public.life_survey_results from public,anon,authenticated;
alter table public.life_performance_grants enable row level security;
revoke all on public.life_performance_grants from public,anon,authenticated;
alter table public.life_survey_policies enable row level security;
revoke all on public.life_survey_policies from public,anon,authenticated;
alter table public.life_survey_rounds enable row level security;
revoke all on public.life_survey_rounds from public,anon,authenticated;
alter table public.life_course_feedback enable row level security;
revoke all on public.life_course_feedback from public,anon,authenticated;
alter table public.life_course_reviews enable row level security;
revoke all on public.life_course_reviews from public,anon,authenticated;
alter table public.life_improvement_actions enable row level security;
revoke all on public.life_improvement_actions from public,anon,authenticated;
alter table public.life_metric_definitions enable row level security;
revoke all on public.life_metric_definitions from public,anon,authenticated;
alter table public.life_metric_observations enable row level security;
revoke all on public.life_metric_observations from public,anon,authenticated;
alter table public.life_performance_reports enable row level security;
revoke all on public.life_performance_reports from public,anon,authenticated;
alter table public.life_annual_events enable row level security;
revoke all on public.life_annual_events from public,anon,authenticated;
alter table life_private.survey_participation enable row level security;
revoke all on life_private.survey_participation from public,anon,authenticated,service_role;
alter table life_private.survey_answers enable row level security;
revoke all on life_private.survey_answers from public,anon,authenticated,service_role;
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='life_private' and p.proname like 'annual_%') or (n.nspname='public' and p.proname=any(array['life_finalize_survey','life_open_survey','life_answer_survey','life_my_surveys','life_quality_feedback','life_review_course','life_add_improvement','life_report_improvement','life_verify_improvement','life_create_metric','life_approve_metric','life_record_metric','life_create_performance_report','life_approve_performance_report','life_quality_board','life_performance_options','life_performance_board','life_performance_report'])) loop
 execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
 if f.proname=any(array['life_finalize_survey','life_open_survey','life_answer_survey','life_my_surveys','life_quality_feedback','life_review_course','life_add_improvement','life_report_improvement','life_verify_improvement','life_create_metric','life_approve_metric','life_record_metric','life_create_performance_report','life_approve_performance_report','life_quality_board','life_performance_options','life_performance_board','life_performance_report','annual_finalize_survey','annual_open_survey','annual_answer_survey','annual_my_surveys','annual_quality_feedback','annual_review_course','annual_add_improvement','annual_report_improvement','annual_verify_improvement','annual_create_metric','annual_approve_metric','annual_record_metric','annual_create_report','annual_approve_report','annual_quality_board','annual_options','annual_board','annual_report']) then execute format('grant execute on function %s to authenticated',f.signature);end if;
 end loop;end $$;
notify pgrst,'reload schema';
commit;
