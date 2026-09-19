-- Read-only before/after check. Run with the Management API or a trusted DB administrator.
-- Target must be selected explicitly: production uoebygejgglgiivzgyks, preview bfqwntulxabfrimcypvx.
begin transaction read only;
with expected_functions(schema_name,function_name,arguments) as (
 values
 ('public','life_course_report','uuid'),
 ('public','life_save_course_report','uuid,jsonb,integer'),
 ('public','life_save_report_file','uuid,text,text,text,text,text'),
 ('public','life_report_file','uuid,uuid,boolean'),
 ('life_private','course_report','uuid'),
 ('life_private','save_course_report','uuid,jsonb,integer'),
 ('life_private','save_report_file','uuid,text,text,text,text,text'),
 ('life_private','report_file','uuid,uuid,boolean'),
 ('life_private','validate_course_report','jsonb'),
 ('life_private','report_number','jsonb,numeric,boolean'),
 ('life_private','report_date','jsonb')
), function_ids as (
 select *,to_regprocedure(format('%I.%I(%s)',schema_name,function_name,arguments)) as id
 from expected_functions
), expected_tables(table_name) as (
 values ('life_course_reports'),('life_report_files')
)
select jsonb_build_object(
 'migration_count',(select count(*) from supabase_migrations.schema_migrations),
 'migration_applied',exists(select 1 from supabase_migrations.schema_migrations where version='20260919043637'),
 'recorded_sql_md5',(select md5(array_to_string(statements,E'\n')) from supabase_migrations.schema_migrations where version='20260919043637'),
 'tables',(select jsonb_agg(jsonb_build_object(
   'name',e.table_name,'exists',c.oid is not null,'rls',c.relrowsecurity,
   'anon_select',has_table_privilege('anon',c.oid,'SELECT'),
   'authenticated_select',has_table_privilege('authenticated',c.oid,'SELECT')
 ) order by e.table_name) from expected_tables e
 left join pg_class c on c.oid=to_regclass('public.'||e.table_name)),
 'functions',(select jsonb_agg(jsonb_build_object(
   'name',f.schema_name||'.'||f.function_name,'exists',f.id is not null,
   'definer',p.prosecdef,'settings',p.proconfig,
   'anon_execute',has_function_privilege('anon',f.id,'EXECUTE'),
   'authenticated_execute',has_function_privilege('authenticated',f.id,'EXECUTE')
 ) order by f.schema_name,f.function_name)
 from function_ids f left join pg_proc p on p.oid=f.id),
 'policies',(select coalesce(jsonb_agg(jsonb_build_object(
   'table',tablename,'name',policyname,'roles',roles,'command',cmd,'predicate',qual
 ) order by tablename,policyname),'[]') from pg_policies
 where schemaname='public' and tablename in ('life_course_reports','life_report_files')),
 'triggers',(select coalesce(jsonb_agg(jsonb_build_object(
   'table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)
 ) order by c.relname,t.tgname),'[]') from pg_trigger t join pg_class c on c.oid=t.tgrelid
 where not t.tgisinternal and c.oid in (to_regclass('public.life_course_reports'),to_regclass('public.life_report_files'))),
 'dependencies',(select jsonb_agg(jsonb_build_object(
   'name',p.oid::regprocedure::text,'definition_md5',md5(pg_get_functiondef(p.oid))
 ) order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='life_private' and p.proname in ('manages','person_id','completion_board','recent_mfa_write_guard')),
 'baseline',jsonb_build_object(
   'auth_users',(select count(*) from auth.users),
   'offerings',(select count(*) from public.life_offerings),
   'organizations',(select count(*) from public.life_organizations))
) as migration_check;
commit;
