begin;

-- The selected responsibility is the canonical cover name for both editable documents.
-- Submitted snapshots stay immutable until a manager explicitly reopens the document.
create function life_private.sync_operation_professor() returns trigger
language plpgsql set search_path='' as $$
declare responsible_name text;
begin
  select p.name into responsible_name
  from public.life_operation_responsibilities r
  join public.life_people p on p.id=r.person_id
  where r.offering_id=new.offering_id;
  if responsible_name is not null and new.content is not null then
    new.content:=jsonb_set(new.content,'{fields,professor}',to_jsonb(responsible_name),true);
  end if;
  return new;
end$$;

create trigger life_operation_professor_sync
before insert or update of content,status on public.life_operation_documents
for each row execute function life_private.sync_operation_professor();

create or replace function life_private.operation_assign(f uuid,p uuid,expected_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare prior integer; prior_person uuid;
begin
  if not life_private.operation_access(f) or not life_private.operation_manager(f) then raise exception 'FORBIDDEN';end if;
  perform 1 from public.life_offerings where id=f for update;
  select revision,person_id into prior,prior_person from public.life_operation_responsibilities where offering_id=f;
  if coalesce(prior,0) is distinct from expected_revision then raise exception 'REVISION_CHANGED';end if;
  if not exists(select 1 from public.life_offering_instructors i join public.life_offerings o on o.id=i.offering_id join public.life_people pp on pp.id=i.person_id
    where i.offering_id=f and i.person_id=p and pp.active and (i.valid_until is null or i.valid_until>now())
    and exists(select 1 from public.life_role_assignments a where a.person_id=p and a.org_id=o.org_id and a.role='INSTRUCTOR' and a.valid_from<=now() and (a.valid_until is null or a.valid_until>now()))) then
    raise exception 'INVALID_RESPONSIBLE';
  end if;
  if prior_person=p then return;end if;
  insert into public.life_operation_responsibilities(offering_id,person_id,updated_by)
  values(f,p,life_private.person_id())
  on conflict(offering_id) do update set person_id=p,revision=public.life_operation_responsibilities.revision+1,updated_at=now(),updated_by=life_private.person_id();
  update public.life_operation_documents
  set status='DRAFT',reviewed_at=null,reviewed_by=null,revision=revision+1,
    return_note='책임강사가 변경되어 내용을 다시 확인해야 합니다.',updated_at=now(),updated_by=life_private.person_id()
  where offering_id=f and status<>'SUBMITTED';
  insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
  select org_id,life_private.person_id(),'OPERATION_RESPONSIBLE_ASSIGNED',f,jsonb_build_object('person_id',p)
  from public.life_offerings where id=f;
end$$;

-- Keep the responsible instructor eligible to author and request review.
create or replace function life_private.assign_instructor(f uuid,p uuid,enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
declare o uuid;
begin
  if not life_private.manages(f) or enabled is null then raise exception 'FORBIDDEN';end if;
  select org_id into o from public.life_offerings where id=f for update;
  if enabled then
    if not exists(select 1 from public.life_role_assignments r join public.life_people person on person.id=r.person_id
      where r.person_id=p and person.active and r.org_id=o and r.role='INSTRUCTOR' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())) then
      raise exception 'APPROVED_INSTRUCTOR_REQUIRED';
    end if;
    insert into public.life_offering_instructors(offering_id,person_id) values(f,p)
      on conflict(offering_id,person_id) do update set valid_until=null;
  else
    if exists(select 1 from public.life_operation_responsibilities r where r.offering_id=f and r.person_id=p) then
      raise exception 'RESPONSIBLE_INSTRUCTOR';
    end if;
    update public.life_offering_instructors set valid_until=now() where offering_id=f and person_id=p;
  end if;
  insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
  values(o,life_private.person_id(),case when enabled then 'INSTRUCTOR_ASSIGNED' else 'INSTRUCTOR_UNASSIGNED' end,f,jsonb_build_object('instructor_id',p));
end$$;

commit;
