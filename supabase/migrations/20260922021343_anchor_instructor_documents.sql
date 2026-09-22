BEGIN;
CREATE TABLE IF NOT EXISTS public.life_instructor_private_profiles (
  person_id uuid PRIMARY KEY REFERENCES public.life_people(id) ON DELETE CASCADE,
  encrypted_resume text NOT NULL,
  resume_iv text NOT NULL,
  resume_version integer NOT NULL DEFAULT 1 CHECK (resume_version > 0),
  resume_completed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.life_instructor_private_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.life_people(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('ID_COPY', 'BANK_COPY')),
  object_path text NOT NULL CHECK (length(btrim(object_path)) > 0),
  original_name text NOT NULL CHECK (length(btrim(original_name)) > 0),
  content_type text NOT NULL CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 1048576),
  name_verification_status text NOT NULL DEFAULT 'UNVERIFIED',
  name_matches_member boolean,
  name_verified_at timestamptz,
  encrypted_extracted_data text,
  extracted_data_iv text,
  extracted_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, document_type)
);

CREATE TABLE IF NOT EXISTS public.life_instructor_generated_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.life_people(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('IDENTITY_BANK_PDF', 'RESUME_PDF')),
  object_path text NOT NULL CHECK (length(btrim(object_path)) > 0),
  original_name text NOT NULL CHECK (length(btrim(original_name)) > 0),
  content_type text NOT NULL DEFAULT 'application/pdf' CHECK (content_type = 'application/pdf'),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, document_type)
);


CREATE TABLE public.life_instructor_private_profile_drafts (
 person_id uuid PRIMARY KEY REFERENCES public.life_people(id) ON DELETE CASCADE,
 encrypted_resume text NOT NULL, resume_iv text NOT NULL,
 resume_version integer NOT NULL DEFAULT 1 CHECK(resume_version>0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.life_instructor_document_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 person_id uuid NOT NULL REFERENCES public.life_people(id) ON DELETE CASCADE,
 org_id uuid NOT NULL REFERENCES public.life_organizations(id),
 actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz NOT NULL, revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX life_document_sessions_actor_idx ON public.life_instructor_document_sessions(actor_user_id);
CREATE INDEX life_document_sessions_person_idx ON public.life_instructor_document_sessions(person_id);
CREATE INDEX life_document_sessions_org_idx ON public.life_instructor_document_sessions(org_id);
CREATE INDEX life_document_sessions_expiry_idx ON public.life_instructor_document_sessions(expires_at);
ALTER TABLE public.life_instructor_private_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.life_instructor_private_profiles FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.life_instructor_private_profiles TO service_role;
ALTER TABLE public.life_instructor_private_profile_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.life_instructor_private_profile_drafts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.life_instructor_private_profile_drafts TO service_role;
ALTER TABLE public.life_instructor_private_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.life_instructor_private_documents FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.life_instructor_private_documents TO service_role;
ALTER TABLE public.life_instructor_generated_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.life_instructor_generated_documents FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.life_instructor_generated_documents TO service_role;
ALTER TABLE public.life_instructor_document_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.life_instructor_document_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.life_instructor_document_sessions TO service_role;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('instructor-private-documents','instructor-private-documents',false,10485760,ARRAY['application/pdf','image/jpeg','image/png'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Only the Edge Function service client accesses private tables and objects.
GRANT SELECT(id,name,active) ON public.life_people TO service_role;
-- Public wrapper preserves the existing native-session / MFA authorization gate.
CREATE FUNCTION life_private.instructor_document_access(p_person uuid DEFAULT NULL,p_org uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := life_private.person_id(); target uuid := coalesce(p_person,actor); organization uuid; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR actor IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT scope.org_id INTO organization FROM (
   SELECT r.org_id FROM public.life_role_assignments r WHERE r.person_id=target AND r.role='INSTRUCTOR'
    AND r.valid_from<=now() AND (r.valid_until IS NULL OR r.valid_until>now())
   UNION SELECT d.org_id FROM public.life_instructor_dossiers d WHERE d.person_id=target
 ) scope WHERE (p_org IS NULL OR scope.org_id=p_org)
   AND (actor=target OR life_private.has_role(scope.org_id,'COURSE_MANAGER'))
 ORDER BY scope.org_id LIMIT 1;
 IF organization IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT jsonb_build_object('id',p.id,'name',p.name,'org_id',organization,'organization',o.name,
   'department','','position','','actor_user_id',auth.uid(),'owner',actor=target)
 INTO result FROM public.life_people p JOIN public.life_organizations o ON o.id=organization WHERE p.id=target AND p.active;
 IF result IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.life_instructor_document_access(p_person uuid DEFAULT NULL,p_org uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT life_private.instructor_document_access(p_person,p_org)
$$;
REVOKE ALL ON FUNCTION life_private.instructor_document_access(uuid,uuid),public.life_instructor_document_access(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION life_private.instructor_document_access(uuid,uuid),public.life_instructor_document_access(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
