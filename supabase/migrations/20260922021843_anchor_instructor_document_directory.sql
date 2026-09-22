BEGIN;
CREATE FUNCTION life_private.instructor_document_directory(p_org uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR life_private.person_id() IS NULL OR NOT life_private.has_role(p_org,'COURSE_MANAGER') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 WITH eligible AS (
  SELECT person_id FROM public.life_role_assignments WHERE org_id=p_org AND role='INSTRUCTOR'
   AND valid_from<=now() AND (valid_until IS NULL OR valid_until>now())
  UNION SELECT person_id FROM public.life_instructor_dossiers WHERE org_id=p_org
 ), people AS (
  SELECT p.id,p.name FROM eligible e JOIN public.life_people p ON p.id=e.person_id WHERE p.active ORDER BY p.name,p.id LIMIT 201
 ), items AS (
  SELECT p.id,p.name,
   EXISTS(SELECT 1 FROM public.life_instructor_private_documents d WHERE d.person_id=p.id AND d.document_type='ID_COPY') AS has_id,
   EXISTS(SELECT 1 FROM public.life_instructor_private_documents d WHERE d.person_id=p.id AND d.document_type='BANK_COPY') AS has_bank,
   EXISTS(SELECT 1 FROM public.life_instructor_private_profiles d WHERE d.person_id=p.id) AS has_resume,
   EXISTS(SELECT 1 FROM public.life_instructor_private_profile_drafts d WHERE d.person_id=p.id) AS has_draft,
   EXISTS(SELECT 1 FROM public.life_instructor_generated_documents d WHERE d.person_id=p.id AND d.document_type='IDENTITY_BANK_PDF') AS has_identity_pdf,
   EXISTS(SELECT 1 FROM public.life_instructor_generated_documents d WHERE d.person_id=p.id AND d.document_type='RESUME_PDF') AS has_resume_pdf
  FROM people p ORDER BY p.name,p.id LIMIT 200
 ) SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.name,i.id) FROM items i),'[]'::jsonb),'more',(SELECT count(*)>200 FROM people)) INTO result;
 RETURN result;
END $$;
CREATE FUNCTION public.life_instructor_document_directory(p_org uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT life_private.instructor_document_directory(p_org) $$;
REVOKE ALL ON FUNCTION life_private.instructor_document_directory(uuid),public.life_instructor_document_directory(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION life_private.instructor_document_directory(uuid),public.life_instructor_document_directory(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
