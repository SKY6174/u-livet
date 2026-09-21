begin;
create table public.life_course_budgets (
 org_id uuid not null references public.life_organizations,
 guide_id text not null references public.life_course_guides,
 source_id text check(source_id ~ '^P(0[1-9]|1[0-6])$'),
 program_id text not null default '' check(length(program_id)<=40 and (program_id='' or program_id ~ '^[A-Z0-9]+(-[A-Z0-9]+){1,5}$')),
 materials bigint check(materials between 0 and 999999999999),
 printing bigint check(printing between 0 and 999999999999),
 instructors bigint check(instructors between 0 and 999999999999),
 operations bigint check(operations between 0 and 999999999999),
 support bigint check(support between 0 and 999999999999),
 scholarships bigint check(scholarships between 0 and 999999999999),
 revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now(), updated_by uuid references public.life_people,
 primary key(org_id,guide_id)
);
create table public.life_budget_workbooks (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.life_organizations,
 year integer not null check(year between 2000 and 2200),
 file_name text not null check(length(file_name) between 1 and 200 and file_name ~* '\.xlsx$'),
 sheet_name text not null check(length(sheet_name) between 1 and 100),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 header_row integer not null check(header_row between 0 and 49),
 rows jsonb not null check(jsonb_typeof(rows)='array' and jsonb_array_length(rows) between 2 and 2000 and octet_length(rows::text)<=1000000),
 created_by uuid not null references public.life_people, created_at timestamptz not null default now(),
 unique(org_id,year,sha256,sheet_name,header_row)
);
create index life_budget_workbooks_org_year on public.life_budget_workbooks(org_id,year,created_at desc);
create index life_course_budgets_guide on public.life_course_budgets(guide_id);
create index life_course_budgets_author on public.life_course_budgets(updated_by);
create index life_budget_workbooks_author on public.life_budget_workbooks(created_by);
alter table public.life_course_budgets enable row level security;
alter table public.life_budget_workbooks enable row level security;
revoke all on public.life_course_budgets,public.life_budget_workbooks from public,anon,authenticated,service_role;
create trigger life_recent_mfa_write before insert or update or delete on public.life_course_budgets for each statement execute function life_private.recent_mfa_write_guard();
create trigger life_recent_mfa_write before insert or update or delete on public.life_budget_workbooks for each statement execute function life_private.recent_mfa_write_guard();

-- Initial amounts transcribed from the user's 2026 budget image; '-' remains NULL.
insert into public.life_course_budgets(org_id,guide_id,source_id,program_id,materials,printing,instructors,operations,support,scholarships)
select o.id,s.* from public.life_organizations o cross join (values
 ('2026-manual-therapy','P06','C1-S3T4-2',780000,300000,3200000,450000,383700,1080000),
 ('2026-obstetric-pilates','P10','C1-S3T4-2',150000,225000,4535000,750000,null,1800000),
 ('2026-silver-food','P12','C1-S3T4-2',1600000,150000,2675000,300000,511600,720000),
 ('2026-healthy-diet','P02','C1-S3T4-2',2100000,210000,3985000,630000,1023300,1512100),
 ('2026-park-golf','P16','C1-S3T4-2',1680000,600000,3930000,700000,null,1680000),
 ('2026-sports-taping','P11','C1-S3T4-2',495000,300000,4860000,960000,null,2304000),
 ('2026-local-cookie','P04','C1-S4T5-3',1800000,75000,4410000,450000,613920,1080000),
 ('2026-pet-food','P08','C1-S4T5-3',1500000,300000,2650000,300000,383700,720000),
 ('2026-pet-behavior','P09','C1-S4T5-3',2160000,80000,4960000,768000,null,1843200),
 ('2026-pet-grooming','P13','C1-S4T5-3',2430000,75000,5250000,675000,null,1620000),
 ('2026-local-planning','P07','C1-S4T5-3',400000,140000,2320000,240000,null,576000),
 ('2026-golf-fitting','P03','C1-S4T5-3',1705000,300000,3435000,360000,null,864000),
 ('2026-furniture','P01','C1-S3T4-3',1507000,null,2960000,420000,383700,1008000),
 ('2026-wallpaper','P05','C1-S3T4-3',1507000,null,2960000,420000,383700,1008000),
 ('2026-interior-woodwork','P14','C1-S3T4-3',1956800,null,2250000,420000,383700,1008000),
 ('2026-facilitator','P15','C1-S3T4-3',295000,400000,3440000,110000,null,1152000)
) s(guide_id,source_id,program_id,materials,printing,instructors,operations,support,scholarships)
where o.name='울산과학대학교 앵커사업단';

create function life_private.course_budget_allowed(o uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select life_private.person_id() is not null and (life_private.has_role(o,'COURSE_MANAGER') or life_private.has_role(o,'SYSTEM_ADMIN'))
$$;
create function life_private.course_budget_overview(o uuid,y integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not life_private.course_budget_allowed(o) then raise exception 'FORBIDDEN'; end if;
 return jsonb_build_object('courses',coalesce((select jsonb_agg(to_jsonb(g)||jsonb_build_object(
  'source_id',b.source_id,'budget',jsonb_build_object('program_id',coalesce(b.program_id,''),'revision',coalesce(b.revision,0),
  'updated_at',b.updated_at,'materials',b.materials,'printing',b.printing,'instructors',b.instructors,
  'operations',b.operations,'support',b.support,'scholarships',b.scholarships)) order by g.sort_order)
  from public.life_course_guides g left join public.life_course_budgets b on b.guide_id=g.id and b.org_id=o where g.year=y),'[]'::jsonb),
 'workbooks',coalesce((select jsonb_agg(v order by v.created_at desc) from (
  select w.id,w.file_name,w.sheet_name,w.created_at,jsonb_array_length(w.rows) as row_count,w.header_row
  from public.life_budget_workbooks w where w.org_id=o and w.year=y order by w.created_at desc limit 50) v),'[]'::jsonb));
end $$;
create function life_private.save_course_budget(o uuid,g text,payload jsonb,expected_revision integer) returns integer
language plpgsql security definer set search_path='' as $$
declare prior integer; k text; result integer; p uuid:=life_private.person_id();
begin
 if not life_private.course_budget_allowed(o) then raise exception 'FORBIDDEN'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or (select count(*) from jsonb_object_keys(payload))<>7
 or jsonb_typeof(payload->'program_id') is distinct from 'string' or length(payload->>'program_id')>40
 or (payload->>'program_id'<>'' and payload->>'program_id'!~ '^[A-Z0-9]+(-[A-Z0-9]+){1,5}$')
 or expected_revision is null or expected_revision<0 or expected_revision>=2147483647 then raise exception 'INVALID_INPUT'; end if;
 foreach k in array array['materials','printing','instructors','operations','support','scholarships'] loop
  if not(payload ? k) or (payload->k<>'null'::jsonb and (jsonb_typeof(payload->k)<>'number' or payload->>k!~ '^[0-9]{1,12}$')) then raise exception 'INVALID_INPUT'; end if;
 end loop;
 -- Serializes even first inserts without locking another institution's records.
 perform 1 from public.life_organizations where id=o for update;
 if not exists(select 1 from public.life_course_guides where id=g) then raise exception 'INVALID_INPUT'; end if;
 select revision into prior from public.life_course_budgets where org_id=o and guide_id=g;
 if coalesce(prior,0)<>expected_revision then raise exception 'REVISION_CHANGED'; end if;
 insert into public.life_course_budgets(org_id,guide_id,program_id,materials,printing,instructors,operations,support,scholarships,updated_by)
 values(o,g,payload->>'program_id',(payload->>'materials')::bigint,(payload->>'printing')::bigint,(payload->>'instructors')::bigint,
 (payload->>'operations')::bigint,(payload->>'support')::bigint,(payload->>'scholarships')::bigint,p)
 on conflict(org_id,guide_id) do update set program_id=excluded.program_id,materials=excluded.materials,printing=excluded.printing,
 instructors=excluded.instructors,operations=excluded.operations,support=excluded.support,scholarships=excluded.scholarships,
 updated_at=now(),updated_by=p,revision=public.life_course_budgets.revision+1 returning revision into result;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details) values(o,p,'COURSE_BUDGET_SAVED',o,jsonb_build_object('guide_id',g,'revision',result,'values',payload));
 return result;
end $$;
create function life_private.save_budget_workbook(o uuid,y integer,payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare r jsonb; c jsonb; result uuid; p uuid:=life_private.person_id();
begin
 if not life_private.course_budget_allowed(o) then raise exception 'FORBIDDEN'; end if;
 if y is null or y not between 2000 and 2200 or jsonb_typeof(payload) is distinct from 'object'
 or jsonb_typeof(payload->'rows') is distinct from 'array' then raise exception 'INVALID_INPUT'; end if;
 if jsonb_array_length(payload->'rows') not between 2 and 2000 or octet_length((payload->'rows')::text)>1000000
 or jsonb_typeof(payload->'file_name') is distinct from 'string' or length(payload->>'file_name') not between 1 and 200 or payload->>'file_name'!~* '\.xlsx$'
 or jsonb_typeof(payload->'sheet_name') is distinct from 'string' or length(payload->>'sheet_name') not between 1 and 100
 or jsonb_typeof(payload->'sha256') is distinct from 'string' or payload->>'sha256'!~ '^[a-f0-9]{64}$'
 or jsonb_typeof(payload->'header_row') is distinct from 'number' or payload->>'header_row'!~ '^[0-9]{1,2}$'
 then raise exception 'INVALID_INPUT'; end if;
 if (payload->>'header_row')::integer>=least(50,jsonb_array_length(payload->'rows')-1) then raise exception 'INVALID_INPUT'; end if;
 for r in select value from jsonb_array_elements(payload->'rows') loop
  if jsonb_typeof(r)<>'array' then raise exception 'INVALID_INPUT'; end if;
  if jsonb_array_length(r) not between 1 and 40 then raise exception 'INVALID_INPUT'; end if;
  for c in select value from jsonb_array_elements(r) loop
   if jsonb_typeof(c)<>'string' or length(c#>>'{}')>500 then raise exception 'INVALID_INPUT'; end if;
  end loop;
 end loop;
 insert into public.life_budget_workbooks(org_id,year,file_name,sheet_name,sha256,header_row,rows,created_by)
 values(o,y,payload->>'file_name',payload->>'sheet_name',payload->>'sha256',(payload->>'header_row')::integer,payload->'rows',p)
 on conflict(org_id,year,sha256,sheet_name,header_row) do nothing returning id into result;
 if result is null then
  select id into result from public.life_budget_workbooks where org_id=o and year=y and sha256=payload->>'sha256' and sheet_name=payload->>'sheet_name' and header_row=(payload->>'header_row')::integer;
 else
  insert into public.life_audit_events(org_id,actor_id,action,entity_id,details) values(o,p,'BUDGET_WORKBOOK_SAVED',result,jsonb_build_object('file_name',payload->>'file_name','sheet_name',payload->>'sheet_name','year',y));
 end if;
 return result;
end $$;
create function life_private.budget_workbook(o uuid,w uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not life_private.course_budget_allowed(o) then raise exception 'FORBIDDEN'; end if;
 return (select to_jsonb(b)-'org_id'-'created_by' from public.life_budget_workbooks b where b.id=w and b.org_id=o);
end $$;
create function public.life_course_budget_overview(o uuid,y integer) returns jsonb language sql stable security invoker set search_path='' as $$select life_private.course_budget_overview(o,y)$$;
create function public.life_save_course_budget(o uuid,g text,payload jsonb,expected_revision integer) returns integer language sql security invoker set search_path='' as $$select life_private.save_course_budget(o,g,payload,expected_revision)$$;
create function public.life_save_budget_workbook(o uuid,y integer,payload jsonb) returns uuid language sql security invoker set search_path='' as $$select life_private.save_budget_workbook(o,y,payload)$$;
create function public.life_budget_workbook(o uuid,w uuid) returns jsonb language sql stable security invoker set search_path='' as $$select life_private.budget_workbook(o,w)$$;
revoke all on function life_private.course_budget_allowed(uuid),life_private.course_budget_overview(uuid,integer),life_private.save_course_budget(uuid,text,jsonb,integer),life_private.save_budget_workbook(uuid,integer,jsonb),life_private.budget_workbook(uuid,uuid),public.life_course_budget_overview(uuid,integer),public.life_save_course_budget(uuid,text,jsonb,integer),public.life_save_budget_workbook(uuid,integer,jsonb),public.life_budget_workbook(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function life_private.course_budget_overview(uuid,integer),life_private.save_course_budget(uuid,text,jsonb,integer),life_private.save_budget_workbook(uuid,integer,jsonb),life_private.budget_workbook(uuid,uuid),public.life_course_budget_overview(uuid,integer),public.life_save_course_budget(uuid,text,jsonb,integer),public.life_save_budget_workbook(uuid,integer,jsonb),public.life_budget_workbook(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
