begin;

alter table public.life_teaching_logs
  add column segments jsonb not null default '[]'::jsonb,
  add column signature text,
  add column signed_at timestamptz,
  add column signed_revision integer,
  add constraint teaching_segments_array check (jsonb_typeof(segments) = 'array'),
  add constraint teaching_signature_complete check (
    (signature is null and signed_at is null and signed_revision is null) or
    (signature is not null and signed_at is not null and signed_revision is not null)
  ),
  add constraint teaching_signature_image check (signature is null or life_private.operation_image(to_jsonb(signature), 200000));

-- The legacy submission RPC remains usable. A corrected revision cannot retain an old signature.
create function life_private.reset_teaching_signature() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.revision is distinct from old.revision then
    new.segments := '[]'::jsonb;
    new.signature := null;
    new.signed_at := null;
    new.signed_revision := null;
  end if;
  return new;
end $$;
create trigger reset_teaching_signature_before_revision
before update on public.life_teaching_logs for each row
execute function life_private.reset_teaching_signature();

create function life_private.teaching_segments_valid(v jsonb, c public.life_class_sessions, minutes numeric)
returns boolean language plpgsql stable set search_path='' as $$
declare item jsonb; start_at timestamptz; end_at timestamptz; previous_end timestamptz; total numeric := 0;
begin
  if jsonb_typeof(v) is distinct from 'array' or jsonb_array_length(v) not between 1 and 12 then return false; end if;
  for item in select value from jsonb_array_elements(v) loop
    if jsonb_typeof(item) is distinct from 'object' or
      (select count(*) from jsonb_object_keys(item)) <> 2 or
      not item ?& array['starts_at','ends_at'] or
      coalesce(item->>'starts_at','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$' or
      coalesce(item->>'ends_at','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$' then return false; end if;
    start_at := (item->>'starts_at')::timestamptz;
    end_at := (item->>'ends_at')::timestamptz;
    if start_at < date_trunc('minute',c.starts_at) or end_at > date_trunc('minute',c.ends_at) + interval '1 minute' or end_at <= start_at or
      (previous_end is not null and start_at < previous_end) then return false; end if;
    total := total + extract(epoch from end_at - start_at) / 60;
    previous_end := end_at;
  end loop;
  return abs(total - minutes) <= 0.01;
exception when others then return false;
end $$;

create function life_private.submit_teaching_detail(s uuid, minutes numeric, notes text, expected_revision integer, segments jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.life_class_sessions; result uuid;
begin
  select * into c from public.life_class_sessions where id=s;
  if c.id is null or not life_private.teaching_segments_valid(segments,c,minutes) then raise exception 'INVALID_SEGMENTS'; end if;
  result := life_private.submit_teaching(s,minutes,notes,expected_revision);
  update public.life_teaching_logs set segments=submit_teaching_detail.segments where id=result;
  return result;
end $$;
create function public.life_submit_teaching_detail(s uuid, minutes numeric, notes text, expected_revision integer, segments jsonb)
returns uuid language sql security invoker set search_path='' as $$
  select life_private.submit_teaching_detail(s,minutes,notes,expected_revision,segments)
$$;

create function life_private.sign_teaching(l uuid, expected_revision integer, image text)
returns void language plpgsql security definer set search_path='' as $$
declare v public.life_teaching_logs; c public.life_class_sessions;
begin
  select * into v from public.life_teaching_logs where id=l for update;
  select * into c from public.life_class_sessions where id=v.session_id;
  if auth.uid() is null or not life_private.mfa_verified() or v.id is null or
    v.person_id is distinct from life_private.person_id() or not life_private.teaches(c.offering_id) then raise exception 'FORBIDDEN'; end if;
  if c.status <> 'SCHEDULED' or c.ends_at > now() then raise exception 'CLASS_NOT_FINISHED'; end if;
  if v.revision is distinct from expected_revision then raise exception 'REVISION_CHANGED'; end if;
  if jsonb_array_length(v.segments)=0 then raise exception 'INVALID_SEGMENTS'; end if;
  if not life_private.operation_image(to_jsonb(image),200000) or image='' then raise exception 'INVALID_SIGNATURE'; end if;
  update public.life_teaching_logs set signature=image,signed_at=now(),signed_revision=revision where id=l;
  insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
    select org_id,life_private.person_id(),'TEACHING_SIGNED',l,jsonb_build_object('revision',expected_revision)
    from public.life_offerings where id=c.offering_id;
end $$;
create function public.life_sign_teaching(l uuid, expected_revision integer, image text)
returns void language sql security invoker set search_path='' as $$select life_private.sign_teaching(l,expected_revision,image)$$;

create or replace function life_private.teaching_records() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'session_id',s.id,'offering_id',o.id,'course_name',o.name,
 'session_title',s.title,'starts_at',s.starts_at,'ends_at',s.ends_at,'person_id',l.person_id,'person_name',p.name,
 'minutes',l.minutes,'notes',l.notes,'revision',l.revision,'approved_at',l.approved_at,
 'segments',l.segments,'signature',l.signature,'signed_at',l.signed_at,'signed_revision',l.signed_revision,
 'current',coalesce(l.approved_revision=l.revision and l.session_snapshot=to_jsonb(s),false)) order by l.submitted_at desc),'[]'::jsonb)
 from public.life_teaching_logs l join public.life_people p on p.id=l.person_id
 join public.life_class_sessions s on s.id=l.session_id join public.life_offerings o on o.id=s.offering_id
 where l.person_id=life_private.person_id() or life_private.manages(o.id)
$$;

-- Managers need the same final attendance evidence as the assigned instructor.
create or replace function life_private.attendance_book(f uuid, staff boolean) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p uuid:=life_private.person_id(); result jsonb;
begin
 if p is null or not (case when staff then life_private.teaches(f) or life_private.manages(f) else life_private.enrolled(f) end) then raise exception 'FORBIDDEN'; end if;
 select jsonb_build_object(
  'offering',jsonb_build_object('id',o.id,'name',o.name,'starts_on',o.starts_on,'ends_on',o.ends_on),
  'viewer_id',p,'generated_at',now(),
  'members',coalesce((select jsonb_agg(jsonb_build_object('person_id',e.person_id,'name',person.name) order by person.name,e.person_id)
    from public.life_enrollments e join public.life_people person on person.id=e.person_id
    where e.offering_id=f and e.status='ACTIVE' and (staff or e.person_id=p)),'[]'::jsonb),
  'sessions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'starts_at',s.starts_at,'ends_at',s.ends_at,
    'status',s.status,'replaces_id',s.replaces_id,'reason',s.reason) order by s.starts_at,s.id)
    from public.life_class_sessions s where s.offering_id=f),'[]'::jsonb),
  'attendance',coalesce((select jsonb_agg(jsonb_build_object('session_id',a.session_id,'person_id',a.person_id,
    'credited_minutes',a.credited_minutes,'reason',a.reason,'revision',a.revision,'recorded_at',a.recorded_at))
    from public.life_class_sessions s join public.life_attendance a on a.session_id=s.id
    join public.life_enrollments e on e.offering_id=f and e.person_id=a.person_id and e.status='ACTIVE'
    where s.offering_id=f and (staff or a.person_id=p)),'[]'::jsonb)
 ) into result from public.life_offerings o where o.id=f;
 if result is null then raise exception 'FORBIDDEN'; end if;
 return result;
end $$;

create or replace function life_private.qr_checkins(f uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p uuid:=life_private.person_id(); staff boolean:=life_private.teaches(f) or life_private.manages(f);
begin
 if p is null or not (staff or life_private.enrolled(f)) then raise exception 'FORBIDDEN'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('session_id',q.session_id,'person_id',q.person_id,'checked_in_at',q.checked_in_at) order by q.checked_in_at)
 from life_private.qr_attendance_checkins q join public.life_class_sessions c on c.id=q.session_id
 join public.life_enrollments e on e.person_id=q.person_id and e.offering_id=f and e.status='ACTIVE'
 where c.offering_id=f and (staff or q.person_id=p)),'[]'::jsonb);
end $$;

revoke all on function life_private.reset_teaching_signature(),life_private.teaching_segments_valid(jsonb,public.life_class_sessions,numeric),
 life_private.submit_teaching_detail(uuid,numeric,text,integer,jsonb),public.life_submit_teaching_detail(uuid,numeric,text,integer,jsonb),
 life_private.sign_teaching(uuid,integer,text),public.life_sign_teaching(uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function life_private.submit_teaching_detail(uuid,numeric,text,integer,jsonb),public.life_submit_teaching_detail(uuid,numeric,text,integer,jsonb),
 life_private.sign_teaching(uuid,integer,text),public.life_sign_teaching(uuid,integer,text) to authenticated;
notify pgrst, 'reload schema';
commit;
