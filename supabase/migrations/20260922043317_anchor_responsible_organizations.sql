BEGIN;

INSERT INTO public.life_organizations (slug, name)
VALUES ('uc-sanhak', '울산과학대학교 산학협력단')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

-- One-time setup for the existing lead administrators only. Other staff and
-- instructor roles are not copied, and existing records keep their institution.
WITH lead_managers AS (
  SELECT DISTINCT ON (manager.person_id)
    manager.person_id,
    least(manager.valid_until, admin.valid_until) AS valid_until
  FROM public.life_role_assignments manager
  JOIN public.life_organizations source ON source.id = manager.org_id
  JOIN public.life_role_assignments admin
    ON admin.person_id = manager.person_id AND admin.org_id = manager.org_id
  JOIN public.life_people person ON person.id = manager.person_id AND person.active
  WHERE source.slug = 'uc-anchor'
    AND manager.role = 'COURSE_MANAGER' AND admin.role = 'SYSTEM_ADMIN'
    AND manager.valid_from <= now() AND admin.valid_from <= now()
    AND (manager.valid_until IS NULL OR manager.valid_until > now())
    AND (admin.valid_until IS NULL OR admin.valid_until > now())
  ORDER BY manager.person_id, least(manager.valid_until, admin.valid_until) DESC NULLS FIRST
), added_roles AS (
  INSERT INTO public.life_role_assignments (person_id, org_id, role, valid_until)
  SELECT manager.person_id, target.id, 'COURSE_MANAGER', manager.valid_until
  FROM lead_managers manager
  CROSS JOIN public.life_organizations target
  WHERE target.slug = 'uc-sanhak'
    AND NOT EXISTS (
      SELECT 1 FROM public.life_role_assignments existing
      WHERE existing.person_id = manager.person_id AND existing.org_id = target.id
        AND existing.role = 'COURSE_MANAGER' AND existing.valid_from <= now()
        AND (existing.valid_until IS NULL OR existing.valid_until > now())
    )
  RETURNING id, org_id
)
INSERT INTO public.life_audit_events (org_id, action, entity_id)
SELECT org_id, 'SANHAK_COURSE_MANAGER_INITIALIZED', id FROM added_roles;

COMMIT;
