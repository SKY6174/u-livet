BEGIN;

-- Named lecturers and assistant lecturers in the 16 supplied 2026 operating plans.
-- Source order and affiliations are captured in docs/operations/2026-course-opening-plans.json.
CREATE TABLE life_private.instructor_plan_roster (
  org_id uuid NOT NULL REFERENCES public.life_organizations(id),
  guide_id text NOT NULL REFERENCES public.life_course_guides(id),
  person_id uuid NOT NULL REFERENCES public.life_people(id),
  teaching_role text NOT NULL CHECK (teaching_role IN ('LECTURER','ASSISTANT')),
  source_order integer NOT NULL CHECK (source_order > 0),
  source_id text NOT NULL CHECK (source_id ~ '^P[0-9]{2}$'),
  imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id,guide_id,person_id,teaching_role)
);
CREATE INDEX instructor_plan_roster_person ON life_private.instructor_plan_roster(org_id,person_id);
ALTER TABLE life_private.instructor_plan_roster ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON life_private.instructor_plan_roster FROM PUBLIC,anon,authenticated,service_role;

CREATE TEMP TABLE plan_staff (
  source_id text NOT NULL,
  source_order integer NOT NULL,
  person_name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('INTERNAL','EXTERNAL')),
  affiliation text NOT NULL,
  teaching_role text NOT NULL CHECK (teaching_role IN ('LECTURER','ASSISTANT')),
  person_id uuid,
  PRIMARY KEY (source_id,teaching_role,source_order)
) ON COMMIT DROP;

INSERT INTO plan_staff(source_id,source_order,person_name,kind,affiliation,teaching_role) VALUES
  ('P01','1','손창서','EXTERNAL','나손향 대표','LECTURER'),
  ('P02','1','정영혜','INTERNAL','울산과학대학교 식품영양학과 전임','LECTURER'),
  ('P02','2','박전순','EXTERNAL','동경요리제과제빵학원 연구원/강사','LECTURER'),
  ('P02','3','신효정','EXTERNAL','한국식생활건강교육협회 연구원','LECTURER'),
  ('P03','1','임종석','INTERNAL','울산과학대학교 특임','LECTURER'),
  ('P03','2','송상용','EXTERNAL','앤라이프샵 대표','LECTURER'),
  ('P03','3','박귀홍','EXTERNAL','골프 샵 대표','LECTURER'),
  ('P03','4','문준석','EXTERNAL','준골프 대표','LECTURER'),
  ('P03','1','김진열','EXTERNAL','온양스포츠센터 강사','ASSISTANT'),
  ('P04','1','신언환','INTERNAL','울산과학대학교 호텔조리제빵과 전임','LECTURER'),
  ('P04','2','정영은','EXTERNAL','울산 동구청 퍼실리테이터','LECTURER'),
  ('P04','3','구범기','EXTERNAL','토탈베이커리시스템 부장','LECTURER'),
  ('P04','4','김중록','EXTERNAL','랑콩뜨레과자점 이사','LECTURER'),
  ('P05','1','조영민','EXTERNAL','집닥 주식회사 실장','LECTURER'),
  ('P06','1','이관우','INTERNAL','울산과학대학교 물리치료학과 조교수','LECTURER'),
  ('P06','2','김정현','EXTERNAL','동천동강병원 팀장','LECTURER'),
  ('P06','1','김정현','EXTERNAL','동천동강병원 팀장','ASSISTANT'),
  ('P06','2','최유진','EXTERNAL','동천동강병원 팀원','ASSISTANT'),
  ('P07','1','오명훈','EXTERNAL','(재)영월문화관광재단 차장','LECTURER'),
  ('P07','2','황동윤','EXTERNAL','파래소 국악실내악단 대표','LECTURER'),
  ('P07','1','김성엽','EXTERNAL','포시크루 대표','ASSISTANT'),
  ('P07','2','서승연','EXTERNAL','해피키키 대표','ASSISTANT'),
  ('P07','3','이뤄라','EXTERNAL','놀래놀래 대표','ASSISTANT'),
  ('P08','1','최수경','INTERNAL','울산과학대학교 식품영양학과 전임','LECTURER'),
  ('P08','2','문해담','EXTERNAL','국제펫푸드영양협회 대표','LECTURER'),
  ('P09','1','이채원','EXTERNAL','필애견엽견훈련학교 대표','LECTURER'),
  ('P10','1','김원호','INTERNAL','울산과학대학교 물리치료학과 교수','LECTURER'),
  ('P10','2','김동주','EXTERNAL','비엔비네오필라테스센터 대표','LECTURER'),
  ('P11','1','서봉한','INTERNAL','울산과학대학교 스포츠재활학부 전임','LECTURER'),
  ('P11','2','조경호','EXTERNAL','K-스포츠재활운동과학연구소 대표','LECTURER'),
  ('P11','1','우철호','EXTERNAL','한국스포츠산업인력개발원㈜ 대표','ASSISTANT'),
  ('P11','2','손승우','EXTERNAL','한국스포츠산업인력개발원㈜ 대표강사','ASSISTANT'),
  ('P12','1','김일낭','INTERNAL','울산과학대학교 식품영양학과 전임','LECTURER'),
  ('P12','2','김은경','EXTERNAL','올바른식생활연구협회 대표','LECTURER'),
  ('P12','3','최진혁','EXTERNAL','너프 대표','LECTURER'),
  ('P13','1','김선아','EXTERNAL','울산퍼스트애견미용학원 강사','LECTURER'),
  ('P13','1','곽나영','EXTERNAL','울산퍼스트애견미용학원 대표','ASSISTANT'),
  ('P14','1','한충목','INTERNAL','울산과학대학교 실내건축디자인과 전임','LECTURER'),
  ('P15','1','정영은','EXTERNAL','엠토리움 더 질문 대표','LECTURER'),
  ('P15','1','진경선','EXTERNAL','엠토리움 더 질문 수석강사','ASSISTANT'),
  ('P16','1','서봉한','INTERNAL','울산과학대학교 스포츠재활학부 전임','LECTURER'),
  ('P16','2','조경호','EXTERNAL','K-스포츠재활운동과학연구소 대표','LECTURER'),
  ('P16','1','우철호','EXTERNAL','한국스포츠산업인력개발원㈜ 대표','ASSISTANT')
;

CREATE TEMP TABLE plan_people ON COMMIT DROP AS
SELECT person_name,kind,affiliation,
  CASE WHEN bool_or(teaching_role='LECTURER') THEN 'LECTURER' ELSE 'ASSISTANT' END AS teaching_role,
  NULL::uuid AS person_id
FROM plan_staff GROUP BY person_name,kind,affiliation;
CREATE UNIQUE INDEX plan_people_identity ON plan_people(person_name,kind,affiliation);

DO $roster$
DECLARE
  anchor_org uuid;
  seed_actor uuid;
  center_id uuid;
  placeholder_id uuid;
  candidate_count integer;
  person record;
  new_person_id uuid;
  prior record;
BEGIN
  SELECT id INTO anchor_org FROM public.life_organizations WHERE slug='uc-anchor';
  SELECT p.id INTO seed_actor FROM public.life_people p
  JOIN public.life_auth_links link ON link.person_id=p.id
  JOIN public.life_role_assignments role ON role.person_id=p.id AND role.org_id=anchor_org
  WHERE p.active AND role.role='COURSE_MANAGER' AND role.valid_from<=now()
    AND (role.valid_until IS NULL OR role.valid_until>now())
  ORDER BY p.id LIMIT 1;
  IF anchor_org IS NULL OR seed_actor IS NULL THEN RAISE EXCEPTION 'ANCHOR_MANAGER_REQUIRED'; END IF;
  IF (SELECT count(*) FROM plan_staff)<>43 OR
     (SELECT count(*) FROM plan_people)<>39 OR
     (SELECT count(*) FROM plan_people WHERE kind='INTERNAL')<>9 OR
     (SELECT count(*) FROM plan_people WHERE kind='EXTERNAL')<>30 OR
     (SELECT count(DISTINCT source_id) FROM plan_staff)<>16 OR
     (SELECT count(*) FROM public.life_course_budgets WHERE org_id=anchor_org AND source_id ~ '^P[0-9]{2}$')<>16 OR
     EXISTS(SELECT 1 FROM plan_staff s LEFT JOIN public.life_course_budgets b
       ON b.org_id=anchor_org AND b.source_id=s.source_id WHERE b.guide_id IS NULL)
  THEN RAISE EXCEPTION 'PLAN_STAFF_SOURCE_MISMATCH'; END IF;

  -- Reuse only an unambiguous existing pool identity. Never link an auth user by name.
  IF EXISTS (
    SELECT 1 FROM plan_people s WHERE (
      SELECT count(*) FROM life_private.instructor_pool x
      JOIN public.life_people p ON p.id=x.person_id
      WHERE x.org_id=anchor_org AND p.active AND p.name=s.person_name AND x.kind=s.kind
        AND (x.affiliation=s.affiliation OR
          ((SELECT count(*) FROM plan_people s2 WHERE s2.person_name=s.person_name AND s2.kind=s.kind)=1
           AND (SELECT count(*) FROM life_private.instructor_pool x2 JOIN public.life_people p2 ON p2.id=x2.person_id
             WHERE x2.org_id=anchor_org AND p2.active AND p2.name=s.person_name AND x2.kind=s.kind)=1))) > 1
  ) THEN RAISE EXCEPTION 'AMBIGUOUS_INSTRUCTOR_IDENTITY'; END IF;

  UPDATE plan_people s SET person_id=x.person_id
  FROM life_private.instructor_pool x JOIN public.life_people p ON p.id=x.person_id
  WHERE x.org_id=anchor_org AND p.active AND p.name=s.person_name AND x.kind=s.kind
    AND (x.affiliation=s.affiliation OR
      ((SELECT count(*) FROM plan_people s2 WHERE s2.person_name=s.person_name AND s2.kind=s.kind)=1
       AND (SELECT count(*) FROM life_private.instructor_pool x2 JOIN public.life_people p2 ON p2.id=x2.person_id
         WHERE x2.org_id=anchor_org AND p2.active AND p2.name=s.person_name AND x2.kind=s.kind)=1));

  FOR person IN SELECT * FROM plan_people WHERE person_id IS NULL ORDER BY kind,person_name,affiliation LOOP
    -- A same-name member without a matching affiliation remains a separate provisional person.
    INSERT INTO public.life_people(name) VALUES(person.person_name) RETURNING id INTO new_person_id;
    UPDATE plan_people SET person_id=new_person_id
      WHERE person_name=person.person_name AND kind=person.kind AND affiliation=person.affiliation;
    INSERT INTO life_private.instructor_pool
      (org_id,person_id,registration_key,kind,teaching_role,affiliation,documents_required,status,notes,created_by,updated_by)
    VALUES(anchor_org,new_person_id,gen_random_uuid(),person.kind,person.teaching_role,person.affiliation,
      person.kind='EXTERNAL','ACTIVE','2026 운영계획서 강사현황 · 계정/신원 확인 전 명단 등록',seed_actor,seed_actor);
    INSERT INTO life_private.account_classifications(person_id,instructor_kind,updated_by)
      VALUES(new_person_id,person.kind,seed_actor);
    INSERT INTO public.life_audit_events(org_id,actor_id,action,entity_id,details)
      VALUES(anchor_org,seed_actor,'PLAN_INSTRUCTOR_POOL_CREATED',new_person_id,
        jsonb_build_object('source','2026 operating plans','kind',person.kind,'authenticated',false));
  END LOOP;

  -- Fill only blank imported affiliations. Correct the 2026 golf assistant's seeded role.
  UPDATE life_private.instructor_pool x
  SET affiliation=CASE WHEN x.affiliation='' THEN s.affiliation ELSE x.affiliation END,
      teaching_role=CASE WHEN x.revision=1 AND x.affiliation='' AND s.teaching_role='ASSISTANT'
        THEN 'ASSISTANT' ELSE x.teaching_role END,
      revision=x.revision+1,updated_by=seed_actor,updated_at=now()
  FROM plan_people s WHERE x.org_id=anchor_org AND x.person_id=s.person_id
    AND (x.affiliation='' OR (x.revision=1 AND x.teaching_role<>'ASSISTANT' AND s.teaching_role='ASSISTANT' AND x.affiliation=''));

  UPDATE plan_staff s SET person_id=p.person_id FROM plan_people p
    WHERE p.person_name=s.person_name AND p.kind=s.kind AND p.affiliation=s.affiliation;
  IF EXISTS(SELECT 1 FROM plan_staff WHERE person_id IS NULL) THEN RAISE EXCEPTION 'PLAN_STAFF_UNLINKED'; END IF;
  INSERT INTO life_private.instructor_plan_roster(org_id,guide_id,person_id,teaching_role,source_order,source_id)
  SELECT anchor_org,b.guide_id,s.person_id,s.teaching_role,s.source_order,s.source_id
  FROM plan_staff s JOIN public.life_course_budgets b ON b.org_id=anchor_org AND b.source_id=s.source_id;
  IF (SELECT count(*) FROM life_private.instructor_plan_roster WHERE org_id=anchor_org)<>43
  THEN RAISE EXCEPTION 'PLAN_ROSTER_COUNT_MISMATCH'; END IF;

  -- A verified center-head member, when present, supersedes the earlier name-only placeholder.
  SELECT count(*),(array_agg(p.id))[1] INTO candidate_count,center_id
  FROM life_private.manual_members m JOIN public.life_people p ON p.id=m.person_id
  JOIN life_private.account_classifications c ON c.person_id=p.id
  WHERE m.org_id=anchor_org AND m.member_group='office' AND c.office_position='CENTER_HEAD'
    AND p.name='현용환' AND p.active;
  IF candidate_count>1 THEN RAISE EXCEPTION 'AMBIGUOUS_CENTER_HEAD'; END IF;
  IF center_id IS NULL THEN
    SELECT count(DISTINCT g.initial_responsible_id),(array_agg(g.initial_responsible_id))[1]
      INTO candidate_count,placeholder_id
    FROM public.life_course_guides g JOIN public.life_people p ON p.id=g.initial_responsible_id
    WHERE g.year=2026 AND g.initial_responsible_basis='CENTER_DIRECTOR' AND p.name='현용환';
    IF candidate_count<>1 THEN RAISE EXCEPTION 'CENTER_HEAD_PLACEHOLDER_MISSING'; END IF;
    center_id:=placeholder_id;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM life_private.instructor_pool WHERE org_id=anchor_org AND person_id=center_id) THEN
    INSERT INTO life_private.instructor_pool
      (org_id,person_id,registration_key,kind,teaching_role,affiliation,position,specialty,documents_required,status,notes,created_by,updated_by)
    VALUES(anchor_org,center_id,gen_random_uuid(),'INTERNAL','LECTURER','울산과학대학교','센터장','교육과정 책임',false,'ACTIVE',
      '교외 강사만 있는 2026 과정의 책임강사 · 운영계획서 실강의 명단에는 없음',seed_actor,seed_actor);
  END IF;
  INSERT INTO life_private.account_classifications(person_id,instructor_kind,updated_by)
    VALUES(center_id,'INTERNAL',seed_actor)
    ON CONFLICT(person_id) DO UPDATE SET instructor_kind='INTERNAL',updated_by=seed_actor,updated_at=now();
  IF NOT EXISTS(SELECT 1 FROM public.life_role_assignments
    WHERE person_id=center_id AND org_id=anchor_org AND role='INSTRUCTOR'
      AND valid_from<=now() AND (valid_until IS NULL OR valid_until>now())) THEN
    INSERT INTO public.life_role_assignments(person_id,org_id,role)
      VALUES(center_id,anchor_org,'INSTRUCTOR');
  END IF;

  CREATE TEMP TABLE expected_plan_responsibles ON COMMIT DROP AS
  SELECT b.guide_id,b.source_id,g.offering_id,
    coalesce((SELECT s.person_id FROM plan_staff s
      WHERE s.source_id=b.source_id AND s.kind='INTERNAL' AND s.teaching_role='LECTURER'
      ORDER BY s.source_order LIMIT 1),center_id) AS person_id,
    CASE WHEN EXISTS(SELECT 1 FROM plan_staff s WHERE s.source_id=b.source_id AND s.kind='INTERNAL' AND s.teaching_role='LECTURER')
      THEN 'FIRST_INTERNAL' ELSE 'CENTER_DIRECTOR' END AS basis
  FROM public.life_course_budgets b JOIN public.life_course_guides g ON g.id=b.guide_id AND g.year=2026
  WHERE b.org_id=anchor_org;
  IF (SELECT count(*) FROM expected_plan_responsibles)<>16 OR
     (SELECT count(*) FROM expected_plan_responsibles WHERE basis='FIRST_INTERNAL')<>10 OR
     (SELECT count(*) FROM expected_plan_responsibles WHERE basis='CENTER_DIRECTOR')<>6 OR
     EXISTS(SELECT 1 FROM expected_plan_responsibles e JOIN public.life_course_guides g ON g.id=e.guide_id
       WHERE e.basis='FIRST_INTERNAL' AND g.initial_instructor_id IS DISTINCT FROM e.person_id)
  THEN RAISE EXCEPTION 'RESPONSIBLE_SOURCE_MISMATCH'; END IF;
  IF EXISTS(SELECT 1 FROM expected_plan_responsibles e
    JOIN public.life_operation_responsibilities r ON r.offering_id=e.offering_id
    WHERE r.person_id IS DISTINCT FROM e.person_id)
  THEN RAISE EXCEPTION 'EXISTING_RESPONSIBLE_REVIEW_REQUIRED'; END IF;
  UPDATE public.life_course_guides g
    SET initial_responsible_id=e.person_id,initial_responsible_basis=e.basis
    FROM expected_plan_responsibles e WHERE g.id=e.guide_id
      AND (g.initial_responsible_id,g.initial_responsible_basis) IS DISTINCT FROM (e.person_id,e.basis);
  INSERT INTO public.life_offering_instructors(offering_id,person_id)
    SELECT offering_id,person_id FROM expected_plan_responsibles WHERE offering_id IS NOT NULL
    ON CONFLICT(offering_id,person_id) DO UPDATE SET valid_until=NULL
      WHERE public.life_offering_instructors.valid_until IS NOT NULL;
  INSERT INTO public.life_operation_responsibilities(offering_id,person_id,updated_by)
    SELECT offering_id,person_id,seed_actor FROM expected_plan_responsibles WHERE offering_id IS NOT NULL
    ON CONFLICT(offering_id) DO NOTHING;
  INSERT INTO public.life_audit_events(org_id,actor_id,action,entity_id,details)
    SELECT anchor_org,seed_actor,'PLAN_RESPONSIBLE_INSTRUCTOR_ASSIGNED',e.offering_id,
      jsonb_build_object('source_id',e.source_id,'guide_id',e.guide_id,'basis',e.basis,'person_id',e.person_id)
    FROM expected_plan_responsibles e WHERE e.offering_id IS NOT NULL;
END $roster$;

create or replace function life_private.member_affiliations() returns table(person_id uuid,org_id uuid)
language sql stable security definer set search_path='' as $$
  select r.person_id,r.org_id from public.life_role_assignments r
  where r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
  union select c.person_id,p.org_id from public.life_consent_events c join public.life_policy_versions p on p.id=c.policy_id where c.accepted
  union select a.person_id,o.org_id from public.life_applications a join public.life_offerings o on o.id=a.offering_id
  union select i.person_id,o.org_id from public.life_offering_instructors i join public.life_offerings o on o.id=i.offering_id
  union select d.person_id,d.org_id from public.life_instructor_dossiers d
  union select m.person_id,m.org_id from life_private.manual_members m
  union select a.person_id,e.org_id from life_private.member_entry_operators e join public.life_auth_links a on a.auth_user_id=e.auth_user_id
  union select x.person_id,x.org_id from life_private.instructor_pool x where x.status='ACTIVE'
$$;

create or replace function life_private.member_scope_for(p_write boolean) returns table(person_id uuid,is_office boolean,is_instructor boolean,is_learner boolean)
language sql stable security definer set search_path='' as $$
  with admins as materialized (
    select distinct r.org_id from public.life_role_assignments r
    where r.person_id=(select life_private.person_id()) and r.role='SYSTEM_ADMIN'
      and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
    union select org_id from life_private.member_entry_orgs() where not p_write
  ), permitted as (
    select a.person_id from life_private.member_affiliations() a
    group by a.person_id having bool_and(a.org_id in (select org_id from admins))
      -- The designated chief belongs in their own office roster even when they
      -- also operate courses for another organization. Keep write scope strict.
      or (not p_write and exists(
        select 1 from life_private.member_entry_operators e
        join public.life_auth_links l on l.auth_user_id=e.auth_user_id
        where e.slot='SUPER_ADMIN' and l.person_id=a.person_id and e.org_id in (select org_id from admins)
      ))
  ), roles as (
    select r.person_id,bool_or(r.role<>'INSTRUCTOR') office,bool_or(r.role='INSTRUCTOR') instructor
    from public.life_role_assignments r where r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()) group by r.person_id
  )
  select p.id,(coalesce(r.office,false) or coalesce(m.member_group='office',false) or exists(select 1 from life_private.member_entry_operators e where e.auth_user_id=u.id)),(coalesce(r.instructor,false) or coalesce(m.member_group='instructor',false) or (not p_write and exists(select 1 from life_private.instructor_pool x where x.person_id=p.id and x.status='ACTIVE'))),
    ((r.person_id is null and m.person_id is null and not exists(select 1 from life_private.member_entry_operators e where e.auth_user_id=u.id) and not exists(select 1 from life_private.instructor_pool x where x.person_id=p.id and x.status='ACTIVE')) or coalesce(m.member_group='learner',false) or exists(select 1 from public.life_applications a where a.person_id=p.id))
  from permitted s join public.life_people p on p.id=s.person_id
  left join public.life_auth_links a on a.person_id=p.id left join auth.users u on u.id=a.auth_user_id
  left join life_private.manual_members m on m.person_id=p.id
  left join roles r on r.person_id=p.id
  where p.active and (u.id is not null or m.person_id is not null or (not p_write and exists(select 1 from life_private.instructor_pool x where x.person_id=p.id and x.status='ACTIVE'))) and u.deleted_at is null and exists(select 1 from admins)
$$;

create or replace function life_private.member_directory(p_group text,p_query text,p_page integer,p_person uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if life_private.person_id() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.life_role_assignments r where r.person_id=life_private.person_id() and r.role='SYSTEM_ADMIN' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())) and not exists(select 1 from life_private.member_entry_orgs()) then raise exception 'FORBIDDEN'; end if;
  if p_group is null or p_group not in ('office','instructor','learner') or p_page is null or p_page not between 1 and 100000 or p_query is null or length(p_query)>100 then raise exception 'INVALID_INPUT'; end if;
  with scope as materialized (select * from life_private.member_scope_for(false)),
  managed as materialized (select person_id from life_private.member_scope()),
  filtered as materialized (
    select p.id,p.name,coalesce(u.email,mm.email) email,u.id auth_user_id,(mm.person_id is not null and u.id is null) is_manual,(mm.person_id is not null and u.email_confirmed_at is not null) account_verified,
      exists(select 1 from life_private.member_entry_operators e where e.auth_user_id=u.id and e.slot='SUPER_ADMIN') is_super_admin,
      case when p_group='office' then case c.office_position
        when 'DIRECTOR' then 1 when 'DIVISION_HEAD' then 2 when 'CENTER_HEAD' then 3 when 'OPERATIONS_HEAD' then 4
        when 'PRINCIPAL_RESEARCHER' then 5 when 'SENIOR_RESEARCHER' then 6 when 'RESEARCHER' then 7 else 8 end else 0 end position_order,
      s.is_office,s.is_instructor,s.is_learner,
      (pool.person_id is not null and mm.person_id is null and u.id is null) is_pool_only,pool.org_id pool_org_id
    from scope s join public.life_people p on p.id=s.person_id
    left join public.life_auth_links a on a.person_id=p.id left join auth.users u on u.id=a.auth_user_id
    left join life_private.manual_members mm on mm.person_id=p.id
    left join life_private.account_classifications c on c.person_id=p.id
    left join lateral (select x.person_id,x.org_id from life_private.instructor_pool x where x.person_id=p.id and x.status='ACTIVE' order by x.org_id limit 1) pool on true
    where (case p_group when 'office' then s.is_office when 'instructor' then s.is_instructor else s.is_learner end)
      and (p_person is null or p.id=p_person)
      and (p_query='' or strpos(lower(p.name),lower(p_query))>0 or strpos(lower(coalesce(u.email,mm.email,'')),lower(p_query))>0)
  ), selected as (
    select * from filtered order by position_order,case when p_group='office' then name end collate pg_catalog."ko-x-icu",name,id limit 20 offset ((p_page-1)*20)
  ), page as (
    select s.id,s.name,s.email,s.position_order,s.is_manual,s.account_verified,s.is_super_admin,
      s.is_office,s.is_instructor,s.is_learner,s.is_pool_only,s.pool_org_id,c.office_position,coalesce(c.instructor_kind,pool.kind) instructor_kind,
      m.office_phone,coalesce(m.mobile_phone,lc.phone) mobile_phone,coalesce(m.instructor_phone,pool.phone) instructor_phone,m.birth_date,
      coalesce(m.notes,pool.notes,'') notes,coalesce(m.revision,0) revision,
      exists(select 1 from managed w where w.person_id=s.id) can_manage,
      (exists(select 1 from managed w where w.person_id=s.id) or life_private.chief_member_self_edit(s.id,p_group)) can_edit,
      case when p_group='learner' then coalesce((
        select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.starts_on,o.id)
        from public.life_enrollments e join public.life_offerings o on o.id=e.offering_id
        where e.person_id=s.id and e.status='ACTIVE'
          and o.starts_on < (date_trunc('year',timezone('Asia/Seoul',now()))+interval '1 year')::date
          and o.ends_on >= date_trunc('year',timezone('Asia/Seoul',now()))::date
      ),'[]'::jsonb) else '[]'::jsonb end current_courses
    from selected s left join life_private.account_classifications c on c.person_id=s.id
    left join life_private.member_profiles m on m.person_id=s.id
    left join life_private.learner_contacts lc on lc.user_id=s.auth_user_id
    left join lateral (select x.kind,x.phone,x.notes from life_private.instructor_pool x where x.person_id=s.id and x.status='ACTIVE' and x.org_id=s.pool_org_id limit 1) pool on true
  )
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page)-'position_order' order by position_order,case when p_group='office' then name end collate pg_catalog."ko-x-icu",name,id) from page),'[]'::jsonb),
    'total',(select count(*) from filtered),'page',p_page,'page_size',20,'current_year',extract(year from timezone('Asia/Seoul',now()))::int,
    'counts',jsonb_build_object('office',(select count(*) from scope where is_office),'instructor',(select count(*) from scope where is_instructor),'learner',(select count(*) from scope where is_learner))) into result;
  return result;
end $$;

NOTIFY pgrst,'reload schema';

COMMIT;
