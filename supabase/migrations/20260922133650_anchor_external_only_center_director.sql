BEGIN;

ALTER TABLE public.life_course_guides
  ADD COLUMN initial_responsible_id uuid REFERENCES public.life_people(id),
  ADD COLUMN initial_responsible_basis text CHECK (
    initial_responsible_basis IN ('FIRST_INTERNAL','CENTER_DIRECTOR')
  );

DO $$
DECLARE
  center_director_id uuid;
  anchor_org uuid;
  seed_actor uuid;
BEGIN
  SELECT id INTO anchor_org FROM public.life_organizations WHERE slug='uc-anchor';
  SELECT p.id INTO seed_actor
  FROM public.life_people p
  JOIN public.life_auth_links link ON link.person_id=p.id
  JOIN public.life_role_assignments role ON role.person_id=p.id AND role.org_id=anchor_org
  WHERE p.active AND role.role='COURSE_MANAGER' AND role.valid_from<=now()
    AND (role.valid_until IS NULL OR role.valid_until>now())
  ORDER BY p.id LIMIT 1;
  IF seed_actor IS NULL THEN
    SELECT id INTO seed_actor FROM public.life_people
    WHERE id='20260922-1331-4000-8000-000000000001'
      AND name='마이그레이션 자료 이관' AND active;
  END IF;
  IF anchor_org IS NULL OR seed_actor IS NULL
     OR (SELECT count(*) FROM public.life_course_guides WHERE year=2026)<>16
     OR (SELECT count(*) FROM public.life_course_guides WHERE year=2026 AND initial_instructor_id IS NOT NULL)<>10
  THEN RAISE EXCEPTION 'INITIAL_INSTRUCTOR_ROSTER_REQUIRED'; END IF;

  -- This is a provisional roster identity, not an authenticated account or
  -- teaching assignment. The verified director can replace it later.
  INSERT INTO public.life_people(name) VALUES('현용환') RETURNING id INTO center_director_id;

  UPDATE public.life_course_guides
  SET initial_responsible_id=coalesce(initial_instructor_id,center_director_id),
      initial_responsible_basis=CASE WHEN initial_instructor_id IS NULL
        THEN 'CENTER_DIRECTOR' ELSE 'FIRST_INTERNAL' END
  WHERE year=2026 AND initial_responsible_id IS NULL;

  IF (SELECT count(*) FROM public.life_course_guides
      WHERE year=2026 AND initial_responsible_id=center_director_id
        AND initial_responsible_basis='CENTER_DIRECTOR')<>6
  THEN RAISE EXCEPTION 'CENTER_DIRECTOR_ROSTER_MISMATCH'; END IF;

  INSERT INTO public.life_audit_events(org_id,actor_id,action,entity_id,details)
  SELECT anchor_org,seed_actor,'INITIAL_CENTER_DIRECTOR_RESPONSIBLE',center_director_id,
    jsonb_build_object('guide_id',guide.id,'authenticated',false)
  FROM public.life_course_guides guide
  WHERE guide.year=2026 AND guide.initial_responsible_id=center_director_id;
END $$;

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
   WHERE g.year=y
 ),'[]'::jsonb),
 'workbooks',coalesce((
   SELECT jsonb_agg(v ORDER BY v.created_at DESC) FROM (
     SELECT w.id,w.file_name,w.sheet_name,w.created_at,jsonb_array_length(w.rows) AS row_count,w.header_row
     FROM public.life_budget_workbooks w
     WHERE w.org_id=o AND w.year=y ORDER BY w.created_at DESC LIMIT 50
   ) v
 ),'[]'::jsonb));
END $$;

COMMIT;
