-- Additive replacement for the legacy demo model. No legacy records are deleted.
-- The life_ prefix lets the reviewed model coexist with the 001–010 tables.
begin;
create schema if not exists life_private;
revoke all on schema life_private from public;
grant usage on schema life_private to authenticated, anon;

-- Retire unsafe legacy Data API paths, including definer views and completion RPCs.
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
-- Retired helpers retain no browser execution rights and a fixed search path.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('update_updated_at_column','is_instructor_of_course','handle_enrollment_capacity_check',
    'evaluate_and_issue_certificate','encrypt_resident_id','decrypt_resident_id','auto_evaluate_scholarship_eligibility',
    'issue_digital_badge','get_current_user_role','is_admin_or_operator','is_learner','is_instructor') loop
    execute format('alter function %s set search_path = pg_catalog, public, extensions',f.signature);
  end loop;
end $$;
-- The retired audit sink must not accept forged browser events if re-granted later.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='audit_logs' and cmd in ('INSERT','ALL') loop
    execute format('drop policy %I on public.audit_logs',p.policyname);
  end loop;
end $$;

create table public.life_organizations (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  name text not null, created_at timestamptz not null default now()
);
create table public.life_project_years (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.life_organizations,
  label text not null, starts_on date not null, ends_on date not null,
  unique(id, org_id), check(ends_on >= starts_on)
);
create table public.life_people (
  id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 100),
  active boolean not null default true, created_at timestamptz not null default now()
);
create table public.life_auth_links (
  person_id uuid primary key references public.life_people,
  auth_user_id uuid unique references auth.users on delete set null
);
create table public.life_role_assignments (
  id uuid primary key default gen_random_uuid(), person_id uuid not null references public.life_people,
  org_id uuid not null references public.life_organizations,
  role text not null check(role in ('INSTRUCTOR','COURSE_MANAGER','FINANCE','CERTIFIER','SYSTEM_ADMIN')),
  valid_from timestamptz not null default now(), valid_until timestamptz,
  check(valid_until is null or valid_until > valid_from)
);
create index life_roles_actor on public.life_role_assignments(person_id,org_id,valid_until);
create table public.life_policy_versions (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.life_organizations,
  kind text not null check(kind in ('ACCOUNT_PRIVACY','ENROLLMENT','COMPLETION','MARKETING')),
  version text not null, title text not null, body text not null,
  status text not null default 'DRAFT' check(status in ('DRAFT','APPROVED')),
  approved_by uuid references public.life_people, approved_at timestamptz,
  effective_from timestamptz not null default now(), effective_until timestamptz,
  unique(id,org_id), unique(org_id,kind,version),
  check(status <> 'APPROVED' or (approved_by is not null and approved_at is not null)),
  check(effective_until is null or effective_until > effective_from)
);
create table public.life_consent_events (
  id uuid primary key default gen_random_uuid(), person_id uuid not null references public.life_people,
  policy_id uuid not null references public.life_policy_versions, accepted boolean not null,
  recorded_at timestamptz not null default now(), source text not null
);
create table public.life_courses (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.life_organizations,
  title text not null check(length(title) between 1 and 200), academy text not null check(length(academy) between 1 and 100),
  unique(id,org_id)
);
create table public.life_course_versions (
  id uuid primary key default gen_random_uuid(), org_id uuid not null,
  course_id uuid not null, version integer not null default 1,
  summary text not null check(length(summary) between 1 and 3000), curriculum text not null check(length(curriculum) between 1 and 20000),
  status text not null default 'DRAFT' check(status in ('DRAFT','APPROVED')),
  completion_policy_id uuid, approved_by uuid references public.life_people,
  unique(id,org_id), unique(course_id,version),
  foreign key(course_id,org_id) references public.life_courses(id,org_id),
  foreign key(completion_policy_id,org_id) references public.life_policy_versions(id,org_id)
);
create table public.life_offerings (
  id uuid primary key default gen_random_uuid(), org_id uuid not null,
  project_year_id uuid not null, course_version_id uuid not null,
  name text not null check(length(name) between 1 and 200),
  mode text not null check(mode in ('OFFLINE','ONLINE','BLENDED')),
  location text not null check(length(location) between 1 and 200), capacity integer not null check(capacity between 1 and 1000),
  tuition integer not null default 0 check(tuition >= 0),
  selection_method text not null default 'REVIEW' check(selection_method in ('REVIEW','FIRST_COME')),
  status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','CLOSED')),
  apply_from timestamptz not null, apply_until timestamptz not null,
  starts_on date not null, ends_on date not null, enrollment_policy_id uuid,
  created_at timestamptz not null default now(),
  unique(id,org_id), check(apply_until > apply_from), check(ends_on >= starts_on),
  foreign key(project_year_id,org_id) references public.life_project_years(id,org_id),
  foreign key(course_version_id,org_id) references public.life_course_versions(id,org_id),
  foreign key(enrollment_policy_id,org_id) references public.life_policy_versions(id,org_id)
);
create index life_offerings_year on public.life_offerings(org_id,project_year_id,status);
create table public.life_offering_instructors (
  offering_id uuid not null references public.life_offerings,
  person_id uuid not null references public.life_people,
  valid_until timestamptz, primary key(offering_id,person_id)
);
create table public.life_applications (
  id uuid primary key default gen_random_uuid(), offering_id uuid not null references public.life_offerings,
  person_id uuid not null references public.life_people,
  status text not null check(status in ('SUBMITTED','WAITLISTED','ACCEPTED','REJECTED','CANCELLED')),
  policy_id uuid not null references public.life_policy_versions,
  submitted_at timestamptz not null default now(), unique(offering_id,person_id),
  unique(id,offering_id,person_id)
);
create index life_applications_queue on public.life_applications(offering_id,status,submitted_at);
create table public.life_enrollments (
  id uuid primary key default gen_random_uuid(), application_id uuid not null unique,
  offering_id uuid not null, person_id uuid not null,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','WITHDRAWN')),
  confirmed_at timestamptz not null default now(), unique(offering_id,person_id),
  foreign key(application_id,offering_id,person_id) references public.life_applications(id,offering_id,person_id)
);
create index life_enrollments_person on public.life_enrollments(person_id,offering_id);
create table public.life_lessons (
  id uuid primary key default gen_random_uuid(), offering_id uuid not null references public.life_offerings,
  title text not null check(length(title) between 1 and 200), position integer not null check(position > 0),
  content text not null check(length(content) <= 30000), published boolean not null default false,
  unique(id,offering_id), unique(offering_id,position)
);
create table public.life_lesson_reads (
  lesson_id uuid not null references public.life_lessons,
  person_id uuid not null references public.life_people,
  read_at timestamptz not null default now(), primary key(lesson_id,person_id)
);
create table public.life_assignments (
  id uuid primary key default gen_random_uuid(), offering_id uuid not null references public.life_offerings,
  title text not null check(length(title) between 1 and 200), instructions text not null,
  due_at timestamptz not null, published boolean not null default false, unique(id,offering_id)
);
create table public.life_submissions (
  id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.life_assignments,
  person_id uuid not null references public.life_people, body text not null check(length(body) between 1 and 20000),
  revision integer not null default 1, submitted_at timestamptz not null default now(),
  unique(assignment_id,person_id)
);
create table public.life_submission_grades (
  submission_id uuid primary key references public.life_submissions,
  submission_revision integer not null, score numeric not null check(score between 0 and 100),
  feedback text not null check(length(feedback) <= 5000), grader_id uuid not null references public.life_people,
  graded_at timestamptz not null default now()
);
create table public.life_audit_events (
  id bigint generated always as identity primary key, org_id uuid references public.life_organizations,
  actor_id uuid references public.life_people, action text not null,
  entity_id uuid not null, created_at timestamptz not null default now()
);

insert into public.life_organizations(id,slug,name)
values('10000000-0000-4000-8000-000000000001','uc-anchor','울산과학대학교 앵커사업단');
insert into public.life_project_years(id,org_id,label,starts_on,ends_on)
values('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','2차년도 · 2026','2026-03-01','2027-02-28');

create function life_private.person_id() returns uuid language sql stable security definer set search_path = '' as $$
  select p.id from public.life_people p join public.life_auth_links a on a.person_id=p.id
  where a.auth_user_id=(select auth.uid()) and p.active
$$;
create function life_private.has_role(o uuid,r text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.life_role_assignments where person_id=life_private.person_id()
    and org_id=o and role=r and valid_from<=now() and (valid_until is null or valid_until>now()))
$$;
create function life_private.manages(f uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select life_private.has_role(org_id,'COURSE_MANAGER') from public.life_offerings where id=f),false)
$$;
create function life_private.teaches(f uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.life_offering_instructors i join public.life_offerings o on o.id=i.offering_id
    where i.offering_id=f and i.person_id=life_private.person_id()
    and (i.valid_until is null or i.valid_until>now()) and life_private.has_role(o.org_id,'INSTRUCTOR'))
$$;
create function life_private.enrolled(f uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.life_enrollments where offering_id=f and person_id=life_private.person_id() and status='ACTIVE')
$$;
create function life_private.policy_valid(p uuid,o uuid,k text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.life_policy_versions where id=p and org_id=o and kind=k
    and status='APPROVED' and effective_from<=now() and (effective_until is null or effective_until>now()))
$$;
create function life_private.read_offering(f uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.life_offerings where id=f and status in ('PUBLISHED','CLOSED'))
    or life_private.manages(f) or life_private.teaches(f) or life_private.enrolled(f)
$$;

-- Policies are immutable evidence once approved. Supersede with a new version.
create function life_private.freeze_policy() returns trigger language plpgsql set search_path='' as $$
begin
  if old.status='APPROVED' then raise exception 'APPROVED_POLICY_IMMUTABLE'; end if;
  return new;
end $$;
create trigger life_policy_freeze before update or delete on public.life_policy_versions
for each row execute function life_private.freeze_policy();

-- Preserve legacy profiles but never trust signup metadata to grant a role.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
declare p uuid; v public.life_policy_versions;
begin
  select * into v from public.life_policy_versions where id=(new.raw_user_meta_data->>'privacy_policy_id')::uuid;
  if v.id is null or not life_private.policy_valid(v.id,v.org_id,'ACCOUNT_PRIVACY')
     or coalesce(new.raw_user_meta_data->>'privacy_accepted','false')<>'true' then
    raise exception 'APPROVED_ACCOUNT_PRIVACY_REQUIRED';
  end if;
  insert into public.user_profiles(id,email,name,role) values(new.id,coalesce(new.email,''),
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),'학습자'),100),'LEARNER');
  insert into public.life_people(name) values(left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),'학습자'),100)) returning id into p;
  insert into public.life_auth_links values(p,new.id);
  insert into public.life_consent_events(person_id,policy_id,accepted,source) values(p,v.id,true,'SIGNUP');
  return new;
end $$;
-- Existing identities get no elevated roles. Role migration requires a reviewed grant.
insert into public.life_people(id,name) select id,left(coalesce(nullif(name,''),'학습자'),100) from public.user_profiles;
insert into public.life_auth_links select id,id from public.user_profiles;

create function life_private.identity() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',p.id,'name',p.name,'roles',coalesce((select jsonb_agg(jsonb_build_object('role',r.role,'org_id',r.org_id))
    from public.life_role_assignments r where r.person_id=p.id and valid_from<=now() and (valid_until is null or valid_until>now())),'[]'::jsonb))
  from public.life_people p where p.id=life_private.person_id()
$$;
create function public.life_identity() returns jsonb language sql stable security invoker set search_path='' as $$select life_private.identity()$$;

create function life_private.apply(f uuid,policy uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.life_offerings; p uuid:=life_private.person_id(); a uuid; s text; n integer;
begin
  if p is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into o from public.life_offerings where id=f for update;
  if o.id is null then raise exception 'NOT_FOUND'; end if;
  -- Natural key makes retries idempotent even after the recruitment window closes.
  select id into a from public.life_applications where offering_id=f and person_id=p;
  if a is not null then return a; end if;
  if o.status<>'PUBLISHED' or now()<o.apply_from or now()>=o.apply_until then raise exception 'APPLICATION_CLOSED'; end if;
  if o.tuition<>0 then raise exception 'PAID_ENROLLMENT_NOT_ENABLED'; end if;
  if policy is distinct from o.enrollment_policy_id or not life_private.policy_valid(policy,o.org_id,'ENROLLMENT') then raise exception 'POLICY_CHANGED'; end if;
  select count(*) into n from public.life_enrollments where offering_id=f and status='ACTIVE';
  s:=case when o.selection_method='REVIEW' then 'SUBMITTED' when n<o.capacity then 'ACCEPTED' else 'WAITLISTED' end;
  insert into public.life_applications(offering_id,person_id,status,policy_id) values(f,p,s,policy) returning id into a;
  insert into public.life_consent_events(person_id,policy_id,accepted,source) values(p,policy,true,'APPLICATION');
  if s='ACCEPTED' then insert into public.life_enrollments(application_id,offering_id,person_id) values(a,f,p); end if;
  insert into public.life_audit_events(org_id,actor_id,action,entity_id) values(o.org_id,p,'APPLICATION_SUBMITTED',a);
  return a;
end $$;
create function public.life_apply(f uuid,policy uuid) returns uuid language sql security invoker set search_path='' as $$select life_private.apply(f,policy)$$;

create function life_private.decide(a uuid,decision text) returns void language plpgsql security definer set search_path='' as $$
declare v public.life_applications; o public.life_offerings; n integer;
begin
  select * into v from public.life_applications where id=a;
  if v.id is null then raise exception 'NOT_FOUND'; end if;
  select * into o from public.life_offerings where id=v.offering_id for update;
  select * into v from public.life_applications where id=a for update;
  if decision='CANCELLED' then
    if v.person_id is distinct from life_private.person_id() and not life_private.manages(o.id) then raise exception 'FORBIDDEN'; end if;
    if (now() at time zone 'Asia/Seoul')::date>=o.starts_on then raise exception 'WITHDRAWAL_REVIEW_REQUIRED'; end if;
  elsif decision in ('ACCEPTED','REJECTED') then
    if not life_private.manages(o.id) then raise exception 'FORBIDDEN'; end if;
    if v.status=decision then return; end if;
    if v.status not in ('SUBMITTED','WAITLISTED') then raise exception 'INVALID_TRANSITION'; end if;
  else raise exception 'INVALID_TRANSITION'; end if;
  if v.status=decision then return; end if;
  if v.status in ('REJECTED','CANCELLED') then raise exception 'INVALID_TRANSITION'; end if;
  if decision='ACCEPTED' then
    if o.tuition<>0 then raise exception 'PAID_ENROLLMENT_NOT_ENABLED'; end if;
    if o.status='DRAFT' or (now() at time zone 'Asia/Seoul')::date>o.ends_on then raise exception 'APPLICATION_CLOSED'; end if;
    select count(*) into n from public.life_enrollments where offering_id=o.id and status='ACTIVE';
    if n>=o.capacity then raise exception 'CAPACITY_FULL'; end if;
    insert into public.life_enrollments(application_id,offering_id,person_id) values(v.id,o.id,v.person_id);
  elsif decision='CANCELLED' then
    update public.life_enrollments set status='WITHDRAWN' where application_id=a;
  end if;
  update public.life_applications set status=decision where id=a;
  insert into public.life_audit_events(org_id,actor_id,action,entity_id) values(o.org_id,life_private.person_id(),'APPLICATION_'||decision,a);
end $$;
create function public.life_decide(a uuid,decision text) returns void language sql security invoker set search_path='' as $$select life_private.decide(a,decision)$$;

create function life_private.read_lesson(l uuid) returns void language plpgsql security definer set search_path='' as $$
declare f uuid;
begin
  select offering_id into f from public.life_lessons where id=l and published;
  if f is null or not life_private.enrolled(f) then raise exception 'FORBIDDEN'; end if;
  insert into public.life_lesson_reads(lesson_id,person_id) values(l,life_private.person_id()) on conflict do nothing;
end $$;
create function public.life_read_lesson(l uuid) returns void language sql security invoker set search_path='' as $$select life_private.read_lesson(l)$$;

create function life_private.submit(a uuid,body text) returns uuid language plpgsql security definer set search_path='' as $$
declare v public.life_assignments; s uuid;
begin
  select * into v from public.life_assignments where id=a;
  if v.id is null or not v.published or not life_private.enrolled(v.offering_id) then raise exception 'FORBIDDEN'; end if;
  if now()>v.due_at then raise exception 'DEADLINE_PASSED'; end if;
  if body is null or length(trim(body)) not between 1 and 20000 then raise exception 'INVALID_INPUT'; end if;
  insert into public.life_submissions(assignment_id,person_id,body) values(a,life_private.person_id(),trim(body))
  on conflict(assignment_id,person_id) do update set body=excluded.body, revision=public.life_submissions.revision+1,submitted_at=now()
  returning id into s;
  -- A new revision never inherits the grade of an older answer.
  delete from public.life_submission_grades where submission_id=s;
  return s;
end $$;
create function public.life_submit(a uuid,body text) returns uuid language sql security invoker set search_path='' as $$select life_private.submit(a,body)$$;

create function life_private.grade(s uuid,revision integer,score numeric,feedback text) returns void language plpgsql security definer set search_path='' as $$
declare f uuid; v public.life_submissions;
begin
  select * into v from public.life_submissions where id=s for update;
  select offering_id into f from public.life_assignments where id=v.assignment_id;
  if f is null or not life_private.teaches(f) then raise exception 'FORBIDDEN'; end if;
  if v.revision<>revision then raise exception 'REVISION_CHANGED'; end if;
  insert into public.life_submission_grades values(s,revision,score,feedback,life_private.person_id(),now())
  on conflict(submission_id) do update set submission_revision=excluded.submission_revision,score=excluded.score,feedback=excluded.feedback,grader_id=excluded.grader_id,graded_at=now();
  insert into public.life_audit_events(org_id,actor_id,action,entity_id)
  select org_id,life_private.person_id(),'SUBMISSION_GRADED',s from public.life_offerings where id=f;
end $$;
create function public.life_grade(s uuid,revision integer,score numeric,feedback text) returns void language sql security invoker set search_path='' as $$select life_private.grade(s,revision,score,feedback)$$;

create function life_private.roster(f uuid) returns table(application_id uuid,person_id uuid,name text,status text,submitted_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not (life_private.manages(f) or life_private.teaches(f)) then raise exception 'FORBIDDEN'; end if;
  return query select a.id,p.id,p.name,a.status,a.submitted_at from public.life_applications a join public.life_people p on p.id=a.person_id
    where a.offering_id=f and (life_private.manages(f) or a.status='ACCEPTED') order by a.submitted_at;
end $$;
create function public.life_roster(f uuid) returns table(application_id uuid,person_id uuid,name text,status text,submitted_at timestamptz)
language sql stable security invoker set search_path='' as $$select * from life_private.roster(f)$$;

-- Only explicitly scoped teaching/management mutations are available to browser roles.
create function life_private.teaching_content(f uuid,kind text,title text,body text,ordinal integer,due_at timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if not life_private.teaches(f) then raise exception 'FORBIDDEN'; end if;
  if kind='LESSON' then
    insert into public.life_lessons(offering_id,title,content,position,published) values(f,title,body,ordinal,true) returning id into result;
  elsif kind='ASSIGNMENT' then
    if due_at<=now() then raise exception 'INVALID_INPUT'; end if;
    insert into public.life_assignments(offering_id,title,instructions,due_at,published) values(f,title,body,due_at,true) returning id into result;
  else raise exception 'INVALID_INPUT'; end if;
  return result;
end $$;
create function public.life_teaching_content(f uuid,kind text,title text,body text,ordinal integer,due_at timestamptz) returns uuid
language sql security invoker set search_path='' as $$select life_private.teaching_content(f,kind,title,body,ordinal,due_at)$$;

create function life_private.create_offering(o uuid,y uuid,title text,academy text,summary text,curriculum text,mode text,location text,capacity integer,selection_method text,apply_from timestamptz,apply_until timestamptz,starts_on date,ends_on date) returns uuid
language plpgsql security definer set search_path='' as $$
declare c uuid; v uuid; f uuid;
begin
  if not life_private.has_role(o,'COURSE_MANAGER') then raise exception 'FORBIDDEN'; end if;
  insert into public.life_courses(org_id,title,academy) values(o,title,academy) returning id into c;
  insert into public.life_course_versions(org_id,course_id,summary,curriculum) values(o,c,summary,curriculum) returning id into v;
  insert into public.life_offerings(org_id,project_year_id,course_version_id,name,mode,location,capacity,selection_method,apply_from,apply_until,starts_on,ends_on)
  values(o,y,v,title,mode,location,capacity,selection_method,apply_from,apply_until,starts_on,ends_on) returning id into f;
  return f;
end $$;
create function public.life_create_offering(o uuid,y uuid,title text,academy text,summary text,curriculum text,mode text,location text,capacity integer,selection_method text,apply_from timestamptz,apply_until timestamptz,starts_on date,ends_on date) returns uuid
language sql security invoker set search_path='' as $$select life_private.create_offering(o,y,title,academy,summary,curriculum,mode,location,capacity,selection_method,apply_from,apply_until,starts_on,ends_on)$$;
create function life_private.publish(f uuid,enrollment_policy uuid,completion_policy uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.life_offerings;
begin
  select * into o from public.life_offerings where id=f for update;
  if not life_private.manages(f) then raise exception 'FORBIDDEN'; end if;
  if o.status<>'DRAFT' then raise exception 'INVALID_TRANSITION'; end if;
  if not life_private.policy_valid(enrollment_policy,o.org_id,'ENROLLMENT') or not life_private.policy_valid(completion_policy,o.org_id,'COMPLETION') then raise exception 'APPROVED_POLICY_REQUIRED'; end if;
  if o.tuition<>0 then raise exception 'PAID_ENROLLMENT_NOT_ENABLED'; end if;
  update public.life_course_versions set status='APPROVED',completion_policy_id=completion_policy,approved_by=life_private.person_id() where id=o.course_version_id;
  update public.life_offerings set status='PUBLISHED',enrollment_policy_id=enrollment_policy where id=f;
  insert into public.life_audit_events(org_id,actor_id,action,entity_id) values(o.org_id,life_private.person_id(),'OFFERING_PUBLISHED',f);
end $$;
create function public.life_publish(f uuid,enrollment_policy uuid,completion_policy uuid) returns void language sql security invoker set search_path='' as $$select life_private.publish(f,enrollment_policy,completion_policy)$$;

-- Read access is RLS constrained. All writes go through checked transactions above.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname='public' and tablename like 'life\_%' escape '\' loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
end $$;
grant select on public.life_organizations,public.life_project_years,public.life_courses,public.life_course_versions,public.life_offerings,public.life_policy_versions to anon;
create policy life_org_read on public.life_organizations for select to anon,authenticated using(true);
create policy life_year_read on public.life_project_years for select to anon,authenticated using(true);
create policy life_person_read on public.life_people for select to authenticated using(id=(select life_private.person_id()));
create policy life_role_read on public.life_role_assignments for select to authenticated using(person_id=(select life_private.person_id()));
create policy life_policy_read on public.life_policy_versions for select to anon,authenticated using(status='APPROVED' or life_private.has_role(org_id,'COURSE_MANAGER'));
create policy life_consent_read on public.life_consent_events for select to authenticated using(person_id=(select life_private.person_id()));
create policy life_course_read on public.life_courses for select to anon,authenticated using(life_private.has_role(org_id,'COURSE_MANAGER') or exists(select 1 from public.life_course_versions v join public.life_offerings o on o.course_version_id=v.id where v.course_id=life_courses.id and life_private.read_offering(o.id)));
create policy life_version_read on public.life_course_versions for select to anon,authenticated using(life_private.has_role(org_id,'COURSE_MANAGER') or exists(select 1 from public.life_offerings o where o.course_version_id=life_course_versions.id and life_private.read_offering(o.id)));
create policy life_offering_read on public.life_offerings for select to anon,authenticated using(life_private.read_offering(id));
create policy life_instructor_read on public.life_offering_instructors for select to authenticated using(person_id=(select life_private.person_id()) or life_private.manages(offering_id));
create policy life_application_read on public.life_applications for select to authenticated using(person_id=(select life_private.person_id()) or life_private.manages(offering_id));
create policy life_enrollment_read on public.life_enrollments for select to authenticated using(person_id=(select life_private.person_id()) or life_private.manages(offering_id) or life_private.teaches(offering_id));
create policy life_lesson_read on public.life_lessons for select to authenticated using((published and life_private.enrolled(offering_id)) or life_private.teaches(offering_id) or life_private.manages(offering_id));
create policy life_read_read on public.life_lesson_reads for select to authenticated using(person_id=(select life_private.person_id()));
create policy life_assignment_read on public.life_assignments for select to authenticated using((published and life_private.enrolled(offering_id)) or life_private.teaches(offering_id) or life_private.manages(offering_id));
create policy life_submission_read on public.life_submissions for select to authenticated using(person_id=(select life_private.person_id()) or exists(select 1 from public.life_assignments a where a.id=assignment_id and life_private.teaches(a.offering_id)));
create policy life_grade_read on public.life_submission_grades for select to authenticated using(exists(select 1 from public.life_submissions s where s.id=submission_id));
create policy life_audit_read on public.life_audit_events for select to authenticated using(life_private.has_role(org_id,'COURSE_MANAGER'));

create view public.life_catalog with(security_invoker=true) as
select o.*,c.academy,c.title,v.summary,v.curriculum,v.completion_policy_id,y.label as year_label
from public.life_offerings o join public.life_course_versions v on v.id=o.course_version_id
join public.life_courses c on c.id=v.course_id join public.life_project_years y on y.id=o.project_year_id;
grant select on public.life_catalog to anon,authenticated;

revoke execute on all functions in schema life_private from public,anon,authenticated;
grant execute on function life_private.person_id(),life_private.has_role(uuid,text),life_private.manages(uuid),life_private.teaches(uuid),life_private.enrolled(uuid),life_private.read_offering(uuid) to anon,authenticated;
grant execute on function life_private.identity(),life_private.apply(uuid,uuid),life_private.decide(uuid,text),life_private.read_lesson(uuid),life_private.submit(uuid,text),life_private.grade(uuid,integer,numeric,text),life_private.roster(uuid),life_private.teaching_content(uuid,text,text,text,integer,timestamptz),life_private.create_offering(uuid,uuid,text,text,text,text,text,text,integer,text,timestamptz,timestamptz,date,date),life_private.publish(uuid,uuid,uuid) to authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'life\_%' escape '\' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
