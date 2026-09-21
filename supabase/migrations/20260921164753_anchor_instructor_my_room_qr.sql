begin;

-- QR confirms presence at a point in time. Only the existing instructor workflow
-- may award credited_minutes after a class has ended.
create table life_private.qr_attendance_tokens (
 token_hash text primary key,
 session_id uuid not null references public.life_class_sessions(id),
 issued_by uuid not null references public.life_people(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null
);
create index qr_attendance_tokens_session on life_private.qr_attendance_tokens(session_id);
create table life_private.qr_attendance_checkins (
 session_id uuid not null references public.life_class_sessions(id),
 person_id uuid not null references public.life_people(id),
 checked_in_at timestamptz not null default now(),
 primary key(session_id,person_id)
);
alter table life_private.qr_attendance_tokens enable row level security;
alter table life_private.qr_attendance_checkins enable row level security;
revoke all on life_private.qr_attendance_tokens,life_private.qr_attendance_checkins from public,anon,authenticated,service_role;

create function life_private.issue_attendance_qr(f uuid,s uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.life_class_sessions; o public.life_offerings; token text; expiry timestamptz;
begin
 if life_private.person_id() is null or not life_private.teaches(f) then raise exception 'FORBIDDEN'; end if;
 select * into c from public.life_class_sessions where id=s and offering_id=f for update;
 select * into o from public.life_offerings where id=f;
 if c.id is null then raise exception 'FORBIDDEN'; end if;
 if c.status<>'SCHEDULED' or now()<c.starts_at or now()>=c.ends_at
   or o.academic_sealed or o.status not in ('PUBLISHED','CLOSED') then raise exception 'CLASS_NOT_OPEN'; end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 expiry:=least(now()+interval '120 seconds',c.ends_at);
 delete from life_private.qr_attendance_tokens where session_id=s and expires_at<=now();
 insert into life_private.qr_attendance_tokens(token_hash,session_id,issued_by,expires_at)
 values(encode(extensions.digest(token,'sha256'),'hex'),s,life_private.person_id(),expiry);
 return jsonb_build_object('token',token,'expires_at',expiry);
end $$;
create function public.life_issue_attendance_qr(f uuid,s uuid) returns jsonb
language sql security invoker set search_path='' as $$select life_private.issue_attendance_qr(f,s)$$;

create function life_private.stop_attendance_qr(f uuid,s uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if life_private.person_id() is null or not life_private.teaches(f) then raise exception 'FORBIDDEN'; end if;
 perform 1 from public.life_class_sessions where id=s and offering_id=f for update;
 if not found then raise exception 'FORBIDDEN'; end if;
 delete from life_private.qr_attendance_tokens where session_id=s;
end $$;
create function public.life_stop_attendance_qr(f uuid,s uuid) returns void
language sql security invoker set search_path='' as $$select life_private.stop_attendance_qr(f,s)$$;

create function life_private.qr_checkin(f uuid,s uuid,t text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p uuid:=life_private.person_id(); c public.life_class_sessions; o public.life_offerings;
 challenge life_private.qr_attendance_tokens; checked timestamptz;
begin
 if p is null or not life_private.enrolled(f) then raise exception 'NOT_ENROLLED'; end if;
 if life_private.teaches(f) then raise exception 'SELF_APPROVAL_FORBIDDEN'; end if;
 if t is null or t!~'^[0-9a-f]{64}$' then raise exception 'INVALID_QR'; end if;
 select * into c from public.life_class_sessions where id=s and offering_id=f for update;
 select * into o from public.life_offerings where id=f;
 if c.id is null then raise exception 'INVALID_QR'; end if;
 if c.status<>'SCHEDULED' or now()<c.starts_at or now()>=c.ends_at
   or o.academic_sealed or o.status not in ('PUBLISHED','CLOSED') then raise exception 'CLASS_NOT_OPEN'; end if;
 select * into challenge from life_private.qr_attendance_tokens
 where token_hash=encode(extensions.digest(t,'sha256'),'hex') and session_id=s and expires_at>now();
 if challenge.token_hash is null then raise exception 'QR_EXPIRED'; end if;
 if not exists(select 1 from public.life_offering_instructors i
   join public.life_role_assignments r on r.person_id=i.person_id and r.org_id=o.org_id and r.role='INSTRUCTOR'
   join public.life_people person on person.id=i.person_id and person.active
   where i.offering_id=f and i.person_id=challenge.issued_by and (i.valid_until is null or i.valid_until>now())
   and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())) then raise exception 'QR_EXPIRED'; end if;
 insert into life_private.qr_attendance_checkins(session_id,person_id) values(s,p)
 on conflict(session_id,person_id) do nothing;
 select checked_in_at into checked from life_private.qr_attendance_checkins where session_id=s and person_id=p;
 return jsonb_build_object('session_title',c.title,'checked_in_at',checked);
end $$;
create function public.life_qr_checkin(f uuid,s uuid,t text) returns jsonb
language sql security invoker set search_path='' as $$select life_private.qr_checkin(f,s,t)$$;

create function life_private.qr_checkins(f uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p uuid:=life_private.person_id(); teacher boolean:=life_private.teaches(f);
begin
 if p is null or not (teacher or life_private.enrolled(f)) then raise exception 'FORBIDDEN'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('session_id',q.session_id,'person_id',q.person_id,'checked_in_at',q.checked_in_at) order by q.checked_in_at)
 from life_private.qr_attendance_checkins q join public.life_class_sessions c on c.id=q.session_id
 join public.life_enrollments e on e.person_id=q.person_id and e.offering_id=f and e.status='ACTIVE'
 where c.offering_id=f and (teacher or q.person_id=p)),'[]'::jsonb);
end $$;
create function public.life_qr_checkins(f uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select life_private.qr_checkins(f)$$;

-- Read-only, minimal completion information for the currently assigned instructor.
create function life_private.instructor_completion(f uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if life_private.person_id() is null or not life_private.teaches(f) then raise exception 'FORBIDDEN'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('person_id',p.id,'name',p.name,'outcome',r.outcome,
   'reasons',r.reasons,'approved_at',a.approved_at,'stale',r.id is not null and
   (r.input_revision is distinct from o.academic_revision or not o.academic_sealed
    or not life_private.policy_valid((r.evidence->>'policy_id')::uuid,o.org_id,'COMPLETION'))) order by p.name)
 from public.life_enrollments e join public.life_people p on p.id=e.person_id join public.life_offerings o on o.id=e.offering_id
 left join lateral(select * from public.life_completion_runs where enrollment_id=e.id order by calculated_at desc,id desc limit 1) r on true
 left join public.life_completion_approvals a on a.run_id=r.id where e.offering_id=f and e.status='ACTIVE'),'[]'::jsonb);
end $$;
create function public.life_instructor_completion(f uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select life_private.instructor_completion(f)$$;

revoke all on function life_private.issue_attendance_qr(uuid,uuid),public.life_issue_attendance_qr(uuid,uuid),
 life_private.stop_attendance_qr(uuid,uuid),public.life_stop_attendance_qr(uuid,uuid),
 life_private.qr_checkin(uuid,uuid,text),public.life_qr_checkin(uuid,uuid,text),
 life_private.qr_checkins(uuid),public.life_qr_checkins(uuid),
 life_private.instructor_completion(uuid),public.life_instructor_completion(uuid) from public,anon,authenticated,service_role;
grant execute on function life_private.issue_attendance_qr(uuid,uuid),public.life_issue_attendance_qr(uuid,uuid),
 life_private.stop_attendance_qr(uuid,uuid),public.life_stop_attendance_qr(uuid,uuid),
 life_private.qr_checkin(uuid,uuid,text),public.life_qr_checkin(uuid,uuid,text),
 life_private.qr_checkins(uuid),public.life_qr_checkins(uuid),
 life_private.instructor_completion(uuid),public.life_instructor_completion(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
