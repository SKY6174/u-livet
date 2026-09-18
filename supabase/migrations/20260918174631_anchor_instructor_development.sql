begin;
alter table public.life_policy_versions drop constraint life_policy_versions_kind_check;
alter table public.life_policy_versions add check(kind in ('ACCOUNT_PRIVACY','ENROLLMENT','COMPLETION','MARKETING','REFUND','SURVEY','BADGE','BADGE_SHARE','INSTRUCTOR_PRIVACY','INSTRUCTOR_REVIEW','INSTRUCTOR_PUBLIC','DEVELOPMENT'));
create table public.life_instructor_dossiers (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.life_organizations,person_id uuid not null references public.life_people,
 public_enabled boolean not null default false,public_policy_id uuid references public.life_policy_versions,public_confirmed_at timestamptz,revision integer not null default 0,
 created_at timestamptz not null default now(),unique(org_id,person_id)
);
create table public.life_instructor_dossier_versions (
 id uuid primary key default gen_random_uuid(),dossier_id uuid not null references public.life_instructor_dossiers,version integer not null,revision integer not null default 0,
 status text not null default 'DRAFT' check(status in ('DRAFT','SUBMITTED','APPROVED','CHANGES_REQUESTED','REJECTED','WITHDRAWN')),
 payload jsonb not null default '{"specialty":"","introduction":"","public_intro":"","claims":[]}'::jsonb,
 privacy_policy_id uuid not null references public.life_policy_versions,privacy_confirmed_at timestamptz not null,review_policy_id uuid references public.life_policy_versions,
 created_at timestamptz not null default now(),submitted_at timestamptz,decided_by uuid references public.life_people,decided_at timestamptz,decision_reason text,valid_until date,
 unique(dossier_id,version),check(status<>'APPROVED' or (decided_by is not null and valid_until is not null and review_policy_id is not null))
);
create unique index life_dossier_open_version on public.life_instructor_dossier_versions(dossier_id) where status in ('DRAFT','SUBMITTED');
create table public.life_course_proposals (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.life_organizations,person_id uuid not null references public.life_people,
 project_year_id uuid not null,kind text not null check(kind in ('NEW','REVISION')),course_id uuid,
 created_at timestamptz not null default now(),foreign key(project_year_id,org_id) references public.life_project_years(id,org_id),foreign key(course_id,org_id) references public.life_courses(id,org_id)
);
create table public.life_course_proposal_versions (
 id uuid primary key default gen_random_uuid(),proposal_id uuid not null references public.life_course_proposals,version integer not null,revision integer not null default 0,
 status text not null default 'DRAFT' check(status in ('DRAFT','SUBMITTED','APPROVED','CHANGES_REQUESTED','REJECTED','WITHDRAWN')),
 payload jsonb not null default '{"title":"","academy":"","summary":"","rationale":"","target":"","outcomes":"","prerequisites":"","assessment":"","materials":"","budget":"","capacity":20,"theory_minutes":0,"practice_minutes":0,"sessions":[]}'::jsonb,
 development_policy_id uuid references public.life_policy_versions,completion_policy_id uuid references public.life_policy_versions,confirmed_at timestamptz,
 created_at timestamptz not null default now(),submitted_at timestamptz,decided_by uuid references public.life_people,decided_at timestamptz,decision_reason text,
 course_version_id uuid unique references public.life_course_versions,revoked_at timestamptz,revocation_reason text,
 unique(proposal_id,version),check(status<>'APPROVED' or (course_version_id is not null and decided_by is not null))
);
create unique index life_proposal_open_version on public.life_course_proposal_versions(proposal_id) where status in ('DRAFT','SUBMITTED');
create table public.life_development_openings (
 request_key uuid primary key,proposal_version_id uuid not null references public.life_course_proposal_versions,offering_id uuid not null unique references public.life_offerings,
 actor_id uuid not null references public.life_people,input jsonb not null,created_at timestamptz not null default now()
);
create table public.life_instructor_development_events (
 id bigint generated always as identity primary key,org_id uuid not null references public.life_organizations,entity_id uuid not null,actor_id uuid not null references public.life_people,
 action text not null,reason text,created_at timestamptz not null default now()
);
create index life_dossier_events_entity on public.life_instructor_development_events(entity_id,id);
create trigger life_instructor_development_events_frozen before update or delete on public.life_instructor_development_events for each row execute function life_private.annual_immutable();
create function life_private.id_event(o uuid,i uuid,a text,r text default null) returns void language sql security definer set search_path='' as $$
 insert into public.life_instructor_development_events(org_id,entity_id,actor_id,action,reason) values(o,i,life_private.person_id(),a,r)
$$;
-- JSON is validated in the database as well as in the web form; unknown keys are never persisted.
create function life_private.id_text(v jsonb,k text,n integer,required boolean) returns void language plpgsql immutable set search_path='' as $$
begin if jsonb_typeof(v->k) is distinct from 'string' or length(v->>k)>n or (required and length(trim(v->>k))=0) then raise exception 'INVALID_INPUT';end if;end $$;
create function life_private.id_validate(v jsonb,kind text,complete boolean) returns void language plpgsql set search_path='' as $$
declare x jsonb;k text;d date;a date;b date;t integer:=0;p integer:=0;
begin
 if v is null or jsonb_typeof(v)<>'object' or octet_length(v::text)>100000 then raise exception 'INVALID_INPUT';end if;
 if kind='DOSSIER' then
  if (v-array['specialty','introduction','public_intro','claims'])<>'{}'::jsonb then raise exception 'INVALID_INPUT';end if;
  perform life_private.id_text(v,'specialty',200,complete);perform life_private.id_text(v,'introduction',2000,complete);perform life_private.id_text(v,'public_intro',1000,false);
  if jsonb_typeof(v->'claims') is distinct from 'array' or jsonb_array_length(v->'claims')>20 or (complete and jsonb_array_length(v->'claims')=0) then raise exception 'INVALID_INPUT';end if;
  for x in select value from jsonb_array_elements(v->'claims') loop
   if jsonb_typeof(x)<>'object' or (x-array['kind','title','organization','started_on','ended_on','expires_on','evidence'])<>'{}'::jsonb or x->>'kind' is null or x->>'kind' not in ('EDUCATION','CAREER','TEACHING','QUALIFICATION') then raise exception 'INVALID_INPUT';end if;
   perform life_private.id_text(x,'title',200,complete);perform life_private.id_text(x,'organization',200,complete);perform life_private.id_text(x,'evidence',500,complete);
   foreach k in array array['started_on','ended_on','expires_on'] loop
    if jsonb_typeof(x->k) is distinct from 'string' then raise exception 'INVALID_INPUT';end if;
    if x->>k<>'' then
     if x->>k!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID_INPUT';end if;
     d:=(x->>k)::date;
     if k<>'expires_on' and d>(clock_timestamp() at time zone 'Asia/Seoul')::date then raise exception 'INVALID_DATE';end if;
    end if;
   end loop;
   a:=nullif(x->>'started_on','')::date;b:=nullif(x->>'ended_on','')::date;
   if a>b or (a is not null and nullif(x->>'expires_on','')::date<a) then raise exception 'INVALID_DATE';end if;
  end loop;
 elsif kind='DEVELOPMENT' then
  if (v-array['title','academy','summary','rationale','target','outcomes','prerequisites','assessment','materials','budget','capacity','theory_minutes','practice_minutes','sessions'])<>'{}'::jsonb then raise exception 'INVALID_INPUT';end if;
  perform life_private.id_text(v,'title',200,complete);perform life_private.id_text(v,'academy',100,complete);perform life_private.id_text(v,'summary',3000,complete);
  foreach k in array array['rationale','target','outcomes','prerequisites','assessment','materials','budget'] loop perform life_private.id_text(v,k,2000,complete);end loop;
  foreach k in array array['capacity','theory_minutes','practice_minutes'] loop
   if jsonb_typeof(v->k) is distinct from 'number' or v->>k!~'^\d{1,5}$' then raise exception 'INVALID_INPUT';end if;
  end loop;
  if (v->>'capacity')::integer not between 1 and 1000 or (v->>'theory_minutes')::integer+(v->>'practice_minutes')::integer>60000 then raise exception 'INVALID_INPUT';end if;
  if jsonb_typeof(v->'sessions') is distinct from 'array' or jsonb_array_length(v->'sessions')>60 or (complete and jsonb_array_length(v->'sessions')=0) then raise exception 'INVALID_INPUT';end if;
  for x in select value from jsonb_array_elements(v->'sessions') loop
   if jsonb_typeof(x)<>'object' or (x-array['title','content','equipment','assessment','minutes','method'])<>'{}'::jsonb or x->>'method' is null or x->>'method' not in ('THEORY','PRACTICE') then raise exception 'INVALID_INPUT';end if;
   perform life_private.id_text(x,'title',200,complete);perform life_private.id_text(x,'content',1000,complete);perform life_private.id_text(x,'equipment',500,complete);perform life_private.id_text(x,'assessment',500,complete);
   if jsonb_typeof(x->'minutes') is distinct from 'number' or x->>'minutes'!~'^\d{1,4}$' or (x->>'minutes')::integer not between 1 and 1440 then raise exception 'INVALID_INPUT';end if;
   if x->>'method'='THEORY' then t:=t+(x->>'minutes')::integer;else p:=p+(x->>'minutes')::integer;end if;
  end loop;
  if complete and (t+p=0 or t<>(v->>'theory_minutes')::integer or p<>(v->>'practice_minutes')::integer) then raise exception 'HOURS_MISMATCH';end if;
 else raise exception 'INVALID_INPUT';end if;
end $$;
create function life_private.id_version_guard() returns trigger language plpgsql set search_path='' as $$
declare allowed text[]:=array['payload','revision','status','review_policy_id','development_policy_id','completion_policy_id','confirmed_at','submitted_at','decided_by','decided_at','decision_reason','valid_until','course_version_id','revoked_at','revocation_reason'];
begin
 if tg_op='DELETE' or (to_jsonb(old)-allowed) is distinct from (to_jsonb(new)-allowed) then raise exception 'IMMUTABLE_RECORD';end if;
 if old.status='DRAFT' and new.status in ('DRAFT','SUBMITTED','WITHDRAWN') then return new;end if;
 if old.status='SUBMITTED' and new.status in ('APPROVED','CHANGES_REQUESTED','REJECTED','WITHDRAWN') and (to_jsonb(old)-array['status','revision','decided_by','decided_at','decision_reason','valid_until','course_version_id'])=(to_jsonb(new)-array['status','revision','decided_by','decided_at','decision_reason','valid_until','course_version_id']) then return new;end if;
 if old.status='APPROVED' and tg_table_name='life_course_proposal_versions' and (to_jsonb(old)->>'revoked_at') is null and (to_jsonb(new)->>'revoked_at') is not null and (to_jsonb(old)-array['revoked_at','revocation_reason'])=(to_jsonb(new)-array['revoked_at','revocation_reason']) then return new;end if;
 raise exception 'IMMUTABLE_RECORD';
end $$;
create trigger life_dossier_versions_frozen before update or delete on public.life_instructor_dossier_versions for each row execute function life_private.id_version_guard();
create trigger life_proposal_versions_frozen before update or delete on public.life_course_proposal_versions for each row execute function life_private.id_version_guard();
create function life_private.id_person_active(p uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.life_people a join public.life_auth_links l on l.person_id=a.id where a.id=p and a.active and l.auth_user_id is not null)$$;
create function life_private.id_dossier_current(o uuid,p uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select v.status='APPROVED' and v.valid_until>=(now() at time zone 'Asia/Seoul')::date and life_private.id_person_active(p) and life_private.policy_valid(v.privacy_policy_id,o,'INSTRUCTOR_PRIVACY') and life_private.policy_valid(v.review_policy_id,o,'INSTRUCTOR_REVIEW') from public.life_instructor_dossiers d join public.life_instructor_dossier_versions v on v.dossier_id=d.id where d.org_id=o and d.person_id=p order by v.version desc limit 1),false)
$$;
create function life_private.id_proposer(o uuid,p uuid) returns boolean language sql stable security definer set search_path='' as $$
 select life_private.id_person_active(p) and (life_private.id_dossier_current(o,p) or exists(select 1 from public.life_role_assignments where person_id=p and org_id=o and role='INSTRUCTOR' and valid_from<=now() and (valid_until is null or valid_until>now())))
$$;
create function life_private.id_options() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if life_private.person_id() is null then raise exception 'AUTH_REQUIRED';end if;
 return jsonb_build_object('organizations',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'manager',life_private.has_role(o.id,'COURSE_MANAGER'),'proposer',life_private.id_proposer(o.id,life_private.person_id()))) from public.life_organizations o),'[]'::jsonb),
 'policies',coalesce((select jsonb_agg(jsonb_build_object('id',id,'org_id',org_id,'kind',kind,'title',title,'version',version,'body',body)) from public.life_policy_versions where kind in ('INSTRUCTOR_PRIVACY','INSTRUCTOR_REVIEW','INSTRUCTOR_PUBLIC','DEVELOPMENT','COMPLETION') and life_private.policy_valid(id,org_id,kind)),'[]'::jsonb),
 'years',coalesce((select jsonb_agg(to_jsonb(y)) from public.life_project_years y),'[]'::jsonb));
end $$;
create function life_private.id_start_dossier(o uuid,privacy uuid,confirmed boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.life_instructor_dossiers;v public.life_instructor_dossier_versions;r uuid;p uuid:=life_private.person_id();
begin
 if p is null then raise exception 'AUTH_REQUIRED';end if;
 if confirmed is distinct from true or not life_private.policy_valid(privacy,o,'INSTRUCTOR_PRIVACY') or not exists(select 1 from public.life_policy_versions where life_private.policy_valid(id,o,'INSTRUCTOR_REVIEW')) then raise exception 'APPROVED_POLICY_REQUIRED';end if;
 insert into public.life_instructor_dossiers(org_id,person_id) values(o,p) on conflict(org_id,person_id) do nothing;
 select * into d from public.life_instructor_dossiers where org_id=o and person_id=p for update;
 select * into v from public.life_instructor_dossier_versions where dossier_id=d.id order by version desc limit 1;
 if v.status in ('DRAFT','SUBMITTED') then return v.id;end if;
 insert into public.life_instructor_dossier_versions(dossier_id,version,privacy_policy_id,privacy_confirmed_at) values(d.id,coalesce(v.version,0)+1,privacy,now()) returning id into r;
 if v.id is not null then update public.life_instructor_dossier_versions set payload=v.payload where id=r;end if;
 update public.life_instructor_dossiers set public_enabled=false,public_policy_id=null,public_confirmed_at=null,revision=revision+1 where id=d.id;
 perform life_private.id_event(o,d.id,'DOSSIER_DRAFTED');return r;
end $$;
create function life_private.id_save_dossier(v uuid,revision integer,payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare x public.life_instructor_dossier_versions;d public.life_instructor_dossiers;
begin
 select * into x from public.life_instructor_dossier_versions where id=v;select * into d from public.life_instructor_dossiers where id=x.dossier_id for update;
 if d.person_id is distinct from life_private.person_id() or d.id is null then raise exception 'FORBIDDEN';end if;
 select * into x from public.life_instructor_dossier_versions where id=v for update;
 if x.status<>'DRAFT' then raise exception 'INVALID_TRANSITION';end if;if x.revision is distinct from revision then raise exception 'REVISION_CHANGED';end if;
 if not life_private.policy_valid(x.privacy_policy_id,d.org_id,'INSTRUCTOR_PRIVACY') then raise exception 'APPROVED_POLICY_REQUIRED';end if;
 perform life_private.id_validate(payload,'DOSSIER',false);
 update public.life_instructor_dossier_versions set payload=id_save_dossier.payload,revision=x.revision+1 where id=v;perform life_private.id_event(d.org_id,d.id,'DOSSIER_SAVED');
end $$;
create function life_private.id_submit_dossier(v uuid,revision integer,policy uuid,confirmed boolean) returns void language plpgsql security definer set search_path='' as $$
declare x public.life_instructor_dossier_versions;d public.life_instructor_dossiers;
begin
 select * into x from public.life_instructor_dossier_versions where id=v;select * into d from public.life_instructor_dossiers where id=x.dossier_id for update;
 if d.id is null or d.person_id is distinct from life_private.person_id() then raise exception 'FORBIDDEN';end if;
 select * into x from public.life_instructor_dossier_versions where id=v for update;
 if x.status<>'DRAFT' then raise exception 'INVALID_TRANSITION';end if;if x.revision is distinct from revision then raise exception 'REVISION_CHANGED';end if;
 if confirmed is distinct from true or not life_private.policy_valid(x.privacy_policy_id,d.org_id,'INSTRUCTOR_PRIVACY') or not life_private.policy_valid(policy,d.org_id,'INSTRUCTOR_REVIEW') then raise exception 'APPROVED_POLICY_REQUIRED';end if;
 perform life_private.id_validate(x.payload,'DOSSIER',true);
 update public.life_instructor_dossier_versions set status='SUBMITTED',revision=x.revision+1,review_policy_id=policy,submitted_at=now() where id=v;
 perform life_private.id_event(d.org_id,d.id,'DOSSIER_SUBMITTED');
end $$;
create function life_private.id_decide_dossier(v uuid,decision text,reason text,valid_until date,verified boolean) returns void language plpgsql security definer set search_path='' as $$
declare x public.life_instructor_dossier_versions;d public.life_instructor_dossiers;c jsonb;
begin
 select * into x from public.life_instructor_dossier_versions where id=v;select * into d from public.life_instructor_dossiers where id=x.dossier_id for update;
 if d.id is null or not life_private.has_role(d.org_id,'COURSE_MANAGER') then raise exception 'FORBIDDEN';end if;
 if d.person_id=life_private.person_id() then raise exception 'SELF_APPROVAL_FORBIDDEN';end if;
 select * into x from public.life_instructor_dossier_versions where id=v for update;
 if x.status<>'SUBMITTED' or decision is null or decision not in ('APPROVED','CHANGES_REQUESTED','REJECTED') then raise exception 'INVALID_TRANSITION';end if;
 if coalesce(length(trim(reason)),0) not between 1 and 2000 then raise exception 'REASON_REQUIRED';end if;
 if decision='APPROVED' then
  if verified is distinct from true or valid_until is null or valid_until<(clock_timestamp() at time zone 'Asia/Seoul')::date or not life_private.id_person_active(d.person_id) then raise exception 'VERIFICATION_REQUIRED';end if;
  if not life_private.policy_valid(x.privacy_policy_id,d.org_id,'INSTRUCTOR_PRIVACY') or not life_private.policy_valid(x.review_policy_id,d.org_id,'INSTRUCTOR_REVIEW') then raise exception 'APPROVED_POLICY_REQUIRED';end if;
  perform life_private.id_validate(x.payload,'DOSSIER',true);
  for c in select value from jsonb_array_elements(x.payload->'claims') loop if nullif(c->>'expires_on','')::date<valid_until then raise exception 'QUALIFICATION_EXPIRES';end if;end loop;
 end if;
 update public.life_instructor_dossier_versions set status=decision,revision=x.revision+1,decided_by=life_private.person_id(),decided_at=now(),decision_reason=reason,valid_until=case when decision='APPROVED' then id_decide_dossier.valid_until end where id=v;
 perform life_private.id_event(d.org_id,d.id,'DOSSIER_'||decision,reason);
end $$;
create function life_private.id_withdraw_dossier(v uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
declare x public.life_instructor_dossier_versions;d public.life_instructor_dossiers;
begin
 select * into x from public.life_instructor_dossier_versions where id=v;select * into d from public.life_instructor_dossiers where id=x.dossier_id for update;
 if d.id is null or d.person_id is distinct from life_private.person_id() then raise exception 'FORBIDDEN';end if;
 select * into x from public.life_instructor_dossier_versions where id=v for update;
 if x.status not in ('DRAFT','SUBMITTED') then raise exception 'INVALID_TRANSITION';end if;
 if coalesce(length(trim(reason)),0) not between 1 and 2000 then raise exception 'REASON_REQUIRED';end if;
 update public.life_instructor_dossier_versions set status='WITHDRAWN',revision=x.revision+1,decision_reason=reason where id=v;perform life_private.id_event(d.org_id,d.id,'DOSSIER_WITHDRAWN',reason);
end $$;
create function life_private.id_set_public(d uuid,enabled boolean,policy uuid,confirmed boolean,revision integer) returns void language plpgsql security definer set search_path='' as $$
declare x public.life_instructor_dossiers;intro text;
begin
 select * into x from public.life_instructor_dossiers where id=d for update;
 if x.id is null or x.person_id is distinct from life_private.person_id() then raise exception 'FORBIDDEN';end if;
 if x.revision is distinct from revision then raise exception 'REVISION_CHANGED';end if;
 if enabled is null then raise exception 'INVALID_INPUT';end if;
 if enabled then
  select payload->>'public_intro' into intro from public.life_instructor_dossier_versions where dossier_id=d order by version desc limit 1;
  if not life_private.id_dossier_current(x.org_id,x.person_id) or length(trim(intro))=0 then raise exception 'CURRENT_APPROVAL_REQUIRED';end if;
  if confirmed is distinct from true or not life_private.policy_valid(policy,x.org_id,'INSTRUCTOR_PUBLIC') then raise exception 'CONSENT_REQUIRED';end if;
 end if;
 update public.life_instructor_dossiers set public_enabled=enabled,public_policy_id=case when enabled then policy end,public_confirmed_at=case when enabled then now() end,revision=x.revision+1 where id=d;
 perform life_private.id_event(x.org_id,d,case when enabled then 'PUBLIC_ENABLED' else 'PUBLIC_WITHDRAWN' end);
end $$;
create function life_private.id_dossier(d uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare x public.life_instructor_dossiers;own boolean;
begin
 select * into x from public.life_instructor_dossiers where id=d;own:=x.person_id=life_private.person_id();
 if x.id is null or not coalesce(own or life_private.has_role(x.org_id,'COURSE_MANAGER'),false) then raise exception 'FORBIDDEN';end if;
 if not own and not exists(select 1 from public.life_instructor_dossier_versions where dossier_id=d and submitted_at is not null) then raise exception 'FORBIDDEN';end if;
 return to_jsonb(x)||jsonb_build_object('owner',own,'name',(select name from public.life_people where id=x.person_id),'current',life_private.id_dossier_current(x.org_id,x.person_id),
 'versions',coalesce((select jsonb_agg(to_jsonb(v)||jsonb_build_object('notices',coalesce((select jsonb_agg(jsonb_build_object('title',pv.title,'version',pv.version,'body',pv.body)) from public.life_policy_versions pv where pv.id in(v.privacy_policy_id,v.review_policy_id)),'[]'::jsonb)) order by version desc) from public.life_instructor_dossier_versions v where dossier_id=d and (own or submitted_at is not null)),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(jsonb_build_object('action',action,'reason',reason,'at',created_at) order by id) from public.life_instructor_development_events where entity_id=d and (own or action not in ('DOSSIER_SAVED','DOSSIER_DRAFTED'))),'[]'::jsonb));
end $$;
create function life_private.id_dossiers(o uuid,staff boolean) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if life_private.person_id() is null or staff is null or (staff and not life_private.has_role(o,'COURSE_MANAGER')) then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(j) from (select jsonb_build_object('id',d.id,'name',p.name,'org_id',d.org_id,'status',v.status,'version',v.version,'specialty',v.payload->>'specialty','current',life_private.id_dossier_current(d.org_id,d.person_id)) j from public.life_instructor_dossiers d join public.life_people p on p.id=d.person_id join lateral(select * from public.life_instructor_dossier_versions where dossier_id=d.id and (not staff or submitted_at is not null) order by version desc limit 1)v on true where d.org_id=o and (staff or d.person_id=life_private.person_id()) order by d.created_at desc limit 100)s),'[]'::jsonb),
 'more',(select count(*)>100 from public.life_instructor_dossiers d where d.org_id=o and (not staff and d.person_id=life_private.person_id() or staff and exists(select 1 from public.life_instructor_dossier_versions where dossier_id=d.id and submitted_at is not null))));
end $$;
create function life_private.id_public_instructors(f uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('name',p.name,'specialty',v.payload->>'specialty','introduction',v.payload->>'public_intro') order by p.name),'[]'::jsonb)
 from public.life_offerings o join public.life_offering_instructors a on a.offering_id=o.id join public.life_people p on p.id=a.person_id join public.life_instructor_dossiers d on d.person_id=p.id and d.org_id=o.org_id
 join lateral(select payload from public.life_instructor_dossier_versions where dossier_id=d.id order by version desc limit 1)v on true
 where o.id=f and o.status in ('PUBLISHED','CLOSED') and (a.valid_until is null or a.valid_until>now()) and d.public_enabled and life_private.id_dossier_current(d.org_id,p.id) and life_private.policy_valid(d.public_policy_id,d.org_id,'INSTRUCTOR_PUBLIC') and exists(select 1 from public.life_role_assignments where person_id=p.id and org_id=o.org_id and role='INSTRUCTOR' and valid_from<=now() and (valid_until is null or valid_until>now()))
$$;
create function life_private.id_start_development(o uuid,y uuid,kind text,target uuid,p uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.life_course_proposals;v public.life_course_proposal_versions;n uuid;
begin
 if not life_private.id_proposer(o,life_private.person_id()) then raise exception 'PROPOSER_REQUIRED';end if;
 if not exists(select 1 from public.life_policy_versions where life_private.policy_valid(id,o,'DEVELOPMENT')) then raise exception 'APPROVED_POLICY_REQUIRED';end if;
 if p is null then
  if kind is null or kind not in ('NEW','REVISION') or (kind='NEW' and target is not null) then raise exception 'INVALID_INPUT';end if;
  if not exists(select 1 from public.life_project_years where id=y and org_id=o) then raise exception 'FORBIDDEN';end if;
  if kind='REVISION' and not exists(select 1 from public.life_courses c where c.id=target and c.org_id=o and (life_private.has_role(o,'COURSE_MANAGER') or exists(select 1 from public.life_course_versions cv join public.life_offerings f on f.course_version_id=cv.id where cv.course_id=c.id and life_private.read_offering(f.id)))) then raise exception 'FORBIDDEN';end if;
  insert into public.life_course_proposals(org_id,person_id,project_year_id,kind,course_id) values(o,life_private.person_id(),y,kind,target) returning * into r;
 else
  select * into r from public.life_course_proposals where id=p for update;
  if r.id is null or r.org_id<>o or r.person_id is distinct from life_private.person_id() then raise exception 'FORBIDDEN';end if;
 end if;
 select * into v from public.life_course_proposal_versions where proposal_id=r.id order by version desc limit 1;
 if v.status in ('DRAFT','SUBMITTED') then return r.id;end if;
 insert into public.life_course_proposal_versions(proposal_id,version) values(r.id,coalesce(v.version,0)+1) returning id into n;
 if v.id is not null then update public.life_course_proposal_versions set payload=v.payload where id=n;end if;
 perform life_private.id_event(o,r.id,'DEVELOPMENT_DRAFTED');return r.id;
end $$;
create function life_private.id_save_development(v uuid,revision integer,payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare x public.life_course_proposal_versions;r public.life_course_proposals;
begin
 select * into x from public.life_course_proposal_versions where id=v;select * into r from public.life_course_proposals where id=x.proposal_id for update;
 if r.id is null or r.person_id is distinct from life_private.person_id() or not life_private.id_proposer(r.org_id,r.person_id) then raise exception 'FORBIDDEN';end if;
 select * into x from public.life_course_proposal_versions where id=v for update;
 if x.status<>'DRAFT' then raise exception 'INVALID_TRANSITION';end if;if x.revision is distinct from revision then raise exception 'REVISION_CHANGED';end if;
 perform life_private.id_validate(payload,'DEVELOPMENT',false);
 update public.life_course_proposal_versions set payload=id_save_development.payload,revision=x.revision+1 where id=v;perform life_private.id_event(r.org_id,r.id,'DEVELOPMENT_SAVED');
end $$;
create function life_private.id_submit_development(v uuid,revision integer,policy uuid,completion uuid,confirmed boolean) returns void language plpgsql security definer set search_path='' as $$
declare x public.life_course_proposal_versions;r public.life_course_proposals;
begin
 select * into x from public.life_course_proposal_versions where id=v;select * into r from public.life_course_proposals where id=x.proposal_id for update;
 if r.id is null or r.person_id is distinct from life_private.person_id() or not life_private.id_proposer(r.org_id,r.person_id) then raise exception 'FORBIDDEN';end if;
 select * into x from public.life_course_proposal_versions where id=v for update;
 if x.status<>'DRAFT' then raise exception 'INVALID_TRANSITION';end if;if x.revision is distinct from revision then raise exception 'REVISION_CHANGED';end if;
 if confirmed is distinct from true or not life_private.policy_valid(policy,r.org_id,'DEVELOPMENT') or not life_private.policy_valid(completion,r.org_id,'COMPLETION') then raise exception 'APPROVED_POLICY_REQUIRED';end if;
 perform life_private.id_validate(x.payload,'DEVELOPMENT',true);
 update public.life_course_proposal_versions set status='SUBMITTED',revision=x.revision+1,development_policy_id=policy,completion_policy_id=completion,confirmed_at=now(),submitted_at=now() where id=v;
 perform life_private.id_event(r.org_id,r.id,'DEVELOPMENT_SUBMITTED');
end $$;
create function life_private.id_decide_development(v uuid,decision text,reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare x public.life_course_proposal_versions;r public.life_course_proposals;cid uuid;cv uuid;ver integer;body text;
begin
 select * into x from public.life_course_proposal_versions where id=v;select * into r from public.life_course_proposals where id=x.proposal_id for update;
 if r.id is null or not life_private.has_role(r.org_id,'COURSE_MANAGER') then raise exception 'FORBIDDEN';end if;
 if r.person_id=life_private.person_id() then raise exception 'SELF_APPROVAL_FORBIDDEN';end if;
 select * into x from public.life_course_proposal_versions where id=v for update;
 if decision is null or decision not in ('APPROVED','CHANGES_REQUESTED','REJECTED') then raise exception 'INVALID_TRANSITION';end if;
 if coalesce(length(trim(reason)),0) not between 1 and 2000 then raise exception 'REASON_REQUIRED';end if;
 if x.status='APPROVED' and decision='APPROVED' and x.revoked_at is null then return x.course_version_id;end if;
 if x.status<>'SUBMITTED' then raise exception 'INVALID_TRANSITION';end if;
 if decision='APPROVED' then
  if not life_private.id_proposer(r.org_id,r.person_id) then raise exception 'PROPOSER_REQUIRED';end if;
  if not life_private.policy_valid(x.development_policy_id,r.org_id,'DEVELOPMENT') or not life_private.policy_valid(x.completion_policy_id,r.org_id,'COMPLETION') then raise exception 'APPROVED_POLICY_REQUIRED';end if;
  perform life_private.id_validate(x.payload,'DEVELOPMENT',true);
  cid:=r.course_id;
  if cid is null then insert into public.life_courses(org_id,title,academy) values(r.org_id,x.payload->>'title',x.payload->>'academy') returning id into cid;update public.life_course_proposals set course_id=cid where id=r.id;end if;
  perform 1 from public.life_courses where id=cid for update;
  select coalesce(max(version),0)+1 into ver from public.life_course_versions where course_id=cid;
  select string_agg((ordinality::text)||'. '||(value->>'title')||' ('||(value->>'minutes')||'분)'||E'\n'||(value->>'content')||E'\n준비·장비: '||(value->>'equipment')||E'\n활동·평가: '||(value->>'assessment'),E'\n\n' order by ordinality) into body from jsonb_array_elements(x.payload->'sessions') with ordinality;
  body:='교육대상: '||(x.payload->>'target')||E'\n선수요건: '||(x.payload->>'prerequisites')||E'\n목표역량: '||(x.payload->>'outcomes')||E'\n준비사항: '||(x.payload->>'materials')||E'\n평가 계획: '||(x.payload->>'assessment')||E'\n\n'||body;
  if length(body)>20000 then raise exception 'CURRICULUM_TOO_LONG';end if;
  insert into public.life_course_versions(org_id,course_id,version,summary,curriculum,status,completion_policy_id,approved_by) values(r.org_id,cid,ver,x.payload->>'summary',body,'APPROVED',x.completion_policy_id,life_private.person_id()) returning id into cv;
 end if;
 update public.life_course_proposal_versions set status=decision,revision=x.revision+1,decided_by=life_private.person_id(),decided_at=now(),decision_reason=reason,course_version_id=cv where id=v;
 perform life_private.id_event(r.org_id,r.id,'DEVELOPMENT_'||decision,reason);return cv;
end $$;
create function life_private.id_withdraw_development(v uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
declare x public.life_course_proposal_versions;r public.life_course_proposals;
begin
 select * into x from public.life_course_proposal_versions where id=v;select * into r from public.life_course_proposals where id=x.proposal_id for update;
 if r.id is null or r.person_id is distinct from life_private.person_id() then raise exception 'FORBIDDEN';end if;
 select * into x from public.life_course_proposal_versions where id=v for update;
 if x.status not in ('DRAFT','SUBMITTED') then raise exception 'INVALID_TRANSITION';end if;
 if coalesce(length(trim(reason)),0) not between 1 and 2000 then raise exception 'REASON_REQUIRED';end if;
 update public.life_course_proposal_versions set status='WITHDRAWN',revision=x.revision+1,decision_reason=reason where id=v;perform life_private.id_event(r.org_id,r.id,'DEVELOPMENT_WITHDRAWN',reason);
end $$;
create function life_private.id_revoke_development(v uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
declare x public.life_course_proposal_versions;r public.life_course_proposals;
begin
 select * into x from public.life_course_proposal_versions where id=v;select * into r from public.life_course_proposals where id=x.proposal_id for update;
 if r.id is null or not life_private.has_role(r.org_id,'COURSE_MANAGER') then raise exception 'FORBIDDEN';end if;
 select * into x from public.life_course_proposal_versions where id=v for update;
 if x.status<>'APPROVED' then raise exception 'INVALID_TRANSITION';end if;
 if coalesce(length(trim(reason)),0) not between 1 and 2000 then raise exception 'REASON_REQUIRED';end if;
 if x.revoked_at is not null then return;end if;
 update public.life_course_proposal_versions set revoked_at=now(),revocation_reason=reason where id=v;perform life_private.id_event(r.org_id,r.id,'DEVELOPMENT_REVOKED',reason);
end $$;
create function life_private.id_development_ready(v uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.life_course_proposal_versions x join public.life_course_proposals p on p.id=x.proposal_id where x.id=v and x.status='APPROVED' and x.revoked_at is null and not exists(select 1 from public.life_course_proposal_versions newer where newer.proposal_id=p.id and newer.version>x.version) and life_private.policy_valid(x.development_policy_id,p.org_id,'DEVELOPMENT') and life_private.policy_valid(x.completion_policy_id,p.org_id,'COMPLETION'))
$$;
create function life_private.id_development(p uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.life_course_proposals;own boolean;
begin
 select * into r from public.life_course_proposals where id=p;own:=r.person_id=life_private.person_id();
 if r.id is null or not coalesce(own or life_private.has_role(r.org_id,'COURSE_MANAGER'),false) then raise exception 'FORBIDDEN';end if;
 if not own and not exists(select 1 from public.life_course_proposal_versions where proposal_id=p and submitted_at is not null) then raise exception 'FORBIDDEN';end if;
 return to_jsonb(r)||jsonb_build_object('owner',own,'name',(select name from public.life_people where id=r.person_id),'manager',life_private.has_role(r.org_id,'COURSE_MANAGER'),'can_write',own and life_private.id_proposer(r.org_id,r.person_id),
 'versions',coalesce((select jsonb_agg(to_jsonb(v)||jsonb_build_object('ready',life_private.id_development_ready(v.id),'notices',coalesce((select jsonb_agg(jsonb_build_object('title',pv.title,'version',pv.version,'body',pv.body)) from public.life_policy_versions pv where pv.id in(v.development_policy_id,v.completion_policy_id)),'[]'::jsonb)) order by version desc) from public.life_course_proposal_versions v where proposal_id=p and (own or submitted_at is not null)),'[]'::jsonb),
 'openings',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'status',f.status)) from public.life_development_openings a join public.life_course_proposal_versions v on v.id=a.proposal_version_id join public.life_offerings f on f.id=a.offering_id where v.proposal_id=p),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(jsonb_build_object('action',action,'reason',reason,'at',created_at) order by id) from public.life_instructor_development_events where entity_id=p and (own or action not in ('DEVELOPMENT_DRAFTED','DEVELOPMENT_SAVED'))),'[]'::jsonb));
end $$;
create function life_private.id_development_board(o uuid,staff boolean) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if life_private.person_id() is null or staff is null or (staff and not life_private.has_role(o,'COURSE_MANAGER')) then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(j) from (select jsonb_build_object('id',p.id,'name',person.name,'title',v.payload->>'title','kind',p.kind,'year_id',p.project_year_id,'status',v.status,'version',v.version,'revoked_at',v.revoked_at) j from public.life_course_proposals p join public.life_people person on person.id=p.person_id join lateral(select * from public.life_course_proposal_versions where proposal_id=p.id and (not staff or submitted_at is not null) order by version desc limit 1)v on true where p.org_id=o and (staff or p.person_id=life_private.person_id()) order by p.created_at desc limit 100)s),'[]'::jsonb),
 'more',(select count(*)>100 from public.life_course_proposals p where p.org_id=o and (not staff and p.person_id=life_private.person_id() or staff and exists(select 1 from public.life_course_proposal_versions where proposal_id=p.id and submitted_at is not null))),
 'counts',case when staff then coalesce((select jsonb_agg(j) from(select p.project_year_id,count(*) filter(where p.kind='NEW' and not exists(select 1 from public.life_course_proposal_versions a where a.proposal_id=p.id and a.status='APPROVED' and a.version<v.version)) as new_count,count(*) filter(where p.kind='REVISION' or exists(select 1 from public.life_course_proposal_versions a where a.proposal_id=p.id and a.status='APPROVED' and a.version<v.version)) as revision_count from public.life_course_proposals p join public.life_course_proposal_versions v on v.proposal_id=p.id where p.org_id=o and v.status='APPROVED' and v.revoked_at is null group by p.project_year_id)j),'[]'::jsonb) else '[]'::jsonb end,
 'courses',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title)) from public.life_courses c where c.org_id=o and (life_private.has_role(o,'COURSE_MANAGER') or exists(select 1 from public.life_course_versions v join public.life_offerings f on f.course_version_id=v.id where v.course_id=c.id and life_private.read_offering(f.id)))),'[]'::jsonb));
end $$;
create function life_private.id_open_development(v uuid,request_key uuid,input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare x public.life_course_proposal_versions;r public.life_course_proposals;a public.life_development_openings;f uuid;y public.life_project_years;af timestamptz;au timestamptz;s date;e date;
begin
 select * into x from public.life_course_proposal_versions where id=v;select * into r from public.life_course_proposals where id=x.proposal_id for update;
 if r.id is null or not life_private.has_role(r.org_id,'COURSE_MANAGER') then raise exception 'FORBIDDEN';end if;
 if request_key is null then raise exception 'INVALID_INPUT';end if;
 select * into a from public.life_development_openings z where z.request_key=id_open_development.request_key;
 if a.offering_id is not null then if a.proposal_version_id<>v or a.input<>input then raise exception 'IDEMPOTENCY_CONFLICT';end if;return a.offering_id;end if;
 if not life_private.id_development_ready(v) then raise exception 'CURRENT_APPROVAL_REQUIRED';end if;
 if jsonb_typeof(input) is distinct from 'object' or octet_length(input::text)>3000 or (input-array['year','name','mode','location','capacity','selection_method','apply_from','apply_until','starts_on','ends_on'])<>'{}'::jsonb then raise exception 'INVALID_INPUT';end if;
 perform life_private.id_text(input,'name',200,true);perform life_private.id_text(input,'location',200,true);
 select * into y from public.life_project_years where id=(input->>'year')::uuid and org_id=r.org_id;
 if y.id is null or input->>'mode' is null or input->>'mode' not in ('ONLINE','OFFLINE','BLENDED') or input->>'selection_method' is null or input->>'selection_method' not in ('REVIEW','FIRST_COME') or jsonb_typeof(input->'capacity') is distinct from 'number' or input->>'capacity'!~'^\d{1,4}$' or (input->>'capacity')::integer not between 1 and (x.payload->>'capacity')::integer then raise exception 'INVALID_INPUT';end if;
 af:=(input->>'apply_from')::timestamptz;au:=(input->>'apply_until')::timestamptz;s:=(input->>'starts_on')::date;e:=(input->>'ends_on')::date;
 if af is null or au is null or s is null or e is null or au<=af or s<y.starts_on or e>y.ends_on or e<s or au>((s+1)::timestamp at time zone 'Asia/Seoul') then raise exception 'INVALID_DATE';end if;
 insert into public.life_offerings(org_id,project_year_id,course_version_id,name,mode,location,capacity,selection_method,apply_from,apply_until,starts_on,ends_on) values(r.org_id,y.id,x.course_version_id,input->>'name',input->>'mode',input->>'location',(input->>'capacity')::integer,input->>'selection_method',af,au,s,e) returning id into f;
 insert into public.life_development_openings(request_key,proposal_version_id,offering_id,actor_id,input) values(request_key,v,f,life_private.person_id(),input);
 perform life_private.id_event(r.org_id,r.id,'DEVELOPMENT_OPENED',f::text);return f;
end $$;
-- Developed course content stays immutable; publication only changes the offering.
create function life_private.id_course_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.life_course_proposal_versions where course_version_id=old.id) and (tg_op='DELETE' or to_jsonb(old) is distinct from to_jsonb(new)) then raise exception 'IMMUTABLE_RECORD';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger life_developed_course_frozen before update or delete on public.life_course_versions for each row execute function life_private.id_course_guard();
create or replace function life_private.publish(f uuid,enrollment_policy uuid,completion_policy uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.life_offerings;v public.life_course_proposal_versions;
begin
 select * into o from public.life_offerings where id=f for update;
 if o.id is null or not life_private.manages(f) then raise exception 'FORBIDDEN';end if;
 if o.status<>'DRAFT' then raise exception 'INVALID_TRANSITION';end if;
 if not life_private.policy_valid(enrollment_policy,o.org_id,'ENROLLMENT') or not life_private.policy_valid(completion_policy,o.org_id,'COMPLETION') then raise exception 'APPROVED_POLICY_REQUIRED';end if;
 if o.tuition<>0 and not exists(select 1 from public.life_offering_finance c where c.offering_id=f and life_private.policy_valid(c.policy_id,o.org_id,'REFUND') and exists(select 1 from public.life_refund_rules r where r.policy_id=c.policy_id)) then raise exception 'APPROVED_REFUND_POLICY_REQUIRED';end if;
 select * into v from public.life_course_proposal_versions where course_version_id=o.course_version_id;
 if v.id is not null then
  perform 1 from public.life_course_proposals where id=v.proposal_id for update;
  if not life_private.id_development_ready(v.id) or v.completion_policy_id is distinct from completion_policy then raise exception 'CURRENT_APPROVAL_REQUIRED';end if;
 else update public.life_course_versions set status='APPROVED',completion_policy_id=completion_policy,approved_by=life_private.person_id() where id=o.course_version_id;end if;
 update public.life_offerings set status='PUBLISHED',enrollment_policy_id=enrollment_policy where id=f;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id) values(o.org_id,life_private.person_id(),'OFFERING_PUBLISHED',f);
end $$;
create function public.life_instructor_options() returns jsonb language sql security invoker set search_path='' as $$select life_private.id_options()$$;
create function public.life_instructor_dossiers(o uuid,staff boolean) returns jsonb language sql security invoker set search_path='' as $$select life_private.id_dossiers(o,staff)$$;
create function public.life_instructor_dossier(d uuid) returns jsonb language sql security invoker set search_path='' as $$select life_private.id_dossier(d)$$;
create function public.life_start_dossier(o uuid,privacy uuid,confirmed boolean) returns uuid language sql security invoker set search_path='' as $$select life_private.id_start_dossier(o,privacy,confirmed)$$;
create function public.life_save_dossier(v uuid,revision integer,payload jsonb) returns void language sql security invoker set search_path='' as $$select life_private.id_save_dossier(v,revision,payload)$$;
create function public.life_submit_dossier(v uuid,revision integer,policy uuid,confirmed boolean) returns void language sql security invoker set search_path='' as $$select life_private.id_submit_dossier(v,revision,policy,confirmed)$$;
create function public.life_decide_dossier(v uuid,decision text,reason text,valid_until date,verified boolean) returns void language sql security invoker set search_path='' as $$select life_private.id_decide_dossier(v,decision,reason,valid_until,verified)$$;
create function public.life_withdraw_dossier(v uuid,reason text) returns void language sql security invoker set search_path='' as $$select life_private.id_withdraw_dossier(v,reason)$$;
create function public.life_set_instructor_public(d uuid,enabled boolean,policy uuid,confirmed boolean,revision integer) returns void language sql security invoker set search_path='' as $$select life_private.id_set_public(d,enabled,policy,confirmed,revision)$$;
create function public.life_public_instructors(f uuid) returns jsonb language sql security invoker set search_path='' as $$select life_private.id_public_instructors(f)$$;
create function public.life_development_board(o uuid,staff boolean) returns jsonb language sql security invoker set search_path='' as $$select life_private.id_development_board(o,staff)$$;
create function public.life_development_detail(p uuid) returns jsonb language sql security invoker set search_path='' as $$select life_private.id_development(p)$$;
create function public.life_start_development(o uuid,y uuid,kind text,target uuid,p uuid) returns uuid language sql security invoker set search_path='' as $$select life_private.id_start_development(o,y,kind,target,p)$$;
create function public.life_save_development(v uuid,revision integer,payload jsonb) returns void language sql security invoker set search_path='' as $$select life_private.id_save_development(v,revision,payload)$$;
create function public.life_submit_development(v uuid,revision integer,policy uuid,completion uuid,confirmed boolean) returns void language sql security invoker set search_path='' as $$select life_private.id_submit_development(v,revision,policy,completion,confirmed)$$;
create function public.life_decide_development(v uuid,decision text,reason text) returns uuid language sql security invoker set search_path='' as $$select life_private.id_decide_development(v,decision,reason)$$;
create function public.life_withdraw_development(v uuid,reason text) returns void language sql security invoker set search_path='' as $$select life_private.id_withdraw_development(v,reason)$$;
create function public.life_revoke_development(v uuid,reason text) returns void language sql security invoker set search_path='' as $$select life_private.id_revoke_development(v,reason)$$;
create function public.life_open_development(v uuid,request_key uuid,input jsonb) returns uuid language sql security invoker set search_path='' as $$select life_private.id_open_development(v,request_key,input)$$;
do $$declare t text;f record;begin
 foreach t in array array['life_instructor_dossiers','life_instructor_dossier_versions','life_course_proposals','life_course_proposal_versions','life_development_openings','life_instructor_development_events'] loop
  execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
 for f in select p.oid::regprocedure sig,p.proname,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='life_private' and left(p.proname,3)='id_') or (n.nspname='public' and p.proname=any(array['life_instructor_options','life_instructor_dossiers','life_instructor_dossier','life_start_dossier','life_save_dossier','life_submit_dossier','life_decide_dossier','life_withdraw_dossier','life_set_instructor_public','life_public_instructors','life_development_board','life_development_detail','life_start_development','life_save_development','life_submit_development','life_decide_development','life_withdraw_development','life_revoke_development','life_open_development'])) loop
  execute format('revoke execute on function %s from public,anon,authenticated',f.sig);
  if f.nspname='public' or f.proname=any(array['id_options','id_dossiers','id_dossier','id_start_dossier','id_save_dossier','id_submit_dossier','id_decide_dossier','id_withdraw_dossier','id_set_public','id_public_instructors','id_development_board','id_development','id_start_development','id_save_development','id_submit_development','id_decide_development','id_withdraw_development','id_revoke_development','id_open_development']) then execute format('grant execute on function %s to authenticated',f.sig);end if;
  if f.proname in ('id_public_instructors','life_public_instructors') then execute format('grant execute on function %s to anon',f.sig);end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
