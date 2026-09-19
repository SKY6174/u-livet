begin;
-- Historical reports are private archive records, never an open enrollment.
alter table public.life_offerings drop constraint life_offerings_status_check;
alter table public.life_offerings add constraint life_offerings_status_check check(status in ('DRAFT','PUBLISHED','CLOSED','ARCHIVED'));
alter table public.life_offerings alter column apply_from drop not null, alter column apply_until drop not null, alter column tuition drop not null, alter column selection_method drop not null;
alter table public.life_offerings add constraint life_offerings_archive_fields check (
 (status='ARCHIVED' and apply_from is null and apply_until is null and tuition is null and selection_method is null)
 or (status<>'ARCHIVED' and apply_from is not null and apply_until is not null and tuition is not null and selection_method is not null)
);
create or replace function life_private.validate_course_report(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text; field text; r jsonb;begin
 if jsonb_typeof(v) is distinct from 'object' or octet_length(v::text)>300000 then return false;end if;
 if v ? 'sourceReport' then
  r:=v->'sourceReport';
  if jsonb_typeof(r) is distinct from 'object' then return false;end if;
  if jsonb_typeof(r->'filename') is distinct from 'string' or not coalesce(length(r->>'filename') between 1 and 200,false) or
    jsonb_typeof(r->'sha256') is distinct from 'string' or not coalesce(r->>'sha256' ~ '^[0-9a-f]{64}$',false) or
    jsonb_typeof(r->'notes') is distinct from 'string' or length(r->>'notes')>5000 then return false;end if;
  foreach field in array array['enrolled','completed','classCount','scholarshipRecipients'] loop
   if not life_private.report_number(r->field,10000) then return false;end if;
  end loop;
  if not life_private.report_number(r->'educationHours',10000,false) or not life_private.report_number(r->'scholarshipAmount',1000000000) or (r->>'completed')::numeric>(r->>'enrolled')::numeric then return false;end if;
 end if;
 foreach k in array array['operator','professor','program','content','method','education','promotion','other','strengths','improvements','followUp'] loop
  if jsonb_typeof(v->k) is distinct from 'string' or length(v->>k)>5000 then return false;end if;
 end loop;
 if not life_private.report_date(v->'reportDate') then return false;end if;
 foreach k in array array['certificates','employed','surveyResponses','satisfaction'] loop
  if v->k is null or (v->k<>'null'::jsonb and not life_private.report_number(v->k,case when k='satisfaction' then 100 else 10000 end,k<>'satisfaction')) then return false;end if;
 end loop;
 foreach k in array array['budgets','participants','scholarships','fees'] loop
  if jsonb_typeof(v->k) is distinct from 'array' or jsonb_array_length(v->k)>(case when k='budgets' then 100 when k='fees' then 200 else 1000 end) then return false;end if;
  for r in select * from jsonb_array_elements(v->k) loop
   if jsonb_typeof(r) is distinct from 'object' or jsonb_typeof(r->'note') is distinct from 'string' or length(r->>'note')>500 then return false;end if;
   if k in ('participants','scholarships') and jsonb_typeof(r->'personId') is distinct from 'string' then return false;end if;
   if k in ('budgets','scholarships') and jsonb_typeof(r->'category') is distinct from 'string' then return false;end if;
   if k in ('participants','scholarships') and not coalesce(r->>'personId' ~ '^[0-9a-fA-F-]{36}$',false) then return false;end if;
   if k in ('participants','fees') and not life_private.report_date(r->'birthDate') then return false;end if;
   if k in ('budgets','scholarships') and not coalesce(length(trim(r->>'category')) between 1 and 100,false) then return false;end if;
   if k='budgets' and (not life_private.report_number(r->'planned',1000000000) or not life_private.report_number(r->'spent',1000000000)) then return false;end if;
   if k='scholarships' and (not life_private.report_number(r->'rate',100,false) or not life_private.report_number(r->'amount',1000000000)) then return false;end if;
   if k='fees' then
    foreach field in array array['name','kind','dates'] loop
     if jsonb_typeof(r->field) is distinct from 'string' then return false;end if;
    end loop;
    if not coalesce(length(trim(r->>'name')) between 1 and 100 and r->>'kind' in ('내부강사','외부강사','보조강사') and length(r->>'dates')<=500,false) then return false;end if;
    if not life_private.report_number(r->'hours',1000,false) or not life_private.report_number(r->'rate',10000000) then return false;end if;
    if (r->>'hours')::numeric*100<>trunc((r->>'hours')::numeric*100) then return false;end if;
   end if;
   if k in ('scholarships','fees') then
    foreach field in array array['bank','account','holder'] loop
     if jsonb_typeof(r->field) is distinct from 'string' then return false;end if;
    end loop;
    if not life_private.report_date(r->'paidOn') or not coalesce(length(r->>'bank')<=100 and length(r->>'account')<=100 and length(r->>'holder')<=100,false) then return false;end if;
   end if;
  end loop;
 end loop;
 return true;
 exception when others then return false;
end $$;

notify pgrst,'reload schema';
commit;
