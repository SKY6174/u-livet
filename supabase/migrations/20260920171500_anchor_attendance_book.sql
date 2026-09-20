begin;
-- One scoped snapshot avoids separate roster/session/attendance requests and API row caps.
create function life_private.attendance_book(f uuid, staff boolean) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p uuid:=life_private.person_id(); result jsonb;
begin
 if p is null or not (case when staff then life_private.teaches(f) else life_private.enrolled(f) end) then
  raise exception 'FORBIDDEN';
 end if;
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
create function public.life_teaching_attendance(f uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select life_private.attendance_book(f,true)$$;
create function public.life_my_attendance(f uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select life_private.attendance_book(f,false)$$;

-- A batch is atomic. Existing single-row rules, revision checks and audit triggers apply.
create function life_private.record_attendance_batch(s uuid, records jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare c public.life_class_sessions; item jsonb; total integer;
begin
 select * into c from public.life_class_sessions where id=s for update;
 if c.id is null or not life_private.teaches(c.offering_id) then raise exception 'FORBIDDEN'; end if;
 if c.status<>'SCHEDULED' or c.ends_at>now() then raise exception 'CLASS_NOT_FINISHED'; end if;
 if records is null or jsonb_typeof(records)<>'array' then raise exception 'INVALID_INPUT'; end if;
 total:=jsonb_array_length(records);
 if total<1 or total>200 then raise exception 'INVALID_INPUT'; end if;
 for item in select value from jsonb_array_elements(records) loop
  if jsonb_typeof(item)<>'object'
    or coalesce(jsonb_typeof(item->'person_id'),'')<>'string'
    or coalesce(item->>'person_id','')!~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or coalesce(jsonb_typeof(item->'minutes'),'')<>'number'
    or coalesce(jsonb_typeof(item->'expected_revision'),'')<>'number'
    or coalesce(jsonb_typeof(item->'reason'),'')<>'string' then raise exception 'INVALID_INPUT'; end if;
  if (item->>'minutes')::numeric not between 0 and 1440
    or (item->>'expected_revision')::numeric not between 0 and 2147483647
    or trunc((item->>'expected_revision')::numeric)<>(item->>'expected_revision')::numeric
    or length(trim(item->>'reason')) not between 1 and 1000 then raise exception 'INVALID_INPUT'; end if;
 end loop;
 if (select count(distinct (value->>'person_id')::uuid) from jsonb_array_elements(records))<>total then raise exception 'INVALID_INPUT'; end if;
 for item in select value from jsonb_array_elements(records) loop
  perform life_private.record_attendance(s,(item->>'person_id')::uuid,(item->>'minutes')::numeric,trim(item->>'reason'),(item->>'expected_revision')::integer);
 end loop;
 return total;
end $$;
create function public.life_record_attendance_batch(s uuid, records jsonb) returns integer
language sql security invoker set search_path='' as $$select life_private.record_attendance_batch(s,records)$$;
revoke all on function life_private.attendance_book(uuid,boolean),public.life_teaching_attendance(uuid),public.life_my_attendance(uuid),
 life_private.record_attendance_batch(uuid,jsonb),public.life_record_attendance_batch(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function life_private.attendance_book(uuid,boolean),public.life_teaching_attendance(uuid),public.life_my_attendance(uuid),
 life_private.record_attendance_batch(uuid,jsonb),public.life_record_attendance_batch(uuid,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
