begin;

-- Resolve the caller's active manager organizations once per read, rather than
-- re-running person/session/MFA checks for every course and application row.
-- This is the same predicate as has_role(org_id, 'COURSE_MANAGER').
create or replace function life_private.management_application_rows()
returns table(id uuid, person_id uuid, name text, active boolean,
  offering_id uuid, course_name text, status text, submitted_at timestamptz,
  enrollment_status text, document_id uuid, document_status text)
language sql stable security definer set search_path = ''
as $function$
 with managed_orgs as materialized (
  select distinct r.org_id from public.life_role_assignments r
  where r.person_id=(select life_private.person_id()) and r.role='COURSE_MANAGER'
   and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
 ), managed_offerings as materialized (
  select o.* from life_private.operational_offerings o
  join managed_orgs m on m.org_id=o.org_id
 ), documents as (
  select d.*,row_number() over(partition by d.person_id,d.offering_id
   order by case when d.status in ('REJECTED','CANCELLED') then 1 else 0 end,
    d.submitted_at desc,d.id) position
  from public.life_learner_document_requests d
  where life_private.operational_offering(d.offering_id)
   and d.kind='APPLICATION' and d.deleted_at is null
   and ((d.offering_id is not null and exists(
     select 1 from managed_offerings o where o.id=d.offering_id))
    or (d.offering_id is null and exists(
     select 1 from managed_orgs m where m.org_id=d.org_id)))
 )
 select a.id,a.person_id,p.name,p.active,a.offering_id,o.name,a.status,
  a.submitted_at,e.status,d.id,d.status
 from public.life_applications a
 join managed_offerings o on o.id=a.offering_id
 join public.life_people p on p.id=a.person_id
 left join public.life_enrollments e on e.application_id=a.id
 left join documents d on d.person_id=a.person_id
  and d.offering_id=a.offering_id and d.position=1
 union all
 select d.id,d.person_id,p.name,p.active,d.offering_id,coalesce(o.name,d.course_name),
  d.status,d.submitted_at,null,d.id,d.status
 from documents d join public.life_people p on p.id=d.person_id
 left join life_private.operational_offerings o on o.id=d.offering_id
 where (d.offering_id is null or d.position=1) and not exists(
  select 1 from public.life_applications a
  where a.person_id=d.person_id and a.offering_id=d.offering_id)
$function$;

create or replace function life_private.management_courses()
returns jsonb
language sql stable security definer set search_path = ''
as $function$
 with managed_orgs as materialized (
  select distinct r.org_id from public.life_role_assignments r
  where r.person_id=(select life_private.person_id()) and r.role='COURSE_MANAGER'
   and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name)
  order by o.starts_on desc,o.name),'[]'::jsonb)
 from life_private.operational_offerings o join managed_orgs m on m.org_id=o.org_id
$function$;

commit;
