begin;

create or replace function life_private.operation_budget_valid(
  b jsonb,
  k text,
  complete boolean default false
) returns boolean
language plpgsql immutable set search_path=''
as $$
declare
  r jsonb;
  v text;
  scholarship_rows jsonb := coalesce(b->'scholarships', '[]'::jsonb);
begin
  if jsonb_typeof(b) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(b)) not in (4, 5)
    or not b ?& array['rows','scholarshipCount','scholarshipAmount','scholarshipNote']
    or (b ? 'scholarships' and jsonb_typeof(b->'scholarships') is distinct from 'array')
    or jsonb_typeof(b->'rows') is distinct from 'array'
    or jsonb_array_length(b->'rows') not between 1 and 30
    or jsonb_array_length(scholarship_rows) > 200
  then return false; end if;

  foreach v in array array['scholarshipCount','scholarshipAmount'] loop
    if jsonb_typeof(b->v) is distinct from 'string'
      or (b->>v) !~ '^(|\d{1,12})$'
      or (complete and k='result' and b->>v='')
    then return false; end if;
  end loop;
  if not life_private.operation_field(b->'scholarshipNote','{"type":"text","max":1000}'::jsonb)
  then return false; end if;

  for r in select * from jsonb_array_elements(b->'rows') loop
    if jsonb_typeof(r) is distinct from 'object'
      or (select count(*) from jsonb_object_keys(r)) <> 5
      or not r ?& array['category','calculation','planned','spent','note']
      or btrim(r->>'category')=''
    then return false; end if;
    foreach v in array array['category','calculation','note'] loop
      if not life_private.operation_field(r->v,'{"type":"text","max":1000}'::jsonb)
      then return false; end if;
    end loop;
    foreach v in array array['planned','spent'] loop
      if jsonb_typeof(r->v) is distinct from 'string'
        or r->>v !~ '^(|\d{1,12})$'
        or (complete and (v='planned' or k='result') and r->>v='')
      then return false; end if;
    end loop;
  end loop;

  for r in select * from jsonb_array_elements(scholarship_rows) loop
    if jsonb_typeof(r) is distinct from 'object'
      or (select count(*) from jsonb_object_keys(r)) <> 10
      or not r ?& array['personId','name','category','rate','amount','bank','account','holder','paidOn','note']
      or (r->>'personId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or btrim(r->>'name')=''
      or btrim(r->>'category')=''
      or (r->>'rate') !~ '^\d{1,3}(\.\d{1,2})?$'
      or (r->>'rate')::numeric > 100
      or (r->>'amount') !~ '^\d{1,12}$'
      or (r->>'paidOn') !~ '^(|\d{4}-\d{2}-\d{2})$'
      or ((r->>'paidOn') <> '' and to_char((r->>'paidOn')::date,'YYYY-MM-DD') <> r->>'paidOn')
    then return false; end if;
    foreach v in array array['name','category','bank','account','holder'] loop
      if not life_private.operation_field(r->v,'{"type":"text","max":200}'::jsonb)
      then return false; end if;
    end loop;
    if not life_private.operation_field(r->'note','{"type":"text","max":1000}'::jsonb)
    then return false; end if;
  end loop;

  if jsonb_array_length(scholarship_rows) > 0 then
    if (select count(*) from jsonb_array_elements(scholarship_rows))
         <> (select count(distinct row->>'personId') from jsonb_array_elements(scholarship_rows) row)
      or (b->>'scholarshipCount')::integer <> jsonb_array_length(scholarship_rows)
      or (b->>'scholarshipAmount')::numeric <>
         (select coalesce(sum((row->>'amount')::numeric),0) from jsonb_array_elements(scholarship_rows) row)
    then return false; end if;
  end if;
  return true;
exception when others then return false;
end$$;

create or replace function life_private.operation_scholarship_members_valid()
returns trigger language plpgsql security definer set search_path=''
as $$
declare r jsonb;
begin
  new.budget := new.budget || jsonb_build_object(
    'scholarships', coalesce(new.budget->'scholarships','[]'::jsonb)
  );
  for r in select * from jsonb_array_elements(new.budget->'scholarships') loop
    if not exists(
      select 1
      from public.life_enrollments e
      join public.life_people p on p.id=e.person_id
      where e.offering_id=new.offering_id
        and e.person_id=(r->>'personId')::uuid
        and e.status='ACTIVE'
        and p.name=r->>'name'
    ) then raise exception 'INVALID_PARTICIPANT'; end if;
  end loop;
  return new;
end$$;

drop trigger if exists life_operation_scholarship_members on public.life_operation_documents;
create trigger life_operation_scholarship_members
before insert or update of budget on public.life_operation_documents
for each row execute function life_private.operation_scholarship_members_valid();

update public.life_operation_documents
set budget=budget || '{"scholarships":[]}'::jsonb
where not budget ? 'scholarships';

create or replace function life_private.operation_context(f uuid) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
begin
  if not life_private.operation_access(f) then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'manager',life_private.operation_manager(f),
    'course',(select jsonb_build_object('id',o.id,'name',o.name,'academy',c.academy,'starts_on',o.starts_on,'ends_on',o.ends_on,'capacity',o.capacity,'summary',v.summary,'curriculum',v.curriculum,'location',o.location,'status',o.status,'org_id',o.org_id) from public.life_offerings o join public.life_course_versions v on v.id=o.course_version_id join public.life_courses c on c.id=v.course_id where o.id=f),
    'responsible',(select jsonb_build_object('person_id',r.person_id,'name',p.name,'revision',r.revision) from public.life_operation_responsibilities r join public.life_people p on p.id=r.person_id where r.offering_id=f),
    'candidates',case when life_private.operation_manager(f) then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name) from public.life_offering_instructors i join public.life_people p on p.id=i.person_id join public.life_offerings o on o.id=i.offering_id where i.offering_id=f and p.active and (i.valid_until is null or i.valid_until>now()) and exists(select 1 from public.life_role_assignments a where a.person_id=p.id and a.org_id=o.org_id and a.role='INSTRUCTOR' and a.valid_from<=now() and (a.valid_until is null or a.valid_until>now()))),'[]'::jsonb) else '[]'::jsonb end,
    'members',coalesce((select jsonb_agg(jsonb_build_object('person_id',p.id,'name',p.name) order by p.name,p.id) from public.life_enrollments e join public.life_people p on p.id=e.person_id where e.offering_id=f and e.status='ACTIVE'),'[]'::jsonb),
    'documents',coalesce((select jsonb_agg(to_jsonb(d)-'offering_id'-'updated_by'-'reviewed_by'-'submitted_by') from public.life_operation_documents d where d.offering_id=f),'[]'::jsonb),
    'legacy',(select r.payload-'participants'-'scholarships'-'fees' from public.life_course_reports r where r.offering_id=f),
    'sessions',coalesce((select jsonb_agg(jsonb_build_object('title',s.title,'starts_at',s.starts_at,'ends_at',s.ends_at) order by s.starts_at) from public.life_class_sessions s where s.offering_id=f and s.status='SCHEDULED'),'[]'::jsonb),
    'submissions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'kind',s.kind,'revision',s.revision,'submitted_at',s.submitted_at,'name',p.name) order by s.submitted_at desc) from public.life_operation_submissions s join public.life_people p on p.id=s.submitted_by where s.offering_id=f),'[]'::jsonb)
  );
end$$;

-- The previous importer appended every source image after two empty ceremonial slots.
-- For the three reviewed archived drafts, move the first two source images into
-- opening/closing and apply the dates printed in each source PDF caption.
with source_dates(offering_id, opening_date, closing_date, operation_dates, expected_images) as (
  values
    ('361eda75-8153-4b2b-86dc-3724a5105f17'::uuid,'2026-08-05','2026-08-21','["2026-08-05","2026-08-05","2026-08-07","2026-08-12","2026-08-14","2026-08-19","2026-08-21","2026-08-21"]'::jsonb,10),
    ('6f436e94-61df-4822-bea3-eccbf25b4c5b'::uuid,'2026-07-14','2026-07-21','["2026-07-14","2026-07-14","2026-07-14","2026-07-14","2026-07-15","2026-07-15","2026-07-15","2026-07-15","2026-07-16","2026-07-16","2026-07-16","2026-07-16","2026-07-20","2026-07-20","2026-07-20","2026-07-20","2026-07-20","2026-07-20","2026-07-21","2026-07-21","2026-07-21","2026-07-21","2026-07-21","2026-07-21"]'::jsonb,26),
    ('1e1e0bb6-f2b2-4b2a-b99f-127e462db915'::uuid,'2026-07-20','2026-07-31','["","","","","",""]'::jsonb,8)
)
update public.life_operation_documents d
set content=jsonb_set(d.content,'{photos}',(
      select jsonb_agg(
        jsonb_build_object(
          'caption',case when item.ordinality=3 then '개강식' when item.ordinality=4 then '수료식' else '운영사진'||(item.ordinality-4)::text end,
          'date',case when item.ordinality=3 then source_dates.opening_date when item.ordinality=4 then source_dates.closing_date else coalesce(source_dates.operation_dates->>((item.ordinality-5)::integer),'') end,
          'image',item.photo->>'image'
        ) order by item.ordinality
      )
      from jsonb_array_elements(d.content->'photos') with ordinality item(photo,ordinality)
      where item.ordinality>=3
    )),
    revision=d.revision+1,
    updated_at=now(),
    return_note=case when d.return_note='' then '원본 PDF 사진 표제의 촬영일을 반영했습니다.' else d.return_note||E'\n원본 PDF 사진 표제의 촬영일을 반영했습니다.' end
from source_dates
where d.offering_id=source_dates.offering_id
  and d.kind='result'
  and d.status='DRAFT'
  and jsonb_array_length(d.content->'photos')=source_dates.expected_images+2
  and d.content->'photos'->0->>'image'=''
  and d.content->'photos'->1->>'image'=''
  and not exists(select 1 from jsonb_array_elements(d.content->'photos') photo where photo->>'date'<>'');

commit;
