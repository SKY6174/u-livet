begin;

alter table public.life_course_monitoring_plans
  add column self_evaluation_target_count integer not null default 1
    check (self_evaluation_target_count in (1, 2)),
  add column self_evaluation_first_on date,
  add column self_evaluation_second_on date,
  add column business_evaluation_on date,
  add constraint monitoring_self_evaluation_order check (
    self_evaluation_second_on is null or
    (self_evaluation_target_count = 2 and self_evaluation_first_on is not null
      and self_evaluation_first_on <= self_evaluation_second_on)
  );

create function life_private.save_monitoring_plan_v3(o uuid, g text, p jsonb, expected_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_count integer;
  first_on date;
  second_on date;
  business_on date;
  result jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' or length(p::text) > 7000 then
    raise exception 'INVALID_PLAN';
  end if;
  target_count := coalesce(nullif(p->>'self_evaluation_target_count','')::integer, 1);
  first_on := nullif(p->>'self_evaluation_first_on','')::date;
  second_on := nullif(p->>'self_evaluation_second_on','')::date;
  business_on := nullif(p->>'business_evaluation_on','')::date;
  if target_count not in (1, 2)
    or (second_on is not null and (target_count <> 2 or first_on is null or first_on > second_on))
    or coalesce((select bool_or(d < date '2026-01-01' or d > date '2027-02-28'
      or d > (now() at time zone 'Asia/Seoul')::date)
      from unnest(array[first_on,second_on,business_on]) d),false)
  then raise exception 'INVALID_EVALUATION'; end if;

  -- v2 delegates access control, MFA, revision and audit to the original writer.
  perform life_private.save_monitoring_plan_v2(o,g,p,expected_revision);
  update public.life_course_monitoring_plans as plan
  set self_evaluation_target_count=target_count,
      self_evaluation_first_on=first_on,
      self_evaluation_second_on=second_on,
      business_evaluation_on=business_on
  where plan.org_id=o and plan.guide_id=g and plan.revision=expected_revision+1
  returning to_jsonb(plan) - 'updated_by' into result;
  if result is null then raise exception 'STALE_PLAN'; end if;
  return result;
end;
$$;

create function public.life_save_monitoring_plan_v3(o uuid, g text, p jsonb, expected_revision integer)
returns jsonb language sql security invoker set search_path = '' as $$
  select life_private.save_monitoring_plan_v3(o,g,p,expected_revision)
$$;

revoke all on function life_private.save_monitoring_plan_v3(uuid,text,jsonb,integer),
  public.life_save_monitoring_plan_v3(uuid,text,jsonb,integer)
  from public,anon,authenticated,service_role;
grant execute on function life_private.save_monitoring_plan_v3(uuid,text,jsonb,integer),
  public.life_save_monitoring_plan_v3(uuid,text,jsonb,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
