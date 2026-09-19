begin;
create table public.life_course_reports (
 offering_id uuid primary key references public.life_offerings,
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=300000),
 revision integer not null default 1, updated_by uuid not null references public.life_people,
 updated_at timestamptz not null default now()
);
create table public.life_report_files (
 id uuid primary key default gen_random_uuid(), offering_id uuid not null references public.life_offerings,
 kind text not null check(kind in ('result','attendance','completion','scholarships','teaching','fees','photo')),
 filename text not null check(length(filename) between 1 and 200), mime text not null check(mime in ('application/pdf','image/png','image/jpeg')),
 size integer not null check(size between 1 and 4194304), caption text not null default '' check(length(caption)<=300),
 body text not null check(length(body)<=5592408), created_by uuid not null references public.life_people,
 created_at timestamptz not null default now()
);
create unique index life_report_one_document on public.life_report_files(offering_id,kind) where kind<>'photo';
create index life_report_files_offering on public.life_report_files(offering_id);
alter table public.life_course_reports enable row level security;
alter table public.life_report_files enable row level security;
revoke all on public.life_course_reports,public.life_report_files from public,anon,authenticated;
-- Reports and file bodies are available only through the scoped RPCs below.
create policy life_reports_read on public.life_course_reports for select to authenticated using(life_private.manages(offering_id));
create policy life_report_files_read on public.life_report_files for select to authenticated using(life_private.manages(offering_id));

create function life_private.report_number(v jsonb, maximum numeric, whole boolean default true) returns boolean
 language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(v)='number' and (v#>>'{}')::numeric between 0 and maximum and (not whole or trunc((v#>>'{}')::numeric)=(v#>>'{}')::numeric),false)
$$;
create function life_private.report_date(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare t text:=v#>>'{}';begin
 if jsonb_typeof(v) is distinct from 'string' then return false;end if;
 if t='' then return true;end if;
 return t ~ '^\d{4}-\d{2}-\d{2}$' and to_char(t::date,'YYYY-MM-DD')=t;
 exception when others then return false;
end $$;
create function life_private.validate_course_report(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text; field text; r jsonb;begin
 if jsonb_typeof(v) is distinct from 'object' or octet_length(v::text)>300000 then return false;end if;
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

create function life_private.save_course_report(f uuid,payload jsonb,expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare prior integer; r jsonb;begin
 if auth.uid() is null or not life_private.manages(f) then raise exception 'FORBIDDEN';end if;
 perform 1 from public.life_offerings where id=f for update;
 if not life_private.validate_course_report(payload) then raise exception 'INVALID_INPUT';end if;
 for r in select * from jsonb_array_elements(payload->'participants') union all select * from jsonb_array_elements(payload->'scholarships') loop
  if not exists(select 1 from public.life_enrollments where offering_id=f and person_id=(r->>'personId')::uuid) then raise exception 'INVALID_PARTICIPANT';end if;
 end loop;
 if (select count(*)<>count(distinct entry->>'personId') from jsonb_array_elements(payload->'participants') entry) then raise exception 'INVALID_INPUT';end if;
 select revision into prior from public.life_course_reports where offering_id=f;
 if coalesce(prior,0) is distinct from expected_revision then raise exception 'REVISION_CHANGED';end if;
 insert into public.life_course_reports(offering_id,payload,updated_by) values(f,payload,life_private.person_id())
 on conflict(offering_id) do update set payload=excluded.payload,revision=public.life_course_reports.revision+1,updated_by=excluded.updated_by,updated_at=now();
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
 select org_id,life_private.person_id(),'COURSE_REPORT_SAVED',f,jsonb_build_object('revision',coalesce(prior,0)+1) from public.life_offerings where id=f;
end $$;
create function public.life_save_course_report(f uuid,payload jsonb,expected_revision integer) returns void language sql security invoker set search_path='' as $$select life_private.save_course_report(f,payload,expected_revision)$$;

create function life_private.course_report(f uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not life_private.manages(f) then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object(
 'report',(select to_jsonb(r)-'offering_id'-'updated_by' from public.life_course_reports r where offering_id=f),
 'members',life_private.completion_board(f),
 'sessions',coalesce((select jsonb_agg(s order by starts_at) from public.life_class_sessions s where offering_id=f),'[]'::jsonb),
 'attendance',coalesce((select jsonb_agg(a) from public.life_attendance a join public.life_class_sessions s on s.id=a.session_id where s.offering_id=f),'[]'::jsonb),
 'teaching',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('name',p.name,'topic',l.notes,'confirmed_at',l.submitted_at,'current',coalesce(l.approved_revision=l.revision and l.session_snapshot=to_jsonb(s),false)) order by s.starts_at,p.name) from public.life_teaching_logs l join public.life_class_sessions s on s.id=l.session_id join public.life_people p on p.id=l.person_id where s.offering_id=f and s.status='SCHEDULED'),'[]'::jsonb),
 'files',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'filename',filename,'mime',mime,'size',size,'caption',caption,'created_at',created_at) order by created_at) from public.life_report_files where offering_id=f),'[]'::jsonb));
end $$;
create function public.life_course_report(f uuid) returns jsonb language sql stable security invoker set search_path='' as $$select life_private.course_report(f)$$;

create function life_private.save_report_file(f uuid,kind text,filename text,mime text,body text,caption text) returns uuid language plpgsql security definer set search_path='' as $$
declare bytes bytea; result uuid;begin
 if auth.uid() is null or not life_private.manages(f) then raise exception 'FORBIDDEN';end if;
 perform 1 from public.life_offerings where id=f for update;
 if body is null or length(body)>5592408 then raise exception 'INVALID_FILE';end if;
 bytes:=decode(body,'base64');
 if octet_length(bytes) not between 1 and 4194304 then raise exception 'INVALID_FILE';end if;
 if not coalesce((kind='photo' and ((mime='image/png' and substring(bytes from 1 for 8)=decode('89504e470d0a1a0a','hex')) or (mime='image/jpeg' and substring(bytes from 1 for 3)=decode('ffd8ff','hex')))) or
 (kind in ('result','attendance','completion','scholarships','teaching','fees') and mime='application/pdf' and substring(bytes from 1 for 5)=decode('255044462d','hex')),false) then raise exception 'INVALID_FILE';end if;
 if kind='photo' and (select count(*) from public.life_report_files where offering_id=f and life_report_files.kind='photo')>=12 then raise exception 'PHOTO_LIMIT';end if;
 if kind<>'photo' then delete from public.life_report_files where offering_id=f and life_report_files.kind=save_report_file.kind;end if;
 insert into public.life_report_files(offering_id,kind,filename,mime,size,body,caption,created_by) values(f,kind,filename,mime,octet_length(bytes),body,caption,life_private.person_id()) returning id into result;
 return result;
end $$;
create function public.life_save_report_file(f uuid,kind text,filename text,mime text,body text,caption text) returns uuid language sql security invoker set search_path='' as $$select life_private.save_report_file(f,kind,filename,mime,body,caption)$$;
create function life_private.report_file(f uuid,file_id uuid,remove boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 if auth.uid() is null or not life_private.manages(f) then raise exception 'FORBIDDEN';end if;
 if remove then
  delete from public.life_report_files where id=file_id and offering_id=f;
  return '{}'::jsonb;
 end if;
 select jsonb_build_object('filename',filename,'mime',mime,'body',body) into result from public.life_report_files where id=file_id and offering_id=f;
 return result;
end $$;
create function public.life_report_file(f uuid,file_id uuid,remove boolean default false) returns jsonb language sql security invoker set search_path='' as $$select life_private.report_file(f,file_id,remove)$$;

do $$declare sig text; t text;begin
 foreach t in array array['life_course_reports','life_report_files'] loop
 execute format('create trigger life_recent_mfa_write before insert or update or delete on public.%I for each statement execute function life_private.recent_mfa_write_guard()',t);
 end loop;
 for sig in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='public' and p.proname in ('life_save_course_report','life_course_report','life_save_report_file','life_report_file'))
 or (n.nspname='life_private' and p.proname in ('save_course_report','course_report','save_report_file','report_file','validate_course_report','report_number','report_date')) loop
 execute 'revoke all on function '||sig||' from public,anon,authenticated';
 if sig !~ '(validate_course_report|report_number|report_date)' then execute 'grant execute on function '||sig||' to authenticated';end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
