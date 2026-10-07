begin;

-- Only checked wrappers supply already-authorized document IDs to this helper.
create function life_private.document_registration_states(request_ids uuid[])
returns table(request_id uuid,registration jsonb)
language sql stable security definer set search_path='' as $$
 with documents as materialized (
  select d.id,d.person_id,d.offering_id from public.life_learner_document_requests d
  where d.id=any(request_ids)
 ), pairs as materialized (
  select distinct person_id,offering_id from documents
 ), security as materialized (
  select life_private.mfa_verified() verified
 ), offering_access as materialized (
  select f.offering_id,life_private.manages(f.offering_id) and security.verified can_manage
  from (select distinct offering_id from documents where offering_id is not null) f cross join security
 ), states as materialized (
  select pair.person_id,pair.offering_id,jsonb_build_object(
   'offering_name',o.name,'offering_status',o.status,'starts_on',o.starts_on,'ends_on',o.ends_on,
   'application_id',a.id,'application_status',a.status,
   'active',exists(select 1 from public.life_enrollments e where e.application_id=a.id and e.status='ACTIVE'),
   'can_manage',coalesce(access.can_manage,false),
   'can_apply',coalesce(o.status='PUBLISHED' and not o.academic_sealed and now()>=o.apply_from and now()<o.apply_until
     and o.ends_on>=(now() at time zone 'Asia/Seoul')::date and life_private.policy_valid(o.enrollment_policy_id,o.org_id,'ENROLLMENT')
     and a.id is null,false),
   'can_admit',coalesce(a.status in ('SUBMITTED','WAITLISTED') and o.status in ('PUBLISHED','CLOSED') and not o.academic_sealed
     and o.ends_on>=(now() at time zone 'Asia/Seoul')::date and a.policy_id=o.enrollment_policy_id
     and life_private.policy_valid(a.policy_id,o.org_id,'ENROLLMENT')
     and exists(select 1 from public.life_consent_events c where c.person_id=pair.person_id and c.policy_id=a.policy_id and c.accepted and c.source='APPLICATION')
     and (o.tuition=0 or exists(select 1 from public.life_offering_finance fin join public.life_consent_events c on c.policy_id=fin.policy_id
       where fin.offering_id=o.id and c.person_id=pair.person_id and c.accepted and c.source='PAID_APPLICATION'
        and life_private.policy_valid(fin.policy_id,o.org_id,'REFUND'))),false)
  ) registration
  from pairs pair left join public.life_offerings o on o.id=pair.offering_id
  left join public.life_applications a on a.offering_id=o.id and a.person_id=pair.person_id
  left join offering_access access on access.offering_id=o.id
 )
 select d.id,state.registration from documents d join states state on state.person_id=d.person_id
  and state.offering_id is not distinct from d.offering_id
$$;
revoke all on function life_private.document_registration_states(uuid[]) from public,anon,authenticated,service_role;

create or replace function life_private.my_learner_documents() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare authorized jsonb:=life_private.my_learner_documents_base(); ids uuid[];
begin
 select array_agg((x.value->>'id')::uuid) into ids from jsonb_array_elements(authorized) x(value);
 return coalesce((with registration as materialized (select * from life_private.document_registration_states(ids))
  select jsonb_agg(x.value||jsonb_build_object('registration',r.registration) order by x.ordinality)
  from jsonb_array_elements(authorized) with ordinality x(value,ordinality)
  left join registration r on r.request_id=(x.value->>'id')::uuid),'[]'::jsonb);
end$$;

create or replace function life_private.admin_learner_documents(k text default null,s text default null,q text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare authorized jsonb:=life_private.admin_learner_documents_base(k,s,q); ids uuid[];
begin
 select array_agg((x.value->>'id')::uuid) into ids from jsonb_array_elements(authorized->'requests') x(value);
 return authorized||jsonb_build_object(
  'requests',coalesce((with registration as materialized (select * from life_private.document_registration_states(ids))
   select jsonb_agg(x.value||jsonb_build_object('registration',r.registration) order by x.ordinality)
   from jsonb_array_elements(authorized->'requests') with ordinality x(value,ordinality)
   left join registration r on r.request_id=(x.value->>'id')::uuid),'[]'::jsonb),
  'offerings',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'org_id',o.org_id,'name',o.name,'status',o.status,'starts_on',o.starts_on,'ends_on',o.ends_on) order by o.starts_on desc,o.name)
   from public.life_offerings o where life_private.manages(o.id) and o.status<>'ARCHIVED' and not o.academic_sealed
    and o.ends_on>=(now() at time zone 'Asia/Seoul')::date),'[]'::jsonb));
end$$;

-- Existing wrapper owner and grants, base authorization and writes are retained.
notify pgrst,'reload schema';
commit;
