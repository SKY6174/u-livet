begin;

-- The opening-plan source ID is the stable join key. Titles may be corrected by a manager.
alter table public.life_course_guides add column source_id text;
update public.life_course_guides g set source_id = m.source_id
from (values
  ('P01','2026-furniture'), ('P02','2026-healthy-diet'),
  ('P03','2026-golf-fitting'), ('P04','2026-local-cookie'),
  ('P05','2026-wallpaper'), ('P06','2026-manual-therapy'),
  ('P07','2026-local-planning'), ('P08','2026-pet-food'),
  ('P09','2026-pet-behavior'), ('P10','2026-obstetric-pilates'),
  ('P11','2026-sports-taping'), ('P12','2026-silver-food'),
  ('P13','2026-pet-grooming'), ('P14','2026-interior-woodwork'),
  ('P15','2026-facilitator'), ('P16','2026-park-golf')
) as m(source_id, guide_id)
where g.id=m.guide_id and g.year=2026;
do $$begin
  if (select count(*) from public.life_course_guides where year=2026 and source_id is not null)<>16
     or exists(select 1 from public.life_course_guides where year=2026 and source_id is null) then
    raise exception 'SOURCE_GUIDE_MAPPING_INCOMPLETE';
  end if;
end$$;
alter table public.life_course_guides
  add constraint life_course_guides_source_id_unique unique(source_id),
  add constraint life_course_guides_source_id_format check(source_id is null or source_id ~ '^P(0[1-9]|1[0-6])$');

create function life_private.create_source_offering(
  source_id text, o uuid, y uuid, title text, academy text, summary text,
  curriculum text, mode text, location text, capacity integer,
  selection_method text, apply_from timestamptz, apply_until timestamptz,
  starts_on date, ends_on date
) returns uuid language plpgsql security definer set search_path='' as $$
declare guide public.life_course_guides; offering uuid;
begin
  if auth.uid() is null or not life_private.mfa_recent()
     or not life_private.has_role(o,'COURSE_MANAGER') then
    raise exception 'FORBIDDEN';
  end if;
  select * into guide from public.life_course_guides g
  where g.source_id=create_source_offering.source_id and g.published
  for update;
  if not found then raise exception 'INVALID_SOURCE'; end if;
  if guide.offering_id is not null then raise exception 'ALREADY_REGISTERED'; end if;
  if o<>'10000000-0000-4000-8000-000000000001'::uuid
     or not exists(select 1 from public.life_project_years py
       where py.id=y and py.org_id=o and extract(year from py.starts_on)=guide.year) then
    raise exception 'INVALID_YEAR_OR_ORG';
  end if;
  offering:=life_private.create_offering(o,y,title,academy,summary,curriculum,
    mode,location,capacity,selection_method,apply_from,apply_until,starts_on,ends_on);
  update public.life_course_guides set offering_id=offering where id=guide.id;
  insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
  values(o,life_private.person_id(),'SOURCE_OFFERING_DRAFT_REGISTERED',offering,
    jsonb_build_object('guide_id',guide.id,'source_id',guide.source_id));
  return offering;
end$$;

create function public.life_create_source_offering(
  source_id text, o uuid, y uuid, title text, academy text, summary text,
  curriculum text, mode text, location text, capacity integer,
  selection_method text, apply_from timestamptz, apply_until timestamptz,
  starts_on date, ends_on date
) returns uuid language sql security invoker set search_path='' as $$
  select life_private.create_source_offering(source_id,o,y,title,academy,summary,
    curriculum,mode,location,capacity,selection_method,apply_from,apply_until,starts_on,ends_on)
$$;

revoke all on function life_private.create_source_offering(text,uuid,uuid,text,text,text,text,text,text,integer,text,timestamptz,timestamptz,date,date) from public,anon,authenticated,service_role;
revoke all on function public.life_create_source_offering(text,uuid,uuid,text,text,text,text,text,text,integer,text,timestamptz,timestamptz,date,date) from public,anon,authenticated,service_role;
grant execute on function life_private.create_source_offering(text,uuid,uuid,text,text,text,text,text,text,integer,text,timestamptz,timestamptz,date,date) to authenticated;
grant execute on function public.life_create_source_offering(text,uuid,uuid,text,text,text,text,text,text,integer,text,timestamptz,timestamptz,date,date) to authenticated;

notify pgrst,'reload schema';
commit;
