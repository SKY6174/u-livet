begin;
alter table public.life_audit_events add column details jsonb not null default '{}'::jsonb;
create function life_private.instructors(f uuid)
returns table(person_id uuid,name text,assigned boolean) language plpgsql stable security definer set search_path='' as $$
declare o uuid;
begin
  if not life_private.manages(f) then raise exception 'FORBIDDEN'; end if;
  select org_id into o from public.life_offerings where id=f;
  return query select p.id,p.name,exists(select 1 from public.life_offering_instructors i where i.offering_id=f and i.person_id=p.id and (i.valid_until is null or i.valid_until>now()))
    from public.life_people p where p.active and exists(select 1 from public.life_role_assignments r
      where r.person_id=p.id and r.org_id=o and r.role='INSTRUCTOR' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())) order by p.name,p.id;
end $$;
create function public.life_instructors(f uuid) returns table(person_id uuid,name text,assigned boolean)
language sql stable security invoker set search_path='' as $$select * from life_private.instructors(f)$$;

create function life_private.assign_instructor(f uuid,p uuid,enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
declare o uuid;
begin
  if not life_private.manages(f) or enabled is null then raise exception 'FORBIDDEN'; end if;
  select org_id into o from public.life_offerings where id=f for update;
  if enabled then
    if not exists(select 1 from public.life_role_assignments r join public.life_people person on person.id=r.person_id
      where r.person_id=p and person.active and r.org_id=o and r.role='INSTRUCTOR' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())) then
      raise exception 'APPROVED_INSTRUCTOR_REQUIRED';
    end if;
    insert into public.life_offering_instructors(offering_id,person_id) values(f,p)
      on conflict(offering_id,person_id) do update set valid_until=null;
  else
    update public.life_offering_instructors set valid_until=now() where offering_id=f and person_id=p;
  end if;
  insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
  values(o,life_private.person_id(),case when enabled then 'INSTRUCTOR_ASSIGNED' else 'INSTRUCTOR_UNASSIGNED' end,f,jsonb_build_object('instructor_id',p));
end $$;
create function public.life_assign_instructor(f uuid,p uuid,enabled boolean) returns void
language sql security invoker set search_path='' as $$select life_private.assign_instructor(f,p,enabled)$$;
revoke execute on function life_private.instructors(uuid),life_private.assign_instructor(uuid,uuid,boolean),public.life_instructors(uuid),public.life_assign_instructor(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function life_private.instructors(uuid),life_private.assign_instructor(uuid,uuid,boolean),public.life_instructors(uuid),public.life_assign_instructor(uuid,uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
