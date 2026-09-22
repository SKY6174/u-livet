BEGIN;

-- Source: docs/operations/2026-course-opening-plans.json, staff.teachers.
-- Names never match existing accounts automatically. These people have no auth links.
ALTER TABLE public.life_course_guides
  ADD COLUMN initial_instructor_id uuid REFERENCES public.life_people(id);

CREATE TEMP TABLE initial_internal_people (
  instructor_name text PRIMARY KEY,
  person_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  affiliation text NOT NULL
) ON COMMIT DROP;

INSERT INTO initial_internal_people(instructor_name,affiliation) VALUES
  ('정영혜','울산과학대학교 식품영양학과 전임'),
  ('임종석','울산과학대학교 특임'),
  ('신언환','울산과학대학교 호텔조리제빵과 전임'),
  ('이관우','울산과학대학교 물리치료학과 조교수'),
  ('최수경','울산과학대학교 식품영양학과 전임'),
  ('김원호','울산과학대학교 물리치료학과 교수'),
  ('서봉한','울산과학대학교 스포츠재활학부 전임'),
  ('김일낭','울산과학대학교 식품영양학과 전임'),
  ('한충목','울산과학대학교 실내건축디자인과 전임');

CREATE TEMP TABLE initial_internal_instructors (
  guide_id text PRIMARY KEY,
  source_id text NOT NULL,
  instructor_name text NOT NULL REFERENCES initial_internal_people(instructor_name)
) ON COMMIT DROP;

INSERT INTO initial_internal_instructors VALUES
  ('2026-healthy-diet','P02','정영혜'),
  ('2026-golf-fitting','P03','임종석'),
  ('2026-local-cookie','P04','신언환'),
  ('2026-manual-therapy','P06','이관우'),
  ('2026-pet-food','P08','최수경'),
  ('2026-obstetric-pilates','P10','김원호'),
  ('2026-sports-taping','P11','서봉한'),
  ('2026-silver-food','P12','김일낭'),
  ('2026-interior-woodwork','P14','한충목'),
  ('2026-park-golf','P16','서봉한');

DO $$
DECLARE
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
  IF anchor_org IS NULL OR seed_actor IS NULL THEN RAISE EXCEPTION 'ANCHOR_MANAGER_REQUIRED'; END IF;
  IF (SELECT count(*) FROM initial_internal_instructors)<>10
     OR (SELECT count(*) FROM initial_internal_people)<>9
     OR EXISTS (
       SELECT 1 FROM initial_internal_instructors seed
       LEFT JOIN public.life_course_guides guide ON guide.id=seed.guide_id AND guide.year=2026
       WHERE guide.id IS NULL
     )
     THEN RAISE EXCEPTION 'INITIAL_INSTRUCTOR_SOURCE_MISMATCH'; END IF;

  INSERT INTO public.life_people(id,name)
  SELECT person_id,instructor_name FROM initial_internal_people;

  INSERT INTO life_private.instructor_pool
    (org_id,person_id,registration_key,kind,affiliation,documents_required,
     status,notes,created_by,updated_by)
  SELECT anchor_org,person.person_id,gen_random_uuid(),'INTERNAL',person.affiliation,false,
    'ACTIVE','2026 운영계획서 강사현황의 첫 교내 강사 · 본인 인증 전 임시 승인',
    seed_actor,seed_actor
  FROM initial_internal_people person;

  INSERT INTO public.life_role_assignments(person_id,org_id,role)
  SELECT person_id,anchor_org,'INSTRUCTOR'
  FROM initial_internal_people;

  UPDATE public.life_course_guides guide
  SET initial_instructor_id=person.person_id
  FROM initial_internal_instructors seed
  JOIN initial_internal_people person ON person.instructor_name=seed.instructor_name
  WHERE guide.id=seed.guide_id AND guide.initial_instructor_id IS NULL;

  INSERT INTO public.life_offering_instructors(offering_id,person_id)
  SELECT guide.offering_id,person.person_id
  FROM initial_internal_instructors seed
  JOIN initial_internal_people person ON person.instructor_name=seed.instructor_name
  JOIN public.life_course_guides guide ON guide.id=seed.guide_id
  JOIN public.life_offerings offering ON offering.id=guide.offering_id AND offering.org_id=anchor_org
  ON CONFLICT(offering_id,person_id) DO NOTHING;

  INSERT INTO public.life_operation_responsibilities(offering_id,person_id,updated_by)
  SELECT guide.offering_id,person.person_id,seed_actor
  FROM initial_internal_instructors seed
  JOIN initial_internal_people person ON person.instructor_name=seed.instructor_name
  JOIN public.life_course_guides guide ON guide.id=seed.guide_id
  JOIN public.life_offerings offering ON offering.id=guide.offering_id AND offering.org_id=anchor_org
  ON CONFLICT(offering_id) DO NOTHING;

  INSERT INTO public.life_audit_events(org_id,actor_id,action,entity_id,details)
  SELECT anchor_org,seed_actor,'INITIAL_INTERNAL_INSTRUCTOR_APPROVED',person.person_id,
    jsonb_build_object('guide_id',seed.guide_id,'source_id',seed.source_id,'authenticated',false)
  FROM initial_internal_instructors seed
  JOIN initial_internal_people person ON person.instructor_name=seed.instructor_name;
END $$;

-- Existing overview is manager-only; add the provisional name and link state
-- without exposing life_people through a public SELECT policy.
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
