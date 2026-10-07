begin;

-- An offering is the source of shared basics once a public guide is linked to it.
create function life_private.offering_period_label(start_date date, end_date date)
returns text language sql immutable set search_path='' as $$
  select extract(year from start_date)::integer || '. ' || extract(month from start_date)::integer || '. ' ||
    extract(day from start_date)::integer || '. - ' ||
    case when extract(year from start_date)=extract(year from end_date) then ''
      else extract(year from end_date)::integer || '. ' end ||
    extract(month from end_date)::integer || '. ' || extract(day from end_date)::integer || '.'
$$;
revoke all on function life_private.offering_period_label(date,date) from public,anon,authenticated,service_role;

-- Reconcile the already linked courses before enforcing the invariant.
update public.life_course_guides guide set
  name=offering.name, location=offering.location, mode=offering.mode,
  capacity=offering.capacity,
  period_label=life_private.offering_period_label(offering.starts_on,offering.ends_on),
  revision=guide.revision+1
from public.life_offerings offering
where guide.offering_id=offering.id and
  (guide.name,guide.location,guide.mode,guide.capacity,guide.period_label) is distinct from
  (offering.name,offering.location,offering.mode,offering.capacity,
   life_private.offering_period_label(offering.starts_on,offering.ends_on));

create function life_private.guard_linked_guide_basics() returns trigger
language plpgsql security definer set search_path='' as $$
declare offering public.life_offerings; expected_period text;
begin
  if new.offering_id is null then return new; end if;
  select * into offering from public.life_offerings where id=new.offering_id;
  if not found then raise exception 'INVALID_OFFERING'; end if;
  expected_period:=life_private.offering_period_label(offering.starts_on,offering.ends_on);
  if tg_op='INSERT' then
    new.name:=offering.name; new.location:=offering.location; new.mode:=offering.mode;
    new.capacity:=offering.capacity; new.period_label:=expected_period;
    return new;
  end if;
  if new.offering_id is distinct from old.offering_id then
    new.name:=offering.name; new.location:=offering.location; new.mode:=offering.mode;
    new.capacity:=offering.capacity; new.period_label:=expected_period;
    new.revision:=old.revision+1;
    return new;
  end if;
  if (new.name,new.location,new.mode,new.capacity,new.period_label) is distinct from
     (offering.name,offering.location,offering.mode,offering.capacity,expected_period) then
    raise exception 'LINKED_COURSE_SHARED_FIELDS';
  end if;
  return new;
end $$;
revoke all on function life_private.guard_linked_guide_basics() from public,anon,authenticated,service_role;
create trigger guard_linked_guide_basics before insert or update of offering_id,name,location,mode,capacity,period_label
on public.life_course_guides for each row execute function life_private.guard_linked_guide_basics();

create function life_private.sync_offering_guide_basics() returns trigger
language plpgsql security definer set search_path='' as $$
declare expected_period text;
begin
  expected_period:=life_private.offering_period_label(new.starts_on,new.ends_on);
  update public.life_course_guides guide set
    name=new.name, location=new.location, mode=new.mode, capacity=new.capacity,
    period_label=expected_period, revision=guide.revision+1
  where guide.offering_id=new.id and
    (guide.name,guide.location,guide.mode,guide.capacity,guide.period_label) is distinct from
    (new.name,new.location,new.mode,new.capacity,expected_period);
  return new;
end $$;
revoke all on function life_private.sync_offering_guide_basics() from public,anon,authenticated,service_role;
create trigger sync_offering_guide_basics after update of name,location,mode,capacity,starts_on,ends_on
on public.life_offerings for each row execute function life_private.sync_offering_guide_basics();

commit;
