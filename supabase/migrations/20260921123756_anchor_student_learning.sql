begin;
create table public.life_learning_requests (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.life_people,
 org_id uuid not null references public.life_organizations,
 title text not null check(length(trim(title)) between 2 and 100),
 goal text not null check(length(trim(goal)) between 10 and 2000),
 preferred_schedule text not null default '' check(length(preferred_schedule)<=200),
 status text not null default 'SUBMITTED' check(status in ('SUBMITTED','REVIEWING','PLANNED','NOT_PLANNED')),
 response text not null default '' check(length(response)<=2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index life_learning_requests_person on public.life_learning_requests(person_id,created_at desc);
create index life_learning_requests_org on public.life_learning_requests(org_id,created_at desc);
alter table public.life_learning_requests enable row level security;
revoke all on public.life_learning_requests from public,anon,authenticated;
grant select on public.life_learning_requests to authenticated;
create policy life_learning_requests_read on public.life_learning_requests for select to authenticated
 using(person_id=(select life_private.person_id()) or life_private.has_role(org_id,'COURSE_MANAGER'));

-- Keep the proposal scope independent of staff directory APIs.
create function life_private.learning_request_orgs() returns table(id uuid,name text)
 language sql stable security definer set search_path='' as $$
 select o.id,o.name from public.life_organizations o where (select life_private.person_id()) is not null and (
 exists(select 1 from public.life_consent_events c join public.life_policy_versions p on p.id=c.policy_id where c.person_id=(select life_private.person_id()) and c.accepted and p.org_id=o.id)
 or exists(select 1 from public.life_applications a join public.life_offerings f on f.id=a.offering_id where a.person_id=(select life_private.person_id()) and f.org_id=o.id)
 or exists(select 1 from public.life_role_assignments r where r.person_id=(select life_private.person_id()) and r.org_id=o.id and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())))
$$;
revoke all on function life_private.learning_request_orgs() from public,anon,authenticated;
grant execute on function life_private.learning_request_orgs() to authenticated;

-- This projection crosses restricted operational tables; never expose the report payload.
create function life_private.my_learning() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=life_private.person_id(); result jsonb;
begin
 if auth.uid() is null or actor is null then raise exception 'FORBIDDEN';end if;
 select jsonb_build_object(
 'courses',coalesce((select jsonb_agg(x.item order by x.submitted_at desc) from (
 select a.submitted_at,jsonb_build_object(
  'application_id',a.id,'status',a.status,'submitted_at',a.submitted_at,
  'id',o.id,'name',o.name,'academy',c.academy,'course_id',c.id,'mode',o.mode,'location',o.location,
  'starts_on',o.starts_on,'ends_on',o.ends_on,'active',coalesce(e.status='ACTIVE',false),
  'instructors',case when e.status='ACTIVE' then coalesce((select jsonb_agg(p.name order by p.name)
    from public.life_offering_instructors i join public.life_people p on p.id=i.person_id
    where i.offering_id=o.id and (i.valid_until is null or i.valid_until>now())),'[]'::jsonb) else '[]'::jsonb end,
  'completion', (select jsonb_build_object('title',p.title,'version',p.version,'body',p.body,
    'attendance_percent',r.attendance_percent,'assignment_min',r.assignment_min,'quiz_min',r.quiz_min)
    from public.life_policy_versions p left join public.life_completion_rules r on r.policy_id=p.id and r.approved_at is not null
    where p.id=v.completion_policy_id and p.org_id=o.org_id and p.status='APPROVED'),
  'sessions',case when e.status='ACTIVE' then coalesce((select jsonb_agg(jsonb_build_object(
    'id',s.id,'title',s.title,'starts_at',s.starts_at,'ends_at',s.ends_at,'status',s.status,
    'replaces_id',s.replaces_id,'reason',s.reason,'credited_minutes',t.credited_minutes) order by s.starts_at,s.id)
    from public.life_class_sessions s left join public.life_attendance t on t.session_id=s.id and t.person_id=actor
    where s.offering_id=o.id),'[]'::jsonb) else '[]'::jsonb end,
  'lessons',case when e.status='ACTIVE' then coalesce((select jsonb_agg(jsonb_build_object(
    'id',l.id,'title',l.title,'position',l.position,'read',exists(select 1 from public.life_lesson_reads lr where lr.lesson_id=l.id and lr.person_id=actor)) order by l.position)
    from public.life_lessons l where l.offering_id=o.id and l.published),'[]'::jsonb) else '[]'::jsonb end
 ) item
 from public.life_applications a join public.life_offerings o on o.id=a.offering_id
 join public.life_course_versions v on v.id=o.course_version_id join public.life_courses c on c.id=v.course_id
 left join public.life_enrollments e on e.application_id=a.id and e.person_id=actor
 where a.person_id=actor
 ) x),'[]'::jsonb),
 'scholarships',coalesce((select jsonb_agg(jsonb_build_object('offering_id',r.offering_id,'name',o.name,
    'category',s->>'category','amount',s->'amount','paid_on',s->>'paidOn') order by o.ends_on desc)
  from public.life_course_reports r join public.life_offerings o on o.id=r.offering_id
  cross join lateral jsonb_array_elements(coalesce(r.payload->'scholarships','[]'::jsonb)) s
  where s->>'personId'=actor::text and exists(select 1 from public.life_enrollments e where e.offering_id=r.offering_id and e.person_id=actor)),'[]'::jsonb),
 'organizations',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.name)
  from life_private.learning_request_orgs() o),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(to_jsonb(r)-'person_id' order by r.created_at desc) from public.life_learning_requests r where r.person_id=actor),'[]'::jsonb)
 ) into result;
 return result;
end $$;
create function public.life_my_learning() returns jsonb language sql stable security invoker set search_path='' as $$select life_private.my_learning()$$;

create function life_private.submit_learning_request(o uuid,title text,goal text,schedule text) returns uuid
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=life_private.person_id(); result uuid;
begin
 if auth.uid() is null or actor is null then raise exception 'FORBIDDEN';end if;
 if not exists(select 1 from life_private.learning_request_orgs() a where a.id=o) then raise exception 'FORBIDDEN';end if;
 if title is null or goal is null or schedule is null or length(trim(title)) not between 2 and 100 or length(trim(goal)) not between 10 and 2000 or length(trim(schedule))>200 then raise exception 'INVALID_INPUT';end if;
 perform 1 from public.life_people where id=actor for update;
 select id into result from public.life_learning_requests r where r.person_id=actor and r.org_id=o
 and r.title=trim(submit_learning_request.title) and r.goal=trim(submit_learning_request.goal)
 and r.preferred_schedule=trim(schedule) and r.created_at>now()-interval '1 day' order by r.created_at desc limit 1;
 if result is not null then return result;end if;
 if (select count(*) from public.life_learning_requests where person_id=actor and created_at>now()-interval '1 day')>=5 then raise exception 'RATE_LIMIT';end if;
 insert into public.life_learning_requests(person_id,org_id,title,goal,preferred_schedule)
 values(actor,o,trim(title),trim(goal),trim(schedule)) returning id into result;
 return result;
end $$;
create function public.life_submit_learning_request(o uuid,title text,goal text,schedule text) returns uuid
 language sql security invoker set search_path='' as $$select life_private.submit_learning_request(o,title,goal,schedule)$$;
create function life_private.review_learning_request(r uuid,new_status text,reply text) returns void
 language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 if auth.uid() is null or life_private.person_id() is null then raise exception 'FORBIDDEN';end if;
 select org_id into org from public.life_learning_requests where id=r for update;
 if org is null or not life_private.has_role(org,'COURSE_MANAGER') then raise exception 'FORBIDDEN';end if;
 if new_status is null or new_status not in ('REVIEWING','PLANNED','NOT_PLANNED') or reply is null or length(trim(reply)) not between 1 and 2000 then raise exception 'INVALID_INPUT';end if;
 update public.life_learning_requests set status=new_status,response=trim(reply),updated_at=now() where id=r;
end $$;
create function public.life_review_learning_request(r uuid,new_status text,reply text) returns void
 language sql security invoker set search_path='' as $$select life_private.review_learning_request(r,new_status,reply)$$;
revoke all on function life_private.my_learning(),public.life_my_learning(),life_private.submit_learning_request(uuid,text,text,text),public.life_submit_learning_request(uuid,text,text,text),life_private.review_learning_request(uuid,text,text),public.life_review_learning_request(uuid,text,text) from public,anon,authenticated;
grant execute on function life_private.my_learning(),public.life_my_learning(),life_private.submit_learning_request(uuid,text,text,text),public.life_submit_learning_request(uuid,text,text,text),life_private.review_learning_request(uuid,text,text),public.life_review_learning_request(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
