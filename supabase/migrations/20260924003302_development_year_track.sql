begin;

-- Keep the existing 2026 anchor-year id so historical references remain valid.
insert into public.life_project_years (org_id, label, starts_on, ends_on)
select o.id, format('%s년 (%s차년도)', y.n, y.n - 2024),
       make_date(y.n, 3, 1), make_date(y.n + 1, 3, 1) - 1
from public.life_organizations o
cross join (values (2025), (2026), (2027), (2028), (2029)) as y(n)
where o.slug in ('uc-anchor', 'uc-sanhak')
  and not exists (
    select 1 from public.life_project_years py
    where py.org_id = o.id and (
      py.label = format('%s년 (%s차년도)', y.n, y.n - 2024)
      or (o.slug = 'uc-anchor' and y.n = 2026 and py.label = '2차년도 · 2026')
    )
  );

alter table public.life_course_proposals
  add column track text check (track in ('RCC', 'AID-X', 'ECC', 'WORKER'));
create index life_course_proposals_year_track
  on public.life_course_proposals(org_id, project_year_id, track, created_at desc);

-- Return a stable organization code to the UI instead of inferring it from a display name.
create or replace function life_private.id_options() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if life_private.person_id() is null then raise exception 'AUTH_REQUIRED'; end if;
  return jsonb_build_object(
    'organizations', coalesce((select jsonb_agg(jsonb_build_object(
      'id', o.id, 'slug', o.slug, 'name', o.name,
      'manager', life_private.has_role(o.id, 'COURSE_MANAGER'),
      'proposer', life_private.id_proposer(o.id, life_private.person_id())))
      from public.life_organizations o), '[]'::jsonb),
    'policies', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'org_id', org_id, 'kind', kind, 'title', title,
      'version', version, 'body', body))
      from public.life_policy_versions
      where kind in ('INSTRUCTOR_PRIVACY','INSTRUCTOR_REVIEW','INSTRUCTOR_PUBLIC','DEVELOPMENT','COMPLETION')
        and life_private.policy_valid(id, org_id, kind)), '[]'::jsonb),
    'years', coalesce((select jsonb_agg(to_jsonb(py)) from public.life_project_years py), '[]'::jsonb)
  );
end $$;

-- First creation uses the existing validated workflow; follow-up versions keep the root track.
create function life_private.id_start_development_classified(
  o uuid, y uuid, kind text, target uuid, track text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare proposal_id uuid; org_slug text;
begin
  select slug into org_slug from public.life_organizations where id = o;
  if track is null or not ((org_slug = 'uc-anchor' and track in ('RCC', 'AID-X', 'ECC'))
      or (org_slug = 'uc-sanhak' and track = 'WORKER')) then
    raise exception 'INVALID_TRACK';
  end if;
  proposal_id := life_private.id_start_development(o, y, kind, target, null);
  update public.life_course_proposals set track = id_start_development_classified.track
    where id = proposal_id;
  return proposal_id;
end $$;

create function public.life_start_development_classified(
  o uuid, y uuid, kind text, target uuid, track text
) returns uuid language sql security invoker set search_path = '' as $$
  select life_private.id_start_development_classified(o, y, kind, target, track)
$$;

-- Filter before the 100-row limit, so older matching proposals remain reachable.
create function life_private.id_development_board_filtered(
  o uuid, staff boolean, y uuid, track text
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if life_private.person_id() is null or staff is null
     or (staff and not life_private.has_role(o, 'COURSE_MANAGER')) then
    raise exception 'FORBIDDEN';
  end if;
  if not exists (select 1 from public.life_project_years py where py.id = y and py.org_id = o)
     or (id_development_board_filtered.track is not null and id_development_board_filtered.track not in ('RCC', 'AID-X', 'ECC', 'WORKER', 'UNCLASSIFIED')) then
    raise exception 'INVALID_INPUT';
  end if;
  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(j) from (
      select jsonb_build_object(
        'id', p.id, 'name', person.name, 'title', v.payload->>'title',
        'kind', p.kind, 'year_id', p.project_year_id, 'track', p.track,
        'status', v.status, 'version', v.version, 'revoked_at', v.revoked_at
      ) j
      from public.life_course_proposals p
      join public.life_people person on person.id = p.person_id
      join lateral (
        select * from public.life_course_proposal_versions
        where proposal_id = p.id and (not staff or submitted_at is not null)
        order by version desc limit 1
      ) v on true
      where p.org_id = o and p.project_year_id = y
        and (id_development_board_filtered.track is null or (id_development_board_filtered.track = 'UNCLASSIFIED' and p.track is null) or p.track = id_development_board_filtered.track)
        and (staff or p.person_id = life_private.person_id())
      order by p.created_at desc limit 100
    ) rows), '[]'::jsonb),
    'more', (select count(*) > 100 from public.life_course_proposals p
      where p.org_id = o and p.project_year_id = y
        and (id_development_board_filtered.track is null or (id_development_board_filtered.track = 'UNCLASSIFIED' and p.track is null) or p.track = id_development_board_filtered.track)
        and ((not staff and p.person_id = life_private.person_id())
          or (staff and exists (select 1 from public.life_course_proposal_versions v
            where v.proposal_id = p.id and v.submitted_at is not null)))),
    'counts', case when staff then jsonb_build_array(jsonb_build_object(
      'project_year_id', y,
      'new_count', (select count(*) from public.life_course_proposals p
        join public.life_course_proposal_versions v on v.proposal_id = p.id
        where p.org_id = o and p.project_year_id = y
          and (id_development_board_filtered.track is null or (id_development_board_filtered.track = 'UNCLASSIFIED' and p.track is null) or p.track = id_development_board_filtered.track)
          and p.kind = 'NEW' and v.status = 'APPROVED' and v.revoked_at is null
          and not exists (select 1 from public.life_course_proposal_versions a
            where a.proposal_id = p.id and a.status = 'APPROVED' and a.version < v.version)),
      'revision_count', (select count(*) from public.life_course_proposals p
        join public.life_course_proposal_versions v on v.proposal_id = p.id
        where p.org_id = o and p.project_year_id = y
          and (id_development_board_filtered.track is null or (id_development_board_filtered.track = 'UNCLASSIFIED' and p.track is null) or p.track = id_development_board_filtered.track)
          and v.status = 'APPROVED' and v.revoked_at is null
          and (p.kind = 'REVISION' or exists (select 1 from public.life_course_proposal_versions a
            where a.proposal_id = p.id and a.status = 'APPROVED' and a.version < v.version)))
    )) else '[]'::jsonb end,
    'courses', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title))
      from public.life_courses c where c.org_id = o
        and (life_private.has_role(o, 'COURSE_MANAGER') or exists (
          select 1 from public.life_course_versions v
          join public.life_offerings f on f.course_version_id = v.id
          where v.course_id = c.id and life_private.read_offering(f.id)))), '[]'::jsonb)
  );
end $$;

create function public.life_development_board_filtered(
  o uuid, staff boolean, y uuid, track text
) returns jsonb language sql security invoker set search_path = '' as $$
  select life_private.id_development_board_filtered(o, staff, y, track)
$$;

revoke all on function public.life_start_development_classified(uuid,uuid,text,uuid,text) from public, anon;
revoke all on function public.life_development_board_filtered(uuid,boolean,uuid,text) from public, anon;
revoke all on function life_private.id_start_development_classified(uuid,uuid,text,uuid,text) from public, anon;
revoke all on function life_private.id_development_board_filtered(uuid,boolean,uuid,text) from public, anon;
grant execute on function public.life_start_development_classified(uuid,uuid,text,uuid,text) to authenticated;
grant execute on function public.life_development_board_filtered(uuid,boolean,uuid,text) to authenticated;
grant execute on function life_private.id_start_development_classified(uuid,uuid,text,uuid,text) to authenticated;
grant execute on function life_private.id_development_board_filtered(uuid,boolean,uuid,text) to authenticated;

commit;
