create or replace function life_private.identity() returns jsonb
language sql stable security definer set search_path='' as $$
  with entry_orgs as materialized (
    select e.org_id, e.org_name, e.is_super_admin
    from life_private.member_entry_orgs() e
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
    'member_entry_orgs', entry_summary.orgs,
    'is_super_admin', entry_summary.is_super_admin,
    'roles', coalesce((select jsonb_agg(jsonb_build_object('role', r.role, 'org_id', r.org_id))
      from public.life_role_assignments r where r.person_id=p.id and r.valid_from<=now()
        and (r.valid_until is null or r.valid_until>now())), '[]'::jsonb))
  from public.life_people p
  left join life_private.account_classifications c on c.person_id=p.id
  cross join entry_summary
  where p.id=life_private.person_id()
$$;
