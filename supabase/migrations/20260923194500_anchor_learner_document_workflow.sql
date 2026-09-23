-- Learner document civil-service workflow. Public tables contain only queue
-- metadata; immutable PDFs stay in life_private and are returned by guarded RPC.
begin;

create table public.life_learner_document_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.life_organizations(id),
  person_id uuid not null references public.life_people(id),
  offering_id uuid,
  request_key uuid not null,
  kind text not null check(kind in ('APPLICATION','SCHOLARSHIP','REFUND')),
  course_name text not null check(length(btrim(course_name)) between 1 and 200),
  applicant_name text not null check(length(btrim(applicant_name)) between 1 and 100),
  phone_masked text not null check(length(phone_masked) between 4 and 30),
  refund_occurrence text check(refund_occurrence is null or refund_occurrence in
    ('before-start','before-sixth','before-third','before-half','after-half')),
  amount integer check(amount is null or amount between 0 and 100000000),
  status text not null default 'RECEIVED' check(status in
    ('RECEIVED','REVIEWING','APPROVED','REJECTED','COMPLETED','CANCELLED')),
  current_note text not null default '' check(length(current_note)<=1000),
  reviewer_id uuid references public.life_people(id),
  revision integer not null default 1 check(revision>=1),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(person_id,request_key),
  foreign key(offering_id,org_id) references public.life_offerings(id,org_id),
  check((kind='REFUND' and offering_id is not null and refund_occurrence is not null and amount is not null)
    or (kind<>'REFUND' and refund_occurrence is null))
);
create index life_learner_documents_person on public.life_learner_document_requests(person_id,submitted_at desc);
create index life_learner_documents_queue on public.life_learner_document_requests(org_id,status,submitted_at desc);
create index life_learner_documents_kind on public.life_learner_document_requests(org_id,kind,submitted_at desc);

create table public.life_learner_document_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.life_learner_document_requests(id) on delete cascade,
  actor_id uuid references public.life_people(id),
  from_status text,
  to_status text not null check(to_status in
    ('RECEIVED','REVIEWING','APPROVED','REJECTED','COMPLETED','CANCELLED')),
  note text not null default '' check(length(note)<=1000),
  created_at timestamptz not null default now()
);
create index life_learner_document_events_request on public.life_learner_document_events(request_id,created_at,id);

create table life_private.learner_document_files (
  request_id uuid primary key references public.life_learner_document_requests(id) on delete cascade,
  pdf_data bytea not null,
  pdf_sha256 text not null check(pdf_sha256 ~ '^[0-9a-f]{64}$'),
  byte_size integer not null check(byte_size between 8 and 5242880),
  created_at timestamptz not null default now()
);

create function life_private.learner_document_staff(o uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and life_private.person_id() is not null
 and life_private.mfa_verified()
 and (life_private.has_role(o,'SYSTEM_ADMIN') or life_private.has_role(o,'COURSE_MANAGER') or life_private.has_role(o,'FINANCE'))
$$;

create function life_private.learner_document_refund_amount(t integer,occurrence text) returns integer
language sql immutable set search_path='' as $$
 select case occurrence
  when 'before-start' then t
  when 'before-sixth' then floor(t::numeric*5/6)::integer
  when 'before-third' then floor(t::numeric*2/3)::integer
  when 'before-half' then floor(t::numeric/2)::integer
  when 'after-half' then 0
 end
$$;

create function life_private.submit_learner_document(
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

create function life_private.my_learner_documents() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p uuid:=life_private.person_id();begin
 if p is null then raise exception 'AUTH_REQUIRED';end if;
 return coalesce((select jsonb_agg(row_to_json(q) order by q.submitted_at desc) from (
  select r.id,r.offering_id,r.kind,r.course_name,r.applicant_name,r.phone_masked,r.refund_occurrence,r.amount,
   r.status,r.current_note,r.revision,r.submitted_at,r.updated_at,r.resolved_at,
   coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'from_status',e.from_status,'to_status',e.to_status,'note',e.note,'created_at',e.created_at,'actor_name',a.name) order by e.created_at,e.id)
    from public.life_learner_document_events e left join public.life_people a on a.id=e.actor_id where e.request_id=r.id),'[]'::jsonb) events
  from public.life_learner_document_requests r where r.person_id=p order by r.submitted_at desc limit 200
 ) q),'[]'::jsonb);
end$$;

create function life_private.admin_learner_documents(k text default null,s text default null,q text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if (k is not null and k not in ('APPLICATION','SCHOLARSHIP','REFUND'))
  or (s is not null and s not in ('RECEIVED','REVIEWING','APPROVED','REJECTED','COMPLETED','CANCELLED'))
  or length(coalesce(q,''))>100 then raise exception 'INVALID_INPUT';end if;
 if not exists(select 1 from public.life_role_assignments ra where ra.person_id=life_private.person_id()
  and ra.role in ('SYSTEM_ADMIN','COURSE_MANAGER','FINANCE') and ra.valid_from<=now()
  and (ra.valid_until is null or ra.valid_until>now()) and life_private.learner_document_staff(ra.org_id)) then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object(
  'organizations',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.name)
   from public.life_organizations o where life_private.learner_document_staff(o.id)),'[]'::jsonb),
  'requests',coalesce((select jsonb_agg(row_to_json(x) order by x.submitted_at desc) from (
   select r.id,r.org_id,r.offering_id,r.kind,r.course_name,r.applicant_name,r.phone_masked,r.refund_occurrence,
    r.amount,r.status,r.current_note,r.revision,r.submitted_at,r.updated_at,r.resolved_at,rv.name reviewer_name,
    coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'from_status',e.from_status,'to_status',e.to_status,'note',e.note,'created_at',e.created_at,'actor_name',a.name) order by e.created_at,e.id)
     from public.life_learner_document_events e left join public.life_people a on a.id=e.actor_id where e.request_id=r.id),'[]'::jsonb) events
   from public.life_learner_document_requests r left join public.life_people rv on rv.id=r.reviewer_id
   where life_private.learner_document_staff(r.org_id) and (k is null or r.kind=k) and (s is null or r.status=s)
    and (coalesce(btrim(q),'')='' or r.course_name ilike '%'||btrim(q)||'%' or r.applicant_name ilike '%'||btrim(q)||'%')
   order by r.submitted_at desc limit 3000
  ) x),'[]'::jsonb)
 );
end$$;

create function life_private.decide_learner_document(r uuid,next_status text,note text,expected_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare req public.life_learner_document_requests;p uuid:=life_private.person_id();begin
 if p is null or not life_private.mfa_recent() then raise exception 'MFA_REAUTH_REQUIRED';end if;
 select * into req from public.life_learner_document_requests x where x.id=r for update;
 if req.id is null then raise exception 'NOT_FOUND';end if;
 if not life_private.learner_document_staff(req.org_id) then raise exception 'FORBIDDEN';end if;
 if expected_revision is distinct from req.revision then raise exception 'STALE_REVISION';end if;
 if note is null or length(btrim(note)) not between 1 and 1000 then raise exception 'NOTE_REQUIRED';end if;
 if not ((req.status='RECEIVED' and next_status in ('REVIEWING','APPROVED','REJECTED'))
  or (req.status='REVIEWING' and next_status in ('APPROVED','REJECTED'))
  or (req.status='APPROVED' and next_status='COMPLETED')) then raise exception 'INVALID_TRANSITION';end if;
 update public.life_learner_document_requests set status=next_status,current_note=btrim(note),reviewer_id=p,
  revision=revision+1,updated_at=now(),resolved_at=case when next_status in ('REJECTED','COMPLETED') then now() else null end where id=r;
 insert into public.life_learner_document_events(request_id,actor_id,from_status,to_status,note)
 values(r,p,req.status,next_status,btrim(note));
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
 values(req.org_id,p,'LEARNER_DOCUMENT_'||next_status,r,jsonb_build_object('kind',req.kind,'from_status',req.status,'revision',req.revision+1));
end$$;

create function life_private.cancel_learner_document(r uuid) returns void
language plpgsql security definer set search_path='' as $$
declare req public.life_learner_document_requests;p uuid:=life_private.person_id();begin
 if p is null then raise exception 'AUTH_REQUIRED';end if;
 select * into req from public.life_learner_document_requests x where x.id=r for update;
 if req.id is null or req.person_id<>p or req.status<>'RECEIVED' then raise exception 'FORBIDDEN';end if;
 update public.life_learner_document_requests set status='CANCELLED',current_note='수강생이 접수를 취소했습니다.',revision=revision+1,updated_at=now(),resolved_at=now() where id=r;
 insert into public.life_learner_document_events(request_id,actor_id,from_status,to_status,note)
 values(r,p,'RECEIVED','CANCELLED','수강생이 접수를 취소했습니다.');
 insert into public.life_audit_events(org_id,actor_id,action,entity_id) values(req.org_id,p,'LEARNER_DOCUMENT_CANCELLED',r);
end$$;

create function life_private.learner_document_file(r uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare req public.life_learner_document_requests;f life_private.learner_document_files;p uuid:=life_private.person_id();begin
 if p is null then raise exception 'AUTH_REQUIRED';end if;
 select * into req from public.life_learner_document_requests x where x.id=r;
 if req.id is null then raise exception 'NOT_FOUND';end if;
 if req.person_id<>p and not life_private.learner_document_staff(req.org_id) then raise exception 'FORBIDDEN';end if;
 select * into f from life_private.learner_document_files x where x.request_id=r;
 if f.request_id is null then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('base64',encode(f.pdf_data,'base64'),'sha256',f.pdf_sha256,'byte_size',f.byte_size,
  'kind',req.kind,'course_name',req.course_name,'submitted_at',req.submitted_at);
end$$;

create function public.life_submit_learner_document(k text,f uuid,request_key uuid,course_name text,applicant_name text,phone text,occurrence text,amount integer,pdf_base64 text,pdf_sha256 text)
returns uuid language sql security invoker set search_path='' as $$select life_private.submit_learner_document(k,f,request_key,course_name,applicant_name,phone,occurrence,amount,pdf_base64,pdf_sha256)$$;
create function public.life_my_learner_documents() returns jsonb language sql stable security invoker set search_path='' as $$select life_private.my_learner_documents()$$;
create function public.life_admin_learner_documents(k text default null,s text default null,q text default null) returns jsonb language sql stable security invoker set search_path='' as $$select life_private.admin_learner_documents(k,s,q)$$;
create function public.life_decide_learner_document(r uuid,next_status text,note text,expected_revision integer) returns void language sql security invoker set search_path='' as $$select life_private.decide_learner_document(r,next_status,note,expected_revision)$$;
create function public.life_cancel_learner_document(r uuid) returns void language sql security invoker set search_path='' as $$select life_private.cancel_learner_document(r)$$;
create function public.life_learner_document_file(r uuid) returns jsonb language sql stable security invoker set search_path='' as $$select life_private.learner_document_file(r)$$;

alter table public.life_learner_document_requests enable row level security;
alter table public.life_learner_document_events enable row level security;
alter table life_private.learner_document_files enable row level security;
revoke all on public.life_learner_document_requests,public.life_learner_document_events,life_private.learner_document_files from public,anon,authenticated,service_role;
do $$declare f record;begin
 for f in select p.oid::regprocedure::text sig,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','life_private') and p.proname like '%learner_document%' loop
  execute 'revoke all on function '||f.sig||' from public,anon,authenticated,service_role';
  execute 'grant execute on function '||f.sig||' to authenticated';
 end loop;
end$$;
notify pgrst,'reload schema';
commit;
