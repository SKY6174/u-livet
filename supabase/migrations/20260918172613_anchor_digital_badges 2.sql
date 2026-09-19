begin;
alter table public.life_issuer_delegations drop constraint life_issuer_delegations_kind_check;
alter table public.life_issuer_delegations add check(kind in ('COMPLETION','TEACHING','BADGE'));
alter table public.life_policy_versions drop constraint life_policy_versions_kind_check;
alter table public.life_policy_versions add check(kind in ('ACCOUNT_PRIVACY','ENROLLMENT','COMPLETION','MARKETING','REFUND','SURVEY','BADGE','BADGE_SHARE'));
create table public.life_badge_definitions (
 id uuid primary key default gen_random_uuid(),offering_id uuid not null references public.life_offerings,org_id uuid not null references public.life_organizations,
 version integer not null,issuer_id uuid not null references public.life_issuer_authorizations,completion_policy_id uuid not null references public.life_policy_versions,policy_id uuid not null references public.life_policy_versions,
 title text not null check(length(trim(title)) between 1 and 100),description text not null check(length(trim(description)) between 1 and 2000),achievement text not null check(length(trim(achievement)) between 1 and 2000),validity_days integer check(validity_days between 1 and 3650),
 status text not null default 'DRAFT' check(status in ('DRAFT','APPROVED')),created_by uuid not null references public.life_people,created_at timestamptz not null default now(),approved_by uuid references public.life_people,approved_at timestamptz,approval_reference text,revoked_at timestamptz,
 unique(offering_id,version),check(approved_by is distinct from created_by),check(status<>'APPROVED' or (approved_at is not null and approved_by is not null and approval_reference is not null))
);
create table public.life_badge_requests (
 id uuid primary key default gen_random_uuid(),offering_id uuid not null references public.life_offerings,definition_id uuid not null references public.life_badge_definitions,
 person_id uuid not null references public.life_people,policy_id uuid not null references public.life_policy_versions,supersedes_id uuid,reason text not null default '' check(length(reason)<=2000),
 status text not null default 'REQUESTED' check(status in ('REQUESTED','ISSUED','CANCELLED','REJECTED')),requested_at timestamptz not null default now(),decision_reason text
);
create unique index life_badge_first_request on public.life_badge_requests(offering_id,person_id) where supersedes_id is null and status in ('REQUESTED','ISSUED');
create unique index life_badge_replacement_request on public.life_badge_requests(supersedes_id) where supersedes_id is not null and status in ('REQUESTED','ISSUED');
create table public.life_badge_awards (
 id uuid primary key,request_id uuid not null unique references public.life_badge_requests,definition_id uuid not null references public.life_badge_definitions,org_id uuid not null references public.life_organizations,
 person_id uuid not null references public.life_people,offering_id uuid not null references public.life_offerings,issuer_id uuid not null references public.life_issuer_authorizations,
 number text not null unique,completion_run_id uuid not null references public.life_completion_runs,evidence_hash text not null,artifact_text text not null check(octet_length(artifact_text)<=50000),sha256 text not null,
 issued_by uuid not null references public.life_people,issued_at timestamptz not null,expires_at timestamptz,supersedes_id uuid references public.life_badge_awards,
 status text not null default 'ISSUED' check(status in ('ISSUED','REVOKED','SUPERSEDED')),revoked_at timestamptz,revocation_reason text,check(issued_by<>person_id)
);
alter table public.life_badge_requests add foreign key(supersedes_id) references public.life_badge_awards;
create index life_badge_awards_owner on public.life_badge_awards(person_id,issued_at desc);
create table life_private.badge_shares (
 award_id uuid primary key references public.life_badge_awards,revision integer not null default 0,enabled boolean not null default false,
 token_hash text unique,policy_id uuid references public.life_policy_versions,confirmed_at timestamptz,changed_at timestamptz not null default now(),
 check(not enabled or (token_hash is not null and policy_id is not null and confirmed_at is not null))
);
create table public.life_badge_events (
 id bigint generated always as identity primary key,org_id uuid not null references public.life_organizations,entity_id uuid not null,actor_id uuid not null references public.life_people,
 action text not null,reason text,created_at timestamptz not null default now()
);
create function life_private.badge_event(o uuid,e uuid,a text,reason text default null) returns void language sql security definer set search_path='' as $$insert into public.life_badge_events(org_id,entity_id,actor_id,action,reason) values(o,e,life_private.person_id(),a,reason)$$;
create function life_private.badge_staff(o uuid) returns boolean language sql stable security definer set search_path='' as $$select life_private.has_role(o,'COURSE_MANAGER') or exists(select 1 from public.life_issuer_authorizations a where a.org_id=o and life_private.can_issue(a.id,'BADGE'))$$;
create function life_private.badge_definition_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'IMMUTABLE_RECORD';end if;
 if (to_jsonb(old)-array['status','approved_by','approved_at','approval_reference','revoked_at']) is distinct from (to_jsonb(new)-array['status','approved_by','approved_at','approval_reference','revoked_at']) then raise exception 'IMMUTABLE_RECORD';end if;
 if old.status='DRAFT' and new.status='APPROVED' and new.revoked_at is null then return new;end if;
 if old.status='APPROVED' and old.revoked_at is null and new.revoked_at is not null and (to_jsonb(old)-'revoked_at')=(to_jsonb(new)-'revoked_at') then return new;end if;
 raise exception 'IMMUTABLE_RECORD';
end $$;
create trigger life_badge_definition_frozen before update or delete on public.life_badge_definitions for each row execute function life_private.badge_definition_guard();
create function life_private.badge_award_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or old.status='SUPERSEDED' or new.status not in ('REVOKED','SUPERSEDED') or (old.status='REVOKED' and new.status<>'SUPERSEDED') or (to_jsonb(old)-array['status','revoked_at','revocation_reason']) is distinct from (to_jsonb(new)-array['status','revoked_at','revocation_reason']) then raise exception 'IMMUTABLE_RECORD';end if;return new;
end $$;
create trigger life_badge_award_frozen before update or delete on public.life_badge_awards for each row execute function life_private.badge_award_guard();
create trigger life_badge_events_frozen before update or delete on public.life_badge_events for each row execute function life_private.annual_immutable();

-- Latest approved completion only; an older approved run never hides a newer unresolved run.
create function life_private.badge_evidence(f uuid,p uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_o public.life_offerings;v_r public.life_completion_runs;v_policy uuid;v_name text;v_approved timestamptz;
begin
 select * into v_o from public.life_offerings where id=f;select name into v_name from public.life_people where id=p and active;
 select completion_policy_id into v_policy from public.life_course_versions where id=v_o.course_version_id;
 if v_o.id is null or v_name is null or not v_o.academic_sealed or v_o.ends_on>=(now() at time zone 'Asia/Seoul')::date then return null;end if;
 if not exists(select 1 from public.life_enrollments where offering_id=f and person_id=p and status='ACTIVE') then return null;end if;
 select * into v_r from public.life_completion_runs where offering_id=f and person_id=p order by calculated_at desc,id desc limit 1;
 select approved_at into v_approved from public.life_completion_approvals where run_id=v_r.id;
 if v_r.id is null or v_r.outcome<>'READY' or v_approved is null or v_r.input_revision<>v_o.academic_revision or (v_r.evidence->>'policy_id') is distinct from v_policy::text or not life_private.policy_valid(v_policy,v_o.org_id,'COMPLETION') then return null;end if;
 return jsonb_build_object('person_name',v_name,'course_name',v_o.name,'starts_on',v_o.starts_on,'ends_on',v_o.ends_on,'completion_run',v_r.id,'input_revision',v_r.input_revision,'policy_id',v_policy,'completed_at',v_approved);
end $$;
create function life_private.badge_definition_ready(d uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.life_badge_definitions b join public.life_offerings o on o.id=b.offering_id join public.life_course_versions v on v.id=o.course_version_id where b.id=d and b.status='APPROVED' and b.revoked_at is null and life_private.issuer_valid(b.issuer_id) and life_private.policy_valid(b.policy_id,b.org_id,'BADGE') and life_private.policy_valid(b.completion_policy_id,b.org_id,'COMPLETION') and b.completion_policy_id=v.completion_policy_id and not exists(select 1 from public.life_badge_definitions x where x.offering_id=b.offering_id and x.version>b.version))
$$;
create function life_private.badge_state(i uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare v public.life_badge_awards;e jsonb;
begin
 select * into v from public.life_badge_awards where id=i;if v.id is null then return 'NOT_FOUND';end if;
 if v.status<>'ISSUED' then return v.status;end if;
 if exists(select 1 from public.life_issuer_authorizations where id=v.issuer_id and revoked_at is not null) or exists(select 1 from public.life_badge_definitions where id=v.definition_id and revoked_at is not null) then return 'REVOKED';end if;
 if v.expires_at<=now() then return 'EXPIRED';end if;
 e:=life_private.badge_evidence(v.offering_id,v.person_id);
 if e is null or encode(extensions.digest(e::text,'sha256'),'hex')<>v.evidence_hash then return 'STALE';end if;
 return 'ISSUED';
end $$;
create function life_private.badge_create_definition(f uuid,issuer uuid,policy uuid,title text,description text,achievement text,days integer) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.life_offerings;v_policy uuid;v_version integer;v_id uuid;
begin
 select * into o from public.life_offerings where id=f for update;
 if o.id is null or not life_private.manages(f) then raise exception 'FORBIDDEN';end if;
 select completion_policy_id into v_policy from public.life_course_versions where id=o.course_version_id;
 if not exists(select 1 from public.life_issuer_authorizations a where a.id=issuer and a.org_id=o.org_id and life_private.issuer_valid(a.id)) or not life_private.policy_valid(policy,o.org_id,'BADGE') or not life_private.policy_valid(v_policy,o.org_id,'COMPLETION') then raise exception 'APPROVED_POLICY_ISSUER_REQUIRED';end if;
 select coalesce(max(version),0)+1 into v_version from public.life_badge_definitions where offering_id=f;
 insert into public.life_badge_definitions(offering_id,org_id,version,issuer_id,completion_policy_id,policy_id,title,description,achievement,validity_days,created_by) values(f,o.org_id,v_version,issuer,v_policy,policy,title,description,achievement,days,life_private.person_id()) returning id into v_id;
 perform life_private.badge_event(o.org_id,v_id,'DEFINITION_DRAFTED');return v_id;
end $$;
create function life_private.badge_approve_definition(d uuid,reference text) returns void language plpgsql security definer set search_path='' as $$
declare b public.life_badge_definitions;
begin
 select * into b from public.life_badge_definitions where id=d;
 if b.id is null or not life_private.can_issue(b.issuer_id,'BADGE') then raise exception 'FORBIDDEN';end if;
 perform 1 from public.life_offerings where id=b.offering_id for update;select * into b from public.life_badge_definitions where id=d;
 if not life_private.can_issue(b.issuer_id,'BADGE') then raise exception 'FORBIDDEN';end if;
 if b.created_by=life_private.person_id() then raise exception 'SELF_APPROVAL_FORBIDDEN';end if;
 if coalesce(length(trim(reference)),0) not between 1 and 2000 then raise exception 'REASON_REQUIRED';end if;
 if b.revoked_at is not null or exists(select 1 from public.life_badge_definitions where offering_id=b.offering_id and version>b.version) then raise exception 'LATEST_DEFINITION_REQUIRED';end if;
 if not life_private.policy_valid(b.policy_id,b.org_id,'BADGE') or not exists(select 1 from public.life_offerings o join public.life_course_versions v on v.id=o.course_version_id where o.id=b.offering_id and v.completion_policy_id=b.completion_policy_id and life_private.policy_valid(b.completion_policy_id,b.org_id,'COMPLETION')) then raise exception 'APPROVED_POLICY_ISSUER_REQUIRED';end if;
 if b.status='APPROVED' then return;end if;
 update public.life_badge_definitions set status='APPROVED',approved_by=life_private.person_id(),approved_at=now(),approval_reference=reference where id=d;
 perform life_private.badge_event(b.org_id,d,'DEFINITION_APPROVED',reference);
end $$;
create function life_private.badge_retire_definition(d uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
declare b public.life_badge_definitions;
begin
 select * into b from public.life_badge_definitions where id=d;
 if b.id is null or not life_private.can_issue(b.issuer_id,'BADGE') then raise exception 'FORBIDDEN';end if;
 perform 1 from public.life_offerings where id=b.offering_id for update;select * into b from public.life_badge_definitions where id=d;
 if not life_private.can_issue(b.issuer_id,'BADGE') then raise exception 'FORBIDDEN';end if;
 if coalesce(length(trim(reason)),0) not between 1 and 2000 then raise exception 'REASON_REQUIRED';end if;
 if b.revoked_at is not null then return;end if;if b.status<>'APPROVED' then raise exception 'INVALID_TRANSITION';end if;
 update public.life_badge_definitions set revoked_at=now() where id=d;perform life_private.badge_event(b.org_id,d,'DEFINITION_REVOKED',reason);
end $$;
create function life_private.badge_request(d uuid,policy uuid,confirmed boolean,supersedes uuid,reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.life_badge_definitions;p uuid:=life_private.person_id();old public.life_badge_awards;v_id uuid;
begin
 if p is null then raise exception 'AUTH_REQUIRED';end if;
 select * into b from public.life_badge_definitions where id=d;
 if b.id is null then raise exception 'FORBIDDEN';end if;
 perform 1 from public.life_offerings where id=b.offering_id for update;
 if confirmed is distinct from true or policy is distinct from b.policy_id then raise exception 'CONSENT_REQUIRED';end if;
 if not life_private.badge_definition_ready(d) then raise exception 'LATEST_DEFINITION_REQUIRED';end if;
 if supersedes is not null then
  select * into old from public.life_badge_awards where id=supersedes;
  if old.person_id is distinct from p or old.offering_id is distinct from b.offering_id then raise exception 'FORBIDDEN';end if;
  select id into v_id from public.life_badge_requests where supersedes_id=supersedes and status in ('REQUESTED','ISSUED');if v_id is not null then return v_id;end if;
  if life_private.badge_state(supersedes) not in ('STALE','REVOKED','EXPIRED') or coalesce(length(trim(reason)),0) not between 1 and 2000 then raise exception 'CORRECTION_REASON_REQUIRED';end if;
 else
  select id into v_id from public.life_badge_requests where offering_id=b.offering_id and person_id=p and supersedes_id is null and status in ('REQUESTED','ISSUED');if v_id is not null then return v_id;end if;
 end if;
 if life_private.badge_evidence(b.offering_id,p) is null then raise exception 'CURRENT_COMPLETION_REQUIRED';end if;
 insert into public.life_badge_requests(offering_id,definition_id,person_id,policy_id,supersedes_id,reason) values(b.offering_id,d,p,policy,supersedes,coalesce(reason,'')) returning id into v_id;
 perform life_private.badge_event(b.org_id,v_id,'BADGE_REQUESTED');return v_id;
end $$;
create function life_private.badge_decide_request(r uuid,decision text,reason text) returns void language plpgsql security definer set search_path='' as $$
declare q public.life_badge_requests;b public.life_badge_definitions;
begin
 select * into q from public.life_badge_requests where id=r;
 if q.id is null then raise exception 'FORBIDDEN';end if;
 perform 1 from public.life_offerings where id=q.offering_id for update;select * into q from public.life_badge_requests where id=r for update;
 select * into b from public.life_badge_definitions where id=q.definition_id;
 if (decision='CANCELLED' and q.person_id is distinct from life_private.person_id()) or (decision='REJECTED' and not life_private.can_issue(b.issuer_id,'BADGE')) or decision is null or decision not in ('CANCELLED','REJECTED') then raise exception 'FORBIDDEN';end if;
 if q.status<>'REQUESTED' then raise exception 'INVALID_TRANSITION';end if;
 if coalesce(length(trim(reason)),0) not between 1 and 2000 then raise exception 'REASON_REQUIRED';end if;
 update public.life_badge_requests set status=decision,decision_reason=badge_decide_request.reason where id=r;perform life_private.badge_event(b.org_id,r,'REQUEST_'||decision,reason);
end $$;
create function life_private.badge_issue(r uuid,reference text) returns uuid language plpgsql security definer set search_path='' as $$
declare q public.life_badge_requests;b public.life_badge_definitions;a public.life_issuer_authorizations;e jsonb;old public.life_badge_awards;v_id uuid;v_when timestamptz:=now();v_exp timestamptz;v_text text;
begin
 select * into q from public.life_badge_requests where id=r;if q.id is null then raise exception 'FORBIDDEN';end if;
 select * into b from public.life_badge_definitions where id=q.definition_id;
 if not life_private.can_issue(b.issuer_id,'BADGE') then raise exception 'FORBIDDEN';end if;
 perform 1 from public.life_offerings where id=q.offering_id for update;select * into q from public.life_badge_requests where id=r for update;
 if not life_private.can_issue(b.issuer_id,'BADGE') then raise exception 'FORBIDDEN';end if;
 if q.person_id=life_private.person_id() then raise exception 'SELF_APPROVAL_FORBIDDEN';end if;
 select id into v_id from public.life_badge_awards where request_id=r;if v_id is not null then return v_id;end if;
 if q.status<>'REQUESTED' then raise exception 'INVALID_TRANSITION';end if;
 if coalesce(length(trim(reference)),0) not between 1 and 2000 then raise exception 'REASON_REQUIRED';end if;
 if not life_private.badge_definition_ready(b.id) then raise exception 'LATEST_DEFINITION_REQUIRED';end if;
 e:=life_private.badge_evidence(q.offering_id,q.person_id);if e is null then raise exception 'CURRENT_COMPLETION_REQUIRED';end if;
 if q.supersedes_id is not null then select * into old from public.life_badge_awards where id=q.supersedes_id for update;
  if old.person_id<>q.person_id or old.offering_id<>q.offering_id or life_private.badge_state(old.id) not in ('STALE','REVOKED','EXPIRED') then raise exception 'CORRECTION_REASON_REQUIRED';end if;
 end if;
 select * into a from public.life_issuer_authorizations where id=b.issuer_id;v_id:=gen_random_uuid();v_exp:=case when b.validity_days is not null then v_when+make_interval(days=>b.validity_days) end;
 v_text:=jsonb_build_object('format','U_LIFE_BADGE_V1','id',v_id,'number','B-'||v_id::text,'badge',jsonb_build_object('title',b.title,'description',b.description,'achievement',b.achievement,'definition_version',b.version),
 'issuer',jsonb_build_object('organization',a.organization_name,'title',a.title,'holder_name',a.holder_name,'test_only',a.test_only),
 'recipient_name',e->>'person_name','course',jsonb_build_object('name',e->>'course_name','starts_on',e->>'starts_on','ends_on',e->>'ends_on'),'completion',jsonb_build_object('approved_at',e->>'completed_at','policy_version',(select version from public.life_policy_versions where id=b.completion_policy_id),'policy_body',(select body from public.life_policy_versions where id=b.completion_policy_id)),
 'issued_at',v_when,'expires_at',v_exp,'supersedes_id',q.supersedes_id,'verification_note','홈페이지 발급 원장과 비교하는 내부 배지입니다. Open Badges 서명·지갑 적합성 인증 자료가 아닙니다.')::text;
 insert into public.life_badge_awards(id,request_id,definition_id,org_id,person_id,offering_id,issuer_id,number,completion_run_id,evidence_hash,artifact_text,sha256,issued_by,issued_at,expires_at,supersedes_id)
 values(v_id,r,b.id,b.org_id,q.person_id,q.offering_id,b.issuer_id,'B-'||v_id::text,(e->>'completion_run')::uuid,encode(extensions.digest(e::text,'sha256'),'hex'),v_text,encode(extensions.digest(v_text,'sha256'),'hex'),life_private.person_id(),v_when,v_exp,q.supersedes_id);
 insert into life_private.badge_shares(award_id) values(v_id);update public.life_badge_requests set status='ISSUED' where id=r;
 if old.id is not null then update public.life_badge_awards set status='SUPERSEDED' where id=old.id;perform life_private.badge_event(b.org_id,old.id,'BADGE_SUPERSEDED',q.reason);end if;
 perform life_private.badge_event(b.org_id,v_id,'BADGE_ISSUED',reference);return v_id;
end $$;
create function life_private.badge_revoke(i uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
declare v public.life_badge_awards;
begin
 select * into v from public.life_badge_awards where id=i for update;
 if v.id is null or not life_private.can_issue(v.issuer_id,'BADGE') then raise exception 'FORBIDDEN';end if;
 if coalesce(length(trim(reason)),0) not between 1 and 2000 then raise exception 'REASON_REQUIRED';end if;
 if v.status='REVOKED' then return;end if;if v.status='SUPERSEDED' then raise exception 'INVALID_TRANSITION';end if;
 update public.life_badge_awards set status='REVOKED',revoked_at=now(),revocation_reason=reason where id=i;perform life_private.badge_event(v.org_id,i,'BADGE_REVOKED',reason);
end $$;
create function life_private.badge_share(i uuid,enabled boolean,policy uuid,confirmed boolean,revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.life_badge_awards;s life_private.badge_shares;t text;
begin
 select * into v from public.life_badge_awards where id=i for update;
 if v.id is null or v.person_id is distinct from life_private.person_id() then raise exception 'FORBIDDEN';end if;
 select * into s from life_private.badge_shares where award_id=i for update;
 if s.revision is distinct from revision then raise exception 'REVISION_CHANGED';end if;
 if enabled is null then raise exception 'INVALID_INPUT';end if;
 if enabled then
  if life_private.badge_state(i)<>'ISSUED' then raise exception 'BADGE_NOT_CURRENT';end if;
  if confirmed is distinct from true or not life_private.policy_valid(policy,v.org_id,'BADGE_SHARE') then raise exception 'CONSENT_REQUIRED';end if;
  t:=encode(extensions.gen_random_bytes(32),'hex');
 end if;
 update life_private.badge_shares set enabled=badge_share.enabled,revision=badge_shares.revision+1,token_hash=case when badge_share.enabled then encode(extensions.digest(t,'sha256'),'hex') end,policy_id=case when badge_share.enabled then policy end,confirmed_at=case when badge_share.enabled then now() end,changed_at=now() where award_id=i;
 perform life_private.badge_event(v.org_id,i,case when enabled then 'SHARE_CREATED' else 'SHARE_WITHDRAWN' end);
 return jsonb_build_object('token',t,'revision',s.revision+1);
end $$;
create function life_private.badge_options() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if life_private.person_id() is null then raise exception 'AUTH_REQUIRED';end if;
 return jsonb_build_object(
 'offerings',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'org_id',o.org_id,'manager',life_private.manages(o.id)) order by o.created_at desc) from public.life_offerings o where life_private.badge_staff(o.org_id)),'[]'::jsonb),
 'issuers',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'org_id',a.org_id,'name',a.organization_name,'test_only',a.test_only,'can_issue',life_private.can_issue(a.id,'BADGE'))) from public.life_issuer_authorizations a where life_private.badge_staff(a.org_id) and life_private.issuer_valid(a.id)),'[]'::jsonb),
 'policies',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'org_id',p.org_id,'title',p.title,'version',p.version,'body',p.body)) from public.life_policy_versions p where life_private.badge_staff(p.org_id) and life_private.policy_valid(p.id,p.org_id,'BADGE')),'[]'::jsonb));
end $$;
create function life_private.badge_board(f uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o public.life_offerings;
begin
 select * into o from public.life_offerings where id=f;if o.id is null or not life_private.badge_staff(o.org_id) then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object('offering',jsonb_build_object('id',o.id,'name',o.name,'org_id',o.org_id),'manager',life_private.manages(f),
 'definitions',coalesce((select jsonb_agg(to_jsonb(b)||jsonb_build_object('can_issue',life_private.can_issue(b.issuer_id,'BADGE'),'ready',life_private.badge_definition_ready(b.id),'policy_body',p.body,'policy_title',p.title,'policy_version',p.version,'completion_body',cp.body,'completion_version',cp.version) order by b.version desc) from public.life_badge_definitions b join public.life_policy_versions p on p.id=b.policy_id join public.life_policy_versions cp on cp.id=b.completion_policy_id where b.offering_id=f),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(to_jsonb(q)||jsonb_build_object('person_name',p.name,'title',b.title,'version',b.version,'can_issue',life_private.can_issue(b.issuer_id,'BADGE'),'ready',life_private.badge_definition_ready(b.id) and life_private.badge_evidence(f,q.person_id) is not null,'award_id',a.id) order by q.requested_at desc) from public.life_badge_requests q join public.life_badge_definitions b on b.id=q.definition_id join public.life_people p on p.id=q.person_id left join public.life_badge_awards a on a.request_id=q.id where q.offering_id=f),'[]'::jsonb),
 'awards',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'number',a.number,'title',b.title,'person_name',p.name,'state',life_private.badge_state(a.id),'status',a.status,'issued_at',a.issued_at,'can_issue',life_private.can_issue(a.issuer_id,'BADGE')) order by a.issued_at desc) from public.life_badge_awards a join public.life_badge_definitions b on b.id=a.definition_id join public.life_people p on p.id=a.person_id where a.offering_id=f),'[]'::jsonb));
end $$;
create function life_private.badge_wallet() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p uuid:=life_private.person_id();
begin
 if p is null then raise exception 'AUTH_REQUIRED';end if;
 return jsonb_build_object(
 'eligible',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'offering_id',b.offering_id,'name',o.name,'title',b.title,'description',b.description,'achievement',b.achievement,'version',b.version,'validity_days',b.validity_days,'policy_id',b.policy_id,'policy_title',pv.title,'policy_version',pv.version,'policy_body',pv.body,'completion_body',cp.body,'ready',life_private.badge_definition_ready(b.id) and life_private.badge_evidence(o.id,p) is not null) order by o.ends_on desc) from public.life_badge_definitions b join public.life_offerings o on o.id=b.offering_id join public.life_policy_versions pv on pv.id=b.policy_id join public.life_policy_versions cp on cp.id=b.completion_policy_id join public.life_enrollments e on e.offering_id=o.id and e.person_id=p where b.status='APPROVED' and b.revoked_at is null and not exists(select 1 from public.life_badge_definitions newer where newer.offering_id=o.id and newer.version>b.version)),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(to_jsonb(q)||jsonb_build_object('title',b.title,'name',o.name) order by q.requested_at desc) from public.life_badge_requests q join public.life_badge_definitions b on b.id=q.definition_id join public.life_offerings o on o.id=q.offering_id where q.person_id=p),'[]'::jsonb),
 'awards',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'offering_id',a.offering_id,'number',a.number,'title',b.title,'name',o.name,'state',life_private.badge_state(a.id),'issued_at',a.issued_at,'expires_at',a.expires_at,'supersedes_id',a.supersedes_id,'test_only',a.artifact_text::jsonb->'issuer'->'test_only') order by a.issued_at desc) from public.life_badge_awards a join public.life_badge_definitions b on b.id=a.definition_id join public.life_offerings o on o.id=a.offering_id where a.person_id=p),'[]'::jsonb));
end $$;
create function life_private.badge_detail(i uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v public.life_badge_awards;own boolean;
begin
 select * into v from public.life_badge_awards where id=i;own:=v.person_id=life_private.person_id();
 if v.id is null or not coalesce(own or life_private.can_issue(v.issuer_id,'BADGE'),false) then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object('id',v.id,'number',v.number,'state',life_private.badge_state(i),'artifact',v.artifact_text::jsonb,'sha256',v.sha256,'issued_at',v.issued_at,'expires_at',v.expires_at,'supersedes_id',v.supersedes_id,'revocation_reason',v.revocation_reason,'owner',own,
 'share',case when own then (select jsonb_build_object('enabled',s.enabled,'revision',s.revision,'changed_at',s.changed_at,'policy_valid',life_private.policy_valid(s.policy_id,v.org_id,'BADGE_SHARE')) from life_private.badge_shares s where award_id=i) end,
 'share_policies',case when own then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'version',p.version,'body',p.body)) from public.life_policy_versions p where life_private.policy_valid(p.id,v.org_id,'BADGE_SHARE')),'[]'::jsonb) else '[]'::jsonb end,
 'events',coalesce((select jsonb_agg(jsonb_build_object('action',action,'reason',reason,'at',created_at) order by id) from public.life_badge_events where entity_id in(i,v.request_id,v.definition_id)),'[]'::jsonb));
end $$;
create function life_private.badge_download(i uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.life_badge_awards;
begin
 select * into v from public.life_badge_awards where id=i;
 if v.id is null or not coalesce(v.person_id=life_private.person_id() or life_private.can_issue(v.issuer_id,'BADGE'),false) then raise exception 'FORBIDDEN';end if;
 if life_private.badge_state(i)<>'ISSUED' then raise exception 'BADGE_NOT_CURRENT';end if;
 perform life_private.badge_event(v.org_id,i,'BADGE_DOWNLOADED');return jsonb_build_object('body',v.artifact_text,'sha256',v.sha256,'number',v.number);
end $$;
create function life_private.badge_verify(token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare h text;v public.life_badge_awards;doc jsonb;bucket text;n integer;
begin
 if token is null or token!~'^[0-9a-f]{64}$' then return jsonb_build_object('state','NOT_FOUND');end if;
 h:=encode(extensions.digest(token,'sha256'),'hex');delete from life_private.verification_limits where window_start<now()-interval '1 hour';
 foreach bucket in array array['badge-global','badge-'||h] loop
  insert into life_private.verification_limits values(bucket,now(),1) on conflict(key) do update set hits=case when life_private.verification_limits.window_start<now()-interval '1 minute' then 1 else life_private.verification_limits.hits+1 end,window_start=case when life_private.verification_limits.window_start<now()-interval '1 minute' then now() else life_private.verification_limits.window_start end returning hits into n;
  if n>(case when bucket='badge-global' then 600 else 30 end) then return jsonb_build_object('state','RATE_LIMITED');end if;
 end loop;
 select a.* into v from public.life_badge_awards a join life_private.badge_shares s on s.award_id=a.id join public.life_people p on p.id=a.person_id where s.token_hash=h and s.enabled and p.active and exists(select 1 from public.life_auth_links al where al.person_id=p.id and al.auth_user_id is not null) and life_private.policy_valid(s.policy_id,a.org_id,'BADGE_SHARE');
 if v.id is null then return jsonb_build_object('state','NOT_FOUND');end if;
 doc:=v.artifact_text::jsonb;
 return jsonb_build_object('state',life_private.badge_state(v.id),'number',v.number,'title',doc->'badge'->>'title','achievement',doc->'badge'->>'achievement','organization',doc->'issuer'->>'organization','name',left(doc->>'recipient_name',1)||repeat('*',greatest(1,length(doc->>'recipient_name')-1)),'course',doc->'course'->>'name','issued_at',v.issued_at,'expires_at',v.expires_at,'sha256',v.sha256,'test_only',doc->'issuer'->'test_only');
end $$;
create function public.life_badge_options() returns jsonb language sql security invoker set search_path='' as $$select life_private.badge_options()$$;
create function public.life_badge_board(f uuid) returns jsonb language sql security invoker set search_path='' as $$select life_private.badge_board(f)$$;
create function public.life_badge_wallet() returns jsonb language sql security invoker set search_path='' as $$select life_private.badge_wallet()$$;
create function public.life_badge_detail(i uuid) returns jsonb language sql security invoker set search_path='' as $$select life_private.badge_detail(i)$$;
create function public.life_badge_download(i uuid) returns jsonb language sql security invoker set search_path='' as $$select life_private.badge_download(i)$$;
create function public.life_create_badge_definition(f uuid,issuer uuid,policy uuid,title text,description text,achievement text,days integer) returns uuid language sql security invoker set search_path='' as $$select life_private.badge_create_definition(f,issuer,policy,title,description,achievement,days)$$;
create function public.life_approve_badge_definition(d uuid,reference text) returns void language sql security invoker set search_path='' as $$select life_private.badge_approve_definition(d,reference)$$;
create function public.life_retire_badge_definition(d uuid,reason text) returns void language sql security invoker set search_path='' as $$select life_private.badge_retire_definition(d,reason)$$;
create function public.life_request_badge(d uuid,policy uuid,confirmed boolean,supersedes uuid,reason text) returns uuid language sql security invoker set search_path='' as $$select life_private.badge_request(d,policy,confirmed,supersedes,reason)$$;
create function public.life_cancel_badge_request(r uuid,reason text) returns void language sql security invoker set search_path='' as $$select life_private.badge_decide_request(r,'CANCELLED',reason)$$;
create function public.life_reject_badge_request(r uuid,reason text) returns void language sql security invoker set search_path='' as $$select life_private.badge_decide_request(r,'REJECTED',reason)$$;
create function public.life_issue_badge(r uuid,reference text) returns uuid language sql security invoker set search_path='' as $$select life_private.badge_issue(r,reference)$$;
create function public.life_revoke_badge(i uuid,reason text) returns void language sql security invoker set search_path='' as $$select life_private.badge_revoke(i,reason)$$;
create function public.life_set_badge_share(i uuid,enabled boolean,policy uuid,confirmed boolean,revision integer) returns jsonb language sql security invoker set search_path='' as $$select life_private.badge_share(i,enabled,policy,confirmed,revision)$$;
create function public.life_verify_badge(token text) returns jsonb language sql security invoker set search_path='' as $$select life_private.badge_verify(token)$$;
do $$declare t text;f record;begin
 foreach t in array array['life_badge_definitions','life_badge_requests','life_badge_awards','life_badge_events'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);end loop;
 alter table life_private.badge_shares enable row level security;revoke all on life_private.badge_shares from public,anon,authenticated,service_role;
 for f in select p.oid::regprocedure signature,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='life_private' and p.proname like 'badge_%') or (n.nspname='public' and p.proname=any(array['life_badge_options','life_badge_board','life_badge_wallet','life_badge_detail','life_badge_download','life_create_badge_definition','life_approve_badge_definition','life_retire_badge_definition','life_request_badge','life_cancel_badge_request','life_reject_badge_request','life_issue_badge','life_revoke_badge','life_set_badge_share','life_verify_badge'])) loop
 execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
 if f.nspname='public' or f.proname=any(array['badge_options','badge_board','badge_wallet','badge_detail','badge_download','badge_create_definition','badge_approve_definition','badge_retire_definition','badge_request','badge_decide_request','badge_issue','badge_revoke','badge_share','badge_verify']) then execute format('grant execute on function %s to authenticated',f.signature);end if;
 if f.proname in ('badge_verify','life_verify_badge') then execute format('grant execute on function %s to anon',f.signature);end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
