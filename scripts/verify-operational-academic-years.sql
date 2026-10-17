-- LOCAL ONLY. Combine migrations and roll back every fixture/schema change.
begin;
create temp table academic_year_fixture(normal uuid,empty_future uuid,hidden uuid,hash text);
grant select on academic_year_fixture to authenticated;
do $$declare actor uuid:='454e4e2b-09b0-4619-9470-c0bf4ac228e0';org uuid;seed public.life_project_years;n uuid:=gen_random_uuid();e uuid:=gen_random_uuid();h uuid:=gen_random_uuid();id uuid;begin
 select org_id into org from public.life_role_assignments where person_id=actor and role='COURSE_MANAGER' limit 1;
 select * into seed from public.life_project_years where org_id=org limit 1;
 foreach id in array array[n,e,h] loop
  insert into public.life_project_years select (jsonb_populate_record(null::public.life_project_years,to_jsonb(seed)||jsonb_build_object('id',id,'label','Local year '||id,'starts_on',case when id=e then '2030-03-01' else '2026-03-01' end,'ends_on',case when id=e then '2031-02-28' else '2027-02-28' end))).*;
 end loop;
 insert into academic_year_fixture select n,e,h,md5(jsonb_agg(to_jsonb(y) order by y.id)::text) from public.life_project_years y;
 insert into life_private.non_operational_project_years(year_id,reason) values(h,'Local dedicated verification year');
 update life_private.non_operational_project_years set reason='Local ID classification survives renaming' where year_id=h;
 perform set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal2","session_id":"1a0d6d22-2dd8-433f-a086-5f932d61d162"}',true);
end$$;
set local role authenticated;
do $$declare f academic_year_fixture;x jsonb;begin
 select * into f from academic_year_fixture;x:=public.life_performance_options();
 if (select count(*) from jsonb_array_elements(x) y where y->>'id' in(f.normal::text,f.empty_future::text))<>2
 or exists(select 1 from jsonb_array_elements(x) y where y->>'id'=f.hidden::text) then raise exception 'YEAR_OPTION_SCOPE_FAILED';end if;
 x:=public.life_performance_board(f.empty_future,null);
 if x#>>'{facts,totals,enrollments}'<>'0' then raise exception 'EMPTY_FUTURE_YEAR_LOST';end if;
 begin perform public.life_performance_board(f.hidden,null);raise exception 'HIDDEN_YEAR_DETAIL_EXPOSED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 if has_table_privilege(current_user,'life_private.non_operational_project_years','SELECT') or has_table_privilege(current_user,'life_private.operational_project_years','SELECT') or has_function_privilege(current_user,'life_private.operational_project_year(uuid)','EXECUTE') then raise exception 'PRIVATE_YEAR_SCOPE_EXPOSED';end if;
 raise notice 'PASS classified year hidden from options/direct stats, normal empty/future years and role boundary preserved';
end$$;
reset role;
do $$begin
 if (select hash from academic_year_fixture)<>(select md5(jsonb_agg(to_jsonb(y) order by y.id)::text) from public.life_project_years y) then raise exception 'ORIGINAL_YEARS_MUTATED';end if;
 raise notice 'PASS original project year rows unchanged';
end$$;
select set_config('request.jwt.claims','{"sub":"41d6ddcd-af44-49aa-9579-c48231377a2d","role":"authenticated","aal":"aal2","session_id":"d4880b5a-cde3-433f-9457-74a713ad5a3c"}',true);
set local role authenticated;
do $$declare f academic_year_fixture;begin
 select * into f from academic_year_fixture;
 begin perform public.life_performance_board(f.normal,null);raise exception 'FOREIGN_YEAR_EXPOSED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 raise notice 'PASS unrelated institution cannot read year statistics';
end$$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$begin
 begin perform public.life_performance_options();raise exception 'ANON_EXPOSED';exception when insufficient_privilege then null;end;
 if has_table_privilege(current_user,'life_private.operational_project_years','SELECT') then raise exception 'ANON_PRIVATE_YEAR_EXPOSED';end if;
 raise notice 'PASS anonymous year/private view access denied';
end$$;
reset role;
rollback;
