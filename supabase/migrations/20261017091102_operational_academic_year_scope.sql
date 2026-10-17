begin;

-- Preserve the dedicated verification year and its organization/role/history.
create table life_private.non_operational_project_years (
 year_id uuid primary key references public.life_project_years(id),
 reason text not null check(length(btrim(reason)) between 1 and 500),
 classified_at timestamptz not null default now()
);
alter table life_private.non_operational_project_years enable row level security;
revoke all on life_private.non_operational_project_years from public,anon,authenticated,service_role;
insert into life_private.non_operational_project_years(year_id,reason)
 select id,'기존 수료 판정 검증 전용 사업연도: 원본 이력 보존 및 운영 통계 제외'
 from public.life_project_years where id='d7730717-d1fd-4aeb-a89e-e2241fd0b2ad';
create function life_private.operational_project_year(y uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from life_private.non_operational_project_years n where n.year_id=y)
$$;
revoke all on function life_private.operational_project_year(uuid) from public,anon,authenticated,service_role;
create view life_private.operational_project_years with(security_invoker=true) as
 select y.* from public.life_project_years y where life_private.operational_project_year(y.id);
revoke all on life_private.operational_project_years from public,anon,authenticated,service_role;

-- Keep legitimate empty/future years; filter only the explicitly classified ID.

CREATE OR REPLACE FUNCTION life_private.annual_board(y uuid, a text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_year public.life_project_years;v_frame jsonb;
begin
 select * into v_year from life_private.operational_project_years where id=y;
 if v_year.id is null or not life_private.annual_read(v_year.org_id) then raise exception 'FORBIDDEN';end if;
 v_frame:=life_private.annual_frame(y);
 return jsonb_build_object('year',to_jsonb(v_year),'generated_at',now(),'can_prepare',life_private.annual_can(v_year.org_id,'PREPARE'),'can_approve',life_private.annual_can(v_year.org_id,'APPROVE'),
 'academies',coalesce((select jsonb_agg(distinct c.academy) from life_private.operational_offerings o join public.life_course_versions v on v.id=o.course_version_id join public.life_courses c on c.id=v.course_id where o.project_year_id=y),'[]'::jsonb),
 'facts',case when a is null then v_frame->'snapshot'->'facts' else life_private.annual_facts(y,a) end,'metrics',v_frame->'snapshot'->'metrics',
 'reports',coalesce((select jsonb_agg(to_jsonb(x) order by version desc) from (select id,version,status,created_at,approved_at,reason,supersedes_id,fingerprint<>v_frame->>'fingerprint' stale from public.life_performance_reports where year_id=y order by version desc limit 100)x),'[]'::jsonb));
end $function$
;

CREATE OR REPLACE FUNCTION life_private.annual_options()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if life_private.person_id() is null then raise exception 'AUTH_REQUIRED';end if;
 return coalesce((select jsonb_agg(to_jsonb(y)||jsonb_build_object('org_name',o.name) order by y.starts_on desc) from life_private.operational_project_years y join public.life_organizations o on o.id=y.org_id where life_private.annual_read(y.org_id)),'[]'::jsonb);
end $function$
;

notify pgrst,'reload schema';
commit;
