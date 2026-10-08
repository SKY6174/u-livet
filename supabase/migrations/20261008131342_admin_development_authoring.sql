begin;

-- An active manager may author a proposal for their own organization.
-- Check the specified author, not the caller's role, because reviewers also
-- call this helper while evaluating someone else's proposal.
create or replace function life_private.id_proposer(o uuid, p uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select life_private.id_person_active(p) and (
    life_private.id_dossier_current(o, p)
    or exists (
      select 1 from public.life_role_assignments a
      where a.person_id = p and a.org_id = o
        and a.role in ('INSTRUCTOR', 'COURSE_MANAGER')
        and a.valid_from <= now()
        and (a.valid_until is null or a.valid_until > now())
    )
  )
$$;

-- Staff can see their own draft alongside submitted proposals, but drafts
-- belonging to other authors remain hidden from the staff list.
create or replace function life_private.id_development_board_classified(
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
      where proposal_id = p.id and (not staff or submitted_at is not null
        or p.person_id = life_private.person_id())
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


-- Course guides already have their owning org_id. Keep them out of other
-- organizations' management lists and reject cross-org budget writes.
CREATE OR REPLACE FUNCTION life_private.course_budget_overview(o uuid,y integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT life_private.course_budget_allowed(o) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN jsonb_build_object(
 'courses',coalesce((
   SELECT jsonb_agg(to_jsonb(g)||jsonb_build_object(
     'source_id',b.source_id,
     'initial_instructor_name',p.name,
     'initial_instructor_verified',EXISTS(
       SELECT 1 FROM public.life_auth_links link WHERE link.person_id=g.initial_instructor_id
     ),
     'initial_responsible_name',responsible.name,
     'initial_responsible_verified',EXISTS(
       SELECT 1 FROM public.life_auth_links link WHERE link.person_id=g.initial_responsible_id
     ),
     'budget',jsonb_build_object(
       'program_id',coalesce(b.program_id,''),'revision',coalesce(b.revision,0),
       'updated_at',b.updated_at,'materials',b.materials,'printing',b.printing,
       'instructors',b.instructors,'operations',b.operations,'support',b.support,
       'scholarships',b.scholarships
     )
   ) ORDER BY g.sort_order)
   FROM public.life_course_guides g
   LEFT JOIN public.life_course_budgets b ON b.guide_id=g.id AND b.org_id=o
   LEFT JOIN public.life_people p ON p.id=g.initial_instructor_id AND p.active
   LEFT JOIN public.life_people responsible ON responsible.id=g.initial_responsible_id AND responsible.active
   WHERE g.year=y AND g.org_id=o
 ),'[]'::jsonb),
 'workbooks',coalesce((
   SELECT jsonb_agg(v ORDER BY v.created_at DESC) FROM (
     SELECT w.id,w.file_name,w.sheet_name,w.created_at,jsonb_array_length(w.rows) AS row_count,w.header_row
     FROM public.life_budget_workbooks w
     WHERE w.org_id=o AND w.year=y ORDER BY w.created_at DESC LIMIT 50
   ) v
 ),'[]'::jsonb));
END $$;

create or replace function life_private.save_course_budget(o uuid,g text,payload jsonb,expected_revision integer) returns integer
language plpgsql security definer set search_path='' as $$
declare prior integer; k text; result integer; p uuid:=life_private.person_id();
begin
 if not life_private.course_budget_allowed(o) then raise exception 'FORBIDDEN'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or (select count(*) from jsonb_object_keys(payload))<>7
 or jsonb_typeof(payload->'program_id') is distinct from 'string' or length(payload->>'program_id')>40
 or (payload->>'program_id'<>'' and payload->>'program_id'!~ '^[A-Z0-9]+(-[A-Z0-9]+){1,5}$')
 or expected_revision is null or expected_revision<0 or expected_revision>=2147483647 then raise exception 'INVALID_INPUT'; end if;
 foreach k in array array['materials','printing','instructors','operations','support','scholarships'] loop
  if not(payload ? k) or (payload->k<>'null'::jsonb and (jsonb_typeof(payload->k)<>'number' or payload->>k!~ '^[0-9]{1,12}$')) then raise exception 'INVALID_INPUT'; end if;
 end loop;
 -- Serializes even first inserts without locking another institution's records.
 perform 1 from public.life_organizations where id=o for update;
 if not exists(select 1 from public.life_course_guides where id=g and org_id=o) then raise exception 'INVALID_INPUT'; end if;
 select revision into prior from public.life_course_budgets where org_id=o and guide_id=g;
 if coalesce(prior,0)<>expected_revision then raise exception 'REVISION_CHANGED'; end if;
 insert into public.life_course_budgets(org_id,guide_id,program_id,materials,printing,instructors,operations,support,scholarships,updated_by)
 values(o,g,payload->>'program_id',(payload->>'materials')::bigint,(payload->>'printing')::bigint,(payload->>'instructors')::bigint,
 (payload->>'operations')::bigint,(payload->>'support')::bigint,(payload->>'scholarships')::bigint,p)
 on conflict(org_id,guide_id) do update set program_id=excluded.program_id,materials=excluded.materials,printing=excluded.printing,
 instructors=excluded.instructors,operations=excluded.operations,support=excluded.support,scholarships=excluded.scholarships,
 updated_at=now(),updated_by=p,revision=public.life_course_budgets.revision+1 returning revision into result;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details) values(o,p,'COURSE_BUDGET_SAVED',o,jsonb_build_object('guide_id',g,'revision',result,'values',payload));
 return result;
end $$;

commit;
