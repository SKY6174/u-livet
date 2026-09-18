begin;
-- No LIVE mode or external network dispatch exists in this implementation.
create table public.life_message_settings (
 org_id uuid primary key references public.life_organizations,
 mode text not null default 'DISABLED' check(mode in ('DISABLED','TEST'))
);
create table public.life_message_templates (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.life_organizations,
 kind text not null check(kind in ('OPERATIONS','MARKETING')),
 audience text not null check(audience in ('APPLICANTS','ACTIVE','PENDING_PAYMENT','COMPLETED')),
 title text not null check(length(trim(title)) between 1 and 100),version text not null,
 body text not null check(length(trim(body)) between 1 and 1800),enabled boolean not null default true,
 approved_by uuid not null references public.life_people,approved_at timestamptz not null,
 approval_reference text not null check(length(trim(approval_reference))>0),unique(id,org_id),unique(org_id,title,version)
);
create table life_private.message_contacts (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.life_organizations,
 person_id uuid not null references public.life_people,recipient_ref text not null check(length(recipient_ref) between 1 and 300),
 masked_label text not null check(masked_label ~ '^010-\*{4}-[0-9]{4}$'),
 verified_until timestamptz not null,verification_reference text not null check(length(trim(verification_reference))>0),
 privacy_reference text not null check(length(trim(privacy_reference))>0),disabled_at timestamptz,
 created_at timestamptz not null default now(),unique(id,org_id,person_id)
);
create unique index life_message_contact_active on life_private.message_contacts(org_id,person_id) where disabled_at is null;
create table public.life_message_marketing_policies (
 policy_id uuid primary key,org_id uuid not null,
 approval_reference text not null check(length(trim(approval_reference))>0),
 foreign key(policy_id,org_id) references public.life_policy_versions(id,org_id)
);
create table public.life_message_preferences (
 org_id uuid not null references public.life_organizations,person_id uuid not null references public.life_people,
 accepted boolean not null,policy_id uuid references public.life_policy_versions,revision bigint not null default 1,
 updated_at timestamptz not null default now(),primary key(org_id,person_id),check(not accepted or policy_id is not null)
);
create table public.life_message_consent_events (
 id bigint generated always as identity primary key,org_id uuid not null references public.life_organizations,
 person_id uuid not null references public.life_people,policy_id uuid references public.life_policy_versions,
 accepted boolean not null,recorded_at timestamptz not null default now()
);
create index life_message_consent_person on public.life_message_consent_events(person_id,id desc);
create table public.life_message_jobs (
 id uuid primary key default gen_random_uuid(),org_id uuid not null,offering_id uuid not null,template_id uuid not null,
 created_by uuid not null references public.life_people,request_key uuid not null,body text not null,
 scheduled_at timestamptz not null,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '15 minutes',
 status text not null default 'PREVIEW' check(status in ('PREVIEW','QUEUED','BLOCKED_CONFIG','CANCELLED','FINISHED')),
 mode text not null default 'DISABLED' check(mode in ('DISABLED','TEST')),
 foreign key(offering_id,org_id) references public.life_offerings(id,org_id),
 foreign key(template_id,org_id) references public.life_message_templates(id,org_id),
 unique(org_id,created_by,request_key)
);
create index life_message_jobs_recent on public.life_message_jobs(org_id,created_at desc);
create index life_message_jobs_due on public.life_message_jobs(status,scheduled_at);
create table public.life_message_deliveries (
 id uuid primary key default gen_random_uuid(),job_id uuid not null references public.life_message_jobs,
 person_id uuid not null references public.life_people,contact_id uuid references life_private.message_contacts,
 state text not null check(state in ('ELIGIBLE','QUEUED','SKIPPED','PROCESSING','UNKNOWN','TEST_PROCESSED','CANCELLED')),
 reason text not null, idempotency_key uuid not null default gen_random_uuid() unique,
 lease_token uuid,lease_until timestamptz,processed_at timestamptz,unique(job_id,person_id)
);
create index life_message_deliveries_pending on public.life_message_deliveries(job_id,state);
create table public.life_message_events (
 id bigint generated always as identity primary key,job_id uuid not null references public.life_message_jobs,
 actor_id uuid references public.life_people,action text not null,created_at timestamptz not null default now()
);
create function life_private.message_lock(o uuid) returns void language sql set search_path='' as $$
 select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(o::text,17321))
$$;
create function life_private.message_template_frozen() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or (to_jsonb(old)-'enabled') is distinct from (to_jsonb(new)-'enabled') then raise exception 'APPROVED_CONFIG_IMMUTABLE';end if;
 return new;
end $$;
create trigger life_message_template_frozen before update or delete on public.life_message_templates for each row execute function life_private.message_template_frozen();
-- A verified contact is versioned; only disconnection may mutate a version.
create function life_private.message_contact_frozen() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(old)-'disabled_at') is distinct from (to_jsonb(new)-'disabled_at') or old.disabled_at is not null then raise exception 'CONTACT_VERSION_IMMUTABLE';end if;
 return new;
end $$;
create trigger life_message_contact_frozen before update on life_private.message_contacts for each row execute function life_private.message_contact_frozen();
create function life_private.message_policy_valid(p uuid,o uuid) returns boolean language sql stable security definer set search_path='' as $$
 select life_private.policy_valid(p,o,'MARKETING') and exists(select 1 from public.life_message_marketing_policies where policy_id=p and org_id=o)
$$;
create function life_private.message_contact(o uuid,p uuid) returns uuid language sql stable security definer set search_path='' as $$
 select id from life_private.message_contacts where org_id=o and person_id=p and disabled_at is null and verified_until>now()
$$;
create function life_private.message_eligible(f uuid,t uuid,p uuid,expected_contact uuid default null) returns text language plpgsql stable security definer set search_path='' as $$
declare o public.life_offerings;v public.life_message_templates;c uuid;
begin
 select * into o from public.life_offerings where id=f;
 select * into v from public.life_message_templates where id=t and org_id=o.org_id and enabled;
 if v.id is null then return 'TEMPLATE_DISABLED';end if;
 if not exists(select 1 from public.life_people pp join public.life_auth_links a on a.person_id=pp.id where pp.id=p and pp.active and a.auth_user_id is not null) then return 'ACCOUNT_INACTIVE';end if;
 if not exists(select 1 from public.life_applications a where a.offering_id=f and a.person_id=p and
   case v.audience
   when 'APPLICANTS' then a.status in ('SUBMITTED','WAITLISTED','PENDING_PAYMENT','ACCEPTED')
   when 'PENDING_PAYMENT' then a.status='PENDING_PAYMENT' and exists(select 1 from public.life_invoices i where i.application_id=a.id and i.status='OPEN' and i.due_at>now())
   when 'ACTIVE' then exists(select 1 from public.life_enrollments e where e.application_id=a.id and e.status='ACTIVE')
   when 'COMPLETED' then exists(select 1 from public.life_completion_runs r join public.life_completion_approvals ca on ca.run_id=r.id join public.life_enrollments e on e.id=r.enrollment_id where r.offering_id=f and r.person_id=p and r.outcome='READY' and r.input_revision=o.academic_revision and o.academic_sealed and e.status='ACTIVE' and life_private.policy_valid((r.evidence->>'policy_id')::uuid,o.org_id,'COMPLETION'))
   else false end) then return 'OUTSIDE_AUDIENCE';end if;
 c:=life_private.message_contact(o.org_id,p);
 if c is null then return 'NO_VERIFIED_CONTACT';end if;
 if expected_contact is not null and c<>expected_contact then return 'CONTACT_CHANGED';end if;
 if v.kind='MARKETING' and not exists(select 1 from public.life_message_preferences x where x.org_id=o.org_id and x.person_id=p and x.accepted and life_private.message_policy_valid(x.policy_id,o.org_id)) then return 'NO_MARKETING_CONSENT';end if;
 return 'ELIGIBLE';
end $$;
create function life_private.message_creator_valid(j uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.life_message_jobs x join public.life_people p on p.id=x.created_by join public.life_auth_links a on a.person_id=p.id join public.life_role_assignments r on r.person_id=p.id and r.org_id=x.org_id where x.id=j and p.active and a.auth_user_id is not null and r.role='COURSE_MANAGER' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()))
$$;
create function life_private.message_preview(f uuid,t uuid,scheduled timestamptz,request_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.life_offerings;v public.life_message_templates;x public.life_message_jobs;result uuid;
begin
 select * into o from public.life_offerings where id=f;
 if o.id is null or not life_private.manages(f) then raise exception 'FORBIDDEN';end if;
 perform life_private.message_lock(o.org_id);
 select * into x from public.life_message_jobs where org_id=o.org_id and created_by=life_private.person_id() and life_message_jobs.request_key=message_preview.request_key;
 if x.id is not null then
   if x.offering_id<>f or x.template_id<>t or x.scheduled_at is distinct from scheduled then raise exception 'IDEMPOTENCY_CONFLICT';end if;
   return x.id;
 end if;
 select * into v from public.life_message_templates where id=t and org_id=o.org_id and enabled;
 if v.id is null then raise exception 'APPROVED_TEMPLATE_REQUIRED';end if;
 if request_key is null or scheduled is null or scheduled<now() or scheduled>now()+interval '30 days' then raise exception 'INVALID_SCHEDULE';end if;
 if (select count(*) from public.life_applications where offering_id=f)>1000 then raise exception 'AUDIENCE_LIMIT';end if;
 insert into public.life_message_jobs(org_id,offering_id,template_id,created_by,request_key,body,scheduled_at)
 values(o.org_id,f,t,life_private.person_id(),request_key,replace(v.body,'{{course}}',o.name),scheduled) returning id into result;
 insert into public.life_message_deliveries(job_id,person_id,contact_id,state,reason)
 select result,a.person_id,life_private.message_contact(o.org_id,a.person_id),case when q.reason='ELIGIBLE' then 'ELIGIBLE' else 'SKIPPED' end,q.reason
 from public.life_applications a cross join lateral (select life_private.message_eligible(f,t,a.person_id) reason) q where a.offering_id=f;
 insert into public.life_message_events(job_id,actor_id,action) values(result,life_private.person_id(),'PREVIEW_CREATED');
 return result;
end $$;
create function life_private.message_queue(j uuid) returns void language plpgsql security definer set search_path='' as $$
<<ctx>>
declare x public.life_message_jobs;r public.life_message_deliveries;reason text;mode text;
begin
 select * into x from public.life_message_jobs where id=j;
 if x.id is null or not life_private.has_role(x.org_id,'COURSE_MANAGER') then raise exception 'FORBIDDEN';end if;
 perform life_private.message_lock(x.org_id);
 select * into x from public.life_message_jobs where id=j;
 if x.status in ('QUEUED','BLOCKED_CONFIG','FINISHED') then return;end if;
 if x.status<>'PREVIEW' then raise exception 'INVALID_TRANSITION';end if;
 if x.expires_at<=now() or x.scheduled_at<now() then raise exception 'PREVIEW_EXPIRED';end if;
 if not life_private.message_creator_valid(j) then raise exception 'CREATOR_REVOKED';end if;
 for r in select * from public.life_message_deliveries where job_id=j and state='ELIGIBLE' loop
   reason:=life_private.message_eligible(x.offering_id,x.template_id,r.person_id,r.contact_id);
   update public.life_message_deliveries set state=case when ctx.reason='ELIGIBLE' then 'QUEUED' else 'SKIPPED' end,reason=ctx.reason where id=r.id;
 end loop;
 if not exists(select 1 from public.life_message_deliveries where job_id=j and state='QUEUED') then raise exception 'NO_ELIGIBLE_RECIPIENTS';end if;
 select s.mode into mode from public.life_message_settings s where org_id=x.org_id;
 update public.life_message_jobs set status=case when ctx.mode='TEST' then 'QUEUED' else 'BLOCKED_CONFIG' end,mode=coalesce(ctx.mode,'DISABLED') where id=j;
 insert into public.life_message_events(job_id,actor_id,action) values(j,life_private.person_id(),case when ctx.mode='TEST' then 'TEST_QUEUED' else 'CONFIG_BLOCKED' end);
end $$;
create function life_private.message_cancel(j uuid) returns void language plpgsql security definer set search_path='' as $$
declare x public.life_message_jobs;
begin
 select * into x from public.life_message_jobs where id=j;
 if x.id is null or not life_private.has_role(x.org_id,'COURSE_MANAGER') then raise exception 'FORBIDDEN';end if;
 perform life_private.message_lock(x.org_id);
 select * into x from public.life_message_jobs where id=j;
 if x.status='CANCELLED' then return;end if;
 if x.status='FINISHED' then raise exception 'INVALID_TRANSITION';end if;
 if exists(select 1 from public.life_message_deliveries where job_id=j and state in ('PROCESSING','UNKNOWN')) then raise exception 'PROCESSING_REQUIRES_REVIEW';end if;
 update public.life_message_deliveries set state='CANCELLED',reason='CANCELLED' where job_id=j and state in ('ELIGIBLE','QUEUED');
 update public.life_message_jobs set status='CANCELLED' where id=j;
 insert into public.life_message_events(job_id,actor_id,action) values(j,life_private.person_id(),'CANCELLED');
end $$;
create function life_private.set_marketing(o uuid,policy uuid,accepted boolean) returns void language plpgsql security definer set search_path='' as $$
declare p uuid:=life_private.person_id();v uuid;
begin
 if p is null then raise exception 'AUTH_REQUIRED';end if;
 if not exists(select 1 from public.life_organizations where id=o) or accepted is null then raise exception 'INVALID_INPUT';end if;
 perform life_private.message_lock(o);
 if accepted and not life_private.message_policy_valid(policy,o) then raise exception 'APPROVED_POLICY_REQUIRED';end if;
 select policy_id into v from public.life_message_preferences where org_id=o and person_id=p;
 if accepted then v:=policy;end if;
 insert into public.life_message_preferences(org_id,person_id,policy_id,accepted) values(o,p,v,accepted)
 on conflict(org_id,person_id) do update set policy_id=excluded.policy_id,accepted=excluded.accepted,revision=public.life_message_preferences.revision+1,updated_at=now();
 insert into public.life_message_consent_events(org_id,person_id,policy_id,accepted) values(o,p,v,accepted);
 if not accepted then
   update public.life_message_deliveries d set state='SKIPPED',reason='CONSENT_WITHDRAWN' from public.life_message_jobs j join public.life_message_templates t on t.id=j.template_id where d.job_id=j.id and j.org_id=o and t.kind='MARKETING' and d.person_id=p and d.state in ('ELIGIBLE','QUEUED');
 end if;
end $$;
create function life_private.disconnect_contact(o uuid) returns void language plpgsql security definer set search_path='' as $$
declare p uuid:=life_private.person_id();
begin
 if p is null then raise exception 'AUTH_REQUIRED';end if;
 perform life_private.message_lock(o);
 update life_private.message_contacts set disabled_at=now() where org_id=o and person_id=p and disabled_at is null;
 update public.life_message_deliveries d set state='SKIPPED',reason='CONTACT_DISCONNECTED' from public.life_message_jobs j where d.job_id=j.id and j.org_id=o and d.person_id=p and d.state in ('ELIGIBLE','QUEUED');
 insert into public.life_audit_events(org_id,actor_id,action,entity_id) values(o,p,'MESSAGE_CONTACT_DISCONNECTED',p);
end $$;
create function life_private.notification_preferences() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p uuid:=life_private.person_id();result jsonb;
begin
 if p is null then raise exception 'AUTH_REQUIRED';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'accepted',coalesce(x.accepted,false),'policy_id',x.policy_id,
 'effective',coalesce(x.accepted and life_private.message_policy_valid(x.policy_id,o.id),false),'updated_at',x.updated_at,
 'contact',(select jsonb_build_object('label',c.masked_label,'valid',c.verified_until>now(),'until',c.verified_until) from life_private.message_contacts c where c.org_id=o.id and c.person_id=p and c.disabled_at is null),
 'policies',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'title',v.title,'version',v.version,'body',v.body) order by v.effective_from desc) from public.life_policy_versions v where v.org_id=o.id and life_private.message_policy_valid(v.id,o.id)),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.id desc) from (select e.id,e.accepted,e.recorded_at,v.title,v.version from public.life_message_consent_events e left join public.life_policy_versions v on v.id=e.policy_id where e.org_id=o.id and e.person_id=p order by e.id desc limit 20)e),'[]'::jsonb)
 ) order by o.name),'[]'::jsonb) into result from public.life_organizations o left join public.life_message_preferences x on x.org_id=o.id and x.person_id=p
 where x.person_id is not null
 or exists(select 1 from public.life_consent_events ce join public.life_policy_versions pv on pv.id=ce.policy_id where ce.person_id=p and pv.org_id=o.id)
 or exists(select 1 from life_private.message_contacts c where c.person_id=p and c.org_id=o.id);
 return result;
end $$;
create function life_private.message_options() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if life_private.person_id() is null then raise exception 'AUTH_REQUIRED';end if;
 return jsonb_build_object(
 'offerings',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'org_id',o.org_id,'name',o.name) order by o.created_at desc) from public.life_offerings o where life_private.manages(o.id)),'[]'::jsonb),
 'templates',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'org_id',t.org_id,'title',t.title,'kind',t.kind,'audience',t.audience,'version',t.version,'body',t.body) order by t.title) from public.life_message_templates t where enabled and life_private.has_role(org_id,'COURSE_MANAGER')),'[]'::jsonb)
 );
end $$;
create function life_private.message_overview(j uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if life_private.person_id() is null then raise exception 'AUTH_REQUIRED';end if;
 if j is not null and not exists(select 1 from public.life_message_jobs where id=j and life_private.has_role(org_id,'COURSE_MANAGER')) then raise exception 'FORBIDDEN';end if;
 return coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc) from (
 select x.id,x.offering_id,x.status,x.mode,x.scheduled_at,x.created_at,x.expires_at,x.body,o.name,t.title,t.version,t.kind,t.audience,
 (select count(*) from public.life_message_deliveries where job_id=x.id) total,
 coalesce((select jsonb_object_agg(state,n) from (select state,count(*) n from public.life_message_deliveries where job_id=x.id group by state)s),'{}'::jsonb) counts,
 coalesce((select jsonb_object_agg(reason,n) from (select reason,count(*) n from public.life_message_deliveries where job_id=x.id and state='SKIPPED' group by reason)s),'{}'::jsonb) exclusions,
 case when j is not null then coalesce((select jsonb_agg(to_jsonb(s)) from (select d.state,d.reason,c.masked_label label from public.life_message_deliveries d left join life_private.message_contacts c on c.id=d.contact_id where d.job_id=x.id order by d.id limit 5)s),'[]'::jsonb) else '[]'::jsonb end samples,
 case when j is not null then coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from (select e.id,e.action,e.created_at from public.life_message_events e where e.job_id=x.id order by e.id desc limit 100)e),'[]'::jsonb) else '[]'::jsonb end events
 from public.life_message_jobs x join public.life_offerings o on o.id=x.offering_id join public.life_message_templates t on t.id=x.template_id
 where (j is null or x.id=j) and life_private.has_role(x.org_id,'COURSE_MANAGER') order by x.created_at desc limit 100
 )q),'[]'::jsonb);
end $$;
-- Service-only local simulation. Never obtains recipient_ref or sends network traffic.
create function life_private.message_test_claim(j uuid) returns jsonb language plpgsql security definer set search_path='' as $$
<<ctx>>
declare x public.life_message_jobs;r public.life_message_deliveries;reason text;token uuid;result jsonb:='[]'::jsonb;
begin
 select * into x from public.life_message_jobs where id=j;
 if x.id is null then raise exception 'INVALID_JOB';end if;
 perform life_private.message_lock(x.org_id);
 select * into x from public.life_message_jobs where id=j;
 if x.mode<>'TEST' or not exists(select 1 from public.life_message_settings where org_id=x.org_id and mode='TEST') then raise exception 'PROVIDER_NOT_CONFIGURED';end if;
 if x.status<>'QUEUED' or x.scheduled_at>now() then return result;end if;
 update public.life_message_deliveries set state='UNKNOWN',reason='LEASE_EXPIRED' where job_id=j and state='PROCESSING' and lease_until<=now();
 for r in select * from public.life_message_deliveries where job_id=j and state='QUEUED' order by id limit 100 loop
   reason:=case when not life_private.message_creator_valid(j) then 'CREATOR_REVOKED' else life_private.message_eligible(x.offering_id,x.template_id,r.person_id,r.contact_id) end;
   if reason<>'ELIGIBLE' then update public.life_message_deliveries set state='SKIPPED',reason=ctx.reason where id=r.id;
   else
     token:=gen_random_uuid();
     update public.life_message_deliveries set state='PROCESSING',lease_token=token,lease_until=now()+interval '2 minutes' where id=r.id;
     result:=result||jsonb_build_array(jsonb_build_object('id',r.id,'token',token,'key',r.idempotency_key));
   end if;
 end loop;
 if not exists(select 1 from public.life_message_deliveries where job_id=j and state in ('QUEUED','PROCESSING','UNKNOWN')) then update public.life_message_jobs set status='FINISHED' where id=j;end if;
 insert into public.life_message_events(job_id,action) values(j,'TEST_CLAIM_CHECKED');
 return result;
end $$;
create function life_private.message_test_finish(d uuid,token uuid) returns void language plpgsql security definer set search_path='' as $$
<<ctx>>
declare x public.life_message_jobs;r public.life_message_deliveries;reason text;
begin
 select j.* into x from public.life_message_jobs j join public.life_message_deliveries v on v.job_id=j.id where v.id=d;
 if x.id is null then raise exception 'INVALID_JOB';end if;
 perform life_private.message_lock(x.org_id);
 select * into r from public.life_message_deliveries where id=d;
 if x.mode<>'TEST' or not exists(select 1 from public.life_message_settings where org_id=x.org_id and mode='TEST') then raise exception 'PROVIDER_NOT_CONFIGURED';end if;
 if token is null or r.lease_token is distinct from token then raise exception 'STALE_LEASE';end if;
 if r.state='TEST_PROCESSED' then return;end if;
 if r.state<>'PROCESSING' or r.lease_until<=now() then raise exception 'STALE_LEASE';end if;
 reason:=case when not life_private.message_creator_valid(x.id) then 'CREATOR_REVOKED' else life_private.message_eligible(x.offering_id,x.template_id,r.person_id,r.contact_id) end;
 update public.life_message_deliveries set state=case when ctx.reason='ELIGIBLE' then 'TEST_PROCESSED' else 'SKIPPED' end,reason=case when ctx.reason='ELIGIBLE' then 'TEST_ONLY' else ctx.reason end,processed_at=now() where id=d;
 if not exists(select 1 from public.life_message_deliveries where job_id=x.id and state in ('QUEUED','PROCESSING','UNKNOWN')) then update public.life_message_jobs set status='FINISHED' where id=x.id;end if;
 insert into public.life_message_events(job_id,action) values(x.id,case when ctx.reason='ELIGIBLE' then 'TEST_PROCESSED' else 'TEST_SKIPPED' end);
end $$;

create function public.life_message_options() returns jsonb language sql security invoker set search_path='' as $$select life_private.message_options()$$;
create function public.life_message_overview(j uuid default null) returns jsonb language sql security invoker set search_path='' as $$select life_private.message_overview(j)$$;
create function public.life_message_preview(f uuid,t uuid,scheduled timestamptz,request_key uuid) returns uuid language sql security invoker set search_path='' as $$select life_private.message_preview(f,t,scheduled,request_key)$$;
create function public.life_message_queue(j uuid) returns void language sql security invoker set search_path='' as $$select life_private.message_queue(j)$$;
create function public.life_message_cancel(j uuid) returns void language sql security invoker set search_path='' as $$select life_private.message_cancel(j)$$;
create function public.life_notification_preferences() returns jsonb language sql security invoker set search_path='' as $$select life_private.notification_preferences()$$;
create function public.life_set_marketing(o uuid,policy uuid,accepted boolean) returns void language sql security invoker set search_path='' as $$select life_private.set_marketing(o,policy,accepted)$$;
create function public.life_disconnect_contact(o uuid) returns void language sql security invoker set search_path='' as $$select life_private.disconnect_contact(o)$$;
create function public.life_message_test_claim(j uuid) returns jsonb language sql security invoker set search_path='' as $$select life_private.message_test_claim(j)$$;
create function public.life_message_test_finish(d uuid,token uuid) returns void language sql security invoker set search_path='' as $$select life_private.message_test_finish(d,token)$$;

do $$ declare r record;begin
 for r in select tablename from pg_tables where schemaname='public' and tablename like 'life_message_%' loop
   execute format('alter table public.%I enable row level security',r.tablename);
   execute format('revoke all on public.%I from public,anon,authenticated',r.tablename);
 end loop;
 for r in select p.oid::regprocedure signature,p.proname,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','life_private') and (p.proname like 'life_message_%' or p.proname like 'message_%' or p.proname in ('life_notification_preferences','notification_preferences','life_set_marketing','set_marketing','life_disconnect_contact','disconnect_contact')) loop
   execute format('revoke execute on function %s from public,anon,authenticated',r.signature);
   if r.proname in ('message_test_claim','message_test_finish','life_message_test_claim','life_message_test_finish') then
     execute format('grant execute on function %s to service_role',r.signature);
   elsif r.proname in ('message_options','message_overview','message_preview','message_queue','message_cancel','notification_preferences','set_marketing','disconnect_contact','life_message_options','life_message_overview','life_message_preview','life_message_queue','life_message_cancel','life_notification_preferences','life_set_marketing','life_disconnect_contact') then
     execute format('grant execute on function %s to authenticated',r.signature);
   end if;
 end loop;
end $$;
alter table life_private.message_contacts enable row level security;
revoke all on life_private.message_contacts from public,anon,authenticated,service_role;
grant usage on schema life_private to service_role;
notify pgrst,'reload schema';
commit;
