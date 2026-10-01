begin;

alter table public.life_course_guides
  add column org_id uuid not null default '10000000-0000-4000-8000-000000000001' references public.life_organizations(id),
  add column card_image_url text check (card_image_url is null or
    (length(card_image_url) <= 2048 and card_image_url ~ '^https://[^[:space:]"''()]+$')),
  add column revision integer not null default 1 check (revision > 0);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('life-course-covers','life-course-covers',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

create policy life_course_covers_staff_upload on storage.objects
for insert to authenticated with check (
  bucket_id='life-course-covers' and
  exists(select 1 from public.life_course_guides guide
    where guide.id=split_part(name,'/',2)
      and guide.org_id::text=split_part(name,'/',1)
      and split_part(name,'/',3) ~ '^[a-f0-9-]{36}\.(jpg|png|webp)$'
      and (life_private.has_role(guide.org_id,'COURSE_MANAGER') or
           life_private.has_role(guide.org_id,'SYSTEM_ADMIN')))
);

create function life_private.save_course_guide(g text, payload jsonb, expected_revision integer)
returns integer language plpgsql security definer set search_path='' as $$
declare current_guide public.life_course_guides; item jsonb; next_revision integer;
begin
  select * into current_guide from public.life_course_guides where id=g for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if life_private.person_id() is null or not (
    life_private.has_role(current_guide.org_id,'COURSE_MANAGER') or
    life_private.has_role(current_guide.org_id,'SYSTEM_ADMIN')) then
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

create function public.life_save_course_guide(g text, payload jsonb, expected_revision integer)
returns integer language sql security invoker set search_path='' as $$
  select life_private.save_course_guide(g,payload,expected_revision)
$$;

revoke all on function life_private.save_course_guide(text,jsonb,integer),
  public.life_save_course_guide(text,jsonb,integer) from public,anon,authenticated,service_role;
grant execute on function life_private.save_course_guide(text,jsonb,integer),
  public.life_save_course_guide(text,jsonb,integer) to authenticated;
notify pgrst,'reload schema';
commit;
