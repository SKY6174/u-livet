begin;

create function life_private.course_guide_staff(o uuid) returns boolean
language sql stable security definer set search_path='' as $function$
  select life_private.person_id() is not null and (
    exists(select 1 from public.life_role_assignments r
      where r.person_id=life_private.person_id() and r.org_id=o and r.role<>'INSTRUCTOR'
        and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()))
    or exists(select 1 from life_private.manual_members m
      where m.person_id=life_private.person_id() and m.org_id=o and m.member_group='office')
    or exists(select 1 from life_private.member_entry_orgs() e where e.org_id=o)
  )
$function$;
revoke all on function life_private.course_guide_staff(uuid) from public,anon,authenticated,service_role;
grant execute on function life_private.course_guide_staff(uuid) to authenticated;

-- Reuse the validated person id while building the identity's member-entry summary.
-- The general member_entry_orgs() helper remains unchanged for its other callers.
create or replace function life_private.identity() returns jsonb
language sql stable security definer set search_path='' as $function$
  with person as materialized (
    select life_private.person_id() as id
  ), entry_orgs as materialized (
    select e.org_id, o.name as org_name, e.slot='SUPER_ADMIN' as is_super_admin
    from person
    join life_private.member_entry_operators e on e.auth_user_id=auth.uid()
    join public.life_organizations o on o.id=e.org_id
    join auth.users u on u.id=e.auth_user_id
    where person.id is not null
      and u.email_confirmed_at is not null and u.deleted_at is null
  ), entry_summary as (
    select coalesce(jsonb_agg(to_jsonb(e) order by e.org_name, e.org_id), '[]'::jsonb) as orgs,
      coalesce(bool_or(e.is_super_admin), false) as is_super_admin
    from entry_orgs e
  )
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'office_position', c.office_position,
    'instructor_kind', c.instructor_kind,
    'member_group', (select m.member_group from life_private.manual_members m
      where m.person_id=p.id and m.member_group in ('office', 'instructor')),
    'member_org_id', (select m.org_id from life_private.manual_members m
      where m.person_id=p.id and m.member_group='office'),
    'member_entry_orgs', entry_summary.orgs,
    'is_super_admin', entry_summary.is_super_admin,
    'roles', coalesce((select jsonb_agg(jsonb_build_object('role', r.role, 'org_id', r.org_id))
      from public.life_role_assignments r where r.person_id=p.id and r.valid_from<=now()
        and (r.valid_until is null or r.valid_until>now())), '[]'::jsonb))
  from person
  join public.life_people p on p.id=person.id
  left join life_private.account_classifications c on c.person_id=p.id
  cross join entry_summary
$function$;

alter policy life_course_covers_staff_upload on storage.objects
with check (
  bucket_id='life-course-covers' and
  exists(select 1 from public.life_course_guides guide
    where guide.id=split_part(name,'/',2)
      and guide.org_id::text=split_part(name,'/',1)
      and split_part(name,'/',3) ~ '^[a-f0-9-]{36}\.(jpg|png|webp)$'
      and life_private.course_guide_staff(guide.org_id))
);

create or replace function life_private.save_course_guide(g text, payload jsonb, expected_revision integer)
returns integer language plpgsql security definer set search_path='' as $$
declare current_guide public.life_course_guides; item jsonb; next_revision integer;
begin
  select * into current_guide from public.life_course_guides where id=g for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not life_private.course_guide_staff(current_guide.org_id) then
    raise exception 'FORBIDDEN';
  end if;
  if expected_revision is null or expected_revision <> current_guide.revision then
    raise exception 'REVISION_CHANGED';
  end if;
  if jsonb_typeof(payload) is distinct from 'object' or
     (select count(*) from jsonb_object_keys(payload)) <> 13 then
    raise exception 'INVALID_INPUT';
  end if;
  if jsonb_typeof(payload->'name') is distinct from 'string' or length(btrim(payload->>'name')) not between 1 and 160 or
     jsonb_typeof(payload->'academy') is distinct from 'string' or payload->>'academy' not in
       ('스마트테크 아카데미','라이프케어 아카데미','로컬창업 아카데미','팝업 아카데미') or
     jsonb_typeof(payload->'summary') is distinct from 'string' or length(btrim(payload->>'summary')) not between 1 and 1000 or
     jsonb_typeof(payload->'mode') is distinct from 'string' or payload->>'mode' not in ('ONLINE','OFFLINE','BLENDED') or
     jsonb_typeof(payload->'capacity') is distinct from 'number' or payload->>'capacity' !~ '^[0-9]{1,3}$' or
     (payload->>'capacity')::integer not between 1 and 999 or
     jsonb_typeof(payload->'teaching_hours') is distinct from 'number' or payload->>'teaching_hours' !~ '^[0-9]{1,3}$' or
     (payload->>'teaching_hours')::integer not between 1 and 999 or
     jsonb_typeof(payload->'period_label') is distinct from 'string' or length(btrim(payload->>'period_label')) not between 1 and 160 or
     jsonb_typeof(payload->'time_label') is distinct from 'string' or length(btrim(payload->>'time_label')) not between 1 and 160 or
     jsonb_typeof(payload->'location') is distinct from 'string' or length(btrim(payload->>'location')) not between 1 and 160 or
     not coalesce(jsonb_typeof(payload->'certificate') in ('string','null'),false) or length(payload->>'certificate') > 160 or
     not coalesce(jsonb_typeof(payload->'card_image_url') in ('string','null'),false) or
     (payload->>'card_image_url' is not null and
       (length(payload->>'card_image_url') > 2048 or
        payload->>'card_image_url' !~ '^https://[^[:space:]"''()]+$')) or
     jsonb_typeof(payload->'curriculum') is distinct from 'array' or
     jsonb_typeof(payload->'schedule_history') is distinct from 'array' then
    raise exception 'INVALID_INPUT';
  end if;
  if jsonb_array_length(payload->'curriculum') not between 1 and 30 or
     jsonb_array_length(payload->'schedule_history') > 30 then
    raise exception 'INVALID_INPUT';
  end if;
  for item in select value from jsonb_array_elements(payload->'curriculum') loop
    if jsonb_typeof(item) <> 'string' or length(btrim(item #>> '{}')) not between 1 and 300 then
      raise exception 'INVALID_INPUT';
    end if;
  end loop;
  for item in select value from jsonb_array_elements(payload->'schedule_history') loop
    if jsonb_typeof(item) <> 'string' or length(btrim(item #>> '{}')) not between 1 and 300 then
      raise exception 'INVALID_INPUT';
    end if;
  end loop;
  update public.life_course_guides set
    name=btrim(payload->>'name'), academy=payload->>'academy', summary=btrim(payload->>'summary'),
    curriculum=array(select jsonb_array_elements_text(payload->'curriculum')),
    mode=payload->>'mode', capacity=(payload->>'capacity')::integer,
    teaching_hours=(payload->>'teaching_hours')::integer,
    period_label=btrim(payload->>'period_label'),
    schedule_history=array(select jsonb_array_elements_text(payload->'schedule_history')),
    time_label=btrim(payload->>'time_label'), location=btrim(payload->>'location'),
    certificate=nullif(btrim(payload->>'certificate'),''),
    card_image_url=nullif(btrim(payload->>'card_image_url'),''), revision=revision+1
  where id=g returning revision into next_revision;
  insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
  values(current_guide.org_id,life_private.person_id(),'COURSE_GUIDE_UPDATED',current_guide.org_id,
    jsonb_build_object('guide_id',g,'revision',next_revision));
  return next_revision;
end $$;

notify pgrst,'reload schema';
commit;
