begin;

alter table public.life_course_monitoring_plans
  add column preparation_due_on date,
  add column preparation_done_on date,
  add column operation_plan_due_on date,
  add column operation_plan_done_on date,
  add column recruitment_due_on date,
  add column recruitment_done_on date,
  add column next_year_decision text not null default 'UNDECIDED'
    check (next_year_decision in ('UNDECIDED','CONTINUE','REVISE','STOP')),
  add constraint monitoring_preparation_order check (
    (preparation_due_on is null or operation_plan_due_on is null or preparation_due_on <= operation_plan_due_on)
    and (operation_plan_due_on is null or recruitment_due_on is null or operation_plan_due_on <= recruitment_due_on)
    and (preparation_due_on is null or recruitment_due_on is null or preparation_due_on <= recruitment_due_on)
    and (recruitment_due_on is null or delivery_starts_on is null or recruitment_due_on <= delivery_starts_on)
  );

-- Preserve previously entered P dates as the final preparation milestone.
update public.life_course_monitoring_plans
set recruitment_due_on = plan_due_on,
    recruitment_done_on = plan_done_on
where plan_due_on is not null or plan_done_on is not null;

create function life_private.save_monitoring_plan_v2(o uuid, g text, p jsonb, expected_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  prep_due date;
  prep_done date;
  operation_due date;
  operation_done date;
  recruitment_due date;
  recruitment_done date;
  delivery_start date;
  delivery_end date;
  check_due date;
  check_done date;
  act_due date;
  act_done date;
  decision text;
  result jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' or length(p::text) > 6000 then
    raise exception 'INVALID_PLAN';
  end if;
  prep_due := nullif(p->>'preparation_due_on','')::date;
  prep_done := nullif(p->>'preparation_done_on','')::date;
  operation_due := nullif(p->>'operation_plan_due_on','')::date;
  operation_done := nullif(p->>'operation_plan_done_on','')::date;
  recruitment_due := nullif(p->>'recruitment_due_on','')::date;
  recruitment_done := nullif(p->>'recruitment_done_on','')::date;
  delivery_start := nullif(p->>'delivery_starts_on','')::date;
  delivery_end := nullif(p->>'delivery_ends_on','')::date;
  check_due := nullif(p->>'check_due_on','')::date;
  check_done := nullif(p->>'check_done_on','')::date;
  act_due := nullif(p->>'act_due_on','')::date;
  act_done := nullif(p->>'act_done_on','')::date;
  decision := coalesce(p->>'next_year_decision','UNDECIDED');

  if decision not in ('UNDECIDED','CONTINUE','REVISE','STOP')
     or coalesce((select bool_or(d < date '2026-01-01' or d > date '2027-02-28')
       from unnest(array[prep_due,prep_done,operation_due,operation_done,
         recruitment_due,recruitment_done,delivery_start,delivery_end,
         check_due,check_done,act_due,act_done]) d),false)
     or coalesce((select bool_or(d > (now() at time zone 'Asia/Seoul')::date)
       from unnest(array[prep_done,operation_done,recruitment_done,check_done,act_done]) d),false)
     or (prep_due is not null and operation_due is not null and prep_due > operation_due)
     or (operation_due is not null and recruitment_due is not null and operation_due > recruitment_due)
     or (prep_due is not null and recruitment_due is not null and prep_due > recruitment_due)
     or (recruitment_due is not null and delivery_start is not null and recruitment_due > delivery_start)
     or (act_done is not null and (decision='UNDECIDED' or btrim(coalesce(p->>'action_note',''))=''))
  then raise exception 'INVALID_PLAN_DATES'; end if;

  -- The original writer remains the authorization, optimistic revision, and audit boundary.
  perform life_private.save_monitoring_plan(o,g,
    p || jsonb_build_object('plan_due_on',recruitment_due,'plan_done_on',recruitment_done),
    expected_revision);
  update public.life_course_monitoring_plans as plan
  set preparation_due_on=prep_due, preparation_done_on=prep_done,
      operation_plan_due_on=operation_due, operation_plan_done_on=operation_done,
      recruitment_due_on=recruitment_due, recruitment_done_on=recruitment_done,
      next_year_decision=decision
  where plan.org_id=o and plan.guide_id=g and plan.revision=expected_revision+1
  returning to_jsonb(plan) - 'updated_by' into result;
  if result is null then raise exception 'STALE_PLAN'; end if;
  return result;
end;
$$;

create function public.life_save_monitoring_plan_v2(o uuid, g text, p jsonb, expected_revision integer)
returns jsonb language sql security invoker set search_path = '' as $$
  select life_private.save_monitoring_plan_v2(o,g,p,expected_revision)
$$;

revoke all on function life_private.save_monitoring_plan_v2(uuid,text,jsonb,integer),
  public.life_save_monitoring_plan_v2(uuid,text,jsonb,integer)
  from public,anon,authenticated,service_role;
grant execute on function life_private.save_monitoring_plan_v2(uuid,text,jsonb,integer),
  public.life_save_monitoring_plan_v2(uuid,text,jsonb,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
