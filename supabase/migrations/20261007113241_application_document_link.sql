begin;

-- Keep the original PDF/decision intact when repairing a missing offering FK.
create function life_private.link_learner_document(r uuid,f uuid,expected_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare req public.life_learner_document_requests; o public.life_offerings; p uuid:=life_private.person_id();
begin
 if p is null or not life_private.mfa_recent() then raise exception 'MFA_REAUTH_REQUIRED'; end if;
 select * into o from public.life_offerings where id=f for update;
 if o.id is null then raise exception 'COURSE_NOT_FOUND'; end if;
 if not life_private.manages(f) then raise exception 'FORBIDDEN'; end if;
 select * into req from public.life_learner_document_requests where id=r for update;
 if req.id is null then raise exception 'NOT_FOUND'; end if;
 if req.org_id<>o.org_id then raise exception 'FORBIDDEN'; end if;
 if req.kind<>'APPLICATION' or req.status in ('REJECTED','CANCELLED') then raise exception 'INVALID_TRANSITION'; end if;
 if req.offering_id=f then return; end if;
 if req.offering_id is not null then raise exception 'LINK_IMMUTABLE'; end if;
 if expected_revision is distinct from req.revision then raise exception 'STALE_REVISION'; end if;
 if o.status='ARCHIVED' or o.academic_sealed or o.ends_on<(now() at time zone 'Asia/Seoul')::date then raise exception 'OFFERING_UNAVAILABLE'; end if;
 update public.life_learner_document_requests set offering_id=f,revision=revision+1,updated_at=now() where id=r;
 insert into public.life_learner_document_events(request_id,actor_id,from_status,to_status,note)
 values(r,p,req.status,req.status,'연결 과정: '||o.name||' ('||o.starts_on||' ~ '||o.ends_on||')');
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
 values(req.org_id,p,'LEARNER_DOCUMENT_LINKED',r,jsonb_build_object('offering_id',f,'revision',req.revision+1));
end$$;

-- Internal helper: consumers authorize the document before asking for this state.
create function life_private.document_registration_state(r uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'offering_name',o.name,'offering_status',o.status,'starts_on',o.starts_on,'ends_on',o.ends_on,
  'application_id',a.id,'application_status',a.status,
  'active',exists(select 1 from public.life_enrollments e where e.application_id=a.id and e.status='ACTIVE'),
  'can_manage',coalesce(life_private.manages(o.id) and life_private.mfa_verified(),false),
  'can_apply',coalesce(o.status='PUBLISHED' and not o.academic_sealed and now()>=o.apply_from and now()<o.apply_until
    and o.ends_on>=(now() at time zone 'Asia/Seoul')::date and life_private.policy_valid(o.enrollment_policy_id,o.org_id,'ENROLLMENT')
    and a.id is null,false),
  'can_admit',coalesce(a.status in ('SUBMITTED','WAITLISTED') and o.status in ('PUBLISHED','CLOSED') and not o.academic_sealed
    and o.ends_on>=(now() at time zone 'Asia/Seoul')::date and a.policy_id=o.enrollment_policy_id
    and life_private.policy_valid(a.policy_id,o.org_id,'ENROLLMENT')
    and exists(select 1 from public.life_consent_events c where c.person_id=d.person_id and c.policy_id=a.policy_id and c.accepted and c.source='APPLICATION')
    and (o.tuition=0 or exists(select 1 from public.life_offering_finance fin join public.life_consent_events c on c.policy_id=fin.policy_id
      where fin.offering_id=o.id and c.person_id=d.person_id and c.accepted and c.source='PAID_APPLICATION'
       and life_private.policy_valid(fin.policy_id,o.org_id,'REFUND'))),false)
 )
 from public.life_learner_document_requests d left join public.life_offerings o on o.id=d.offering_id
 left join public.life_applications a on a.offering_id=o.id and a.person_id=d.person_id where d.id=r
$$;

create function life_private.admit_learner_document(r uuid,expected_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare req public.life_learner_document_requests; o public.life_offerings; a public.life_applications; result_status text;
begin
 if life_private.person_id() is null or not life_private.mfa_recent() then raise exception 'MFA_REAUTH_REQUIRED'; end if;
 select * into req from public.life_learner_document_requests where id=r;
 if req.id is null then raise exception 'NOT_FOUND'; end if;
 if req.offering_id is null then raise exception 'LINK_REQUIRED'; end if;
 select * into o from public.life_offerings where id=req.offering_id for update;
 if not life_private.manages(o.id) then raise exception 'FORBIDDEN'; end if;
 select * into req from public.life_learner_document_requests where id=r for update;
 if req.offering_id is distinct from o.id then raise exception 'STALE_REVISION'; end if;
 if req.kind<>'APPLICATION' or req.status not in ('APPROVED','COMPLETED') then raise exception 'DOCUMENT_APPROVAL_REQUIRED'; end if;
 select * into a from public.life_applications where offering_id=o.id and person_id=req.person_id for update;
 if a.id is null then raise exception 'APPLICATION_REQUIRED'; end if;
 if a.status='PENDING_PAYMENT' or (a.status='ACCEPTED' and exists(select 1 from public.life_enrollments e where e.application_id=a.id and e.status='ACTIVE')) then return; end if;
 if expected_revision is distinct from req.revision then raise exception 'STALE_REVISION'; end if;
 if o.status not in ('PUBLISHED','CLOSED') or o.academic_sealed or o.ends_on<(now() at time zone 'Asia/Seoul')::date then raise exception 'OFFERING_UNAVAILABLE'; end if;
 if a.policy_id is distinct from o.enrollment_policy_id or not life_private.policy_valid(a.policy_id,o.org_id,'ENROLLMENT')
  or not exists(select 1 from public.life_consent_events c where c.person_id=req.person_id and c.policy_id=a.policy_id and c.accepted and c.source='APPLICATION') then raise exception 'CONSENT_REQUIRED'; end if;
 if o.tuition>0 and not exists(select 1 from public.life_offering_finance fin join public.life_consent_events c on c.policy_id=fin.policy_id
  where fin.offering_id=o.id and c.person_id=req.person_id and c.accepted and c.source='PAID_APPLICATION'
   and life_private.policy_valid(fin.policy_id,o.org_id,'REFUND')) then raise exception 'CONSENT_REQUIRED'; end if;
 -- Existing admission rules own capacity, paid seat reservations and invoices.
 perform life_private.review_application(a.id,'ACCEPTED','승인 원서에 따른 수강 등록 처리',a.status);
 select status into result_status from public.life_applications where id=a.id;
 update public.life_learner_document_requests set revision=revision+1,updated_at=now() where id=r;
 insert into public.life_learner_document_events(request_id,actor_id,from_status,to_status,note)
 values(r,life_private.person_id(),req.status,req.status,case when result_status='PENDING_PAYMENT' then '수강 등록 절차: 납부 대기' else '수강 등록 완료' end);
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
 values(req.org_id,life_private.person_id(),'LEARNER_DOCUMENT_ADMISSION',r,jsonb_build_object('application_id',a.id,'status',result_status,'revision',req.revision+1));
end$$;

alter function life_private.decide_learner_document(uuid,text,text,integer) rename to decide_learner_document_base;
create function life_private.decide_learner_document(r uuid,next_status text,note text,expected_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare req public.life_learner_document_requests;
begin
 select * into req from public.life_learner_document_requests where id=r;
 if req.offering_id is not null then perform 1 from public.life_offerings where id=req.offering_id for update; end if;
 select * into req from public.life_learner_document_requests where id=r for update;
 if not life_private.learner_document_staff(req.org_id) then raise exception 'FORBIDDEN'; end if;
 if req.kind='APPLICATION' and next_status='APPROVED' and req.offering_id is null then raise exception 'LINK_REQUIRED'; end if;
 perform life_private.decide_learner_document_base(r,next_status,note,expected_revision);
 if req.kind='APPLICATION' and next_status='APPROVED' and life_private.manages(req.offering_id)
  and exists(select 1 from public.life_applications a where a.offering_id=req.offering_id and a.person_id=req.person_id and a.status in ('SUBMITTED','WAITLISTED')) then
  perform life_private.admit_learner_document(r,expected_revision+1);
 end if;
end$$;

alter function life_private.my_learner_documents() rename to my_learner_documents_base;
create function life_private.my_learner_documents() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare authorized jsonb:=life_private.my_learner_documents_base();
begin
 return coalesce((select jsonb_agg(x.value||jsonb_build_object('registration',life_private.document_registration_state((x.value->>'id')::uuid)) order by x.ordinality)
  from jsonb_array_elements(authorized) with ordinality x(value,ordinality)),'[]'::jsonb);
end$$;

alter function life_private.admin_learner_documents(text,text,text) rename to admin_learner_documents_base;
create function life_private.admin_learner_documents(k text default null,s text default null,q text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare authorized jsonb:=life_private.admin_learner_documents_base(k,s,q);
begin
 return authorized||jsonb_build_object(
  'requests',coalesce((select jsonb_agg(x.value||jsonb_build_object('registration',life_private.document_registration_state((x.value->>'id')::uuid)) order by x.ordinality)
   from jsonb_array_elements(authorized->'requests') with ordinality x(value,ordinality)),'[]'::jsonb),
  'offerings',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'org_id',o.org_id,'name',o.name,'status',o.status,'starts_on',o.starts_on,'ends_on',o.ends_on) order by o.starts_on desc,o.name)
   from public.life_offerings o where life_private.manages(o.id) and o.status<>'ARCHIVED' and not o.academic_sealed
    and o.ends_on>=(now() at time zone 'Asia/Seoul')::date),'[]'::jsonb));
end$$;

alter function life_private.submit_learner_document(text,uuid,uuid,text,text,text,text,integer,text,text) rename to submit_learner_document_base;
-- PL/pgSQL parameter qualification follows the function's block name. Preserve
-- the original retry checks after moving the implementation behind a wrapper.
do $$
declare definition text;
begin
 select pg_get_functiondef('life_private.submit_learner_document_base(text,uuid,uuid,text,text,text,text,integer,text,text)'::regprocedure) into definition;
 execute replace(definition,'submit_learner_document.request_key','submit_learner_document_base.request_key');
end$$;
create function life_private.submit_learner_document(k text,f uuid,request_key uuid,course_name text,applicant_name text,phone text,occurrence text,amount integer,pdf_base64 text,pdf_sha256 text) returns uuid
language plpgsql security definer set search_path='' as $$
declare existing public.life_learner_document_requests; matches uuid[];
begin
 -- Resolve retries against their original link, even if a guide changes later.
 select * into existing from public.life_learner_document_requests d where d.person_id=life_private.person_id() and d.request_key=submit_learner_document.request_key;
 if k='APPLICATION' and f is null then
  if existing.id is not null then f:=existing.offering_id;
  else
   select array_agg(distinct o.id) into matches from public.life_course_guides g join public.life_offerings o on o.id=g.offering_id
   join public.life_organizations org on org.id=o.org_id and org.slug='uc-anchor'
   where g.published and regexp_replace(btrim(g.name),'\s+','','g')=regexp_replace(btrim(course_name),'\s+','','g')
    and o.status in ('PUBLISHED','CLOSED') and not o.academic_sealed and o.ends_on>=(now() at time zone 'Asia/Seoul')::date;
   if cardinality(matches)=1 then f:=matches[1]; end if;
  end if;
 end if;
 return life_private.submit_learner_document_base(k,f,request_key,course_name,applicant_name,phone,occurrence,amount,pdf_base64,pdf_sha256);
end$$;

-- Historical repair requires a single usable guide mapping. Expired drafts stay
-- unlinked until an operator confirms the actual offering; consent is untouched.
do $$
declare item record;
begin
 for item in
  select d.id,d.org_id,d.status,d.revision,(array_agg(distinct o.id))[1] offering_id
  from public.life_learner_document_requests d join public.life_course_guides g
   on g.published and regexp_replace(btrim(g.name),'\s+','','g')=regexp_replace(btrim(d.course_name),'\s+','','g')
  join public.life_offerings o on o.id=g.offering_id and o.org_id=d.org_id
  where d.kind='APPLICATION' and d.offering_id is null and d.status not in ('REJECTED','CANCELLED')
   and o.status in ('PUBLISHED','CLOSED') and not o.academic_sealed and o.ends_on>=(now() at time zone 'Asia/Seoul')::date
  group by d.id,d.org_id,d.status,d.revision having count(distinct o.id)=1
 loop
  update public.life_learner_document_requests set offering_id=item.offering_id,revision=revision+1,updated_at=now() where id=item.id;
  insert into public.life_learner_document_events(request_id,from_status,to_status,note)
   values(item.id,item.status,item.status,'공개 과정 안내의 고유 연결 정보로 과정을 연결했습니다.');
  insert into public.life_audit_events(org_id,action,entity_id,details)
   values(item.org_id,'LEARNER_DOCUMENT_LINK_BACKFILL',item.id,jsonb_build_object('offering_id',item.offering_id,'revision',item.revision+1));
 end loop;
end$$;

-- Rebind wrappers after renaming; callers can only enter checked paths.
create or replace function public.life_my_learner_documents() returns jsonb language sql stable security invoker set search_path='' as $$select life_private.my_learner_documents()$$;
create or replace function public.life_admin_learner_documents(k text default null,s text default null,q text default null) returns jsonb language sql stable security invoker set search_path='' as $$select life_private.admin_learner_documents(k,s,q)$$;
create or replace function public.life_decide_learner_document(r uuid,next_status text,note text,expected_revision integer) returns void language sql security invoker set search_path='' as $$select life_private.decide_learner_document(r,next_status,note,expected_revision)$$;
create or replace function public.life_submit_learner_document(k text,f uuid,request_key uuid,course_name text,applicant_name text,phone text,occurrence text,amount integer,pdf_base64 text,pdf_sha256 text) returns uuid language sql security invoker set search_path='' as $$select life_private.submit_learner_document(k,f,request_key,course_name,applicant_name,phone,occurrence,amount,pdf_base64,pdf_sha256)$$;
create function public.life_link_learner_document(r uuid,f uuid,expected_revision integer) returns void language sql security invoker set search_path='' as $$select life_private.link_learner_document(r,f,expected_revision)$$;
create function public.life_admit_learner_document(r uuid,expected_revision integer) returns void language sql security invoker set search_path='' as $$select life_private.admit_learner_document(r,expected_revision)$$;

revoke all on function life_private.decide_learner_document_base(uuid,text,text,integer),life_private.my_learner_documents_base(),life_private.admin_learner_documents_base(text,text,text),life_private.submit_learner_document_base(text,uuid,uuid,text,text,text,text,integer,text,text),life_private.document_registration_state(uuid) from public,anon,authenticated,service_role;
revoke all on function life_private.link_learner_document(uuid,uuid,integer),life_private.admit_learner_document(uuid,integer),life_private.decide_learner_document(uuid,text,text,integer),life_private.my_learner_documents(),life_private.admin_learner_documents(text,text,text),life_private.submit_learner_document(text,uuid,uuid,text,text,text,text,integer,text,text),public.life_link_learner_document(uuid,uuid,integer),public.life_admit_learner_document(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function life_private.link_learner_document(uuid,uuid,integer),life_private.admit_learner_document(uuid,integer),life_private.decide_learner_document(uuid,text,text,integer),life_private.my_learner_documents(),life_private.admin_learner_documents(text,text,text),life_private.submit_learner_document(text,uuid,uuid,text,text,text,text,integer,text,text),public.life_link_learner_document(uuid,uuid,integer),public.life_admit_learner_document(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
