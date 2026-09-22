BEGIN;
CREATE TABLE life_private.instructor_pool (
 org_id uuid NOT NULL REFERENCES public.life_organizations,
 person_id uuid NOT NULL REFERENCES public.life_people,
 registration_key uuid NOT NULL UNIQUE,
 kind text NOT NULL CHECK(kind IN ('INTERNAL','EXTERNAL')),
 affiliation text NOT NULL DEFAULT '' CHECK(length(affiliation)<=150),
 department text NOT NULL DEFAULT '' CHECK(length(department)<=100),
 position text NOT NULL DEFAULT '' CHECK(length(position)<=100),
 specialty text NOT NULL DEFAULT '' CHECK(length(specialty)<=300),
 phone text NOT NULL DEFAULT '' CHECK(phone='' OR phone ~ '^0[0-9]{8,10}$'),
 email text NOT NULL DEFAULT '' CHECK(length(email)<=254),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
 documents_required boolean NOT NULL,
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
 revision integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL REFERENCES public.life_people,
 updated_by uuid NOT NULL REFERENCES public.life_people,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(org_id,person_id)
);
CREATE INDEX life_pool_person ON life_private.instructor_pool(person_id);
CREATE INDEX life_pool_creators ON life_private.instructor_pool(created_by);
CREATE INDEX life_pool_editors ON life_private.instructor_pool(updated_by);
CREATE TABLE life_private.instructor_allowances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_key uuid NOT NULL UNIQUE,
 org_id uuid NOT NULL,person_id uuid NOT NULL,
 offering_id uuid REFERENCES public.life_offerings,
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
 activity_kind text NOT NULL CHECK(activity_kind IN ('TEACHING','DEVELOPMENT','REVIEW','OTHER')),
 activity_on date NOT NULL,minutes integer NOT NULL CHECK(minutes BETWEEN 1 AND 60000),
 rate bigint NOT NULL CHECK(rate BETWEEN 0 AND 100000000),
 gross bigint GENERATED ALWAYS AS (round(minutes::numeric*rate/60)::bigint) STORED,
 withholding bigint NOT NULL DEFAULT 0 CHECK(withholding>=0),
 evidence text NOT NULL DEFAULT '' CHECK(length(evidence)<=1000),
 status text NOT NULL DEFAULT 'PLANNED' CHECK(status IN ('PLANNED','PAID','CANCELLED')),
 paid_on date,reference text NOT NULL DEFAULT '' CHECK(length(reference)<=200),
 cancel_reason text NOT NULL DEFAULT '' CHECK(length(cancel_reason)<=1000),
 revision integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL REFERENCES public.life_people,updated_by uuid NOT NULL REFERENCES public.life_people,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(org_id,person_id) REFERENCES life_private.instructor_pool(org_id,person_id),
 CHECK(withholding<=gross),CHECK(gross<=1000000000),
 CHECK(status<>'PAID' OR (paid_on IS NOT NULL AND length(trim(reference))>0 AND length(trim(evidence))>0))
);
CREATE UNIQUE INDEX life_allowance_payment_reference ON life_private.instructor_allowances(org_id,person_id,reference) WHERE status='PAID';
CREATE INDEX life_allowance_person_date ON life_private.instructor_allowances(org_id,person_id,activity_on DESC);
CREATE INDEX life_allowance_offering ON life_private.instructor_allowances(offering_id);
CREATE INDEX life_allowance_creators ON life_private.instructor_allowances(created_by);
CREATE INDEX life_allowance_editors ON life_private.instructor_allowances(updated_by);
ALTER TABLE life_private.instructor_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_private.instructor_allowances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON life_private.instructor_pool,life_private.instructor_allowances FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION life_private.pool_authorize(o uuid) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR life_private.person_id() IS NULL OR NOT life_private.has_role(o,'COURSE_MANAGER') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
END $$;
CREATE FUNCTION life_private.pool_scope(o uuid) RETURNS TABLE(person_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT r.person_id FROM public.life_role_assignments r WHERE r.org_id=o AND r.role='INSTRUCTOR' AND r.valid_from<=now() AND (r.valid_until IS NULL OR r.valid_until>now())
 UNION SELECT d.person_id FROM public.life_instructor_dossiers d WHERE d.org_id=o
 UNION SELECT i.person_id FROM public.life_offering_instructors i JOIN public.life_offerings f ON f.id=i.offering_id WHERE f.org_id=o
 UNION SELECT p.person_id FROM life_private.instructor_pool p WHERE p.org_id=o
 UNION SELECT m.person_id FROM life_private.manual_members m WHERE m.org_id=o AND m.member_group='instructor'
$$;
CREATE FUNCTION life_private.pool_documents(p uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
 'id',EXISTS(SELECT 1 FROM public.life_instructor_private_documents WHERE person_id=p AND document_type='ID_COPY'),
 'bank',EXISTS(SELECT 1 FROM public.life_instructor_private_documents WHERE person_id=p AND document_type='BANK_COPY'),
 'resume',EXISTS(SELECT 1 FROM public.life_instructor_private_profiles WHERE person_id=p),
 'identity_pdf',EXISTS(SELECT 1 FROM public.life_instructor_generated_documents WHERE person_id=p AND document_type='IDENTITY_BANK_PDF'),
 'resume_pdf',EXISTS(SELECT 1 FROM public.life_instructor_generated_documents WHERE person_id=p AND document_type='RESUME_PDF'))
$$;
CREATE FUNCTION life_private.pool_rows(o uuid) RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',p.id,'name',p.name,'kind',coalesce(x.kind,c.instructor_kind,'UNSPECIFIED'),
 'affiliation',coalesce(x.affiliation,''),'department',coalesce(x.department,''),'position',coalesce(x.position,''),'specialty',coalesce(x.specialty,''),
 'phone',coalesce(x.phone,''),'email',coalesce(x.email,''),'notes',coalesce(x.notes,''),'status',coalesce(x.status,'ACTIVE'),
 'documents_required',coalesce(x.documents_required,c.instructor_kind IS DISTINCT FROM 'INTERNAL'),'registered',x.person_id IS NOT NULL,
 'revision',coalesce(x.revision,0),'documents',life_private.pool_documents(p.id),
 'courses',(SELECT count(DISTINCT i.offering_id) FROM public.life_offering_instructors i JOIN public.life_offerings f ON f.id=i.offering_id WHERE i.person_id=p.id AND f.org_id=o),
 'paid',coalesce((SELECT sum(a.gross-a.withholding) FROM life_private.instructor_allowances a WHERE a.org_id=o AND a.person_id=p.id AND a.status='PAID'),0),
 'pending',coalesce((SELECT sum(a.gross-a.withholding) FROM life_private.instructor_allowances a WHERE a.org_id=o AND a.person_id=p.id AND a.status='PLANNED'),0))
 FROM life_private.pool_scope(o) s JOIN public.life_people p ON p.id=s.person_id AND p.active
 LEFT JOIN life_private.instructor_pool x ON x.org_id=o AND x.person_id=p.id
 LEFT JOIN life_private.account_classifications c ON c.person_id=p.id
$$;

CREATE FUNCTION life_private.pool_save(o uuid,p uuid,expected_revision integer,request_key uuid,payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=life_private.person_id(); x life_private.instructor_pool; result uuid:=p; k text; fields text[]:=ARRAY['name','kind','affiliation','department','position','specialty','phone','email','notes','documents_required','status'];
BEGIN
 PERFORM life_private.pool_authorize(o);
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
 INSERT INTO public.life_audit_events(org_id,actor_id,action,entity_id) VALUES(o,actor,'INSTRUCTOR_POOL_SAVED',result);
 RETURN result;
END $$;
CREATE FUNCTION life_private.pool_import(o uuid,rows jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb; n integer:=0;
BEGIN
 PERFORM life_private.pool_authorize(o);
 IF jsonb_typeof(rows) IS DISTINCT FROM 'array' OR jsonb_array_length(rows) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(rows) LOOP
  PERFORM life_private.pool_save(o,NULL,0,(r->>'request_key')::uuid,r->'payload'); n:=n+1;
 END LOOP;
 RETURN n;
END $$;

CREATE FUNCTION life_private.allowance_save(o uuid,p uuid,a uuid,expected_revision integer,request_key uuid,payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE x life_private.instructor_allowances; result uuid; f uuid; actor uuid:=life_private.person_id(); day date;
BEGIN
 PERFORM life_private.pool_authorize(o);
 IF NOT EXISTS(SELECT 1 FROM life_private.instructor_pool WHERE org_id=o AND person_id=p AND status='ACTIVE') THEN RAISE EXCEPTION 'POOL_PROFILE_REQUIRED'; END IF;
 IF payload IS NULL OR jsonb_typeof(payload)<>'object' OR request_key IS NULL OR expected_revision IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(payload) key WHERE key NOT IN ('offering_id','title','activity_kind','activity_on','minutes','rate','withholding','evidence')) THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF coalesce(payload->>'activity_kind','') NOT IN ('TEACHING','DEVELOPMENT','REVIEW','OTHER') OR coalesce(length(trim(payload->>'title')),0) NOT BETWEEN 1 AND 200
 OR coalesce(length(payload->>'evidence'),0)>1000 OR coalesce(payload->>'minutes','')!~'^[0-9]{1,5}$' OR coalesce(payload->>'rate','')!~'^[0-9]{1,9}$'
 OR coalesce(payload->>'withholding','')!~'^[0-9]{1,10}$' OR coalesce(payload->>'activity_on','')!~'^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 day:=(payload->>'activity_on')::date;
 IF day<date '2000-01-01' OR day>current_date+interval '3 years' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 f:=nullif(payload->>'offering_id','')::uuid;
 IF f IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.life_offerings WHERE id=f AND org_id=o) THEN RAISE EXCEPTION 'COURSE_SCOPE_MISMATCH'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(request_key::text,0));
 IF a IS NULL THEN
  SELECT * INTO x FROM life_private.instructor_allowances WHERE instructor_allowances.request_key=allowance_save.request_key;
  IF FOUND THEN
   IF x.org_id<>o OR x.person_id<>p OR x.created_by<>actor THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
   RETURN x.id;
  END IF;
  IF expected_revision<>0 THEN RAISE EXCEPTION 'REVISION_CHANGED'; END IF;
  INSERT INTO life_private.instructor_allowances(request_key,org_id,person_id,offering_id,title,activity_kind,activity_on,minutes,rate,withholding,evidence,created_by,updated_by)
  VALUES(request_key,o,p,f,trim(payload->>'title'),payload->>'activity_kind',day,(payload->>'minutes')::integer,(payload->>'rate')::bigint,(payload->>'withholding')::bigint,coalesce(payload->>'evidence',''),actor,actor) RETURNING id INTO result;
 ELSE
  SELECT * INTO x FROM life_private.instructor_allowances WHERE id=a AND org_id=o AND person_id=p FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF x.revision<>expected_revision THEN RAISE EXCEPTION 'REVISION_CHANGED'; END IF;
  IF x.status<>'PLANNED' THEN RAISE EXCEPTION 'FINAL_RECORD_IMMUTABLE'; END IF;
  UPDATE life_private.instructor_allowances SET offering_id=f,title=trim(payload->>'title'),activity_kind=payload->>'activity_kind',activity_on=day,minutes=(payload->>'minutes')::integer,rate=(payload->>'rate')::bigint,withholding=(payload->>'withholding')::bigint,evidence=coalesce(payload->>'evidence',''),revision=revision+1,updated_by=actor,updated_at=now() WHERE id=a;
  result:=a;
 END IF;
 INSERT INTO public.life_audit_events(org_id,actor_id,action,entity_id) VALUES(o,actor,'INSTRUCTOR_ALLOWANCE_SAVED',result);
 RETURN result;
END $$;
CREATE FUNCTION life_private.allowance_transition(o uuid,a uuid,expected_revision integer,action text,paid_on date,reference text,evidence text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE x life_private.instructor_allowances; required boolean; docs jsonb;
BEGIN
 PERFORM life_private.pool_authorize(o);
 SELECT * INTO x FROM life_private.instructor_allowances WHERE id=a AND org_id=o FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF expected_revision IS NULL OR x.revision<>expected_revision THEN RAISE EXCEPTION 'REVISION_CHANGED'; END IF;
 IF action IS NULL OR action NOT IN ('PAY','CANCEL') OR evidence IS NULL OR length(trim(evidence)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF x.status='CANCELLED' OR (action='PAY' AND x.status<>'PLANNED') THEN RAISE EXCEPTION 'FINAL_RECORD_IMMUTABLE'; END IF;
 IF action='PAY' THEN
  IF paid_on IS NULL OR paid_on<x.activity_on OR paid_on>current_date OR reference IS NULL OR length(trim(reference)) NOT BETWEEN 1 AND 200 OR x.gross<=0 THEN RAISE EXCEPTION 'PAYMENT_EVIDENCE_REQUIRED'; END IF;
  SELECT documents_required INTO required FROM life_private.instructor_pool WHERE org_id=o AND person_id=x.person_id AND status='ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'POOL_PROFILE_REQUIRED'; END IF;
  docs:=life_private.pool_documents(x.person_id);
  IF required AND NOT ((docs->>'id')::boolean AND (docs->>'bank')::boolean AND (docs->>'resume')::boolean) THEN RAISE EXCEPTION 'DOCUMENTS_REQUIRED'; END IF;
  UPDATE life_private.instructor_allowances SET status='PAID',paid_on=allowance_transition.paid_on,reference=trim(allowance_transition.reference),evidence=trim(allowance_transition.evidence),revision=revision+1,updated_by=life_private.person_id(),updated_at=now() WHERE id=a;
 ELSE
  UPDATE life_private.instructor_allowances SET status='CANCELLED',cancel_reason=trim(evidence),revision=revision+1,updated_by=life_private.person_id(),updated_at=now() WHERE id=a;
 END IF;
 INSERT INTO public.life_audit_events(org_id,actor_id,action,entity_id) VALUES(o,life_private.person_id(),'INSTRUCTOR_ALLOWANCE_'||action,a);
END $$;

CREATE FUNCTION life_private.pool_board(o uuid,q text DEFAULT '',kind text DEFAULT 'ALL',page integer DEFAULT 1,p uuid DEFAULT NULL,activity_page integer DEFAULT 1,page_size integer DEFAULT 20) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM life_private.pool_authorize(o);
 IF q IS NULL OR length(q)>100 OR kind IS NULL OR kind NOT IN ('ALL','INTERNAL','EXTERNAL','UNSPECIFIED') OR page IS NULL OR page NOT BETWEEN 1 AND 100000 OR activity_page IS NULL OR activity_page NOT BETWEEN 1 AND 100000 OR page_size IS NULL OR page_size NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF p IS NOT NULL AND NOT EXISTS(SELECT 1 FROM life_private.pool_scope(o) WHERE person_id=p) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 WITH base AS MATERIALIZED(SELECT row FROM life_private.pool_rows(o) row),
 filtered AS MATERIALIZED(SELECT row FROM base WHERE (kind='ALL' OR row->>'kind'=kind) AND (q='' OR strpos(lower((row->>'name')||' '||(row->>'affiliation')||' '||(row->>'specialty')),lower(q))>0)),
 items AS(SELECT row FROM filtered ORDER BY row->>'name',row->>'id' LIMIT page_size OFFSET (page-1)*page_size),
 payments AS MATERIALIZED(SELECT a.*,b.row->>'name' name,b.row->>'kind' person_kind,f.name offering_name,(a.gross-a.withholding) net FROM life_private.instructor_allowances a JOIN filtered b ON (b.row->>'id')::uuid=a.person_id LEFT JOIN public.life_offerings f ON f.id=a.offering_id WHERE a.org_id=o AND (p IS NULL OR a.person_id=p)),
 activity AS(SELECT * FROM payments ORDER BY activity_on DESC,id LIMIT 50 OFFSET (activity_page-1)*50)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(row ORDER BY row->>'name',row->>'id') FROM items),'[]'::jsonb),'total',(SELECT count(*) FROM filtered),'page',page,'page_size',page_size,
 'counts',jsonb_build_object('total',(SELECT count(*) FROM base),'internal',(SELECT count(*) FROM base WHERE row->>'kind'='INTERNAL'),'external',(SELECT count(*) FROM base WHERE row->>'kind'='EXTERNAL'),'unclassified',(SELECT count(*) FROM base WHERE row->>'kind'='UNSPECIFIED'),
 'ready',(SELECT count(*) FROM base WHERE NOT (row->>'documents_required')::boolean OR ((row->'documents'->>'id')::boolean AND (row->'documents'->>'bank')::boolean AND (row->'documents'->>'resume')::boolean)),
 'paid',coalesce((SELECT sum((row->>'paid')::bigint) FROM base),0),'pending',coalesce((SELECT sum((row->>'pending')::bigint) FROM base),0)),
 'selected',(SELECT row FROM base WHERE (row->>'id')::uuid=p),
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

-- Pool membership authorizes the same encrypted document workflow without granting login/teaching roles.
CREATE OR REPLACE FUNCTION life_private.instructor_document_access(p_person uuid DEFAULT NULL,p_org uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=life_private.person_id(); target uuid:=coalesce(p_person,actor); organization uuid; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR actor IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT scope.org_id INTO organization FROM (
 SELECT r.org_id FROM public.life_role_assignments r WHERE r.person_id=target AND r.role='INSTRUCTOR' AND r.valid_from<=now() AND (r.valid_until IS NULL OR r.valid_until>now())
 UNION SELECT d.org_id FROM public.life_instructor_dossiers d WHERE d.person_id=target
 UNION SELECT x.org_id FROM life_private.instructor_pool x WHERE x.person_id=target AND x.status='ACTIVE'
 ) scope WHERE (p_org IS NULL OR scope.org_id=p_org) AND (actor=target OR life_private.has_role(scope.org_id,'COURSE_MANAGER')) ORDER BY scope.org_id LIMIT 1;
 IF organization IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT jsonb_build_object('id',p.id,'name',p.name,'org_id',organization,'organization',coalesce(nullif(x.affiliation,''),o.name),
 'department',coalesce(x.department,''),'position',coalesce(x.position,''),'actor_user_id',auth.uid(),'owner',actor=target)
 INTO result FROM public.life_people p JOIN public.life_organizations o ON o.id=organization LEFT JOIN life_private.instructor_pool x ON x.person_id=p.id AND x.org_id=organization WHERE p.id=target AND p.active;
 IF result IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION life_private.instructor_document_directory(p_org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM life_private.pool_authorize(p_org);
 SELECT jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('id',row->>'id','name',row->>'name','has_id',row->'documents'->'id','has_bank',row->'documents'->'bank','has_resume',row->'documents'->'resume','has_identity_pdf',row->'documents'->'identity_pdf','has_resume_pdf',row->'documents'->'resume_pdf') ORDER BY row->>'name'),'[]'::jsonb),'more',(SELECT count(*)>200 FROM life_private.pool_scope(p_org))) INTO result FROM (SELECT row FROM life_private.pool_rows(p_org) row ORDER BY row->>'name' LIMIT 200) s;
 RETURN result;
END $$;
CREATE FUNCTION public.life_instructor_pool_board(o uuid,q text DEFAULT '',kind text DEFAULT 'ALL',page integer DEFAULT 1,p uuid DEFAULT NULL,activity_page integer DEFAULT 1,page_size integer DEFAULT 20) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$SELECT life_private.pool_board(o,q,kind,page,p,activity_page,page_size)$$;
CREATE FUNCTION public.life_instructor_pool_save(o uuid,p uuid,expected_revision integer,request_key uuid,payload jsonb) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT life_private.pool_save(o,p,expected_revision,request_key,payload)$$;
CREATE FUNCTION public.life_instructor_pool_import(o uuid,rows jsonb) RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT life_private.pool_import(o,rows)$$;
CREATE FUNCTION public.life_instructor_allowance_save(o uuid,p uuid,a uuid,expected_revision integer,request_key uuid,payload jsonb) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT life_private.allowance_save(o,p,a,expected_revision,request_key,payload)$$;
CREATE FUNCTION public.life_instructor_allowance_transition(o uuid,a uuid,expected_revision integer,action text,paid_on date,reference text,evidence text) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT life_private.allowance_transition(o,a,expected_revision,action,paid_on,reference,evidence)$$;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature,n.nspname,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='life_private' AND p.proname IN ('pool_authorize','pool_scope','pool_documents','pool_rows','pool_save','pool_import','pool_board','allowance_save','allowance_transition')) OR (n.nspname='public' AND p.proname IN ('life_instructor_pool_board','life_instructor_pool_save','life_instructor_pool_import','life_instructor_allowance_save','life_instructor_allowance_transition')) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
 IF f.proname NOT IN ('pool_authorize','pool_scope','pool_documents','pool_rows') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature); END IF;
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
