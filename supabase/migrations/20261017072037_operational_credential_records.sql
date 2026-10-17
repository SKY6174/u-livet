begin;

-- Operational read models only. Original issuance, file, token, sharing,
-- status, counter, evidence and verification records remain unchanged.
create function life_private.operational_credential_context(f uuid,p uuid default null,issuer uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
 select life_private.operational_offering(f)
 and not exists(select 1 from life_private.non_operational_members n where n.person_id=p)
 and (issuer is null or exists(select 1 from public.life_issuer_authorizations a where a.id=issuer and not a.test_only))
$$;
revoke all on function life_private.operational_credential_context(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create view life_private.operational_issuer_authorizations with(security_invoker=true) as
 select a.* from public.life_issuer_authorizations a where not a.test_only;

-- Check the immutable artifact as well as current context. A test artifact
-- cannot become an operational issue because its current issuer is normal.
create view life_private.operational_certificate_requests with(security_invoker=true) as
 select r.* from public.life_certificate_requests r
 where life_private.operational_credential_context(r.offering_id,r.person_id)
 and not exists(select 1 from public.life_certificate_issues i where i.request_id=r.id and (
   not life_private.operational_credential_context(r.offering_id,r.person_id,i.issuer_id)
   or coalesce(i.snapshot#>>'{issuer,test_only}','false')='true'));
create view life_private.operational_certificate_issues with(security_invoker=true) as
 select i.* from public.life_certificate_issues i
 join life_private.operational_certificate_requests r on r.id=i.request_id;

create view life_private.operational_badge_definitions with(security_invoker=true) as
 select b.* from public.life_badge_definitions b
 where life_private.operational_credential_context(b.offering_id,null,b.issuer_id);
create view life_private.operational_badge_requests with(security_invoker=true) as
 select q.* from public.life_badge_requests q
 join life_private.operational_badge_definitions d on d.id=q.definition_id
 where life_private.operational_credential_context(q.offering_id,q.person_id,d.issuer_id)
 and not exists(select 1 from public.life_badge_awards a where a.request_id=q.id and (
   not life_private.operational_credential_context(a.offering_id,a.person_id,a.issuer_id)
   or coalesce(a.artifact_text::jsonb#>>'{issuer,test_only}','false')='true'));
create view life_private.operational_badge_awards with(security_invoker=true) as
 select a.* from public.life_badge_awards a
 join life_private.operational_badge_requests q on q.id=a.request_id
 where life_private.operational_credential_context(a.offering_id,a.person_id,a.issuer_id)
 and coalesce(a.artifact_text::jsonb#>>'{issuer,test_only}','false')<>'true';

revoke all on life_private.operational_issuer_authorizations,
 life_private.operational_certificate_requests,life_private.operational_certificate_issues,
 life_private.operational_badge_definitions,life_private.operational_badge_requests,
 life_private.operational_badge_awards from public,anon,authenticated,service_role;

-- Existing signatures, organization/owner/delegation/MFA guards and ACLs stay.

-- Operational credential read: certificate_list
CREATE OR REPLACE FUNCTION life_private.certificate_list()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'offering_id',r.offering_id,'org_id',o.org_id,'evidence',life_private.certificate_evidence(r.offering_id,r.person_id,r.kind),'person_id',r.person_id,'person_name',p.name,'course_name',o.name,'kind',r.kind,'status',r.status,'reason',r.reason,'requested_at',r.requested_at,'issue_id',i.id,'number',i.certificate_no,'state',case when i.id is not null then life_private.cert_effective(i.id) end,'last_error',i.last_error) order by r.requested_at desc),'[]'::jsonb)
 from life_private.operational_certificate_requests r join life_private.operational_offerings o on o.id=r.offering_id join public.life_people p on p.id=r.person_id left join life_private.operational_certificate_issues i on i.request_id=r.id
 where r.person_id=life_private.person_id() or life_private.certificate_staff(o.org_id)
$function$;

-- Operational credential read: certificate_detail
CREATE OR REPLACE FUNCTION life_private.certificate_detail(i uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if not life_private.certificate_readable(i) or not exists(select 1 from life_private.operational_certificate_issues v where v.id=i) then raise exception 'FORBIDDEN';end if;
 select jsonb_build_object('id',v.id,'number',v.certificate_no,'snapshot',v.snapshot,'state',life_private.cert_effective(v.id),'issued_at',v.issued_at,'sha256',v.file_sha256,'last_error',v.last_error,'request',to_jsonb(r),'revocation_reason',v.revocation_reason) into result from life_private.operational_certificate_issues v join life_private.operational_certificate_requests r on r.id=v.request_id where v.id=i;
 return result;
end $function$;

-- Operational credential read: certificate_options
CREATE OR REPLACE FUNCTION life_private.certificate_options()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('issuers',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'org_id',a.org_id,'label',a.organization_name||' '||a.title||' '||a.holder_name,'test_only',a.test_only,'kinds',array(select d.kind from public.life_issuer_delegations d where d.issuer_id=a.id and d.person_id=life_private.person_id() and d.valid_from<=now() and d.valid_until>now()))) from life_private.operational_issuer_authorizations a where life_private.certificate_staff(a.org_id) and life_private.issuer_valid(a.id)),'[]'::jsonb),
 'templates',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'org_id',t.org_id,'kind',t.kind,'title',t.title,'version',t.version)) from public.life_certificate_templates t where revoked_at is null and life_private.certificate_staff(t.org_id)),'[]'::jsonb))
$function$;

-- Operational credential read: badge_options
CREATE OR REPLACE FUNCTION life_private.badge_options()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if life_private.person_id() is null then raise exception 'AUTH_REQUIRED';end if;
 return jsonb_build_object(
 'offerings',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'org_id',o.org_id,'manager',life_private.manages(o.id)) order by o.created_at desc) from life_private.operational_offerings o where life_private.badge_staff(o.org_id)),'[]'::jsonb),
 'issuers',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'org_id',a.org_id,'name',a.organization_name,'test_only',a.test_only,'can_issue',life_private.can_issue(a.id,'BADGE'))) from life_private.operational_issuer_authorizations a where life_private.badge_staff(a.org_id) and life_private.issuer_valid(a.id)),'[]'::jsonb),
 'policies',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'org_id',p.org_id,'title',p.title,'version',p.version,'body',p.body)) from public.life_policy_versions p where life_private.badge_staff(p.org_id) and life_private.policy_valid(p.id,p.org_id,'BADGE')),'[]'::jsonb));
end $function$;

-- Operational credential read: badge_board
CREATE OR REPLACE FUNCTION life_private.badge_board(f uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o public.life_offerings;
begin
 select * into o from life_private.operational_offerings where id=f;if o.id is null or not life_private.badge_staff(o.org_id) then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object('offering',jsonb_build_object('id',o.id,'name',o.name,'org_id',o.org_id),'manager',life_private.manages(f),
 'definitions',coalesce((select jsonb_agg(to_jsonb(b)||jsonb_build_object('can_issue',life_private.can_issue(b.issuer_id,'BADGE'),'ready',life_private.badge_definition_ready(b.id),'policy_body',p.body,'policy_title',p.title,'policy_version',p.version,'completion_body',cp.body,'completion_version',cp.version) order by b.version desc) from life_private.operational_badge_definitions b join public.life_policy_versions p on p.id=b.policy_id join public.life_policy_versions cp on cp.id=b.completion_policy_id where b.offering_id=f),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(to_jsonb(q)||jsonb_build_object('person_name',p.name,'title',b.title,'version',b.version,'can_issue',life_private.can_issue(b.issuer_id,'BADGE'),'ready',life_private.badge_definition_ready(b.id) and life_private.badge_evidence(f,q.person_id) is not null,'award_id',a.id) order by q.requested_at desc) from life_private.operational_badge_requests q join life_private.operational_badge_definitions b on b.id=q.definition_id join public.life_people p on p.id=q.person_id left join life_private.operational_badge_awards a on a.request_id=q.id where q.offering_id=f),'[]'::jsonb),
 'awards',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'number',a.number,'title',b.title,'person_name',p.name,'state',life_private.badge_state(a.id),'status',a.status,'issued_at',a.issued_at,'can_issue',life_private.can_issue(a.issuer_id,'BADGE')) order by a.issued_at desc) from life_private.operational_badge_awards a join life_private.operational_badge_definitions b on b.id=a.definition_id join public.life_people p on p.id=a.person_id where a.offering_id=f),'[]'::jsonb));
end $function$;

-- Operational credential read: badge_wallet
CREATE OR REPLACE FUNCTION life_private.badge_wallet()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p uuid:=life_private.person_id();
begin
 if p is null then raise exception 'AUTH_REQUIRED';end if;
 return jsonb_build_object(
 'eligible',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'offering_id',b.offering_id,'name',o.name,'title',b.title,'description',b.description,'achievement',b.achievement,'version',b.version,'validity_days',b.validity_days,'policy_id',b.policy_id,'policy_title',pv.title,'policy_version',pv.version,'policy_body',pv.body,'completion_body',cp.body,'ready',life_private.badge_definition_ready(b.id) and life_private.badge_evidence(o.id,p) is not null) order by o.ends_on desc) from life_private.operational_badge_definitions b join life_private.operational_offerings o on o.id=b.offering_id join public.life_policy_versions pv on pv.id=b.policy_id join public.life_policy_versions cp on cp.id=b.completion_policy_id join public.life_enrollments e on e.offering_id=o.id and e.person_id=p where b.status='APPROVED' and b.revoked_at is null and not exists(select 1 from life_private.operational_badge_definitions newer where newer.offering_id=o.id and newer.version>b.version)),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(to_jsonb(q)||jsonb_build_object('title',b.title,'name',o.name) order by q.requested_at desc) from life_private.operational_badge_requests q join life_private.operational_badge_definitions b on b.id=q.definition_id join life_private.operational_offerings o on o.id=q.offering_id where q.person_id=p),'[]'::jsonb),
 'awards',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'offering_id',a.offering_id,'number',a.number,'title',b.title,'name',o.name,'state',life_private.badge_state(a.id),'issued_at',a.issued_at,'expires_at',a.expires_at,'supersedes_id',a.supersedes_id,'test_only',a.artifact_text::jsonb->'issuer'->'test_only') order by a.issued_at desc) from life_private.operational_badge_awards a join life_private.operational_badge_definitions b on b.id=a.definition_id join life_private.operational_offerings o on o.id=a.offering_id where a.person_id=p),'[]'::jsonb));
end $function$;

-- Operational credential read: badge_detail
CREATE OR REPLACE FUNCTION life_private.badge_detail(i uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.life_badge_awards;own boolean;
begin
 select * into v from life_private.operational_badge_awards where id=i;own:=v.person_id=life_private.person_id();
 if v.id is null or not coalesce(own or life_private.can_issue(v.issuer_id,'BADGE'),false) then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object('id',v.id,'number',v.number,'state',life_private.badge_state(i),'artifact',v.artifact_text::jsonb,'sha256',v.sha256,'issued_at',v.issued_at,'expires_at',v.expires_at,'supersedes_id',v.supersedes_id,'revocation_reason',v.revocation_reason,'owner',own,
 'share',case when own then (select jsonb_build_object('enabled',s.enabled,'revision',s.revision,'changed_at',s.changed_at,'policy_valid',life_private.policy_valid(s.policy_id,v.org_id,'BADGE_SHARE')) from life_private.badge_shares s where award_id=i) end,
 'share_policies',case when own then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'version',p.version,'body',p.body)) from public.life_policy_versions p where life_private.policy_valid(p.id,v.org_id,'BADGE_SHARE')),'[]'::jsonb) else '[]'::jsonb end,
 'events',coalesce((select jsonb_agg(jsonb_build_object('action',action,'reason',reason,'at',created_at) order by id) from public.life_badge_events where entity_id in(i,v.request_id,v.definition_id)),'[]'::jsonb));
end $function$;

notify pgrst,'reload schema';
commit;
