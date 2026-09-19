begin;
create table public.life_teaching_logs (
 id uuid primary key default gen_random_uuid(),session_id uuid not null references public.life_class_sessions,
 person_id uuid not null references public.life_people,minutes numeric not null check(minutes>0),notes text not null check(length(trim(notes)) between 1 and 3000),
 revision integer not null default 1,submitted_at timestamptz not null default now(),approved_revision integer,approved_by uuid references public.life_people,approved_at timestamptz,session_snapshot jsonb,
 unique(session_id,person_id),check(approved_by is distinct from person_id)
);
create table life_private.issuer_seals(id uuid primary key default gen_random_uuid(),png bytea not null check(octet_length(png)<=500000),reference text not null);
create table public.life_issuer_authorizations (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.life_organizations,
 organization_name text not null check(length(organization_name) between 1 and 150),title text not null check(length(title) between 1 and 100),holder_name text not null check(length(holder_name) between 1 and 100),
 valid_from timestamptz not null,valid_until timestamptz not null,approval_reference text not null check(length(trim(approval_reference))>0),approved_by uuid not null references public.life_people,approved_at timestamptz not null,
 seal_id uuid references life_private.issuer_seals,seal_omission_basis text,test_only boolean not null default false,revoked_at timestamptz,
 check(valid_until>valid_from),check((seal_id is not null and seal_omission_basis is null) or (seal_id is null and coalesce(length(trim(seal_omission_basis))>0,false)))
);
create table public.life_issuer_delegations (
 id uuid primary key default gen_random_uuid(),issuer_id uuid not null references public.life_issuer_authorizations,person_id uuid not null references public.life_people,
 kind text not null check(kind in ('COMPLETION','TEACHING')),valid_from timestamptz not null,valid_until timestamptz not null,approval_reference text not null,check(valid_until>valid_from)
);
create table public.life_certificate_templates (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.life_organizations,kind text not null check(kind in ('COMPLETION','TEACHING')),
 version text not null,title text not null check(length(title) between 1 and 100),body text not null check(length(body) between 1 and 1000),layout text not null default 'v1' check(layout='v1'),
 approved_by uuid not null references public.life_people,approved_at timestamptz not null,approval_reference text not null,revoked_at timestamptz,unique(org_id,kind,version)
);
create table public.life_certificate_requests (
 id uuid primary key default gen_random_uuid(),offering_id uuid not null references public.life_offerings,person_id uuid not null references public.life_people,
 kind text not null check(kind in ('COMPLETION','TEACHING')),status text not null default 'REQUESTED' check(status in ('REQUESTED','GENERATING','ISSUED','REVOKED')),
 supersedes_id uuid,reason text not null default '',requested_at timestamptz not null default now()
);
create unique index life_certificate_first on public.life_certificate_requests(offering_id,person_id,kind) where supersedes_id is null;
create unique index life_certificate_replacement on public.life_certificate_requests(supersedes_id) where supersedes_id is not null;
create table life_private.certificate_counters(org_id uuid references public.life_organizations,kind text,year integer,next_no bigint not null,primary key(org_id,kind,year));
create table public.life_certificate_issues (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique references public.life_certificate_requests,
 issuer_id uuid not null references public.life_issuer_authorizations,template_id uuid not null references public.life_certificate_templates,
 org_id uuid not null references public.life_organizations,certificate_no text not null,approved_by uuid not null references public.life_people,approved_at timestamptz not null default now(),
 snapshot jsonb not null,evidence_hash text not null,verification_hash text not null unique,status text not null default 'GENERATING' check(status in ('GENERATING','ISSUED','REVOKED','SUPERSEDED')),
 file_sha256 text,issued_at timestamptz,revocation_reason text,revoked_at timestamptz,lease_until timestamptz,lease_nonce uuid,last_error text,
 unique(org_id,certificate_no),check(status not in ('ISSUED','SUPERSEDED') or (file_sha256 is not null and issued_at is not null))
);
alter table public.life_certificate_requests add foreign key(supersedes_id) references public.life_certificate_issues;
create table life_private.certificate_tokens(issue_id uuid primary key references public.life_certificate_issues,token text not null);
create table life_private.certificate_files(issue_id uuid primary key references public.life_certificate_issues,pdf bytea not null check(octet_length(pdf) between 100 and 2000000));
create table life_private.verification_limits(key text primary key,window_start timestamptz not null,hits integer not null);
create index life_certificate_requests_person on public.life_certificate_requests(person_id,requested_at);

create function life_private.issuer_valid(i uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.life_issuer_authorizations where id=i and revoked_at is null and valid_from<=now() and valid_until>now())
$$;
create function life_private.can_issue(i uuid,k text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.life_issuer_authorizations a join public.life_issuer_delegations d on d.issuer_id=a.id where a.id=i and life_private.issuer_valid(i) and life_private.has_role(a.org_id,'CERTIFIER') and d.person_id=life_private.person_id() and d.kind=k and d.valid_from<=now() and d.valid_until>now())
$$;
create function life_private.certificate_staff(o uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.life_issuer_authorizations a where a.org_id=o and (life_private.can_issue(a.id,'COMPLETION') or life_private.can_issue(a.id,'TEACHING')))
$$;
create function life_private.cert_config_frozen() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or (to_jsonb(old)-'revoked_at') is distinct from (to_jsonb(new)-'revoked_at') or old.revoked_at is not null then raise exception 'APPROVED_CONFIG_IMMUTABLE'; end if;return new;
end $$;
create trigger life_issuer_frozen before update or delete on public.life_issuer_authorizations for each row execute function life_private.cert_config_frozen();
create trigger life_template_frozen before update or delete on public.life_certificate_templates for each row execute function life_private.cert_config_frozen();

create function life_private.submit_teaching(s uuid,minutes numeric,notes text,expected_revision integer) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.life_class_sessions;l public.life_teaching_logs;result uuid;
begin
 select * into c from public.life_class_sessions where id=s for update;
 if c.id is null or not life_private.teaches(c.offering_id) then raise exception 'FORBIDDEN';end if;
 if c.status<>'SCHEDULED' or c.ends_at>now() then raise exception 'CLASS_NOT_FINISHED';end if;
 if minutes is null or minutes<=0 or minutes>extract(epoch from c.ends_at-c.starts_at)/60 then raise exception 'INVALID_INPUT';end if;
 select * into l from public.life_teaching_logs where session_id=s and person_id=life_private.person_id();
 if coalesce(l.revision,0) is distinct from expected_revision then raise exception 'REVISION_CHANGED';end if;
 insert into public.life_teaching_logs(session_id,person_id,minutes,notes) values(s,life_private.person_id(),minutes,notes)
 on conflict(session_id,person_id) do update set minutes=excluded.minutes,notes=excluded.notes,revision=public.life_teaching_logs.revision+1,submitted_at=now(),approved_by=null,approved_at=null,approved_revision=null,session_snapshot=null returning id into result;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details) select org_id,life_private.person_id(),'TEACHING_SUBMITTED',result,jsonb_build_object('before',to_jsonb(l),'minutes',minutes,'notes',notes) from public.life_offerings where id=c.offering_id;
 return result;
end $$;
create function public.life_submit_teaching(s uuid,minutes numeric,notes text,expected_revision integer) returns uuid language sql security invoker set search_path='' as $$select life_private.submit_teaching(s,minutes,notes,expected_revision)$$;
create function life_private.approve_teaching(l uuid,expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare v public.life_teaching_logs;c public.life_class_sessions;
begin
 select * into v from public.life_teaching_logs where id=l for update;select * into c from public.life_class_sessions where id=v.session_id;
 if v.id is null or not life_private.manages(c.offering_id) then raise exception 'FORBIDDEN';end if;
 if v.person_id=life_private.person_id() then raise exception 'SELF_APPROVAL_FORBIDDEN';end if;
 if v.revision is distinct from expected_revision then raise exception 'REVISION_CHANGED';end if;
 if c.status<>'SCHEDULED' or c.ends_at>now() or v.minutes>extract(epoch from c.ends_at-c.starts_at)/60 then raise exception 'CLASS_NOT_FINISHED';end if;
 update public.life_teaching_logs set approved_revision=revision,approved_by=life_private.person_id(),approved_at=now(),session_snapshot=to_jsonb(c) where id=l;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id) select org_id,life_private.person_id(),'TEACHING_APPROVED',l from public.life_offerings where id=c.offering_id;
end $$;
create function public.life_approve_teaching(l uuid,expected_revision integer) returns void language sql security invoker set search_path='' as $$select life_private.approve_teaching(l,expected_revision)$$;

-- Internal evidence: never exposed as an unauthenticated/person-id lookup.
create function life_private.certificate_evidence(f uuid,p uuid,k text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o public.life_offerings;r public.life_completion_runs;items jsonb;who text;minutes numeric;
begin
 select * into o from public.life_offerings where id=f;select name into who from public.life_people where id=p;
 if o.id is null or who is null then return null;end if;
 if k='COMPLETION' then
  select cr.* into r from public.life_completion_runs cr join public.life_completion_approvals ca on ca.run_id=cr.id join public.life_enrollments e on e.id=cr.enrollment_id where cr.offering_id=f and cr.person_id=p and cr.input_revision=o.academic_revision and cr.outcome='READY' and e.status='ACTIVE' order by ca.approved_at desc limit 1;
  if r.id is null or not life_private.policy_valid((r.evidence->>'policy_id')::uuid,o.org_id,'COMPLETION') then return null;end if;
  select case when count(*)>0 and count(*) filter(where x->>'credited_minutes' is null)=0 then sum((x->>'credited_minutes')::numeric) end into minutes from jsonb_array_elements(r.evidence->'sessions') x;
  items:=jsonb_build_object('completion_run',r.id,'input_revision',r.input_revision,'minutes',minutes);
 elsif k='TEACHING' then
  select jsonb_agg(jsonb_build_object('log_id',l.id,'revision',l.revision,'approved_at',l.approved_at,'session_id',s.id,'title',s.title,'starts_at',s.starts_at,'minutes',l.minutes) order by s.starts_at,s.id),sum(l.minutes)
  into items,minutes from public.life_teaching_logs l join public.life_class_sessions s on s.id=l.session_id where s.offering_id=f and l.person_id=p and l.approved_revision=l.revision and l.approved_at is not null and s.status='SCHEDULED' and s.ends_at<=now() and l.session_snapshot=to_jsonb(s);
  if items is null then return null;end if;
  -- Any changed/unapproved log makes the full claimed period unready; do not silently omit it.
  if exists(select 1 from public.life_teaching_logs l join public.life_class_sessions s on s.id=l.session_id where s.offering_id=f and l.person_id=p and (l.approved_revision is distinct from l.revision or l.session_snapshot is distinct from to_jsonb(s))) then return null;end if;
  items:=jsonb_build_object('logs',items,'minutes',minutes);
 else return null;end if;
 return jsonb_build_object('person_id',p,'person_name',who,'offering_id',f,'course_name',o.name,'starts_on',o.starts_on,'ends_on',o.ends_on,'kind',k,'evidence',items);
end $$;
create function life_private.cert_effective(i uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare v public.life_certificate_issues;r public.life_certificate_requests;e jsonb;
begin
 select * into v from public.life_certificate_issues where id=i;if v.id is null then return 'NOT_FOUND';end if;
 if v.status in ('REVOKED','SUPERSEDED') then return v.status;end if;
 if exists(select 1 from public.life_issuer_authorizations where id=v.issuer_id and revoked_at is not null) then return 'REVOKED';end if;
 select * into r from public.life_certificate_requests where id=v.request_id;
 e:=life_private.certificate_evidence(r.offering_id,r.person_id,r.kind);
 if e is null or encode(extensions.digest(e::text,'sha256'),'hex')<>v.evidence_hash then return 'STALE';end if;
 return v.status;
end $$;
create function life_private.request_certificate(f uuid,k text,supersedes uuid,reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare p uuid:=life_private.person_id();old public.life_certificate_requests;i public.life_certificate_issues;result uuid;
begin
 if p is null then raise exception 'AUTH_REQUIRED';end if;
 perform 1 from public.life_offerings where id=f for update;
 if supersedes is not null then
  select * into i from public.life_certificate_issues where id=supersedes;select * into old from public.life_certificate_requests where id=i.request_id;
  if old.person_id is distinct from p or old.offering_id is distinct from f or old.kind is distinct from k then raise exception 'FORBIDDEN';end if;
  select id into result from public.life_certificate_requests where supersedes_id=supersedes;if result is not null then return result;end if;
  if life_private.cert_effective(supersedes) not in ('STALE','REVOKED') or reason is null or length(trim(reason)) not between 1 and 1000 then raise exception 'CORRECTION_REASON_REQUIRED';end if;
 else
  select id into result from public.life_certificate_requests where offering_id=f and person_id=p and kind=k and supersedes_id is null;if result is not null then return result;end if;
 end if;
 if life_private.certificate_evidence(f,p,k) is null then raise exception 'CERTIFICATE_EVIDENCE_REQUIRED';end if;
 insert into public.life_certificate_requests(offering_id,person_id,kind,supersedes_id,reason) values(f,p,k,supersedes,coalesce(reason,'')) returning id into result;
 return result;
end $$;
create function public.life_request_certificate(f uuid,k text,supersedes uuid,reason text) returns uuid language sql security invoker set search_path='' as $$select life_private.request_certificate(f,k,supersedes,reason)$$;
create function life_private.approve_certificate(r uuid,issuer uuid,template uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare q public.life_certificate_requests;a public.life_issuer_authorizations;t public.life_certificate_templates;e jsonb;result uuid;token text;n bigint;y integer;oid uuid;
begin
 select * into q from public.life_certificate_requests where id=r for update;
 if q.id is null or not life_private.can_issue(issuer,q.kind) then raise exception 'FORBIDDEN';end if;
 if q.person_id=life_private.person_id() then raise exception 'SELF_APPROVAL_FORBIDDEN';end if;
 select org_id into oid from public.life_offerings where id=q.offering_id for update;
 select * into a from public.life_issuer_authorizations where id=issuer;select * into t from public.life_certificate_templates where id=template;
 if a.org_id is distinct from oid or t.org_id is distinct from oid or t.kind is distinct from q.kind or t.revoked_at is not null then raise exception 'ISSUER_TEMPLATE_REQUIRED';end if;
 select id into result from public.life_certificate_issues where request_id=r;if result is not null then return result;end if;
 e:=life_private.certificate_evidence(q.offering_id,q.person_id,q.kind);if e is null then raise exception 'CERTIFICATE_EVIDENCE_REQUIRED';end if;
 y:=extract(year from now() at time zone 'Asia/Seoul');
 insert into life_private.certificate_counters values(oid,q.kind,y,1) on conflict(org_id,kind,year) do update set next_no=life_private.certificate_counters.next_no+1 returning next_no into n;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.life_certificate_issues(request_id,issuer_id,template_id,org_id,certificate_no,approved_by,snapshot,evidence_hash,verification_hash)
 values(r,issuer,template,oid,case when q.kind='COMPLETION' then 'C' else 'T' end||'-'||y||'-'||lpad(n::text,greatest(6,length(n::text)),'0'),life_private.person_id(),
 e||jsonb_build_object('issuer',jsonb_build_object('organization_name',a.organization_name,'title',a.title,'holder_name',a.holder_name,'seal_omission_basis',a.seal_omission_basis,'test_only',a.test_only),'template',jsonb_build_object('title',t.title,'body',t.body,'version',t.version,'layout',t.layout)),encode(extensions.digest(e::text,'sha256'),'hex'),encode(extensions.digest(token,'sha256'),'hex')) returning id into result;
 insert into life_private.certificate_tokens values(result,token);
 update public.life_certificate_requests set status='GENERATING' where id=r;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id) values(oid,life_private.person_id(),'CERTIFICATE_APPROVED',result);
 return result;
end $$;
create function public.life_approve_certificate(r uuid,issuer uuid,template uuid) returns uuid language sql security invoker set search_path='' as $$select life_private.approve_certificate(r,issuer,template)$$;
create function life_private.retry_certificate(i uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v public.life_certificate_issues;k text;
begin
 select * into v from public.life_certificate_issues where id=i;select kind into k from public.life_certificate_requests where id=v.request_id;
 if v.id is null or not life_private.can_issue(v.issuer_id,k) then raise exception 'FORBIDDEN';end if;return i;
end $$;
create function public.life_retry_certificate(i uuid) returns uuid language sql security invoker set search_path='' as $$select life_private.retry_certificate(i)$$;

create function life_private.certificate_job_authorized(i uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.life_certificate_issues c join public.life_certificate_requests q on q.id=c.request_id join public.life_people p on p.id=c.approved_by join public.life_issuer_delegations d on d.issuer_id=c.issuer_id and d.person_id=p.id and d.kind=q.kind join public.life_role_assignments r on r.person_id=p.id and r.org_id=c.org_id and r.role='CERTIFIER' where c.id=i and p.active and d.valid_from<=now() and d.valid_until>now() and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()))
$$;
revoke all on function life_private.certificate_job_authorized(uuid) from public,anon,authenticated;

-- Only the server worker can claim/finalize. No browser role can upload a forged issued PDF.
create function public.life_claim_certificate(i uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.life_certificate_issues;nonce uuid:=gen_random_uuid();token text;seal bytea;
begin
 select * into v from public.life_certificate_issues where id=i for update;
 if v.id is null or v.status<>'GENERATING' then return null;end if;
 if v.lease_until>now() then return null;end if;
 if not life_private.certificate_job_authorized(i) or not life_private.issuer_valid(v.issuer_id) or life_private.cert_effective(i)<>'GENERATING' or exists(select 1 from public.life_certificate_templates where id=v.template_id and revoked_at is not null) then raise exception 'CERTIFICATE_EVIDENCE_REQUIRED';end if;
 update public.life_certificate_issues set lease_nonce=nonce,lease_until=now()+interval '120 seconds',last_error=null where id=i;
 select ct.token into token from life_private.certificate_tokens ct where issue_id=i;
 select s.png into seal from life_private.issuer_seals s join public.life_issuer_authorizations a on a.seal_id=s.id where a.id=v.issuer_id;
 return jsonb_build_object('id',i,'nonce',nonce,'number',v.certificate_no,'snapshot',v.snapshot,'issue_date',(v.approved_at at time zone 'Asia/Seoul')::date,'token',token,'seal',case when seal is not null then encode(seal,'base64') end);
end $$;
create function public.life_finish_certificate(i uuid,nonce uuid,pdf_base64 text) returns text language plpgsql security definer set search_path='' as $$
declare v public.life_certificate_issues;q public.life_certificate_requests;bytes bytea;h text;
begin
 select * into v from public.life_certificate_issues where id=i for update;
 if v.status='ISSUED' then return v.file_sha256;end if;
 if v.id is null or v.status<>'GENERATING' or v.lease_nonce is distinct from nonce or v.lease_until<=now() then raise exception 'STALE_JOB';end if;
 select * into q from public.life_certificate_requests where id=v.request_id;
 perform 1 from public.life_offerings where id=q.offering_id for update;
 -- Teaching log rows are locked too; corrections become stale after this transaction commits.
 perform 1 from public.life_teaching_logs l join public.life_class_sessions s on s.id=l.session_id where s.offering_id=q.offering_id and l.person_id=q.person_id for update of l;
 if not life_private.certificate_job_authorized(i) or not life_private.issuer_valid(v.issuer_id) or life_private.cert_effective(i)<>'GENERATING' or exists(select 1 from public.life_certificate_templates where id=v.template_id and revoked_at is not null) then raise exception 'CERTIFICATE_EVIDENCE_REQUIRED';end if;
 if pdf_base64 is null or length(pdf_base64)>2800000 then raise exception 'INVALID_PDF';end if;
 bytes:=decode(pdf_base64,'base64');if octet_length(bytes) not between 100 and 2000000 or substring(bytes from 1 for 5)<>convert_to('%PDF-','UTF8') then raise exception 'INVALID_PDF';end if;
 h:=encode(extensions.digest(bytes,'sha256'),'hex');
 insert into life_private.certificate_files values(i,bytes);
 update public.life_certificate_issues set status='ISSUED',issued_at=now(),file_sha256=h,lease_until=null,lease_nonce=null,last_error=null where id=i;
 update public.life_certificate_requests set status='ISSUED' where id=q.id;
 if q.supersedes_id is not null then update public.life_certificate_issues set status='SUPERSEDED' where id=q.supersedes_id and issued_at is not null;end if;
 delete from life_private.certificate_tokens where issue_id=i;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id) values(v.org_id,v.approved_by,'CERTIFICATE_ISSUED',i);
 return h;
end $$;
create function public.life_fail_certificate(i uuid,nonce uuid) returns void language sql security definer set search_path='' as $$
 update public.life_certificate_issues set lease_until=null,lease_nonce=null,last_error='PDF 생성에 실패했습니다. 재시도하거나 발급권과 근거자료를 확인하세요.' where id=i and lease_nonce=nonce and status='GENERATING'
$$;
create function life_private.revoke_certificate(i uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
declare v public.life_certificate_issues;q public.life_certificate_requests;
begin
 select * into v from public.life_certificate_issues where id=i for update;select * into q from public.life_certificate_requests where id=v.request_id;
 if v.id is null or not life_private.can_issue(v.issuer_id,q.kind) then raise exception 'FORBIDDEN';end if;
 if reason is null or length(trim(reason)) not between 1 and 1000 then raise exception 'INVALID_INPUT';end if;
 if v.status='REVOKED' then return;end if;
 if v.status='SUPERSEDED' then raise exception 'INVALID_TRANSITION';end if;
 update public.life_certificate_issues set status='REVOKED',revoked_at=now(),revocation_reason=reason,lease_nonce=null,lease_until=null where id=i;
 update public.life_certificate_requests set status='REVOKED' where id=q.id;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details) values(v.org_id,life_private.person_id(),'CERTIFICATE_REVOKED',i,jsonb_build_object('reason',reason));
end $$;
create function public.life_revoke_certificate(i uuid,reason text) returns void language sql security invoker set search_path='' as $$select life_private.revoke_certificate(i,reason)$$;

create function life_private.certificate_readable(i uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.life_certificate_issues c join public.life_certificate_requests r on r.id=c.request_id where c.id=i and (r.person_id=life_private.person_id() or life_private.can_issue(c.issuer_id,r.kind)))
$$;
create function life_private.certificate_detail(i uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not life_private.certificate_readable(i) then raise exception 'FORBIDDEN';end if;
 select jsonb_build_object('id',v.id,'number',v.certificate_no,'snapshot',v.snapshot,'state',life_private.cert_effective(v.id),'issued_at',v.issued_at,'sha256',v.file_sha256,'last_error',v.last_error,'request',to_jsonb(r),'revocation_reason',v.revocation_reason) into result from public.life_certificate_issues v join public.life_certificate_requests r on r.id=v.request_id where v.id=i;
 return result;
end $$;
create function public.life_certificate_detail(i uuid) returns jsonb language sql stable security invoker set search_path='' as $$select life_private.certificate_detail(i)$$;
create function life_private.download_certificate(i uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;org uuid;
begin
 if not life_private.certificate_readable(i) then raise exception 'FORBIDDEN';end if;
 if life_private.cert_effective(i)<>'ISSUED' then raise exception 'CERTIFICATE_NOT_CURRENT';end if;
 select jsonb_build_object('base64',encode(f.pdf,'base64'),'sha256',v.file_sha256,'number',v.certificate_no),v.org_id into result,org from life_private.certificate_files f join public.life_certificate_issues v on v.id=f.issue_id where v.id=i;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id) values(org,life_private.person_id(),'CERTIFICATE_DOWNLOADED',i);
 return result;
end $$;
create function public.life_download_certificate(i uuid) returns jsonb language sql security invoker set search_path='' as $$select life_private.download_certificate(i)$$;
create function life_private.certificate_list() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'offering_id',r.offering_id,'org_id',o.org_id,'evidence',life_private.certificate_evidence(r.offering_id,r.person_id,r.kind),'person_id',r.person_id,'person_name',p.name,'course_name',o.name,'kind',r.kind,'status',r.status,'reason',r.reason,'requested_at',r.requested_at,'issue_id',i.id,'number',i.certificate_no,'state',case when i.id is not null then life_private.cert_effective(i.id) end,'last_error',i.last_error) order by r.requested_at desc),'[]'::jsonb)
 from public.life_certificate_requests r join public.life_offerings o on o.id=r.offering_id join public.life_people p on p.id=r.person_id left join public.life_certificate_issues i on i.request_id=r.id
 where r.person_id=life_private.person_id() or life_private.certificate_staff(o.org_id)
$$;
create function public.life_certificate_list() returns jsonb language sql stable security invoker set search_path='' as $$select life_private.certificate_list()$$;
create function life_private.teaching_records() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'session_id',s.id,'offering_id',o.id,'course_name',o.name,'session_title',s.title,'starts_at',s.starts_at,'ends_at',s.ends_at,'person_id',l.person_id,'person_name',p.name,'minutes',l.minutes,'notes',l.notes,'revision',l.revision,'approved_at',l.approved_at,'current',l.approved_revision=l.revision and l.session_snapshot=to_jsonb(s)) order by l.submitted_at desc),'[]'::jsonb)
 from public.life_teaching_logs l join public.life_people p on p.id=l.person_id join public.life_class_sessions s on s.id=l.session_id join public.life_offerings o on o.id=s.offering_id
 where l.person_id=life_private.person_id() or life_private.manages(o.id)
$$;
create function public.life_teaching_records() returns jsonb language sql stable security invoker set search_path='' as $$select life_private.teaching_records()$$;
create function life_private.certificate_options() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('issuers',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'org_id',a.org_id,'label',a.organization_name||' '||a.title||' '||a.holder_name,'test_only',a.test_only,'kinds',array(select d.kind from public.life_issuer_delegations d where d.issuer_id=a.id and d.person_id=life_private.person_id() and d.valid_from<=now() and d.valid_until>now()))) from public.life_issuer_authorizations a where life_private.certificate_staff(a.org_id) and life_private.issuer_valid(a.id)),'[]'::jsonb),
 'templates',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'org_id',t.org_id,'kind',t.kind,'title',t.title,'version',t.version)) from public.life_certificate_templates t where revoked_at is null and life_private.certificate_staff(t.org_id)),'[]'::jsonb))
$$;
create function public.life_certificate_options() returns jsonb language sql stable security invoker set search_path='' as $$select life_private.certificate_options()$$;

-- Opaque-token lookup only, with bounded per-token and global database counters.
create function life_private.verify_certificate(token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare h text;v public.life_certificate_issues;bucket text;n integer;
begin
 if token is null or token!~'^[0-9a-f]{64}$' then return jsonb_build_object('state','NOT_FOUND');end if;
 h:=encode(extensions.digest(token,'sha256'),'hex');
 delete from life_private.verification_limits where window_start<now()-interval '1 hour';
 foreach bucket in array array['global',h] loop
 insert into life_private.verification_limits values(bucket,now(),1) on conflict(key) do update set hits=case when life_private.verification_limits.window_start<now()-interval '1 minute' then 1 else life_private.verification_limits.hits+1 end,window_start=case when life_private.verification_limits.window_start<now()-interval '1 minute' then now() else life_private.verification_limits.window_start end returning hits into n;
 if n>(case when bucket='global' then 600 else 30 end) then return jsonb_build_object('state','RATE_LIMITED');end if;
 end loop;
 select * into v from public.life_certificate_issues where verification_hash=h;
 if v.id is null or v.issued_at is null then return jsonb_build_object('state','NOT_FOUND');end if;
 return jsonb_build_object('state',life_private.cert_effective(v.id),'number',v.certificate_no,'kind',v.snapshot->>'kind','organization',v.snapshot->'issuer'->>'organization_name','name',left(v.snapshot->>'person_name',1)||repeat('*',greatest(1,length(v.snapshot->>'person_name')-1)),'issued_at',v.issued_at,'sha256',v.file_sha256,'test_only',v.snapshot->'issuer'->'test_only');
end $$;
create function public.life_verify_certificate(token text) returns jsonb language sql security invoker set search_path='' as $$select life_private.verify_certificate(token)$$;

-- Record access through purpose-specific functions; no raw issuance ledger or token endpoint.
do $$ declare t text;begin
 foreach t in array array['life_teaching_logs','life_issuer_authorizations','life_issuer_delegations','life_certificate_templates','life_certificate_requests','life_certificate_issues'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
 foreach t in array array['issuer_seals','certificate_counters','certificate_tokens','certificate_files','verification_limits'] loop
 execute format('alter table life_private.%I enable row level security',t);execute format('revoke all on life_private.%I from public,anon,authenticated',t);
 end loop;
end $$;
do $$ declare fn text;f record;begin
 foreach fn in array array['issuer_valid','can_issue','certificate_staff','cert_config_frozen','submit_teaching','approve_teaching','certificate_evidence','cert_effective','request_certificate','approve_certificate','retry_certificate','revoke_certificate','certificate_readable','certificate_detail','download_certificate','certificate_list','teaching_records','certificate_options','verify_certificate'] loop
 for f in select p.oid::regprocedure as sig,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='life_private' and p.proname=fn) or (n.nspname='public' and p.proname='life_'||fn) loop
 execute format('revoke all on function %s from public,anon,authenticated',f.sig);
 if fn in ('submit_teaching','approve_teaching','request_certificate','approve_certificate','retry_certificate','revoke_certificate','certificate_detail','download_certificate','certificate_list','teaching_records','certificate_options','verify_certificate') then execute format('grant execute on function %s to authenticated',f.sig);end if;
 if fn='verify_certificate' then execute format('grant execute on function %s to anon',f.sig);end if;
 end loop;end loop;
 foreach fn in array array['life_claim_certificate','life_finish_certificate','life_fail_certificate'] loop
 for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=fn loop
 execute format('revoke all on function %s from public,anon,authenticated',f.sig);execute format('grant execute on function %s to service_role',f.sig);
 end loop;end loop;
end $$;
notify pgrst,'reload schema';
commit;
