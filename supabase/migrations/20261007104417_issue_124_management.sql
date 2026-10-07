begin;

create table life_private.application_reviews (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.life_applications,
  actor_id uuid not null references public.life_people,
  previous_status text not null, next_status text not null,
  reason text not null default '' check(length(reason)<=1000),
  created_at timestamptz not null default clock_timestamp(),
  check(next_status<>'REJECTED' or length(trim(reason))>0)
);
create index application_reviews_application on life_private.application_reviews(application_id,created_at);
alter table life_private.application_reviews enable row level security;
revoke all on life_private.application_reviews from public,anon,authenticated,service_role;

create function life_private.review_application(a uuid,decision text,reason text,expected_status text) returns void
language plpgsql security definer set search_path='' as $$
declare v public.life_applications; result_status text;
begin
  select * into v from public.life_applications where id=a;
  if v.id is null then raise exception 'NOT_FOUND'; end if;
  -- Same lock order as application/finance decisions: offering, then application.
  perform 1 from public.life_offerings where id=v.offering_id for update;
  select * into v from public.life_applications where id=a for update;
  if life_private.person_id() is null or
    (decision='CANCELLED' and v.person_id is distinct from life_private.person_id() and not life_private.manages(v.offering_id)) or
    (decision is distinct from 'CANCELLED' and not life_private.manages(v.offering_id)) then raise exception 'FORBIDDEN'; end if;
  if expected_status is not null and expected_status is distinct from v.status then raise exception 'STATUS_CHANGED'; end if;
  if reason is null or length(reason)>1000 or (decision='REJECTED' and length(trim(reason))=0) then raise exception 'REASON_REQUIRED'; end if;
  perform life_private.decide(a,decision);
  select status into result_status from public.life_applications where id=a;
  if result_status is distinct from v.status then
    insert into life_private.application_reviews(application_id,actor_id,previous_status,next_status,reason)
      values(a,life_private.person_id(),v.status,result_status,trim(reason));
  end if;
end $$;
create function public.life_review_application(a uuid,decision text,reason text,expected_status text) returns void
language sql security invoker set search_path='' as $$select life_private.review_application(a,decision,reason,expected_status)$$;
create or replace function public.life_decide(a uuid,decision text) returns void
language sql security invoker set search_path='' as $$select life_private.review_application(a,decision,'',null)$$;
-- The old private helper cannot be invoked directly through a private-schema client.
revoke execute on function life_private.decide(uuid,text),life_private.decide_free(uuid,text) from public,anon,authenticated,service_role;

create function life_private.management_courses() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.starts_on desc,o.name),'[]'::jsonb)
 from public.life_offerings o where life_private.manages(o.id)
$$;

create function life_private.management_applications(f uuid,q text,s text,page integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.life_role_assignments r where r.person_id=life_private.person_id() and life_private.has_role(r.org_id,'COURSE_MANAGER')) then raise exception 'FORBIDDEN'; end if;
 if q is null or length(q)>100 or page is null or page<1 or page>100000 or s is null or s not in ('','SUBMITTED','WAITLISTED','ACCEPTED','PENDING_PAYMENT','REJECTED','CANCELLED','EXPIRED') then raise exception 'INVALID_INPUT'; end if;
 if f is not null and not life_private.manages(f) then raise exception 'FORBIDDEN'; end if;
 with scoped as materialized (
  select a.id,a.person_id,p.name,p.active,a.offering_id,o.name course_name,a.status,a.submitted_at,e.status enrollment_status
  from public.life_applications a join public.life_offerings o on o.id=a.offering_id join public.life_people p on p.id=a.person_id
  left join public.life_enrollments e on e.application_id=a.id
  where life_private.manages(o.id) and (f is null or o.id=f) and (s='' or a.status=s) and (q='' or strpos(lower(p.name),lower(q))>0)
 ), sliced as (select * from scoped order by submitted_at desc,id limit 40 offset (page-1)*40)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x) order by submitted_at desc,id) from sliced x),'[]'::jsonb),'count',(select count(*) from scoped),'courses',life_private.management_courses()) into result;
 return result;
end $$;
create function public.life_management_applications(f uuid default null,q text default '',s text default '',page integer default 1) returns jsonb
language sql stable security invoker set search_path='' as $$select life_private.management_applications(f,q,s,page)$$;

create function life_private.management_learners(f uuid,q text,page integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.life_role_assignments r where r.person_id=life_private.person_id() and life_private.has_role(r.org_id,'COURSE_MANAGER')) then raise exception 'FORBIDDEN'; end if;
 if q is null or length(q)>100 or page is null or page<1 or page>100000 then raise exception 'INVALID_INPUT'; end if;
 if f is not null and not life_private.manages(f) then raise exception 'FORBIDDEN'; end if;
 with scoped as materialized (
  select p.id,p.name,p.active,count(*) applications,count(*) filter(where e.status='ACTIVE') enrollments,max(a.submitted_at) latest_application
  from public.life_people p join public.life_applications a on a.person_id=p.id join public.life_offerings o on o.id=a.offering_id
  left join public.life_enrollments e on e.application_id=a.id
  where life_private.manages(o.id) and (f is null or o.id=f) and (q='' or strpos(lower(p.name),lower(q))>0)
  group by p.id
 ), sliced as (select * from scoped order by name,id limit 40 offset (page-1)*40)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x) order by name,id) from sliced x),'[]'::jsonb),'count',(select count(*) from scoped),'courses',life_private.management_courses()) into result;
 return result;
end $$;
create function public.life_management_learners(f uuid default null,q text default '',page integer default 1) returns jsonb
language sql stable security invoker set search_path='' as $$select life_private.management_learners(f,q,page)$$;

create function life_private.application_detail(a uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v public.life_applications; manager boolean; result jsonb;
begin
 select * into v from public.life_applications where id=a;
 manager:=life_private.manages(v.offering_id);
 if v.id is null or life_private.person_id() is null or (not manager and v.person_id is distinct from life_private.person_id()) then raise exception 'FORBIDDEN'; end if;
 select jsonb_build_object('application',jsonb_build_object('id',v.id,'person_id',p.id,'name',p.name,'active',p.active,'offering_id',o.id,'course_name',o.name,'status',v.status,'submitted_at',v.submitted_at,'enrollment_status',e.status),
 'contact',jsonb_build_object('email',coalesce(u.email,mm.email),'phone',coalesce(mp.mobile_phone,lc.phone)),
 'history',coalesce((select jsonb_agg(x order by x.created_at,x.id) from (
   select r.id,r.previous_status,r.next_status,r.reason,r.created_at,actor.name actor_name from life_private.application_reviews r join public.life_people actor on actor.id=r.actor_id where r.application_id=a
   union all
   select -ev.id,null,substring(ev.action from 13),'',ev.created_at,actor.name from public.life_audit_events ev left join public.life_people actor on actor.id=ev.actor_id
   where ev.entity_id=a and ev.action in ('APPLICATION_ACCEPTED','APPLICATION_REJECTED','APPLICATION_CANCELLED')
     and not exists(select 1 from life_private.application_reviews r where r.application_id=a and r.created_at between ev.created_at-interval '1 second' and ev.created_at+interval '1 second')
 ) x),'[]'::jsonb)) into result
 from public.life_people p join public.life_offerings o on o.id=v.offering_id
 left join public.life_enrollments e on e.application_id=a
 left join public.life_auth_links l on l.person_id=p.id left join auth.users u on u.id=l.auth_user_id
 left join life_private.manual_members mm on mm.person_id=p.id left join life_private.member_profiles mp on mp.person_id=p.id
 left join life_private.learner_contacts lc on lc.user_id=l.auth_user_id where p.id=v.person_id;
 return result;
end $$;
create function public.life_application_detail(a uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select life_private.application_detail(a)$$;

create function life_private.management_learner(p uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.life_applications a where a.person_id=p and life_private.manages(a.offering_id)) then raise exception 'FORBIDDEN'; end if;
 select jsonb_build_object('id',person.id,'name',person.name,'active',person.active,'email',coalesce(u.email,mm.email),'phone',coalesce(mp.mobile_phone,lc.phone),
 'applications',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'person_id',p,'name',person.name,'active',person.active,'offering_id',o.id,'course_name',o.name,'status',a.status,'submitted_at',a.submitted_at,'enrollment_status',e.status) order by a.submitted_at desc)
 from public.life_applications a join public.life_offerings o on o.id=a.offering_id left join public.life_enrollments e on e.application_id=a.id where a.person_id=p and life_private.manages(o.id)),'[]'::jsonb)) into result
 from public.life_people person left join public.life_auth_links l on l.person_id=person.id left join auth.users u on u.id=l.auth_user_id
 left join life_private.manual_members mm on mm.person_id=person.id left join life_private.member_profiles mp on mp.person_id=person.id
 left join life_private.learner_contacts lc on lc.user_id=l.auth_user_id where person.id=p;
 return result;
end $$;
create function public.life_management_learner(p uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select life_private.management_learner(p)$$;

create function life_private.update_offering(f uuid,expected_revision bigint,fields jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare o public.life_offerings; v public.life_course_versions; new_version uuid; occupied integer; cap integer; first_date date; last_date date; af timestamptz; au timestamptz; next_state text;
begin
 if not life_private.manages(f) then raise exception 'FORBIDDEN'; end if;
 select * into o from public.life_offerings where id=f for update;
 if o.status='ARCHIVED' or o.academic_sealed then raise exception 'COURSE_READ_ONLY'; end if;
 if expected_revision is distinct from o.academic_revision then raise exception 'REVISION_CHANGED'; end if;
 if fields is null or jsonb_typeof(fields)<>'object' or
  coalesce(length(trim(fields->>'name')),0) not between 1 and 200 or
  coalesce(length(trim(fields->>'location')),0) not between 1 and 200 or
  coalesce(length(trim(fields->>'summary')),0) not between 1 and 3000 or
  coalesce(length(trim(fields->>'curriculum')),0) not between 1 and 20000 or
  coalesce(fields->>'mode','') not in ('ONLINE','OFFLINE','BLENDED') or
  coalesce(fields->>'selection_method','') not in ('REVIEW','FIRST_COME') or
  coalesce(fields->>'status','') not in ('DRAFT','PUBLISHED','CLOSED') then raise exception 'INVALID_INPUT'; end if;
 cap:=(fields->>'capacity')::integer; first_date:=(fields->>'starts_on')::date; last_date:=(fields->>'ends_on')::date;
 af:=(fields->>'apply_from')::timestamptz; au:=(fields->>'apply_until')::timestamptz; next_state:=fields->>'status';
 if cap is null or cap not between 1 and 1000 or first_date is null or last_date is null or last_date<first_date or af is null or au is null or au<=af or au>(first_date::timestamp at time zone 'Asia/Seoul') then raise exception 'INVALID_DATES_OR_CAPACITY'; end if;
 if (o.status='DRAFT' and next_state<>'DRAFT') or (o.status<>'DRAFT' and next_state='DRAFT') then raise exception 'INVALID_TRANSITION'; end if;
 if next_state='PUBLISHED' and (not life_private.policy_valid(o.enrollment_policy_id,o.org_id,'ENROLLMENT') or not life_private.policy_valid((select completion_policy_id from public.life_course_versions where id=o.course_version_id),o.org_id,'COMPLETION')) then raise exception 'APPROVED_POLICY_REQUIRED'; end if;
 if fields->>'selection_method' is distinct from o.selection_method and exists(select 1 from public.life_applications where offering_id=f) then raise exception 'SELECTION_LOCKED'; end if;
 select (select count(*) from public.life_enrollments where offering_id=f and status='ACTIVE')+(select count(*) from public.life_applications where offering_id=f and status='PENDING_PAYMENT') into occupied;
 if cap<occupied then raise exception 'CAPACITY_FULL'; end if;
 if exists(select 1 from public.life_class_sessions where offering_id=f and status='SCHEDULED' and ((starts_at at time zone 'Asia/Seoul')::date<first_date or (ends_at at time zone 'Asia/Seoul')::date>last_date)) then raise exception 'SCHEDULE_OUTSIDE_PERIOD'; end if;
 select * into v from public.life_course_versions where id=o.course_version_id;
 new_version:=v.id;
 if fields->>'summary' is distinct from v.summary or fields->>'curriculum' is distinct from v.curriculum then
  perform 1 from public.life_courses where id=v.course_id for update;
  insert into public.life_course_versions(org_id,course_id,version,summary,curriculum,status,completion_policy_id,approved_by)
  select v.org_id,v.course_id,coalesce(max(cv.version),0)+1,trim(fields->>'summary'),trim(fields->>'curriculum'),v.status,v.completion_policy_id,v.approved_by from public.life_course_versions cv where cv.course_id=v.course_id returning id into new_version;
 end if;
 update public.life_offerings set name=trim(fields->>'name'),location=trim(fields->>'location'),mode=fields->>'mode',capacity=cap,
   selection_method=fields->>'selection_method',status=next_state,starts_on=first_date,ends_on=last_date,apply_from=af,apply_until=au,
   course_version_id=new_version,academic_revision=academic_revision+1 where id=f;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details) values(o.org_id,life_private.person_id(),'OFFERING_UPDATED',f,jsonb_build_object('before',to_jsonb(o),'fields',fields));
end $$;
create function public.life_update_offering(f uuid,expected_revision bigint,fields jsonb) returns void
language sql security invoker set search_path='' as $$select life_private.update_offering(f,expected_revision,fields)$$;

revoke all on function life_private.management_courses() from public,anon,authenticated,service_role;
do $$ declare fn regprocedure; begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
 (n.nspname='life_private' and p.proname in ('review_application','management_applications','management_learners','application_detail','management_learner','update_offering')) or
 (n.nspname='public' and p.proname in ('life_review_application','life_decide','life_management_applications','life_management_learners','life_application_detail','life_management_learner','life_update_offering')) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',fn);
 execute format('grant execute on function %s to authenticated',fn);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
