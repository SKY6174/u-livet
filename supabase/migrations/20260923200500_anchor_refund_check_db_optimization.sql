-- Optimize the learner-document queue without changing its public JSON shape.
begin;

create extension if not exists pg_trgm with schema extensions;

create index if not exists life_learner_documents_queue_kind
  on public.life_learner_document_requests(org_id,status,kind,submitted_at desc);
create index if not exists life_learner_documents_course_search
  on public.life_learner_document_requests using gin(course_name extensions.gin_trgm_ops);
create index if not exists life_learner_documents_applicant_search
  on public.life_learner_document_requests using gin(applicant_name extensions.gin_trgm_ops);

create or replace function life_private.admin_learner_documents(
  k text default null,s text default null,q text default null
) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  p uuid:=life_private.person_id();
  normalized_query text:=nullif(btrim(q),'');
begin
  if (k is not null and k not in ('APPLICATION','SCHOLARSHIP','REFUND'))
    or (s is not null and s not in ('RECEIVED','REVIEWING','APPROVED','REJECTED','COMPLETED','CANCELLED'))
    or length(coalesce(q,''))>100 then raise exception 'INVALID_INPUT';end if;
  if p is null or not life_private.mfa_verified() then raise exception 'FORBIDDEN';end if;
  if not exists(
    select 1 from public.life_role_assignments ra
    where ra.person_id=p and ra.role in ('SYSTEM_ADMIN','COURSE_MANAGER','FINANCE')
      and ra.valid_from<=now() and (ra.valid_until is null or ra.valid_until>now())
  ) then raise exception 'FORBIDDEN';end if;

  return (
    with authorized_orgs as materialized (
      select distinct ra.org_id
      from public.life_role_assignments ra
      where ra.person_id=p and ra.role in ('SYSTEM_ADMIN','COURSE_MANAGER','FINANCE')
        and ra.valid_from<=now() and (ra.valid_until is null or ra.valid_until>now())
    ), selected_requests as materialized (
      select r.*
      from public.life_learner_document_requests r
      join authorized_orgs ao on ao.org_id=r.org_id
      where (k is null or r.kind=k) and (s is null or r.status=s)
        and (normalized_query is null or r.course_name ilike '%'||normalized_query||'%'
          or r.applicant_name ilike '%'||normalized_query||'%')
      order by r.submitted_at desc,r.id
      limit 500
    )
    select jsonb_build_object(
      'organizations',coalesce((
        select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.name)
        from public.life_organizations o join authorized_orgs ao on ao.org_id=o.id
      ),'[]'::jsonb),
      'requests',coalesce((
        select jsonb_agg(row_to_json(x) order by x.submitted_at desc,x.id) from (
          select r.id,r.org_id,r.offering_id,r.kind,r.course_name,r.applicant_name,r.phone_masked,
            r.refund_occurrence,r.amount,r.status,r.current_note,r.revision,r.submitted_at,r.updated_at,
            r.resolved_at,rv.name reviewer_name,
            coalesce((
              select jsonb_agg(jsonb_build_object(
                'id',e.id,'from_status',e.from_status,'to_status',e.to_status,'note',e.note,
                'created_at',e.created_at,'actor_name',a.name
              ) order by e.created_at,e.id)
              from public.life_learner_document_events e
              left join public.life_people a on a.id=e.actor_id
              where e.request_id=r.id
            ),'[]'::jsonb) events
          from selected_requests r
          left join public.life_people rv on rv.id=r.reviewer_id
        ) x
      ),'[]'::jsonb)
    )
  );
end$$;

notify pgrst,'reload schema';
commit;
