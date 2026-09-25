begin;

alter table life_private.qr_attendance_tokens
  add column phase text not null default 'START' check (phase in ('START', 'END'));
alter table life_private.qr_attendance_checkins
  add column checked_out_at timestamptz;

create function life_private.issue_attendance_qr_end(f uuid, s uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare challenge jsonb;
begin
  challenge := life_private.issue_attendance_qr(f, s);
  update life_private.qr_attendance_tokens
    set phase = 'END'
    where token_hash = encode(extensions.digest(challenge->>'token', 'sha256'), 'hex')
      and session_id = s;
  return challenge;
end $$;
create function public.life_issue_attendance_qr_end(f uuid, s uuid) returns jsonb
language sql security invoker set search_path = '' as $$
  select life_private.issue_attendance_qr_end(f, s)
$$;

create or replace function life_private.qr_checkin(f uuid, s uuid, t text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p uuid := life_private.person_id(); c public.life_class_sessions; o public.life_offerings;
  challenge life_private.qr_attendance_tokens; checked timestamptz; finished timestamptz;
begin
  if p is null or not life_private.enrolled(f) then raise exception 'NOT_ENROLLED'; end if;
  if life_private.teaches(f) then raise exception 'SELF_APPROVAL_FORBIDDEN'; end if;
  if t is null or t !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_QR'; end if;
  select * into c from public.life_class_sessions where id = s and offering_id = f for update;
  select * into o from public.life_offerings where id = f;
  if c.id is null then raise exception 'INVALID_QR'; end if;
  if c.status <> 'SCHEDULED' or now() < c.starts_at or now() >= c.ends_at
    or o.academic_sealed or o.status not in ('PUBLISHED', 'CLOSED') then raise exception 'CLASS_NOT_OPEN'; end if;
  select * into challenge from life_private.qr_attendance_tokens
    where token_hash = encode(extensions.digest(t, 'sha256'), 'hex') and session_id = s and expires_at > now();
  if challenge.token_hash is null then raise exception 'QR_EXPIRED'; end if;
  if not exists(select 1 from public.life_offering_instructors i
    join public.life_role_assignments r on r.person_id = i.person_id and r.org_id = o.org_id and r.role = 'INSTRUCTOR'
    join public.life_people person on person.id = i.person_id and person.active
    where i.offering_id = f and i.person_id = challenge.issued_by and (i.valid_until is null or i.valid_until > now())
      and r.valid_from <= now() and (r.valid_until is null or r.valid_until > now())) then raise exception 'QR_EXPIRED'; end if;
  if challenge.phase = 'END' then
    update life_private.qr_attendance_checkins
      set checked_out_at = coalesce(checked_out_at, now())
      where session_id = s and person_id = p
      returning checked_in_at, checked_out_at into checked, finished;
    if not found then raise exception 'CHECKIN_REQUIRED'; end if;
  else
    insert into life_private.qr_attendance_checkins(session_id, person_id) values(s, p)
      on conflict(session_id, person_id) do nothing;
    select checked_in_at, checked_out_at into checked, finished
      from life_private.qr_attendance_checkins where session_id = s and person_id = p;
  end if;
  return jsonb_build_object('session_title', c.title, 'checked_in_at', checked,
    'checked_out_at', finished, 'phase', challenge.phase);
end $$;

create or replace function life_private.qr_checkins(f uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare p uuid := life_private.person_id(); staff boolean := life_private.teaches(f) or life_private.manages(f);
begin
  if p is null or not (staff or life_private.enrolled(f)) then raise exception 'FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('session_id', q.session_id,
    'person_id', q.person_id, 'checked_in_at', q.checked_in_at, 'checked_out_at', q.checked_out_at) order by q.checked_in_at)
    from life_private.qr_attendance_checkins q join public.life_class_sessions c on c.id = q.session_id
    join public.life_enrollments e on e.person_id = q.person_id and e.offering_id = f and e.status = 'ACTIVE'
    where c.offering_id = f and (staff or q.person_id = p)), '[]'::jsonb);
end $$;

revoke all on function life_private.issue_attendance_qr_end(uuid, uuid),
  public.life_issue_attendance_qr_end(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function life_private.issue_attendance_qr_end(uuid, uuid),
  public.life_issue_attendance_qr_end(uuid, uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
