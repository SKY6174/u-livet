begin;

-- Delete from normal visibility; retain original records and enrollment history.
alter table public.life_learner_document_requests
 add column deleted_at timestamptz,
 add column deleted_by uuid references public.life_people(id),
 add constraint life_learner_document_deletion_actor_check
 check ((deleted_at is null) = (deleted_by is null));

create function life_private.delete_learner_document(r uuid, expected_revision integer)
returns void language plpgsql security definer set search_path='' as $$
declare req public.life_learner_document_requests; p uuid:=life_private.person_id();
begin
 if p is null or not life_private.mfa_recent() then raise exception 'MFA_REAUTH_REQUIRED'; end if;
 select * into req from public.life_learner_document_requests where id=r for update;
 if req.id is null then raise exception 'NOT_FOUND'; end if;
 if not life_private.learner_document_staff(req.org_id) then raise exception 'FORBIDDEN'; end if;
 if req.deleted_at is not null then raise exception 'NOT_FOUND'; end if;
 if expected_revision is distinct from req.revision then raise exception 'STALE_REVISION'; end if;
 update public.life_learner_document_requests
 set deleted_at=now(),deleted_by=p,revision=revision+1,updated_at=now() where id=r;
 insert into public.life_learner_document_events(request_id,actor_id,from_status,to_status,note)
 values(r,p,req.status,req.status,'관리자가 접수 문서를 삭제했습니다. 원본과 처리 기록은 보관됩니다.');
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
 values(req.org_id,p,'LEARNER_DOCUMENT_DELETED',r,jsonb_build_object('revision',req.revision+1,'kind',req.kind));
end$$;
revoke all on function life_private.delete_learner_document(uuid,integer) from public,anon,authenticated,service_role;

create function public.life_delete_learner_document(r uuid, expected_revision integer)
returns void language sql security definer set search_path='' as $$
 select life_private.delete_learner_document(r,expected_revision)
$$;
-- Existing wrappers use the definer bridge so callers cannot execute private helpers.
revoke all on function public.life_delete_learner_document(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.life_delete_learner_document(uuid,integer) to authenticated;

CREATE OR REPLACE FUNCTION life_private.admin_learner_documents_base(k text DEFAULT NULL::text, s text DEFAULT NULL::text, q text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      where r.deleted_at is null and (k is null or r.kind=k) and (s is null or r.status=s)
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
end$function$
;

CREATE OR REPLACE FUNCTION life_private.admit_learner_document(r uuid, expected_revision integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare req public.life_learner_document_requests; o public.life_offerings; a public.life_applications; result_status text;
begin
 if life_private.person_id() is null or not life_private.mfa_recent() then raise exception 'MFA_REAUTH_REQUIRED'; end if;
 select * into req from public.life_learner_document_requests where id=r and deleted_at is null;
 if req.id is null then raise exception 'NOT_FOUND'; end if;
 if req.offering_id is null then raise exception 'LINK_REQUIRED'; end if;
 select * into o from public.life_offerings where id=req.offering_id for update;
 if not life_private.manages(o.id) then raise exception 'FORBIDDEN'; end if;
 select * into req from public.life_learner_document_requests where id=r and deleted_at is null for update;
 if req.id is null then raise exception 'NOT_FOUND'; end if;
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
end$function$
;

CREATE OR REPLACE FUNCTION life_private.cancel_learner_document(r uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare req public.life_learner_document_requests;p uuid:=life_private.person_id();begin
 if p is null then raise exception 'AUTH_REQUIRED';end if;
 select * into req from public.life_learner_document_requests x where x.id=r and deleted_at is null for update;
 if req.id is null then raise exception 'NOT_FOUND'; end if;
 if req.id is null or req.person_id<>p or req.status<>'RECEIVED' then raise exception 'FORBIDDEN';end if;
 update public.life_learner_document_requests set status='CANCELLED',current_note='수강생이 접수를 취소했습니다.',revision=revision+1,updated_at=now(),resolved_at=now() where id=r;
 insert into public.life_learner_document_events(request_id,actor_id,from_status,to_status,note)
 values(r,p,'RECEIVED','CANCELLED','수강생이 접수를 취소했습니다.');
 insert into public.life_audit_events(org_id,actor_id,action,entity_id) values(req.org_id,p,'LEARNER_DOCUMENT_CANCELLED',r);
end$function$
;

CREATE OR REPLACE FUNCTION life_private.decide_learner_document(r uuid, next_status text, note text, expected_revision integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare req public.life_learner_document_requests;
begin
 select * into req from public.life_learner_document_requests where id=r and deleted_at is null;
 if req.id is null then raise exception 'NOT_FOUND'; end if;
 if req.offering_id is not null then perform 1 from public.life_offerings where id=req.offering_id for update; end if;
 select * into req from public.life_learner_document_requests where id=r and deleted_at is null for update;
 if req.id is null then raise exception 'NOT_FOUND'; end if;
 if not life_private.learner_document_staff(req.org_id) then raise exception 'FORBIDDEN'; end if;
 if req.kind='APPLICATION' and next_status='APPROVED' and req.offering_id is null then raise exception 'LINK_REQUIRED'; end if;
 perform life_private.decide_learner_document_base(r,next_status,note,expected_revision);
 if req.kind='APPLICATION' and next_status='APPROVED' and life_private.manages(req.offering_id)
  and exists(select 1 from public.life_applications a where a.offering_id=req.offering_id and a.person_id=req.person_id and a.status in ('SUBMITTED','WAITLISTED')) then
  perform life_private.admit_learner_document(r,expected_revision+1);
 end if;
end$function$
;

CREATE OR REPLACE FUNCTION life_private.learner_document_file(r uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare req public.life_learner_document_requests;f life_private.learner_document_files;p uuid:=life_private.person_id();begin
 if p is null then raise exception 'AUTH_REQUIRED';end if;
 select * into req from public.life_learner_document_requests x where x.id=r and deleted_at is null;
 if req.id is null then raise exception 'NOT_FOUND'; end if;
 if req.person_id<>p and not life_private.learner_document_staff(req.org_id) then raise exception 'FORBIDDEN';end if;
 select * into f from life_private.learner_document_files x where x.request_id=r;
 if f.request_id is null then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('base64',encode(f.pdf_data,'base64'),'sha256',f.pdf_sha256,'byte_size',f.byte_size,
  'kind',req.kind,'course_name',req.course_name,'submitted_at',req.submitted_at);
end$function$
;

CREATE OR REPLACE FUNCTION life_private.link_learner_document(r uuid, f uuid, expected_revision integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare req public.life_learner_document_requests; o public.life_offerings; p uuid:=life_private.person_id();
begin
 if p is null or not life_private.mfa_recent() then raise exception 'MFA_REAUTH_REQUIRED'; end if;
 select * into o from public.life_offerings where id=f for update;
 if o.id is null then raise exception 'COURSE_NOT_FOUND'; end if;
 if not life_private.manages(f) then raise exception 'FORBIDDEN'; end if;
 select * into req from public.life_learner_document_requests where id=r and deleted_at is null for update;
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
end$function$
;

CREATE OR REPLACE FUNCTION life_private.my_learner_documents_base()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p uuid:=life_private.person_id();begin
 if p is null then raise exception 'AUTH_REQUIRED';end if;
 return coalesce((select jsonb_agg(row_to_json(q) order by q.submitted_at desc) from (
  select r.id,r.offering_id,r.kind,r.course_name,r.applicant_name,r.phone_masked,r.refund_occurrence,r.amount,
   r.status,r.current_note,r.revision,r.submitted_at,r.updated_at,r.resolved_at,
   coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'from_status',e.from_status,'to_status',e.to_status,'note',e.note,'created_at',e.created_at,'actor_name',a.name) order by e.created_at,e.id)
    from public.life_learner_document_events e left join public.life_people a on a.id=e.actor_id where e.request_id=r.id),'[]'::jsonb) events
  from public.life_learner_document_requests r where r.person_id=p and r.deleted_at is null order by r.submitted_at desc limit 200
 ) q),'[]'::jsonb);
end$function$
;

CREATE OR REPLACE FUNCTION life_private.submit_learner_document(k text, f uuid, request_key uuid, course_name text, applicant_name text, phone text, occurrence text, amount integer, pdf_base64 text, pdf_sha256 text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p uuid:=life_private.person_id(); existing public.life_learner_document_requests;
begin
 if p is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into existing from public.life_learner_document_requests d
 where d.person_id=p and d.request_key=submit_learner_document.request_key;
 if existing.id is not null then
  if existing.deleted_at is not null then raise exception 'NOT_FOUND'; end if;
  if k='APPLICATION' and f is null then f:=existing.offering_id; end if;
 elsif k='APPLICATION' then
  if f is null or not exists(
   select 1 from public.life_offerings o where o.id=f and (
    exists(select 1 from life_private.course_introductions(o.id))
    or exists(select 1 from public.life_course_guides guide where guide.offering_id=o.id and guide.published)
   )
  ) then raise exception 'COURSE_NOT_FOUND'; end if;
 end if;
 return life_private.submit_learner_document_base(k,f,request_key,course_name,applicant_name,phone,occurrence,amount,pdf_base64,pdf_sha256);
end$function$
;

notify pgrst, 'reload schema';
commit;
