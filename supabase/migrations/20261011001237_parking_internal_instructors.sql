begin;

alter table public.life_parking_requests drop constraint life_parking_requests_applicant_kind_check;
alter table public.life_parking_requests add constraint life_parking_requests_applicant_kind_check
  check (applicant_kind in ('LEARNER', 'INTERNAL_INSTRUCTOR', 'EXTERNAL_INSTRUCTOR'));

create or replace function life_private.parking_applicant(f uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare
  o public.life_offerings;
  p uuid := life_private.person_id();
  k text;
begin
  if p is null then return null; end if;
  select * into o from public.life_offerings where id=f;
  if o.id is null or o.status not in ('PUBLISHED','CLOSED') then return null; end if;
  if life_private.enrolled(f) then return 'LEARNER'; end if;
  if life_private.teaches(f) then
    select c.instructor_kind into k from life_private.account_classifications c where c.person_id=p;
    if k='INTERNAL' then return 'INTERNAL_INSTRUCTOR'; end if;
    if k='EXTERNAL' then return 'EXTERNAL_INSTRUCTOR'; end if;
  end if;
  return null;
end $$;

revoke all on function life_private.parking_applicant(uuid) from public, anon, service_role;
grant execute on function life_private.parking_applicant(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
