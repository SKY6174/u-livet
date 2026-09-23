-- Gate refund and scholarship documents on approved application documents and
-- current completion recognition. The same helpers drive UI eligibility and
-- submission enforcement so clients cannot bypass the workflow.
begin;

create index if not exists life_learner_documents_eligibility
  on public.life_learner_document_requests(person_id,offering_id,kind,status)
  where offering_id is not null and status in ('APPROVED','COMPLETED');

create or replace function life_private.learner_document_application_approved(p uuid,f uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select p is not null and f is not null and exists(
    select 1 from public.life_learner_document_requests r
    where r.person_id=p and r.offering_id=f and r.kind='APPLICATION'
      and r.status in ('APPROVED','COMPLETED')
  )
$$;

create or replace function life_private.learner_document_completion_approved(p uuid,f uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select p is not null and f is not null and exists(
    select 1
    from public.life_completion_runs r
    join public.life_completion_approvals a on a.run_id=r.id
    join public.life_enrollments e on e.id=r.enrollment_id
    join public.life_offerings o on o.id=r.offering_id
    join public.life_course_versions v on v.id=o.course_version_id
    where r.person_id=p and r.offering_id=f and e.person_id=p and e.offering_id=f
      and e.status='ACTIVE' and r.outcome='READY'
      and r.input_revision=o.academic_revision and o.academic_sealed
      and (r.evidence->>'policy_id')::uuid is not distinct from v.completion_policy_id
      and life_private.policy_valid((r.evidence->>'policy_id')::uuid,o.org_id,'COMPLETION')
  )
$$;

create or replace function life_private.learner_document_eligibility() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p uuid:=life_private.person_id();
begin
  if p is null then raise exception 'AUTH_REQUIRED';end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'offering_id',o.id,
      'course_name',o.name,
      'application_approved',true,
      'completion_approved',eligibility.completion_approved,
      'refund_allowed',true,
      'scholarship_allowed',eligibility.completion_approved
    ) order by o.ends_on desc,o.name,o.id)
    from public.life_offerings o
    cross join lateral (
      select life_private.learner_document_completion_approved(p,o.id) completion_approved
    ) eligibility
    where life_private.learner_document_application_approved(p,o.id)
  ),'[]'::jsonb);
end$$;

create or replace function life_private.submit_learner_document(
  k text,f uuid,request_key uuid,course_name text,applicant_name text,phone text,
  occurrence text,amount integer,pdf_base64 text,pdf_sha256 text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 p uuid:=life_private.person_id(); o public.life_offerings; org uuid;
 existing public.life_learner_document_requests; result uuid; bytes bytea;
 expected_amount integer; normalized_phone text:=regexp_replace(coalesce(phone,''),'[^0-9]','','g');
begin
 if p is null then raise exception 'AUTH_REQUIRED';end if;
 if k is null or k not in ('APPLICATION','SCHOLARSHIP','REFUND') or request_key is null
  or course_name is null or length(btrim(course_name)) not between 1 and 200
  or applicant_name is null or length(btrim(applicant_name)) not between 1 and 100
  or normalized_phone !~ '^01[016789][0-9]{7,8}$'
  or pdf_base64 is null or length(pdf_base64)>6991000
  or pdf_sha256 is null or pdf_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_INPUT';end if;
 select * into existing from public.life_learner_document_requests r where r.person_id=p and r.request_key=submit_learner_document.request_key;
 if existing.id is not null then
  if existing.kind<>k or existing.offering_id is distinct from f then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return existing.id;
 end if;
 if f is not null then
  select * into o from public.life_offerings x where x.id=f;
  if o.id is null then raise exception 'COURSE_NOT_FOUND';end if;
  org:=o.org_id; course_name:=o.name;
 else
  select id into org from public.life_organizations where slug='uc-anchor';
 end if;
 if org is null then raise exception 'COURSE_NOT_FOUND';end if;
 if k in ('SCHOLARSHIP','REFUND') and not life_private.learner_document_application_approved(p,o.id) then
  raise exception 'APPLICATION_APPROVAL_REQUIRED';
 end if;
 if k='SCHOLARSHIP' and not life_private.learner_document_completion_approved(p,o.id) then
  raise exception 'COMPLETION_APPROVAL_REQUIRED';
 end if;
 if k='REFUND' then
  if o.id is null or o.tuition is null or occurrence is null or occurrence not in
   ('before-start','before-sixth','before-third','before-half','after-half') then raise exception 'TUITION_UNAVAILABLE';end if;
  expected_amount:=life_private.learner_document_refund_amount(o.tuition,occurrence);
  if amount is distinct from expected_amount then raise exception 'REFUND_AMOUNT_MISMATCH';end if;
 else
  occurrence:=null;
 end if;
 begin bytes:=decode(pdf_base64,'base64'); exception when others then raise exception 'INVALID_PDF';end;
 if octet_length(bytes) not between 8 and 5242880
  or convert_from(substring(bytes from 1 for 8),'UTF8')<>'%PDF-1.7'
  or encode(extensions.digest(bytes,'sha256'),'hex')<>pdf_sha256 then raise exception 'INVALID_PDF';end if;
 insert into public.life_learner_document_requests(
  org_id,person_id,offering_id,request_key,kind,course_name,applicant_name,phone_masked,refund_occurrence,amount,current_note
 ) values(
  org,p,o.id,request_key,k,btrim(course_name),btrim(applicant_name),
  case when length(normalized_phone)>=8 then left(normalized_phone,3)||'-****-'||right(normalized_phone,4) else '****' end,
  occurrence,case when k in ('REFUND','SCHOLARSHIP') then amount else null end,
  case when k='APPLICATION' then '입력 완료 문서가 접수되었습니다.' else '신청서가 접수되었습니다.' end
 ) returning id into result;
 insert into life_private.learner_document_files(request_id,pdf_data,pdf_sha256,byte_size)
 values(result,bytes,pdf_sha256,octet_length(bytes));
 insert into public.life_learner_document_events(request_id,actor_id,to_status,note)
 values(result,p,'RECEIVED',case when k='APPLICATION' then '입력 완료 문서가 접수되었습니다.' else '신청서가 접수되었습니다.' end);
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
 values(org,p,'LEARNER_DOCUMENT_RECEIVED',result,jsonb_build_object('kind',k,'offering_id',o.id,'pdf_sha256',pdf_sha256));
 return result;
exception when unique_violation then
 select id into result from public.life_learner_document_requests r where r.person_id=p and r.request_key=submit_learner_document.request_key;
 if result is null then raise;end if;
 return result;
end$$;

create or replace function public.life_learner_document_eligibility() returns jsonb
language sql stable security invoker set search_path='' as $$
  select life_private.learner_document_eligibility()
$$;

revoke all on function life_private.learner_document_application_approved(uuid,uuid),
  life_private.learner_document_completion_approved(uuid,uuid),
  life_private.learner_document_eligibility() from public,anon,authenticated,service_role;
revoke all on function public.life_learner_document_eligibility() from public,anon,authenticated,service_role;
grant execute on function life_private.learner_document_eligibility(),
  public.life_learner_document_eligibility() to authenticated;

notify pgrst,'reload schema';
commit;
