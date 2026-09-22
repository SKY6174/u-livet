begin;
create table public.life_operation_responsibilities (
 offering_id uuid primary key references public.life_offerings(id), person_id uuid not null references public.life_people(id),
 revision integer not null default 1, updated_at timestamptz not null default now(), updated_by uuid not null references public.life_people(id)
);
create index life_operation_responsible_person on public.life_operation_responsibilities(person_id,offering_id);
create table public.life_operation_documents (
 offering_id uuid not null references public.life_offerings(id), kind text not null check(kind in ('plan','result')),
 content jsonb not null, budget jsonb not null, status text not null default 'DRAFT' check(status in ('DRAFT','REVIEW','SUBMITTED')),
 revision integer not null default 1 check(revision>0), updated_at timestamptz not null default now(), updated_by uuid not null references public.life_people(id),
 reviewed_at timestamptz, reviewed_by uuid references public.life_people(id), submitted_at timestamptz, submitted_by uuid references public.life_people(id),
 return_note text not null default '', primary key(offering_id,kind)
);
create table public.life_operation_submissions (
 id uuid primary key default gen_random_uuid(), offering_id uuid not null references public.life_offerings(id), kind text not null check(kind in ('plan','result')),
 content jsonb not null, budget jsonb not null, revision integer not null, submitted_at timestamptz not null default now(), submitted_by uuid not null references public.life_people(id),
 unique(offering_id,kind,revision)
);
create function life_private.freeze_operation_submission() returns trigger language plpgsql set search_path='' as $$begin raise exception 'SUBMISSION_IMMUTABLE';end$$;
create trigger life_operation_submission_immutable before update or delete on public.life_operation_submissions for each row execute function life_private.freeze_operation_submission();

create function life_private.operation_manager(f uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.life_offerings o where o.id=f and (life_private.has_role(o.org_id,'COURSE_MANAGER') or life_private.has_role(o.org_id,'SYSTEM_ADMIN')))
$$;
create function life_private.operation_access(f uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and life_private.person_id() is not null and life_private.mfa_verified() and (life_private.operation_manager(f) or (life_private.teaches(f) and exists(select 1 from public.life_operation_responsibilities r where r.offering_id=f and r.person_id=life_private.person_id())))
$$;
create function life_private.operation_list() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not life_private.mfa_verified() then raise exception 'FORBIDDEN';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'starts_on',o.starts_on,'ends_on',o.ends_on,'manager',life_private.operation_manager(o.id),'responsible',p.name,'plan_status',d.status,'result_status',r.status) order by o.starts_on desc,o.name)
 from public.life_offerings o left join public.life_operation_responsibilities a on a.offering_id=o.id left join public.life_people p on p.id=a.person_id
 left join public.life_operation_documents d on d.offering_id=o.id and d.kind='plan' left join public.life_operation_documents r on r.offering_id=o.id and r.kind='result'
 where life_private.operation_access(o.id)), '[]'::jsonb);
end$$;
create function life_private.operation_context(f uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not life_private.operation_access(f) then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object('manager',life_private.operation_manager(f),
 'course',(select jsonb_build_object('id',o.id,'name',o.name,'academy',c.academy,'starts_on',o.starts_on,'ends_on',o.ends_on,'capacity',o.capacity,'summary',v.summary,'curriculum',v.curriculum,'location',o.location,'status',o.status,'org_id',o.org_id) from public.life_offerings o join public.life_course_versions v on v.id=o.course_version_id join public.life_courses c on c.id=v.course_id where o.id=f),
 'responsible',(select jsonb_build_object('person_id',r.person_id,'name',p.name,'revision',r.revision) from public.life_operation_responsibilities r join public.life_people p on p.id=r.person_id where r.offering_id=f),
 'candidates',case when life_private.operation_manager(f) then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name) from public.life_offering_instructors i join public.life_people p on p.id=i.person_id join public.life_offerings o on o.id=i.offering_id where i.offering_id=f and p.active and (i.valid_until is null or i.valid_until>now()) and exists(select 1 from public.life_role_assignments a where a.person_id=p.id and a.org_id=o.org_id and a.role='INSTRUCTOR' and a.valid_from<=now() and (a.valid_until is null or a.valid_until>now()))),'[]'::jsonb) else '[]'::jsonb end,
 'documents',coalesce((select jsonb_agg(to_jsonb(d)-'offering_id'-'updated_by'-'reviewed_by'-'submitted_by') from public.life_operation_documents d where d.offering_id=f),'[]'::jsonb),
 'legacy',(select r.payload-'participants'-'scholarships'-'fees' from public.life_course_reports r where r.offering_id=f),
 'sessions',coalesce((select jsonb_agg(jsonb_build_object('title',s.title,'starts_at',s.starts_at,'ends_at',s.ends_at) order by s.starts_at) from public.life_class_sessions s where s.offering_id=f and s.status='SCHEDULED'),'[]'::jsonb),
 'submissions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'kind',s.kind,'revision',s.revision,'submitted_at',s.submitted_at,'name',p.name) order by s.submitted_at desc) from public.life_operation_submissions s join public.life_people p on p.id=s.submitted_by where s.offering_id=f),'[]'::jsonb));
end$$;
create function life_private.operation_assign(f uuid,p uuid,expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare prior integer; begin
 if not life_private.operation_access(f) or not life_private.operation_manager(f) then raise exception 'FORBIDDEN';end if;
 perform 1 from public.life_offerings where id=f for update;
 select revision into prior from public.life_operation_responsibilities where offering_id=f;
 if coalesce(prior,0) is distinct from expected_revision then raise exception 'REVISION_CHANGED';end if;
 if not exists(select 1 from public.life_offering_instructors i join public.life_offerings o on o.id=i.offering_id join public.life_people pp on pp.id=i.person_id where i.offering_id=f and i.person_id=p and pp.active and (i.valid_until is null or i.valid_until>now()) and exists(select 1 from public.life_role_assignments a where a.person_id=p and a.org_id=o.org_id and a.role='INSTRUCTOR' and a.valid_from<=now() and (a.valid_until is null or a.valid_until>now()))) then raise exception 'INVALID_RESPONSIBLE';end if;
 insert into public.life_operation_responsibilities(offering_id,person_id,updated_by) values(f,p,life_private.person_id()) on conflict(offering_id) do update set person_id=p,revision=public.life_operation_responsibilities.revision+1,updated_at=now(),updated_by=life_private.person_id();
 update public.life_operation_documents set status='DRAFT',reviewed_at=null,reviewed_by=null,revision=revision+1,return_note='책임강사가 변경되어 내용을 다시 확인해야 합니다.',updated_at=now(),updated_by=life_private.person_id() where offering_id=f and status<>'SUBMITTED';
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details) select org_id,life_private.person_id(),'OPERATION_RESPONSIBLE_ASSIGNED',f,jsonb_build_object('person_id',p) from public.life_offerings where id=f;
end$$;
-- Schema definition is generated from src/lib/operation-documents/schema.ts below.
create function life_private.operation_schema(k text) returns jsonb language sql immutable set search_path='' as $fn$select $schema${"plan":{"fields":[{"key":"title","label":"과정명","type":"text","required":true,"max":500},{"key":"year","label":"학년도","type":"number","required":true,"max":12},{"key":"academy","label":"영역 / 아카데미","type":"text","required":true,"max":500},{"key":"program","label":"세부프로그램명","type":"text","required":true,"max":500},{"key":"professor","label":"담당 교수 / 책임강사","type":"text","required":true,"max":500},{"key":"documentDate","label":"작성일","type":"date","required":true,"max":500},{"key":"startsOn","label":"교육 시작일","type":"date","required":true,"max":500},{"key":"endsOn","label":"교육 종료일","type":"date","required":true,"max":500},{"key":"audience","label":"주요대상 (성인학습자 / 지역주민)","type":"text","required":true,"max":500},{"key":"content","label":"1-2. 주요내용","type":"long","required":true,"max":5000},{"key":"method","label":"1-3. 교육방법","type":"long","required":true,"max":5000},{"key":"effects","label":"1-4. 기대효과","type":"long","required":true,"max":5000},{"key":"capacity","label":"가. 모집인원","type":"number","required":true,"max":12},{"key":"purposes","label":"다. 주요목적 (자격증 / 취창업 / 취미·여가 / 자기계발 / 진로진학 / 기타)","type":"text","required":true,"max":500},{"key":"partner","label":"거버넌스 기관명","type":"text","required":true,"max":500},{"key":"partnerField","label":"거버넌스 기관 분야","type":"text","required":true,"max":500},{"key":"partnerDevelopment","label":"교육과정개발 연계","type":"long","required":true,"max":5000},{"key":"partnerEmployment","label":"취·창업 연계","type":"long","required":true,"max":5000},{"key":"partnerInternship","label":"인턴십 연계","type":"long","required":true,"max":5000},{"key":"partnerService","label":"봉사 및 기여활동","type":"long","required":true,"max":5000},{"key":"partnerFollowUp","label":"교육종료 후 활성화 방안","type":"long","required":true,"max":5000},{"key":"qualificationNote","label":"자격증 과정 해당 여부 / 비해당 사유","type":"text","required":true,"max":500},{"key":"issuerInfo","label":"민간자격 발급기관 정보 (기관명·대표자·연락처·이메일·소재지·홈페이지)","type":"long","required":false,"max":5000},{"key":"refundPolicy","label":"민간자격 환불규정","type":"long","required":false,"max":5000},{"key":"staffNote","label":"보조강사·보조인력 해당 여부 및 비고","type":"long","required":true,"max":5000}],"tables":[{"key":"recruitment","label":"나. 주요대상","columns":[{"key":"category","label":"구분","type":"text","required":false,"max":500},{"key":"count","label":"인원","type":"number","required":false,"max":12},{"key":"ratio","label":"비율 (%)","type":"number","required":false,"max":12}],"min":1,"max":9},{"key":"national","label":"가. 국가자격증","columns":[{"key":"name","label":"자격명 (자격종류)","type":"text","required":false,"max":500},{"key":"issuer","label":"발급기관명 (홈페이지)","type":"text","required":false,"max":500},{"key":"exam","label":"시험일정","type":"text","required":false,"max":500},{"key":"cost","label":"응시료·자격발급비","type":"text","required":false,"max":500},{"key":"refund","label":"자격발급 환불규정","type":"text","required":false,"max":500},{"key":"contact","label":"연락처","type":"text","required":false,"max":500}],"min":0,"max":10},{"key":"private","label":"나. 민간자격증","columns":[{"key":"name","label":"자격명","type":"text","required":false,"max":500},{"key":"kind","label":"자격의 종류","type":"text","required":false,"max":500},{"key":"registration","label":"등록번호","type":"text","required":false,"max":500},{"key":"issuer","label":"자격발급기관","type":"text","required":false,"max":500},{"key":"cost","label":"총비용 및 세부내역","type":"text","required":false,"max":500}],"min":0,"max":10},{"key":"schedule","label":"회차별 강의계획","columns":[{"key":"date","label":"일시","type":"text","required":false,"max":500},{"key":"topic","label":"강의주제 및 내용","type":"text","required":false,"max":500},{"key":"instructor","label":"강사명","type":"text","required":false,"max":500},{"key":"hours","label":"교육시간","type":"number","required":false,"max":12},{"key":"assistant","label":"보조강사명","type":"text","required":false,"max":500},{"key":"assistantHours","label":"보조 교육시간","type":"number","required":false,"max":12},{"key":"location","label":"교육장소","type":"text","required":false,"max":500},{"key":"mode","label":"수업방식","type":"text","required":false,"max":500},{"key":"holiday","label":"공휴일 수업여부 / 보강 날짜","type":"text","required":false,"max":500}],"min":1,"max":60},{"key":"instructors","label":"6. 강사현황","columns":[{"key":"affiliation","label":"소속","type":"text","required":false,"max":500},{"key":"position","label":"직위","type":"text","required":false,"max":500},{"key":"name","label":"성명","type":"text","required":false,"max":500},{"key":"theory","label":"이론 시수","type":"number","required":false,"max":12},{"key":"practice","label":"실습 시수","type":"number","required":false,"max":12}],"min":1,"max":60},{"key":"assistants","label":"7. 보조강사현황","columns":[{"key":"affiliation","label":"소속","type":"text","required":false,"max":500},{"key":"position","label":"직위","type":"text","required":false,"max":500},{"key":"name","label":"성명","type":"text","required":false,"max":500},{"key":"hours","label":"근무시수","type":"number","required":false,"max":12},{"key":"note","label":"비고","type":"text","required":false,"max":500}],"min":0,"max":60},{"key":"support","label":"8. 보조인력 현황","columns":[{"key":"department","label":"학과","type":"text","required":false,"max":500},{"key":"studentId","label":"학번","type":"text","required":false,"max":500},{"key":"name","label":"성명","type":"text","required":false,"max":500},{"key":"hours","label":"근무시수","type":"number","required":false,"max":12},{"key":"note","label":"비고","type":"text","required":false,"max":500}],"min":0,"max":60}]},"result":{"fields":[{"key":"title","label":"과정명","type":"text","required":true,"max":500},{"key":"year","label":"학년도","type":"number","required":true,"max":12},{"key":"academy","label":"영역 / 아카데미","type":"text","required":true,"max":500},{"key":"program","label":"세부프로그램명","type":"text","required":true,"max":500},{"key":"professor","label":"담당 교수 / 책임강사","type":"text","required":true,"max":500},{"key":"documentDate","label":"작성일","type":"date","required":true,"max":500},{"key":"startsOn","label":"교육 시작일","type":"date","required":true,"max":500},{"key":"endsOn","label":"교육 종료일","type":"date","required":true,"max":500},{"key":"content","label":"2. 주요내용","type":"long","required":true,"max":5000},{"key":"capacity","label":"모집정원","type":"number","required":true,"max":12},{"key":"enrolled","label":"모집인원","type":"number","required":true,"max":12},{"key":"completed","label":"수료인원","type":"number","required":true,"max":12},{"key":"certificates","label":"자격증 취득 수","type":"number","required":true,"max":12},{"key":"employed","label":"취창업인원","type":"number","required":true,"max":12},{"key":"surveyResponses","label":"이수자 교육만족 응답수","type":"number","required":true,"max":12},{"key":"satisfaction","label":"교육만족도율 (%)","type":"number","required":true,"max":12},{"key":"photoNote","label":"운영사진 설명 / 미첨부 사유","type":"long","required":true,"max":5000},{"key":"method","label":"교육방법","type":"long","required":true,"max":5000},{"key":"education","label":"교육내용","type":"long","required":true,"max":5000},{"key":"promotion","label":"교육생 모집 홍보","type":"long","required":true,"max":5000},{"key":"other","label":"기타","type":"long","required":true,"max":5000},{"key":"strengths","label":"우수한 점","type":"long","required":true,"max":5000},{"key":"strengthsNote","label":"우수한 점 비고","type":"text","required":false,"max":500},{"key":"improvements","label":"개선할 점","type":"long","required":true,"max":5000},{"key":"improvementsNote","label":"개선할 점 비고","type":"text","required":false,"max":500},{"key":"followUp","label":"환류 계획","type":"long","required":true,"max":5000},{"key":"followUpNote","label":"환류 계획 비고","type":"text","required":false,"max":500}],"tables":[{"key":"schedule","label":"회차별 교육 내역","columns":[{"key":"date","label":"일시","type":"text","required":false,"max":500},{"key":"topic","label":"강의주제 및 내용","type":"text","required":false,"max":500},{"key":"instructor","label":"강사명","type":"text","required":false,"max":500},{"key":"hours","label":"교육시간","type":"number","required":false,"max":12},{"key":"assistant","label":"보조강사명","type":"text","required":false,"max":500},{"key":"assistantHours","label":"보조 교육시간","type":"number","required":false,"max":12},{"key":"location","label":"교육장소","type":"text","required":false,"max":500}],"min":1,"max":60}]}}$schema$::jsonb->k$fn$;
create function life_private.operation_field(value jsonb, spec jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare s text;begin
 if jsonb_typeof(value) is distinct from 'string' then return false;end if;
 s:=value#>>'{}';if length(s)>(spec->>'max')::integer then return false;end if;
 if s='' then return true;end if;
 if spec->>'type'='number' then return s~'^\d{1,9}(\.\d{1,2})?$' and (spec->>'key' not in ('ratio','satisfaction') or s::numeric<=100);end if;
 if spec->>'type'='date' then return s~'^\d{4}-\d{2}-\d{2}$' and to_char(s::date,'YYYY-MM-DD')=s;end if;
 return true;
 exception when others then return false;
end$$;
create function life_private.operation_image(v jsonb,lim integer) returns boolean language plpgsql immutable set search_path='' as $$
declare s text;b bytea;begin
 if jsonb_typeof(v) is distinct from 'string' then return false;end if;
 s:=v#>>'{}';if s='' then return true;end if;
 if length(s)>lim or s!~'^data:image/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$' then return false;end if;
 b:=decode(split_part(s,',',2),'base64');
 return (s like 'data:image/png;%' and substring(b from 1 for 8)=decode('89504e470d0a1a0a','hex')) or (s like 'data:image/jpeg;%' and substring(b from 1 for 3)=decode('ffd8ff','hex'));
 exception when others then return false;
end$$;
create function life_private.operation_content_valid(c jsonb,k text,complete boolean default false) returns boolean language plpgsql immutable set search_path='' as $$
declare spec jsonb; x jsonb; t jsonb; r jsonb; col jsonb; ff jsonb; tt jsonb;begin
 if k is null or k not in ('plan','result') or jsonb_typeof(c) is distinct from 'object' or octet_length(c::text)>3000000 then return false;end if;
 if (select count(*) from jsonb_object_keys(c))<>4 or not c ?& array['fields','tables','photos','signature'] or jsonb_typeof(c->'fields') is distinct from 'object' or jsonb_typeof(c->'tables') is distinct from 'object' or jsonb_typeof(c->'photos') is distinct from 'array' then return false;end if;
 spec:=life_private.operation_schema(k);ff:=spec->'fields';tt:=spec->'tables';
 if (select count(*) from jsonb_object_keys(c->'fields'))<>jsonb_array_length(ff) or (select count(*) from jsonb_object_keys(c->'tables'))<>jsonb_array_length(tt) then return false;end if;
 for x in select * from jsonb_array_elements(ff) loop
  if not life_private.operation_field(c->'fields'->(x->>'key'),x) or (complete and coalesce((x->>'required')::boolean,false) and btrim(c->'fields'->>(x->>'key'))='') then return false;end if;
 end loop;
 if c->'fields'->>'startsOn'<>'' and c->'fields'->>'endsOn'<>'' and c->'fields'->>'startsOn'>c->'fields'->>'endsOn' then return false;end if;
 for t in select * from jsonb_array_elements(tt) loop
  if jsonb_typeof(c->'tables'->(t->>'key')) is distinct from 'array' or jsonb_array_length(c->'tables'->(t->>'key'))>(t->>'max')::integer or (complete and jsonb_array_length(c->'tables'->(t->>'key'))<coalesce((t->>'min')::integer,0)) then return false;end if;
  for r in select * from jsonb_array_elements(c->'tables'->(t->>'key')) loop
   if jsonb_typeof(r) is distinct from 'object' or (select count(*) from jsonb_object_keys(r))<>jsonb_array_length(t->'columns') then return false;end if;
   for col in select * from jsonb_array_elements(t->'columns') loop
    if not life_private.operation_field(r->(col->>'key'),col) then return false;end if;
   end loop;
   if complete and t->>'key'='schedule' and (btrim(r->>'date')='' or btrim(r->>'topic')='' or btrim(r->>'instructor')='' or r->>'hours'='' or btrim(r->>'location')='') then return false;end if;
   if complete and t->>'key'='instructors' and btrim(r->>'name')='' then return false;end if;
  end loop;
 end loop;
 if jsonb_array_length(c->'photos')<>(case when k='result' then 6 else 0 end) or not life_private.operation_image(c->'signature',200000) then return false;end if;
 for r in select * from jsonb_array_elements(c->'photos') loop
  if jsonb_typeof(r) is distinct from 'object' or (select count(*) from jsonb_object_keys(r))<>3 or not r ?& array['caption','date','image'] or not life_private.operation_field(r->'caption','{"type":"text","max":100}'::jsonb) or not life_private.operation_field(r->'date','{"type":"date","max":10}'::jsonb) or not life_private.operation_image(r->'image',400000) then return false;end if;
 end loop;
 return true;exception when others then return false;
end$$;
create function life_private.operation_budget_valid(b jsonb,k text,complete boolean default false) returns boolean language plpgsql immutable set search_path='' as $$
declare r jsonb;v text;begin
 if jsonb_typeof(b) is distinct from 'object' or (select count(*) from jsonb_object_keys(b))<>4 or not b ?& array['rows','scholarshipCount','scholarshipAmount','scholarshipNote'] or jsonb_typeof(b->'rows') is distinct from 'array' or jsonb_array_length(b->'rows') not between 1 and 30 then return false;end if;
 foreach v in array array['scholarshipCount','scholarshipAmount'] loop
  if jsonb_typeof(b->v) is distinct from 'string' or (b->>v)!~'^(|\d{1,12})$' or (complete and k='result' and b->>v='') then return false;end if;
 end loop;
 if not life_private.operation_field(b->'scholarshipNote','{"type":"text","max":1000}'::jsonb) then return false;end if;
 for r in select * from jsonb_array_elements(b->'rows') loop
  if jsonb_typeof(r) is distinct from 'object' or (select count(*) from jsonb_object_keys(r))<>5 or not r ?& array['category','calculation','planned','spent','note'] or btrim(r->>'category')='' then return false;end if;
  foreach v in array array['category','calculation','note'] loop if not life_private.operation_field(r->v,'{"type":"text","max":1000}'::jsonb) then return false;end if;end loop;
  foreach v in array array['planned','spent'] loop
   if jsonb_typeof(r->v) is distinct from 'string' or r->>v!~'^(|\d{1,12})$' or (complete and (v='planned' or k='result') and r->>v='') then return false;end if;
  end loop;
 end loop;return true;exception when others then return false;
end$$;
create function life_private.operation_save(f uuid,k text,c jsonb,b jsonb,expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.life_operation_documents; manager boolean; budget_value jsonb;legacy jsonb;begin
 if not life_private.operation_access(f) then raise exception 'FORBIDDEN';end if;
 manager:=life_private.operation_manager(f);
 if not manager and b is not null then raise exception 'BUDGET_FORBIDDEN';end if;
 perform 1 from public.life_offerings where id=f for update;
 select * into d from public.life_operation_documents where offering_id=f and kind=k;
 if coalesce(d.revision,0) is distinct from expected_revision then raise exception 'REVISION_CHANGED';end if;
 if d.status='SUBMITTED' or (d.status='REVIEW' and not manager) then raise exception 'DOCUMENT_LOCKED';end if;
 if not life_private.operation_content_valid(c,k) then raise exception 'INVALID_CONTENT';end if;
 select payload into legacy from public.life_course_reports where offering_id=f;
 budget_value:=coalesce(b,d.budget,jsonb_build_object('rows',case when k='result' and jsonb_array_length(coalesce(legacy->'budgets','[]'::jsonb))>0 then
 (select jsonb_agg(jsonb_build_object('category',r->>'category','calculation','','planned',coalesce(r->>'planned',''),'spent',coalesce(r->>'spent',''),'note',coalesce(r->>'note',''))) from jsonb_array_elements(legacy->'budgets') r)
 else (select jsonb_agg(jsonb_build_object('category',category,'calculation','','planned','','spent','','note','')) from unnest(case when k='plan' then array['내부강사','외부강사','보조강사','보조인력','장학금','운영비','인쇄비','재료비','수강료'] else array['운영비','인쇄비','재료비','강사료'] end) category) end,
 'scholarshipCount',case when k='result' then coalesce(legacy->'sourceReport'->>'scholarshipRecipients','') else '' end,
 'scholarshipAmount',case when k='result' then coalesce(legacy->'sourceReport'->>'scholarshipAmount','') else '' end,'scholarshipNote',''));
 if not life_private.operation_budget_valid(budget_value,k) then raise exception 'INVALID_BUDGET';end if;
 insert into public.life_operation_documents(offering_id,kind,content,budget,updated_by) values(f,k,c,budget_value,life_private.person_id())
 on conflict(offering_id,kind) do update set content=c,budget=budget_value,revision=public.life_operation_documents.revision+1,updated_at=now(),updated_by=life_private.person_id();
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details) select org_id,life_private.person_id(),'OPERATION_DOCUMENT_SAVED',f,jsonb_build_object('kind',k,'revision',coalesce(d.revision,0)+1) from public.life_offerings where id=f;
 return life_private.operation_context(f);
end$$;
create function life_private.operation_transition(f uuid,k text,intent text,expected_revision integer,note text,confirmed boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.life_operation_documents; manager boolean; next_status text;begin
 if not life_private.operation_access(f) then raise exception 'FORBIDDEN';end if;
 manager:=life_private.operation_manager(f);
 perform 1 from public.life_offerings where id=f for update;
 select * into d from public.life_operation_documents where offering_id=f and kind=k;
 if d.revision is null or d.revision is distinct from expected_revision then raise exception 'REVISION_CHANGED';end if;
 if note is null or length(note)>2000 then raise exception 'INVALID_INPUT';end if;
 if intent='review' then
  if d.status<>'DRAFT' then raise exception 'INVALID_TRANSITION';end if;
  if not exists(select 1 from public.life_operation_responsibilities r join public.life_offering_instructors i on i.offering_id=r.offering_id and i.person_id=r.person_id join public.life_offerings o on o.id=r.offering_id join public.life_people p on p.id=r.person_id where r.offering_id=f and p.active and (i.valid_until is null or i.valid_until>now()) and exists(select 1 from public.life_role_assignments a where a.person_id=r.person_id and a.org_id=o.org_id and a.role='INSTRUCTOR' and a.valid_from<=now() and (a.valid_until is null or a.valid_until>now()))) then raise exception 'RESPONSIBLE_REQUIRED';end if;
  if confirmed is distinct from true or not life_private.operation_content_valid(d.content,k,true) then raise exception 'CONTENT_REQUIRED';end if;
  next_status:='REVIEW';
 elsif intent='submit' then
  if not manager then raise exception 'FORBIDDEN';end if;
  if d.status<>'REVIEW' then raise exception 'INVALID_TRANSITION';end if;
  if confirmed is distinct from true or not life_private.operation_budget_valid(d.budget,k,true) then raise exception 'BUDGET_REQUIRED';end if;
  if not life_private.operation_content_valid(d.content,k,true) then raise exception 'CONTENT_REQUIRED';end if;
  next_status:='SUBMITTED';
 elsif intent in ('return','reopen') then
  if not manager then raise exception 'FORBIDDEN';end if;
  if (intent='return' and d.status<>'REVIEW') or (intent='reopen' and d.status<>'SUBMITTED') or btrim(note)='' then raise exception 'REASON_REQUIRED';end if;
  next_status:='DRAFT';
 else raise exception 'INVALID_TRANSITION';end if;
 update public.life_operation_documents set status=next_status,revision=revision+1,updated_at=now(),updated_by=life_private.person_id(),
 reviewed_at=case when intent='review' then now() when next_status='DRAFT' then null else reviewed_at end,
 reviewed_by=case when intent='review' then life_private.person_id() when next_status='DRAFT' then null else reviewed_by end,
 submitted_at=case when next_status='SUBMITTED' then now() else null end,submitted_by=case when next_status='SUBMITTED' then life_private.person_id() else null end,
 return_note=case when next_status='DRAFT' then note else '' end where offering_id=f and kind=k;
 if next_status='SUBMITTED' then insert into public.life_operation_submissions(offering_id,kind,content,budget,revision,submitted_by) values(f,k,d.content,d.budget,d.revision+1,life_private.person_id());end if;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details) select org_id,life_private.person_id(),'OPERATION_DOCUMENT_'||upper(intent),f,jsonb_build_object('kind',k,'revision',d.revision+1,'note',note) from public.life_offerings where id=f;
 return life_private.operation_context(f);
end$$;
create function life_private.operation_submission(f uuid,s uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not life_private.operation_access(f) then raise exception 'FORBIDDEN';end if;
 return (select to_jsonb(d)-'submitted_by'||jsonb_build_object('status','SUBMITTED') from public.life_operation_submissions d where d.offering_id=f and d.id=s);
end$$;
create function public.life_operation_list() returns jsonb language sql stable security invoker set search_path='' as $$select life_private.operation_list()$$;
create function public.life_operation_context(f uuid) returns jsonb language sql stable security invoker set search_path='' as $$select life_private.operation_context(f)$$;
create function public.life_operation_assign(f uuid,p uuid,expected_revision integer) returns void language sql security invoker set search_path='' as $$select life_private.operation_assign(f,p,expected_revision)$$;
create function public.life_operation_save(f uuid,k text,c jsonb,b jsonb,expected_revision integer) returns jsonb language sql security invoker set search_path='' as $$select life_private.operation_save(f,k,c,b,expected_revision)$$;
create function public.life_operation_transition(f uuid,k text,intent text,expected_revision integer,note text,confirmed boolean) returns jsonb language sql security invoker set search_path='' as $$select life_private.operation_transition(f,k,intent,expected_revision,note,confirmed)$$;
create function public.life_operation_submission(f uuid,s uuid) returns jsonb language sql stable security invoker set search_path='' as $$select life_private.operation_submission(f,s)$$;
do $$declare t text;p record;begin
 foreach t in array array['life_operation_responsibilities','life_operation_documents','life_operation_submissions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('create trigger life_recent_mfa_write before insert or update or delete on public.%I for each statement execute function life_private.recent_mfa_write_guard()',t);
 end loop;
 for p in select oid::regprocedure::text sig,proname from pg_proc where pronamespace in ('life_private'::regnamespace,'public'::regnamespace) and (proname like 'operation_%' or proname like 'life_operation_%' or proname='freeze_operation_submission') loop
 execute 'revoke all on function '||p.sig||' from public,anon,authenticated,service_role';
 if p.proname in ('operation_list','operation_context','operation_assign','operation_save','operation_transition','operation_submission','life_operation_list','life_operation_context','life_operation_assign','life_operation_save','life_operation_transition','life_operation_submission') then execute 'grant execute on function '||p.sig||' to authenticated';end if;
 end loop;
end$$;
notify pgrst,'reload schema';
commit;
