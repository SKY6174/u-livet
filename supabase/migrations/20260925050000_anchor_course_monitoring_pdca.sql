begin;

-- Private planning baseline for the 16 source courses. The public course guide
-- stays descriptive; monitoring decisions and obstacles are manager-only data.
create table public.life_course_monitoring_plans (
  org_id uuid not null references public.life_organizations(id),
  guide_id text not null references public.life_course_guides(id),
  plan_due_on date,
  plan_done_on date,
  delivery_starts_on date,
  delivery_ends_on date,
  check_due_on date,
  check_done_on date,
  act_due_on date,
  act_done_on date,
  blocked boolean not null default false,
  issue_note text not null default '' check (length(issue_note) <= 1000),
  action_note text not null default '' check (length(action_note) <= 2000),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.life_people(id),
  primary key (org_id, guide_id),
  constraint monitoring_delivery_order check (delivery_starts_on is null or delivery_ends_on is null or delivery_starts_on <= delivery_ends_on),
  constraint monitoring_pdca_order check (
    (plan_due_on is null or delivery_starts_on is null or plan_due_on <= delivery_starts_on)
    and (delivery_ends_on is null or check_due_on is null or delivery_ends_on <= check_due_on)
    and (check_due_on is null or act_due_on is null or check_due_on <= act_due_on)
  ),
  constraint monitoring_blocker_reason check (not blocked or length(btrim(issue_note)) > 0)
);
alter table public.life_course_monitoring_plans enable row level security;
revoke all on public.life_course_monitoring_plans from public, anon, authenticated;
grant all on public.life_course_monitoring_plans to service_role;

create function life_private.monitoring_plans() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not life_private.mfa_verified() then raise exception 'FORBIDDEN'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(p) - 'updated_by' order by p.guide_id)
    from public.life_course_monitoring_plans p
    where p.org_id = '10000000-0000-4000-8000-000000000001'::uuid
      and life_private.has_role(p.org_id, 'COURSE_MANAGER')
  ), '[]'::jsonb);
end;
$$;
create function public.life_monitoring_plans() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select life_private.monitoring_plans()
$$;

create function life_private.save_monitoring_plan(o uuid, g text, p jsonb, expected_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result public.life_course_monitoring_plans;
  p_due date;
  p_done date;
  d_start date;
  d_end date;
  c_due date;
  c_done date;
  a_due date;
  a_done date;
  issue text := btrim(coalesce(p->>'issue_note', ''));
  action_text text := btrim(coalesce(p->>'action_note', ''));
  is_blocked boolean := coalesce((p->>'blocked')::boolean, false);
begin
  if auth.uid() is null or not life_private.mfa_recent()
     or not life_private.has_role(o, 'COURSE_MANAGER') then raise exception 'FORBIDDEN'; end if;
  if o <> '10000000-0000-4000-8000-000000000001'::uuid
     or not exists (select 1 from public.life_course_guides guide
       where guide.id = g and guide.year = 2026 and guide.published)
     or p is null or jsonb_typeof(p) <> 'object' or length(p::text) > 5000
     or expected_revision is null or expected_revision < 0
     or length(issue) > 1000 or length(action_text) > 2000
     or (is_blocked and issue = '') then raise exception 'INVALID_PLAN'; end if;

  p_due := nullif(p->>'plan_due_on', '')::date;
  p_done := nullif(p->>'plan_done_on', '')::date;
  d_start := nullif(p->>'delivery_starts_on', '')::date;
  d_end := nullif(p->>'delivery_ends_on', '')::date;
  c_due := nullif(p->>'check_due_on', '')::date;
  c_done := nullif(p->>'check_done_on', '')::date;
  a_due := nullif(p->>'act_due_on', '')::date;
  a_done := nullif(p->>'act_done_on', '')::date;
  if (select bool_or(d < date '2026-01-01' or d > date '2027-03-31')
      from unnest(array[p_due,p_done,d_start,d_end,c_due,c_done,a_due,a_done]) d where d is not null)
     or (select bool_or(d > (now() at time zone 'Asia/Seoul')::date)
       from unnest(array[p_done,c_done,a_done]) d where d is not null)
     or (p_due is not null and d_start is not null and p_due > d_start)
     or (d_start is not null and d_end is not null and d_start > d_end)
     or (d_end is not null and c_due is not null and d_end > c_due)
     or (c_due is not null and a_due is not null and c_due > a_due) then
    raise exception 'INVALID_PLAN_DATES';
  end if;

  insert into public.life_course_monitoring_plans as existing
    (org_id, guide_id, plan_due_on, plan_done_on, delivery_starts_on, delivery_ends_on,
     check_due_on, check_done_on, act_due_on, act_done_on, blocked, issue_note,
     action_note, updated_by)
  values (o,g,p_due,p_done,d_start,d_end,c_due,c_done,a_due,a_done,
    is_blocked,issue,action_text,life_private.person_id())
  on conflict (org_id, guide_id) do update set
    plan_due_on=excluded.plan_due_on, plan_done_on=excluded.plan_done_on,
    delivery_starts_on=excluded.delivery_starts_on, delivery_ends_on=excluded.delivery_ends_on,
    check_due_on=excluded.check_due_on, check_done_on=excluded.check_done_on,
    act_due_on=excluded.act_due_on, act_done_on=excluded.act_done_on,
    blocked=excluded.blocked, issue_note=excluded.issue_note, action_note=excluded.action_note,
    revision=existing.revision+1, updated_at=now(), updated_by=life_private.person_id()
  where existing.revision = expected_revision
  returning * into result;
  if not found or result.revision <> expected_revision + 1 then
    raise exception 'STALE_PLAN';
  end if;
  insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
  values(o,life_private.person_id(),'COURSE_MONITORING_PLAN_SAVED',o,
    jsonb_build_object('guide_id',g,'revision',result.revision,'blocked',result.blocked));
  return to_jsonb(result) - 'updated_by';
end;
$$;
create function public.life_save_monitoring_plan(o uuid, g text, p jsonb, expected_revision integer)
returns jsonb language sql security invoker set search_path = '' as $$
  select life_private.save_monitoring_plan(o,g,p,expected_revision)
$$;

revoke all on function life_private.monitoring_plans(), public.life_monitoring_plans(),
  life_private.save_monitoring_plan(uuid,text,jsonb,integer),
  public.life_save_monitoring_plan(uuid,text,jsonb,integer) from public,anon,authenticated,service_role;
grant execute on function life_private.monitoring_plans(), public.life_monitoring_plans(),
  life_private.save_monitoring_plan(uuid,text,jsonb,integer),
  public.life_save_monitoring_plan(uuid,text,jsonb,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
