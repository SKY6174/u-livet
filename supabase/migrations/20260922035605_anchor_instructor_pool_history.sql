BEGIN;
CREATE TABLE life_private.instructor_pool_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,org_id uuid NOT NULL,person_id uuid NOT NULL,
 snapshot jsonb NOT NULL,changed_by uuid NOT NULL REFERENCES public.life_people,changed_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(org_id,person_id) REFERENCES life_private.instructor_pool(org_id,person_id)
);
CREATE INDEX life_pool_history_person ON life_private.instructor_pool_history(org_id,person_id,changed_at DESC);
CREATE INDEX life_pool_history_actor ON life_private.instructor_pool_history(changed_by);
ALTER TABLE life_private.instructor_pool_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON life_private.instructor_pool_history FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE life_private.instructor_pool_history_id_seq FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE life_private.instructor_allowances ADD COLUMN instructor_snapshot jsonb;
UPDATE life_private.instructor_allowances a SET instructor_snapshot=jsonb_build_object('kind',p.kind,'affiliation',p.affiliation,'department',p.department,'position',p.position,'captured_at',now(),'source','migration_current_profile') FROM life_private.instructor_pool p WHERE p.org_id=a.org_id AND p.person_id=a.person_id;
ALTER TABLE life_private.instructor_allowances ALTER COLUMN instructor_snapshot SET NOT NULL;
INSERT INTO life_private.instructor_pool_history(org_id,person_id,snapshot,changed_by)
SELECT org_id,person_id,jsonb_build_object('kind',kind,'affiliation',affiliation,'department',department,'position',position,'status',status,'revision',revision,'source','migration_current_profile'),updated_by FROM life_private.instructor_pool;
CREATE OR REPLACE FUNCTION life_private.pool_save(o uuid,p uuid,expected_revision integer,request_key uuid,payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
 INSERT INTO life_private.instructor_pool_history(org_id,person_id,snapshot,changed_by)
 SELECT o,result,jsonb_build_object('kind',kind,'affiliation',affiliation,'department',department,'position',position,'status',status,'revision',revision),actor FROM life_private.instructor_pool WHERE org_id=o AND person_id=result;
 INSERT INTO public.life_audit_events(org_id,actor_id,action,entity_id) VALUES(o,actor,'INSTRUCTOR_POOL_SAVED',result);
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION life_private.allowance_save(o uuid,p uuid,a uuid,expected_revision integer,request_key uuid,payload jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
  INSERT INTO life_private.instructor_allowances(request_key,org_id,person_id,offering_id,instructor_snapshot,title,activity_kind,activity_on,minutes,rate,withholding,evidence,created_by,updated_by)
  VALUES(request_key,o,p,f,(SELECT jsonb_build_object('kind',kind,'affiliation',affiliation,'department',department,'position',position) FROM life_private.instructor_pool WHERE org_id=o AND person_id=p),trim(payload->>'title'),payload->>'activity_kind',day,(payload->>'minutes')::integer,(payload->>'rate')::bigint,(payload->>'withholding')::bigint,coalesce(payload->>'evidence',''),actor,actor) RETURNING id INTO result;
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
CREATE OR REPLACE FUNCTION life_private.allowance_transition(o uuid,a uuid,expected_revision integer,action text,paid_on date,reference text,evidence text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
  UPDATE life_private.instructor_allowances SET status='CANCELLED',cancel_reason=trim(allowance_transition.evidence),revision=revision+1,updated_by=life_private.person_id(),updated_at=now() WHERE id=a;
 END IF;
 INSERT INTO public.life_audit_events(org_id,actor_id,action,entity_id) VALUES(o,life_private.person_id(),'INSTRUCTOR_ALLOWANCE_'||action,a);
END $$;
CREATE OR REPLACE FUNCTION life_private.pool_board(o uuid,q text DEFAULT '',kind text DEFAULT 'ALL',page integer DEFAULT 1,p uuid DEFAULT NULL,activity_page integer DEFAULT 1,page_size integer DEFAULT 20) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM life_private.pool_authorize(o);
 IF q IS NULL OR length(q)>100 OR kind IS NULL OR kind NOT IN ('ALL','INTERNAL','EXTERNAL','UNSPECIFIED') OR page IS NULL OR page NOT BETWEEN 1 AND 100000 OR activity_page IS NULL OR activity_page NOT BETWEEN 1 AND 100000 OR page_size IS NULL OR page_size NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 IF p IS NOT NULL AND NOT EXISTS(SELECT 1 FROM life_private.pool_scope(o) WHERE person_id=p) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 WITH base AS MATERIALIZED(SELECT row FROM life_private.pool_rows(o) row),
 filtered AS MATERIALIZED(SELECT row FROM base WHERE (kind='ALL' OR row->>'kind'=kind) AND (q='' OR strpos(lower((row->>'name')||' '||(row->>'affiliation')||' '||(row->>'specialty')),lower(q))>0)),
 items AS(SELECT row FROM filtered ORDER BY row->>'name',row->>'id' LIMIT page_size OFFSET (page-1)*page_size),
 payments AS MATERIALIZED(SELECT a.*,b.row->>'name' name,a.instructor_snapshot->>'kind' person_kind,f.name offering_name,(a.gross-a.withholding) net FROM life_private.instructor_allowances a JOIN filtered b ON (b.row->>'id')::uuid=a.person_id LEFT JOIN public.life_offerings f ON f.id=a.offering_id WHERE a.org_id=o AND (p IS NULL OR a.person_id=p)),
 activity AS(SELECT * FROM payments ORDER BY activity_on DESC,id LIMIT 50 OFFSET (activity_page-1)*50)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(row ORDER BY row->>'name',row->>'id') FROM items),'[]'::jsonb),'total',(SELECT count(*) FROM filtered),'page',page,'page_size',page_size,
 'counts',jsonb_build_object('total',(SELECT count(*) FROM base),'internal',(SELECT count(*) FROM base WHERE row->>'kind'='INTERNAL'),'external',(SELECT count(*) FROM base WHERE row->>'kind'='EXTERNAL'),'unclassified',(SELECT count(*) FROM base WHERE row->>'kind'='UNSPECIFIED'),
 'ready',(SELECT count(*) FROM base WHERE NOT (row->>'documents_required')::boolean OR ((row->'documents'->>'id')::boolean AND (row->'documents'->>'bank')::boolean AND (row->'documents'->>'resume')::boolean)),
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
CREATE OR REPLACE FUNCTION life_private.pool_rows(o uuid) RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',p.id,'name',p.name,'kind',coalesce(x.kind,c.instructor_kind,'UNSPECIFIED'),
 'affiliation',coalesce(x.affiliation,''),'department',coalesce(x.department,''),'position',coalesce(x.position,''),'specialty',coalesce(x.specialty,''),
 'phone',coalesce(x.phone,''),'email',coalesce(x.email,''),'notes',coalesce(x.notes,''),'status',coalesce(x.status,'ACTIVE'),
 'documents_required',coalesce(x.documents_required,c.instructor_kind IS DISTINCT FROM 'INTERNAL'),'registered',x.person_id IS NOT NULL,
 'document_access',((x.person_id IS NOT NULL AND x.status='ACTIVE') OR EXISTS(SELECT 1 FROM public.life_role_assignments r WHERE r.person_id=p.id AND r.org_id=o AND r.role='INSTRUCTOR' AND r.valid_from<=now() AND (r.valid_until IS NULL OR r.valid_until>now())) OR EXISTS(SELECT 1 FROM public.life_instructor_dossiers d WHERE d.person_id=p.id AND d.org_id=o)),'revision',coalesce(x.revision,0),'documents',life_private.pool_documents(p.id),
 'courses',(SELECT count(DISTINCT i.offering_id) FROM public.life_offering_instructors i JOIN public.life_offerings f ON f.id=i.offering_id WHERE i.person_id=p.id AND f.org_id=o),
 'paid',coalesce((SELECT sum(a.gross-a.withholding) FROM life_private.instructor_allowances a WHERE a.org_id=o AND a.person_id=p.id AND a.status='PAID'),0),
 'pending',coalesce((SELECT sum(a.gross-a.withholding) FROM life_private.instructor_allowances a WHERE a.org_id=o AND a.person_id=p.id AND a.status='PLANNED'),0))
 FROM life_private.pool_scope(o) s JOIN public.life_people p ON p.id=s.person_id AND p.active
 LEFT JOIN life_private.instructor_pool x ON x.org_id=o AND x.person_id=p.id
 LEFT JOIN life_private.account_classifications c ON c.person_id=p.id
$$;
CREATE OR REPLACE FUNCTION life_private.instructor_document_directory(p_org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM life_private.pool_authorize(p_org);
 SELECT jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('id',row->>'id','name',row->>'name','has_draft',EXISTS(SELECT 1 FROM public.life_instructor_private_profile_drafts d WHERE d.person_id=(row->>'id')::uuid),'has_id',row->'documents'->'id','has_bank',row->'documents'->'bank','has_resume',row->'documents'->'resume','has_identity_pdf',row->'documents'->'identity_pdf','has_resume_pdf',row->'documents'->'resume_pdf') ORDER BY row->>'name'),'[]'::jsonb),'more',(SELECT count(*)>200 FROM life_private.pool_scope(p_org))) INTO result FROM (SELECT row FROM life_private.pool_rows(p_org) row ORDER BY row->>'name' LIMIT 200) s;
 RETURN result;
END $$;

CREATE FUNCTION life_private.allowance_detail(o uuid,a uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM life_private.pool_authorize(o);
 SELECT to_jsonb(record) INTO result FROM (SELECT x.*,p.name,x.instructor_snapshot->>'kind' person_kind,f.name offering_name,(x.gross-x.withholding) net FROM life_private.instructor_allowances x JOIN public.life_people p ON p.id=x.person_id LEFT JOIN public.life_offerings f ON f.id=x.offering_id WHERE x.org_id=o AND x.id=a) record;
 IF result IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.life_instructor_allowance_detail(o uuid,a uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$SELECT life_private.allowance_detail(o,a)$$;
REVOKE ALL ON FUNCTION life_private.allowance_detail(uuid,uuid),public.life_instructor_allowance_detail(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION life_private.allowance_detail(uuid,uuid),public.life_instructor_allowance_detail(uuid,uuid) TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
