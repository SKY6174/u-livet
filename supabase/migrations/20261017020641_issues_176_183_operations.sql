begin;

-- Keep all historical field keys while removing redundant plan requirements.
alter function life_private.operation_schema(text) rename to operation_schema_before_176;
create function life_private.operation_schema(k text) returns jsonb
language sql immutable set search_path='' as $$
 select case when k='plan' then jsonb_set(s,'{fields}',(select jsonb_agg(case when f->>'key' in ('program','qualificationNote') then f||'{"required":false}'::jsonb else f end order by n) from jsonb_array_elements(s->'fields') with ordinality x(f,n))) else s end
 from (select life_private.operation_schema_before_176(k) s) original
$$;

-- Serialize distinct request keys on the same offering; same-key retries retain
-- the original document/link idempotency check, including retries after the deadline.
create or replace function life_private.submit_learner_document(
 k text,f uuid,request_key uuid,course_name text,applicant_name text,phone text,
 occurrence text,amount integer,pdf_base64 text,pdf_sha256 text
) returns uuid language plpgsql security definer set search_path='' as $$
declare p uuid:=life_private.person_id(); existing public.life_learner_document_requests; o public.life_offerings;
begin
 if p is null then raise exception 'AUTH_REQUIRED'; end if;
 if k='APPLICATION' then
  select * into o from public.life_offerings where id=f for update;
  select * into existing from public.life_learner_document_requests d where d.person_id=p and d.request_key=submit_learner_document.request_key;
  if existing.id is not null and f is null then f:=existing.offering_id;end if;
  if existing.id is null then
   if o.id is null then raise exception 'COURSE_NOT_FOUND';end if;
   if o.status<>'PUBLISHED' or o.academic_sealed or now()<o.apply_from or now()>=o.apply_until or (now() at time zone 'Asia/Seoul')::date>=o.starts_on then raise exception 'APPLICATION_CLOSED';end if;
   if exists(select 1 from public.life_learner_document_requests d where d.person_id=p and d.offering_id=f and d.kind='APPLICATION' and d.status not in ('REJECTED','CANCELLED') and d.deleted_at is null) then raise exception 'DUPLICATE_APPLICATION';end if;
  end if;
 end if;
 return life_private.submit_learner_document_base(k,f,request_key,course_name,applicant_name,phone,occurrence,amount,pdf_base64,pdf_sha256);
end$$;

-- A single read model for application records and received PDF applications.
-- Authorization stays per institution/offering, including unlinked old PDFs.
create function life_private.management_application_rows()
returns table(id uuid,person_id uuid,name text,active boolean,offering_id uuid,course_name text,status text,submitted_at timestamptz,enrollment_status text,document_id uuid,document_status text)
language sql stable security definer set search_path='' as $$
 with documents as (
  select d.*,row_number() over(partition by d.person_id,d.offering_id order by case when d.status in ('REJECTED','CANCELLED') then 1 else 0 end,d.submitted_at desc,d.id) position
  from public.life_learner_document_requests d where d.kind='APPLICATION' and d.deleted_at is null
   and ((d.offering_id is not null and life_private.manages(d.offering_id)) or (d.offering_id is null and life_private.has_role(d.org_id,'COURSE_MANAGER')))
 )
 select a.id,a.person_id,p.name,p.active,a.offering_id,o.name,a.status,a.submitted_at,e.status,d.id,d.status
 from public.life_applications a join public.life_offerings o on o.id=a.offering_id join public.life_people p on p.id=a.person_id
 left join public.life_enrollments e on e.application_id=a.id
 left join documents d on d.person_id=a.person_id and d.offering_id=a.offering_id and d.position=1
 where life_private.manages(o.id)
 union all
 select d.id,d.person_id,p.name,p.active,d.offering_id,coalesce(o.name,d.course_name),d.status,d.submitted_at,null,d.id,d.status
 from documents d join public.life_people p on p.id=d.person_id left join public.life_offerings o on o.id=d.offering_id
 where (d.offering_id is null or d.position=1) and not exists(select 1 from public.life_applications a where a.person_id=d.person_id and a.offering_id=d.offering_id)
$$;

create or replace function life_private.management_applications(f uuid,q text,s text,page integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 if not exists(select 1 from public.life_role_assignments r where r.person_id=life_private.person_id() and life_private.has_role(r.org_id,'COURSE_MANAGER')) then raise exception 'FORBIDDEN';end if;
 if q is null or length(q)>100 or page is null or page<1 or page>100000 or s is null or s not in ('','SUBMITTED','WAITLISTED','ACCEPTED','PENDING_PAYMENT','REJECTED','CANCELLED','EXPIRED','RECEIVED','REVIEWING','APPROVED','COMPLETED') then raise exception 'INVALID_INPUT';end if;
 if f is not null and not life_private.manages(f) then raise exception 'FORBIDDEN';end if;
 with scoped as materialized (select * from life_private.management_application_rows() a where (f is null or a.offering_id=f) and (s='' or a.status=s or a.document_status=s) and (q='' or strpos(lower(a.name),lower(q))>0)),
 sliced as (select * from scoped order by submitted_at desc,id limit 40 offset(page-1)*40)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x) order by submitted_at desc,id) from sliced x),'[]'::jsonb),'count',(select count(*) from scoped),'courses',life_private.management_courses()) into result;
 return result;
end$$;

create or replace function life_private.management_learners(f uuid,q text,page integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 if not exists(select 1 from public.life_role_assignments r where r.person_id=life_private.person_id() and life_private.has_role(r.org_id,'COURSE_MANAGER')) then raise exception 'FORBIDDEN';end if;
 if q is null or length(q)>100 or page is null or page<1 or page>100000 then raise exception 'INVALID_INPUT';end if;
 if f is not null and not life_private.manages(f) then raise exception 'FORBIDDEN';end if;
 with scoped as materialized (
  select a.person_id id,a.name,a.active,count(*) applications,count(*) filter(where enrollment_status='ACTIVE') enrollments
  from life_private.management_application_rows() a where (f is null or a.offering_id=f) and (q='' or strpos(lower(a.name),lower(q))>0) group by a.person_id,a.name,a.active
 ), sliced as(select * from scoped order by name,id limit 40 offset(page-1)*40)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x) order by name,id) from sliced x),'[]'::jsonb),'count',(select count(*) from scoped),'courses',life_private.management_courses()) into result;
 return result;
end$$;

create or replace function life_private.management_learner(p uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 if not exists(select 1 from life_private.management_application_rows() a where a.person_id=p) then raise exception 'FORBIDDEN';end if;
 select jsonb_build_object('id',person.id,'name',person.name,'active',person.active,'email',coalesce(u.email,mm.email),'phone',coalesce(mp.mobile_phone,lc.phone),
 'applications',coalesce((select jsonb_agg(to_jsonb(a) order by a.submitted_at desc) from life_private.management_application_rows() a where a.person_id=p),'[]'::jsonb)) into result
 from public.life_people person left join public.life_auth_links l on l.person_id=person.id left join auth.users u on u.id=l.auth_user_id
 left join life_private.manual_members mm on mm.person_id=person.id left join life_private.member_profiles mp on mp.person_id=person.id
 left join life_private.learner_contacts lc on lc.user_id=l.auth_user_id where person.id=p;
 return result;
end$$;

-- A registered active pool instructor is a valid assignment, without granting
-- any account-wide role or disclosing the private pool's contact information.
create function life_private.instructor_eligible(o uuid,p uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.life_people person where person.id=p and person.active) and not exists(select 1 from life_private.instructor_pool pool where pool.org_id=o and pool.person_id=p and pool.status='INACTIVE') and (
 exists(select 1 from public.life_role_assignments r where r.person_id=p and r.org_id=o and r.role='INSTRUCTOR' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())) or
 exists(select 1 from life_private.instructor_pool pool where pool.org_id=o and pool.person_id=p and pool.status='ACTIVE'))
$$;
create or replace function life_private.instructors(f uuid) returns table(person_id uuid,name text,assigned boolean)
language plpgsql stable security definer set search_path='' as $$
declare o uuid;begin
 if not life_private.manages(f) then raise exception 'FORBIDDEN';end if;
 select org_id into o from public.life_offerings where id=f;
 return query select p.id,p.name,exists(select 1 from public.life_offering_instructors i where i.offering_id=f and i.person_id=p.id and (i.valid_until is null or i.valid_until>now()))
 from public.life_people p where life_private.instructor_eligible(o,p.id) order by p.name,p.id;
end$$;

-- Shared eligibility is applied to the existing checked assignment/context paths.
do $$declare definition text;begin
 definition:=pg_get_functiondef('life_private.assign_instructor(uuid,uuid,boolean)'::regprocedure);
 definition:=regexp_replace(definition,'exists\(select 1 from public.life_role_assignments r join public.life_people person on person.id=r.person_id\s+where r.person_id=p and person.active and r.org_id=o and r.role=''INSTRUCTOR'' and r.valid_from<=now\(\) and \(r.valid_until is null or r.valid_until>now\(\)\)\)','life_private.instructor_eligible(o,p)');
 if definition=pg_get_functiondef('life_private.assign_instructor(uuid,uuid,boolean)'::regprocedure) then raise exception 'ASSIGN_ELIGIBILITY_PATCH_MISSING';end if;execute definition;
 definition:=pg_get_functiondef('life_private.operation_assign(uuid,uuid,integer)'::regprocedure);
 definition:=replace(definition,'exists(select 1 from public.life_role_assignments a where a.person_id=p and a.org_id=o.org_id and a.role=''INSTRUCTOR'' and a.valid_from<=now() and (a.valid_until is null or a.valid_until>now()))','life_private.instructor_eligible(o.org_id,p)');
 if definition=pg_get_functiondef('life_private.operation_assign(uuid,uuid,integer)'::regprocedure) then raise exception 'RESPONSIBLE_ELIGIBILITY_PATCH_MISSING';end if;execute definition;
 definition:=pg_get_functiondef('life_private.operation_context(uuid)'::regprocedure);
 definition:=replace(definition,'exists(select 1 from public.life_role_assignments a where a.person_id=p.id and a.org_id=o.org_id and a.role=''INSTRUCTOR'' and a.valid_from<=now() and (a.valid_until is null or a.valid_until>now()))','life_private.instructor_eligible(o.org_id,p.id)');
 if definition=pg_get_functiondef('life_private.operation_context(uuid)'::regprocedure) then raise exception 'CONTEXT_ELIGIBILITY_PATCH_MISSING';end if;execute definition;
end$$;

-- Pool membership alone is insufficient: teaching still requires the exact
-- authenticated person, active assignment and active person record.
create or replace function life_private.teaches(f uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select life_private.person_id() is not null and exists(select 1 from public.life_offering_instructors i join public.life_offerings o on o.id=i.offering_id
 where i.offering_id=f and i.person_id=life_private.person_id() and (i.valid_until is null or i.valid_until>now()) and life_private.instructor_eligible(o.org_id,i.person_id))
$$;

-- Integer recruitment counts and capacity are validated on direct RPC saves too.
do $$declare definition text;begin
 definition:=pg_get_functiondef('life_private.operation_content_valid(jsonb,text,boolean)'::regprocedure);
 if position('return true;' in definition)=0 then raise exception 'CONTENT_VALIDATION_PATCH_MISSING';end if;
 definition:=replace(definition,'return true;',$patch$
 if k='plan' then
  if c->'fields'->>'capacity'<>'' and c->'fields'->>'capacity' !~ '^\d{1,6}$' then return false;end if;
  if exists(select 1 from jsonb_array_elements(c->'tables'->'recruitment') recruitment_row(entry) where recruitment_row.entry->>'count'<>'' and recruitment_row.entry->>'count' !~ '^\d{1,6}$') then return false;end if;
  if exists(select 1 from jsonb_array_elements(c->'tables'->'recruitment') recruitment_row(entry) where recruitment_row.entry->>'count'<>'') and
   (coalesce(nullif(c->'fields'->>'capacity','')::integer,0)<=0 or
    (select coalesce(sum(coalesce(nullif(recruitment_row.entry->>'count','')::integer,0)),0) from jsonb_array_elements(c->'tables'->'recruitment') recruitment_row(entry))> (c->'fields'->>'capacity')::integer) then return false;end if;
 end if;
 return true;$patch$);execute definition;
end$$;

revoke all on function life_private.management_application_rows(),life_private.instructor_eligible(uuid,uuid),life_private.operation_schema_before_176(text),life_private.operation_schema(text) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
