begin;

create or replace function life_private.operation_context(f uuid) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
begin
  if not life_private.operation_access(f) then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'manager',life_private.operation_manager(f),
    'course',(select jsonb_build_object('id',o.id,'name',o.name,'academy',c.academy,'starts_on',o.starts_on,'ends_on',o.ends_on,'capacity',o.capacity,'summary',v.summary,'curriculum',v.curriculum,'location',o.location,'status',o.status,'org_id',o.org_id) from public.life_offerings o join public.life_course_versions v on v.id=o.course_version_id join public.life_courses c on c.id=v.course_id where o.id=f),
    'responsible',(
      select jsonb_build_object(
        'person_id',r.person_id,
        'name',p.name,
        'affiliation',coalesce(nullif(trim(pool.affiliation),''),organization.name),
        'revision',r.revision
      )
      from public.life_operation_responsibilities r
      join public.life_people p on p.id=r.person_id
      join public.life_offerings offering on offering.id=r.offering_id
      join public.life_organizations organization on organization.id=offering.org_id
      left join life_private.instructor_pool pool
        on pool.org_id=offering.org_id
       and pool.person_id=r.person_id
       and pool.status='ACTIVE'
      where r.offering_id=f
    ),
    'candidates',case when life_private.operation_manager(f) then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name) from public.life_offering_instructors i join public.life_people p on p.id=i.person_id join public.life_offerings o on o.id=i.offering_id where i.offering_id=f and p.active and (i.valid_until is null or i.valid_until>now()) and exists(select 1 from public.life_role_assignments a where a.person_id=p.id and a.org_id=o.org_id and a.role='INSTRUCTOR' and a.valid_from<=now() and (a.valid_until is null or a.valid_until>now()))),'[]'::jsonb) else '[]'::jsonb end,
    'members',coalesce((select jsonb_agg(jsonb_build_object('person_id',p.id,'name',p.name) order by p.name,p.id) from public.life_enrollments e join public.life_people p on p.id=e.person_id where e.offering_id=f and e.status='ACTIVE'),'[]'::jsonb),
    'documents',coalesce((select jsonb_agg(to_jsonb(d)-'offering_id'-'updated_by'-'reviewed_by'-'submitted_by') from public.life_operation_documents d where d.offering_id=f),'[]'::jsonb),
    'legacy',(select r.payload-'participants'-'scholarships'-'fees' from public.life_course_reports r where r.offering_id=f),
    'sessions',coalesce((select jsonb_agg(jsonb_build_object('title',s.title,'starts_at',s.starts_at,'ends_at',s.ends_at) order by s.starts_at) from public.life_class_sessions s where s.offering_id=f and s.status='SCHEDULED'),'[]'::jsonb),
    'submissions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'kind',s.kind,'revision',s.revision,'submitted_at',s.submitted_at,'name',p.name) order by s.submitted_at desc) from public.life_operation_submissions s join public.life_people p on p.id=s.submitted_by where s.offering_id=f),'[]'::jsonb)
  );
end$$;

commit;
