-- Explicit operator registration only; course names never grant test privileges.
create table life_private.qr_test_offerings (
  offering_id uuid primary key references public.life_offerings(id) on delete cascade
);
alter table life_private.qr_test_offerings enable row level security;
revoke all on life_private.qr_test_offerings from public, anon, authenticated;

create function life_private.can_edit_qr_test_time(f uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select life_private.person_id() is not null and life_private.teaches(f)
    and exists(select 1 from life_private.qr_test_offerings where offering_id=f)
$$;
create function public.life_can_edit_qr_test_time(f uuid) returns boolean
language sql security invoker set search_path='' as $$
  select life_private.can_edit_qr_test_time(f)
$$;

create function life_private.reschedule_qr_test_class(
  f uuid, s uuid, p_starts_at timestamptz, p_ends_at timestamptz,
  p_expected_starts_at timestamptz, p_expected_ends_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.life_class_sessions; o public.life_offerings;
begin
  if not life_private.can_edit_qr_test_time(f) then raise exception 'TEST_CLASS_FORBIDDEN'; end if;
  if p_starts_at is null or p_ends_at is null or not isfinite(p_starts_at) or not isfinite(p_ends_at)
    or p_ends_at<=p_starts_at or p_ends_at-p_starts_at>interval '24 hours' then
    raise exception 'INVALID_SESSION_TIME';
  end if;
  -- Same lock order as QR issuance/check-in prevents a stale token surviving an edit.
  select * into c from public.life_class_sessions where id=s and offering_id=f for update;
  select * into o from public.life_offerings where id=f for update;
  if c.id is null then raise exception 'TEST_CLASS_FORBIDDEN'; end if;
  if c.starts_at is distinct from p_expected_starts_at or c.ends_at is distinct from p_expected_ends_at then
    raise exception 'SESSION_TIME_CHANGED';
  end if;
  if c.status<>'SCHEDULED' or o.status not in ('PUBLISHED','CLOSED') or o.academic_sealed
    or exists(select 1 from public.life_attendance where session_id=s)
    or exists(select 1 from public.life_teaching_logs where session_id=s)
    or exists(select 1 from public.life_completion_runs where offering_id=f) then
    raise exception 'SESSION_TIME_LOCKED';
  end if;
  update public.life_offerings set
    starts_on=least(starts_on,(p_starts_at at time zone 'Asia/Seoul')::date),
    ends_on=greatest(ends_on,(p_ends_at at time zone 'Asia/Seoul')::date)
  where id=f;
  update public.life_class_sessions set starts_at=p_starts_at,ends_at=p_ends_at where id=s;
  delete from life_private.qr_attendance_tokens where session_id=s;
  insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
  values(o.org_id,life_private.person_id(),'QR_TEST_SESSION_RESCHEDULED',s,
    jsonb_build_object('offering_id',f,'before',jsonb_build_object('starts_at',c.starts_at,'ends_at',c.ends_at),
      'after',jsonb_build_object('starts_at',p_starts_at,'ends_at',p_ends_at)));
  return jsonb_build_object('id',s,'starts_at',p_starts_at,'ends_at',p_ends_at);
end $$;
create function public.life_reschedule_qr_test_class(
  f uuid, s uuid, p_starts_at timestamptz, p_ends_at timestamptz,
  p_expected_starts_at timestamptz, p_expected_ends_at timestamptz
) returns jsonb language sql security invoker set search_path='' as $$
  select life_private.reschedule_qr_test_class(f,s,p_starts_at,p_ends_at,p_expected_starts_at,p_expected_ends_at)
$$;
revoke all on function life_private.can_edit_qr_test_time(uuid), public.life_can_edit_qr_test_time(uuid),
  life_private.reschedule_qr_test_class(uuid,uuid,timestamptz,timestamptz,timestamptz,timestamptz),
  public.life_reschedule_qr_test_class(uuid,uuid,timestamptz,timestamptz,timestamptz,timestamptz) from public,anon;
grant execute on function life_private.can_edit_qr_test_time(uuid), public.life_can_edit_qr_test_time(uuid),
  life_private.reschedule_qr_test_class(uuid,uuid,timestamptz,timestamptz,timestamptz,timestamptz),
  public.life_reschedule_qr_test_class(uuid,uuid,timestamptz,timestamptz,timestamptz,timestamptz) to authenticated;
