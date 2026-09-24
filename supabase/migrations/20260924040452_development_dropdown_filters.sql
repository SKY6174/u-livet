begin;

-- Keep legacy WORKER rows while recording the newly requested team and center codes.
alter table public.life_course_proposals
  drop constraint if exists life_course_proposals_track_check;
alter table public.life_course_proposals
  add constraint life_course_proposals_track_check
  check (track in ('ECC', 'ICC', 'RCC', 'AID-X', 'WORKER',
                   'SANHAK_PLANNING', 'SANHAK_SUPPORT'));

create or replace function life_private.id_start_development_classified(
  o uuid, y uuid, kind text, target uuid, track text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare proposal_id uuid; org_slug text;
begin
  select slug into org_slug from public.life_organizations where id = o;
  if track is null or not ((org_slug = 'uc-anchor' and track in ('ECC', 'ICC', 'RCC', 'AID-X'))
      or (org_slug = 'uc-sanhak' and track in ('SANHAK_PLANNING', 'SANHAK_SUPPORT'))) then
    raise exception 'INVALID_TRACK';
  end if;
  proposal_id := life_private.id_start_development(o, y, kind, target, null);
  update public.life_course_proposals set track = id_start_development_classified.track
    where id = proposal_id;
  return proposal_id;
end $$;

-- The filters run before pagination and approval counts, using the latest
-- visible proposal version for the list and each approved version for counts.
create function life_private.id_development_board_classified(
  o uuid, staff boolean, y uuid, track text, academy text
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare selected_track text := track; selected_academy text := academy; result jsonb;
begin
  if life_private.person_id() is null or staff is null
     or (staff and not life_private.has_role(o, 'COURSE_MANAGER')) then
    raise exception 'FORBIDDEN';
  end if;
  if not exists (select 1 from public.life_project_years py where py.id = y and py.org_id = o)
     or (selected_track is not null and not exists (
       select 1 from public.life_organizations org where org.id = o and (
         (org.slug = 'uc-anchor' and selected_track in ('ECC', 'ICC', 'RCC', 'AID-X'))
         or (org.slug = 'uc-sanhak' and selected_track in ('SANHAK_PLANNING', 'SANHAK_SUPPORT'))
       )))
     or (selected_academy is not null and selected_academy not in
       ('스마트테크', '라이프케어', '로컬창업', '팝업')) then
    raise exception 'INVALID_INPUT';
  end if;

  with candidates as materialized (
    select p.id, person.name, v.payload->>'title' as title,
           p.kind, p.project_year_id as year_id, p.track,
           v.status, v.version, v.revoked_at, p.created_at
    from public.life_course_proposals p
    join public.life_people person on person.id = p.person_id
    join lateral (
      select * from public.life_course_proposal_versions
      where proposal_id = p.id and (not staff or submitted_at is not null)
      order by version desc limit 1
    ) v on true
    where p.org_id = o and p.project_year_id = y
      and (selected_track is null or p.track = selected_track)
      and (staff or p.person_id = life_private.person_id())
      and (selected_academy is null or
        left(btrim(coalesce(v.payload->>'academy', '')), length(selected_academy)) = selected_academy)
  ), approved as materialized (
    select p.id, p.kind, v.version
    from public.life_course_proposals p
    join public.life_course_proposal_versions v on v.proposal_id = p.id
    where staff and p.org_id = o and p.project_year_id = y
      and (selected_track is null or p.track = selected_track)
      and v.status = 'APPROVED' and v.revoked_at is null
      and (selected_academy is null or
        left(btrim(coalesce(v.payload->>'academy', '')), length(selected_academy)) = selected_academy)
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name, 'title', c.title, 'kind', c.kind,
      'year_id', c.year_id, 'track', c.track, 'status', c.status,
      'version', c.version, 'revoked_at', c.revoked_at
    ) order by c.created_at desc) from (
      select * from candidates order by created_at desc limit 100
    ) c), '[]'::jsonb),
    'more', (select count(*) > 100 from candidates),
    'counts', case when staff then jsonb_build_array(jsonb_build_object(
      'project_year_id', y,
      'new_count', (select count(*) from approved a where a.kind = 'NEW'
        and not exists (select 1 from public.life_course_proposal_versions previous
          where previous.proposal_id = a.id and previous.status = 'APPROVED'
            and previous.version < a.version)),
      'revision_count', (select count(*) from approved a where a.kind = 'REVISION'
        or exists (select 1 from public.life_course_proposal_versions previous
          where previous.proposal_id = a.id and previous.status = 'APPROVED'
            and previous.version < a.version))
    )) else '[]'::jsonb end,
    'courses', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title))
      from public.life_courses c where c.org_id = o
        and (life_private.has_role(o, 'COURSE_MANAGER') or exists (
          select 1 from public.life_course_versions v
          join public.life_offerings f on f.course_version_id = v.id
          where v.course_id = c.id and life_private.read_offering(f.id)))), '[]'::jsonb)
  ) into result;
  return result;
end $$;

create function public.life_development_board_classified(
  o uuid, staff boolean, y uuid, track text, academy text
) returns jsonb language sql security invoker set search_path = '' as $$
  select life_private.id_development_board_classified(o, staff, y, track, academy)
$$;

revoke all on function life_private.id_development_board_classified(uuid,boolean,uuid,text,text) from public, anon;
revoke all on function public.life_development_board_classified(uuid,boolean,uuid,text,text) from public, anon;
grant execute on function life_private.id_development_board_classified(uuid,boolean,uuid,text,text) to authenticated;
grant execute on function public.life_development_board_classified(uuid,boolean,uuid,text,text) to authenticated;

commit;
