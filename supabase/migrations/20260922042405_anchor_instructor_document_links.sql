BEGIN;
CREATE TABLE life_private.instructor_pool_removals (
 org_id uuid NOT NULL REFERENCES public.life_organizations,person_id uuid NOT NULL REFERENCES public.life_people,
 removed_by uuid NOT NULL REFERENCES public.life_people,removed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(org_id,person_id)
);
CREATE INDEX life_pool_removal_person ON life_private.instructor_pool_removals(person_id);
CREATE INDEX life_pool_removal_actor ON life_private.instructor_pool_removals(removed_by);
ALTER TABLE life_private.instructor_pool_removals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON life_private.instructor_pool_removals FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE public.life_instructor_document_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL REFERENCES public.life_organizations,
 person_id uuid NOT NULL REFERENCES public.life_people,issued_by uuid NOT NULL REFERENCES public.life_people,
 code_hash text NOT NULL UNIQUE CHECK(code_hash ~ '^[0-9a-f]{64}$'),pin_hash text NOT NULL,
 expires_at timestamptz NOT NULL,revoked_at timestamptz,failed_attempts integer NOT NULL DEFAULT 0 CHECK(failed_attempts>=0),
 locked_until timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX life_document_invite_person ON public.life_instructor_document_invites(person_id);
CREATE INDEX life_document_invite_issuer ON public.life_instructor_document_invites(issued_by);
CREATE UNIQUE INDEX life_document_invite_current ON public.life_instructor_document_invites(org_id,person_id) WHERE revoked_at IS NULL;
ALTER TABLE public.life_instructor_document_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.life_instructor_document_invites FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.life_instructor_document_invites TO service_role;
ALTER TABLE public.life_instructor_document_sessions ALTER COLUMN actor_user_id DROP NOT NULL;
ALTER TABLE public.life_instructor_document_sessions ADD COLUMN invite_id uuid REFERENCES public.life_instructor_document_invites;
ALTER TABLE public.life_instructor_document_sessions ADD CONSTRAINT life_document_session_identity CHECK((actor_user_id IS NOT NULL) <> (invite_id IS NOT NULL));
CREATE INDEX life_document_session_invite ON public.life_instructor_document_sessions(invite_id);

CREATE FUNCTION life_private.document_invite_access(i uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 SELECT jsonb_build_object('id',p.id,'name',p.name,'org_id',x.org_id,'invite_id',x.id,'expires_at',x.expires_at,
 'organization',coalesce(nullif(pool.affiliation,''),o.name),'department',coalesce(pool.department,''),'position',coalesce(pool.position,'')) INTO result
 FROM public.life_instructor_document_invites x JOIN public.life_people p ON p.id=x.person_id AND p.active
 JOIN public.life_people issuer ON issuer.id=x.issued_by AND issuer.active JOIN public.life_organizations o ON o.id=x.org_id
 LEFT JOIN life_private.instructor_pool pool ON pool.org_id=x.org_id AND pool.person_id=x.person_id
 WHERE x.id=i AND x.revoked_at IS NULL AND x.expires_at>now()
 AND EXISTS(SELECT 1 FROM public.life_role_assignments r WHERE r.person_id=x.issued_by AND r.org_id=x.org_id AND r.role='COURSE_MANAGER' AND r.valid_from<=now() AND (r.valid_until IS NULL OR r.valid_until>now()))
 AND (pool.status='ACTIVE' OR EXISTS(SELECT 1 FROM public.life_role_assignments r WHERE r.person_id=x.person_id AND r.org_id=x.org_id AND r.role='INSTRUCTOR' AND r.valid_from<=now() AND (r.valid_until IS NULL OR r.valid_until>now())) OR EXISTS(SELECT 1 FROM public.life_instructor_dossiers d WHERE d.person_id=x.person_id AND d.org_id=x.org_id))
 AND NOT EXISTS(SELECT 1 FROM life_private.instructor_pool_removals d WHERE d.org_id=x.org_id AND d.person_id=x.person_id)
 AND (pool.person_id IS NULL OR pool.status='ACTIVE');
 RETURN result;
END $$;
CREATE FUNCTION life_private.document_invite_create(o uuid,p uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE code text; pin text; until_at timestamptz:=now()+interval '7 days';
BEGIN
 PERFORM life_private.pool_authorize(o);
 PERFORM life_private.instructor_document_access(p,o);
 IF EXISTS(SELECT 1 FROM life_private.instructor_pool_removals WHERE org_id=o AND person_id=p) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF EXISTS(SELECT 1 FROM life_private.instructor_pool WHERE org_id=o AND person_id=p AND status<>'ACTIVE') THEN RAISE EXCEPTION 'POOL_PROFILE_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(o::text||p::text,0));
 UPDATE public.life_instructor_document_invites SET revoked_at=now() WHERE org_id=o AND person_id=p AND revoked_at IS NULL;
 code:=translate(rtrim(encode(extensions.gen_random_bytes(32),'base64'),'='),'+/','-_');
 pin:=lpad(((('x'||encode(extensions.gen_random_bytes(4),'hex'))::bit(32)::bigint)%1000000)::text,6,'0');
 INSERT INTO public.life_instructor_document_invites(org_id,person_id,issued_by,code_hash,pin_hash,expires_at)
 VALUES(o,p,life_private.person_id(),encode(extensions.digest(code,'sha256'),'hex'),extensions.crypt(pin,extensions.gen_salt('bf',10)),until_at);
 INSERT INTO public.life_audit_events(org_id,actor_id,action,entity_id) VALUES(o,life_private.person_id(),'INSTRUCTOR_DOCUMENT_INVITE_CREATED',p);
 RETURN jsonb_build_object('public_code',code,'pin',pin,'expires_at',until_at);
END $$;
CREATE FUNCTION life_private.document_invite_verify(code text,person_name text,pin text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE x public.life_instructor_document_invites; member jsonb; failures integer;
BEGIN
 IF code IS NULL OR code !~ '^[A-Za-z0-9_-]{43}$' OR person_name IS NULL OR length(person_name)>100 OR pin IS NULL OR pin !~ '^[0-9]{6}$' THEN RETURN jsonb_build_object('error','INVALID_CREDENTIALS'); END IF;
 SELECT * INTO x FROM public.life_instructor_document_invites WHERE code_hash=encode(extensions.digest(code,'sha256'),'hex') FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','INVALID_CREDENTIALS'); END IF;
 member:=life_private.document_invite_access(x.id);
 IF member IS NULL THEN RETURN jsonb_build_object('error','INVALID_CREDENTIALS'); END IF;
 IF x.locked_until>now() THEN RETURN jsonb_build_object('error','LOCKED'); END IF;
 failures:=CASE WHEN x.locked_until IS NOT NULL THEN 0 ELSE x.failed_attempts END;
 IF trim(person_name)<>member->>'name' OR extensions.crypt(pin,x.pin_hash)<>x.pin_hash THEN
  failures:=failures+1;
  UPDATE public.life_instructor_document_invites SET failed_attempts=failures,locked_until=CASE WHEN failures>=5 THEN now()+interval '15 minutes' ELSE NULL END WHERE id=x.id;
  RETURN jsonb_build_object('error',CASE WHEN failures>=5 THEN 'LOCKED' ELSE 'INVALID_CREDENTIALS' END);
 END IF;
 UPDATE public.life_instructor_document_invites SET failed_attempts=0,locked_until=NULL WHERE id=x.id;
 RETURN jsonb_build_object('member',member);
END $$;
CREATE FUNCTION life_private.pool_remove(o uuid,p uuid,expected_revision integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE revision_now integer;
BEGIN
 PERFORM life_private.pool_authorize(o);
 IF NOT EXISTS(SELECT 1 FROM life_private.pool_scope(o) WHERE person_id=p) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT revision INTO revision_now FROM life_private.instructor_pool WHERE org_id=o AND person_id=p FOR UPDATE;
 IF expected_revision IS DISTINCT FROM coalesce(revision_now,0) THEN RAISE EXCEPTION 'REVISION_CHANGED'; END IF;
 INSERT INTO life_private.instructor_pool_removals(org_id,person_id,removed_by) VALUES(o,p,life_private.person_id()) ON CONFLICT DO NOTHING;
 UPDATE life_private.instructor_pool SET status='INACTIVE',revision=revision+1,updated_at=now(),updated_by=life_private.person_id() WHERE org_id=o AND person_id=p;
 UPDATE public.life_instructor_document_invites SET revoked_at=now() WHERE org_id=o AND person_id=p AND revoked_at IS NULL;
 UPDATE public.life_instructor_document_sessions SET revoked_at=now() WHERE org_id=o AND person_id=p AND revoked_at IS NULL;
 INSERT INTO public.life_audit_events(org_id,actor_id,action,entity_id) VALUES(o,life_private.person_id(),'INSTRUCTOR_POOL_REMOVED',p);
END $$;
CREATE OR REPLACE FUNCTION life_private.pool_rows(o uuid) RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('removed',EXISTS(SELECT 1 FROM life_private.instructor_pool_removals d WHERE d.org_id=o AND d.person_id=p.id),'id',p.id,'name',p.name,'kind',coalesce(x.kind,c.instructor_kind,'UNSPECIFIED'),
 'affiliation',coalesce(x.affiliation,''),'department',coalesce(x.department,''),'position',coalesce(x.position,''),'specialty',coalesce(x.specialty,''),
 'phone',coalesce(x.phone,''),'email',coalesce(x.email,''),'notes',coalesce(x.notes,''),'status',coalesce(x.status,'ACTIVE'),
 'documents_required',coalesce(x.documents_required,c.instructor_kind IS DISTINCT FROM 'INTERNAL'),'registered',x.person_id IS NOT NULL,
 'document_access',NOT EXISTS(SELECT 1 FROM life_private.instructor_pool_removals rm WHERE rm.org_id=o AND rm.person_id=p.id) AND ((x.person_id IS NOT NULL AND x.status='ACTIVE') OR EXISTS(SELECT 1 FROM public.life_role_assignments r WHERE r.person_id=p.id AND r.org_id=o AND r.role='INSTRUCTOR' AND r.valid_from<=now() AND (r.valid_until IS NULL OR r.valid_until>now())) OR EXISTS(SELECT 1 FROM public.life_instructor_dossiers d WHERE d.person_id=p.id AND d.org_id=o)),'revision',coalesce(x.revision,0),'documents',life_private.pool_documents(p.id),
 'courses',(SELECT count(DISTINCT i.offering_id) FROM public.life_offering_instructors i JOIN public.life_offerings f ON f.id=i.offering_id WHERE i.person_id=p.id AND f.org_id=o),
 'paid',coalesce((SELECT sum(a.gross-a.withholding) FROM life_private.instructor_allowances a WHERE a.org_id=o AND a.person_id=p.id AND a.status='PAID'),0),
 'pending',coalesce((SELECT sum(a.gross-a.withholding) FROM life_private.instructor_allowances a WHERE a.org_id=o AND a.person_id=p.id AND a.status='PLANNED'),0))
 FROM life_private.pool_scope(o) s JOIN public.life_people p ON p.id=s.person_id AND p.active
 LEFT JOIN life_private.instructor_pool x ON x.org_id=o AND x.person_id=p.id
 LEFT JOIN life_private.account_classifications c ON c.person_id=p.id
$$;
CREATE OR REPLACE FUNCTION life_private.pool_board(o uuid,q text DEFAULT '',kind text DEFAULT 'ALL',page integer DEFAULT 1,p uuid DEFAULT NULL,activity_page integer DEFAULT 1,page_size integer DEFAULT 20) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM life_private.pool_authorize(o);
 IF q IS NULL OR length(q)>100 OR kind IS NULL OR kind NOT IN ('ALL','INTERNAL','EXTERNAL','UNSPECIFIED') OR page IS NULL OR page NOT BETWEEN 1 AND 100000 OR activity_page IS NULL OR activity_page NOT BETWEEN 1 AND 100000 OR page_size IS NULL OR page_size NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF p IS NOT NULL AND NOT EXISTS(SELECT 1 FROM life_private.pool_scope(o) WHERE person_id=p) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 WITH base AS MATERIALIZED(SELECT row FROM life_private.pool_rows(o) row),
 visible AS MATERIALIZED(SELECT row FROM base WHERE NOT (row->>'removed')::boolean),
 filtered AS MATERIALIZED(SELECT row FROM visible WHERE (kind='ALL' OR row->>'kind'=kind) AND (q='' OR strpos(lower((row->>'name')||' '||(row->>'affiliation')||' '||(row->>'specialty')),lower(q))>0)),
 items AS(SELECT row FROM filtered ORDER BY row->>'name',row->>'id' LIMIT page_size OFFSET (page-1)*page_size),
 payments AS MATERIALIZED(SELECT a.*,b.row->>'name' name,a.instructor_snapshot->>'kind' person_kind,f.name offering_name,(a.gross-a.withholding) net FROM life_private.instructor_allowances a JOIN base b ON (b.row->>'id')::uuid=a.person_id LEFT JOIN public.life_offerings f ON f.id=a.offering_id WHERE a.org_id=o AND (p IS NULL OR a.person_id=p) AND (kind='ALL' OR b.row->>'kind'=kind) AND (q='' OR strpos(lower((b.row->>'name')||' '||(b.row->>'affiliation')||' '||(b.row->>'specialty')),lower(q))>0)),
 activity AS(SELECT * FROM payments ORDER BY activity_on DESC,id LIMIT 50 OFFSET (activity_page-1)*50)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(row ORDER BY row->>'name',row->>'id') FROM items),'[]'::jsonb),'total',(SELECT count(*) FROM filtered),'page',page,'page_size',page_size,
 'counts',jsonb_build_object('total',(SELECT count(*) FROM visible),'internal',(SELECT count(*) FROM visible WHERE row->>'kind'='INTERNAL'),'external',(SELECT count(*) FROM visible WHERE row->>'kind'='EXTERNAL'),'unclassified',(SELECT count(*) FROM visible WHERE row->>'kind'='UNSPECIFIED'),
 'ready',(SELECT count(*) FROM visible WHERE NOT (row->>'documents_required')::boolean OR ((row->'documents'->>'id')::boolean AND (row->'documents'->>'bank')::boolean AND (row->'documents'->>'resume')::boolean)),
 'paid',coalesce((SELECT sum((row->>'paid')::bigint) FROM base),0),'pending',coalesce((SELECT sum((row->>'pending')::bigint) FROM base),0)),
 'selected',(SELECT row FROM base WHERE (row->>'id')::uuid=p),
 'profile_history',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.changed_at DESC,h.id DESC) FROM (SELECT id,snapshot,changed_at FROM life_private.instructor_pool_history WHERE org_id=o AND person_id=p ORDER BY changed_at DESC,id DESC LIMIT 20) h),'[]'::jsonb),
 'allowances',coalesce((SELECT jsonb_agg(to_jsonb(activity) ORDER BY activity_on DESC,id) FROM activity),'[]'::jsonb),'allowance_total',(SELECT count(*) FROM payments),'activity_page',activity_page,
 'offerings',coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.starts_on DESC) FROM (SELECT id,name,starts_on,ends_on FROM public.life_offerings WHERE org_id=o ORDER BY starts_on DESC LIMIT 500) f),'[]'::jsonb),
 'teaching',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.starts_on DESC) FROM (
 SELECT f.id,f.name,f.starts_on,f.ends_on,
 (SELECT count(*) FROM public.life_class_sessions s WHERE s.offering_id=f.id AND s.status='SCHEDULED') sessions,
 coalesce((SELECT sum(l.minutes) FROM public.life_teaching_logs l JOIN public.life_class_sessions s ON s.id=l.session_id WHERE l.person_id=p AND s.offering_id=f.id AND s.status='SCHEDULED' AND l.approved_revision=l.revision),0) confirmed_minutes
 FROM public.life_offerings f WHERE f.org_id=o AND EXISTS(SELECT 1 FROM public.life_offering_instructors i WHERE i.person_id=p AND i.offering_id=f.id)
 ) t),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION life_private.instructor_document_access(p_person uuid DEFAULT NULL,p_org uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=life_private.person_id(); target uuid:=coalesce(p_person,actor); organization uuid; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR actor IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF actor<>target AND EXISTS(SELECT 1 FROM life_private.instructor_pool_removals WHERE person_id=target AND org_id=p_org) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT scope.org_id INTO organization FROM (
 SELECT r.org_id FROM public.life_role_assignments r WHERE r.person_id=target AND r.role='INSTRUCTOR' AND r.valid_from<=now() AND (r.valid_until IS NULL OR r.valid_until>now())
 UNION SELECT d.org_id FROM public.life_instructor_dossiers d WHERE d.person_id=target
 UNION SELECT x.org_id FROM life_private.instructor_pool x WHERE x.person_id=target AND x.status='ACTIVE'
 ) scope WHERE NOT EXISTS(SELECT 1 FROM life_private.instructor_pool_removals d WHERE d.person_id=target AND d.org_id=scope.org_id AND actor<>target) AND (p_org IS NULL OR scope.org_id=p_org) AND (actor=target OR life_private.has_role(scope.org_id,'COURSE_MANAGER')) ORDER BY scope.org_id LIMIT 1;
 IF organization IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT jsonb_build_object('id',p.id,'name',p.name,'org_id',organization,'organization',coalesce(nullif(x.affiliation,''),o.name),
 'department',coalesce(x.department,''),'position',coalesce(x.position,''),'actor_user_id',auth.uid(),'owner',actor=target)
 INTO result FROM public.life_people p JOIN public.life_organizations o ON o.id=organization LEFT JOIN life_private.instructor_pool x ON x.person_id=p.id AND x.org_id=organization WHERE p.id=target AND p.active;
 IF result IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION life_private.pool_save(o uuid,p uuid,expected_revision integer,request_key uuid,payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=life_private.person_id(); x life_private.instructor_pool; result uuid:=p; k text; fields text[]:=ARRAY['name','kind','affiliation','department','position','specialty','phone','email','notes','documents_required','status'];
BEGIN
 PERFORM life_private.pool_authorize(o);
 IF EXISTS(SELECT 1 FROM life_private.instructor_pool_removals WHERE org_id=o AND person_id=p) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF payload IS NULL OR jsonb_typeof(payload)<>'object' OR request_key IS NULL OR expected_revision IS NULL OR expected_revision<0 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(payload) key WHERE key<>ALL(fields)) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 FOREACH k IN ARRAY fields LOOP
  IF k<>'documents_required' AND (jsonb_typeof(payload->k) IS DISTINCT FROM 'string') THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 END LOOP;
 IF payload->>'kind' NOT IN ('INTERNAL','EXTERNAL') OR payload->>'status' NOT IN ('ACTIVE','INACTIVE') OR jsonb_typeof(payload->'documents_required') IS DISTINCT FROM 'boolean'
 OR length(trim(payload->>'name')) NOT BETWEEN 1 AND 100 OR length(payload->>'affiliation')>150 OR length(payload->>'department')>100 OR length(payload->>'position')>100
 OR length(payload->>'specialty')>300 OR length(payload->>'notes')>2000 OR length(payload->>'email')>254
 OR (payload->>'email'<>'' AND payload->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
 OR (payload->>'phone'<>'' AND payload->>'phone' !~ '^0[0-9]{8,10}$') THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(request_key::text,0));
 IF p IS NULL THEN
  SELECT * INTO x FROM life_private.instructor_pool WHERE registration_key=request_key;
  IF FOUND THEN
   IF x.org_id<>o OR x.created_by<>actor THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
   RETURN x.person_id;
  END IF;
  IF expected_revision<>0 THEN RAISE EXCEPTION 'REVISION_CHANGED'; END IF;
  IF EXISTS(SELECT 1 FROM life_private.pool_rows(o) row WHERE row->>'name'=trim(payload->>'name') AND row->>'affiliation'=payload->>'affiliation' AND row->>'kind'=payload->>'kind') THEN RAISE EXCEPTION 'DUPLICATE_INSTRUCTOR'; END IF;
  INSERT INTO public.life_people(name) VALUES(trim(payload->>'name')) RETURNING id INTO result;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM life_private.pool_scope(o) WHERE person_id=p) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  PERFORM 1 FROM public.life_people WHERE id=p AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO x FROM life_private.instructor_pool WHERE org_id=o AND person_id=p FOR UPDATE;
  IF coalesce(x.revision,0)<>expected_revision THEN RAISE EXCEPTION 'REVISION_CHANGED'; END IF;
  -- A pool editor does not change the shared login identity's name.
  IF (SELECT name FROM public.life_people WHERE id=p) IS DISTINCT FROM trim(payload->>'name') THEN RAISE EXCEPTION 'NAME_MISMATCH'; END IF;
 END IF;
 INSERT INTO life_private.instructor_pool AS current(org_id,person_id,registration_key,kind,affiliation,department,position,specialty,phone,email,notes,documents_required,status,created_by,updated_by)
 VALUES(o,result,request_key,payload->>'kind',payload->>'affiliation',payload->>'department',payload->>'position',payload->>'specialty',payload->>'phone',payload->>'email',payload->>'notes',(payload->>'documents_required')::boolean,payload->>'status',actor,actor)
 ON CONFLICT(org_id,person_id) DO UPDATE SET kind=excluded.kind,affiliation=excluded.affiliation,department=excluded.department,position=excluded.position,specialty=excluded.specialty,phone=excluded.phone,email=excluded.email,notes=excluded.notes,documents_required=excluded.documents_required,status=excluded.status,revision=current.revision+1,updated_by=actor,updated_at=now();
 INSERT INTO life_private.instructor_pool_history(org_id,person_id,snapshot,changed_by)
 SELECT o,result,jsonb_build_object('kind',kind,'affiliation',affiliation,'department',department,'position',position,'status',status,'revision',revision),actor FROM life_private.instructor_pool WHERE org_id=o AND person_id=result;
 INSERT INTO public.life_audit_events(org_id,actor_id,action,entity_id) VALUES(o,actor,'INSTRUCTOR_POOL_SAVED',result);
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION life_private.instructor_document_directory(p_org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM life_private.pool_authorize(p_org);
 SELECT jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('id',row->>'id','name',row->>'name','has_draft',EXISTS(SELECT 1 FROM public.life_instructor_private_profile_drafts d WHERE d.person_id=(row->>'id')::uuid),'has_id',row->'documents'->'id','has_bank',row->'documents'->'bank','has_resume',row->'documents'->'resume','has_identity_pdf',row->'documents'->'identity_pdf','has_resume_pdf',row->'documents'->'resume_pdf') ORDER BY row->>'name'),'[]'::jsonb),'more',(SELECT count(*)>200 FROM life_private.pool_rows(p_org) item WHERE NOT (item->>'removed')::boolean)) INTO result FROM (SELECT row FROM life_private.pool_rows(p_org) row WHERE NOT (row->>'removed')::boolean ORDER BY row->>'name' LIMIT 200) s;
 RETURN result;
END $$;
CREATE FUNCTION public.life_instructor_document_invite_create(o uuid,p uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT life_private.document_invite_create(o,p)$$;
CREATE FUNCTION public.life_instructor_document_invite_verify(code text,person_name text,pin text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT life_private.document_invite_verify(code,person_name,pin)$$;
CREATE FUNCTION public.life_instructor_document_invite_access(i uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$SELECT life_private.document_invite_access(i)$$;
CREATE FUNCTION public.life_instructor_pool_remove(o uuid,p uuid,expected_revision integer) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT life_private.pool_remove(o,p,expected_revision)$$;
REVOKE ALL ON FUNCTION life_private.document_invite_create(uuid,uuid),public.life_instructor_document_invite_create(uuid,uuid),life_private.pool_remove(uuid,uuid,integer),public.life_instructor_pool_remove(uuid,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION life_private.document_invite_create(uuid,uuid),public.life_instructor_document_invite_create(uuid,uuid),life_private.pool_remove(uuid,uuid,integer),public.life_instructor_pool_remove(uuid,uuid,integer) TO authenticated;
REVOKE ALL ON FUNCTION life_private.document_invite_verify(text,text,text),public.life_instructor_document_invite_verify(text,text,text),life_private.document_invite_access(uuid),public.life_instructor_document_invite_access(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION life_private.document_invite_verify(text,text,text),public.life_instructor_document_invite_verify(text,text,text),life_private.document_invite_access(uuid),public.life_instructor_document_invite_access(uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
