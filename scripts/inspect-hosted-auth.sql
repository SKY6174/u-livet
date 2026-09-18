-- Read-only catalog inspection. No Auth user/session/audit rows are read.
-- Run on an explicitly selected Preview. Privileges do not establish provider support.
with required_columns(table_name,column_name) as (values
 ('users','id'),('users','encrypted_password'),('users','deleted_at'),('users','banned_until'),
 ('audit_log_entries','payload'),
 ('sessions','id'),('sessions','user_id'),('sessions','created_at'),('sessions','not_after'),('sessions','aal'),('sessions','factor_id'),
 ('mfa_factors','id'),('mfa_factors','user_id'),('mfa_factors','factor_type'),('mfa_factors','status'),('mfa_factors','friendly_name'),
 ('mfa_amr_claims','session_id'),('mfa_amr_claims','authentication_method'),('mfa_amr_claims','updated_at')
), required_triggers(table_name,trigger_name,function_name) as (values
 ('users','life_record_credential_change','record_credential_change'),
 ('audit_log_entries','life_approve_credential_change','approve_credential_change'),
 ('mfa_factors','life_mfa_factor_change','mfa_factor_change_guard'),
 ('mfa_factors','life_mfa_record_verified','mfa_record_verified')
), relations as (
 select c.oid,c.relname from pg_catalog.pg_class c
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where n.nspname='auth' and c.relkind in ('r','p')
)
select jsonb_build_object(
 'schema_version',1,
 'columns',(select jsonb_agg(jsonb_build_object(
   'table',q.table_name,'column',q.column_name,'present',a.attname is not null,
   'type',case when a.attname is not null then pg_catalog.format_type(a.atttypid,a.atttypmod) end
 ) order by q.table_name,q.column_name) from required_columns q
 left join relations r on r.relname=q.table_name
 left join pg_catalog.pg_attribute a on a.attrelid=r.oid and a.attname=q.column_name and a.attnum>0 and not a.attisdropped),
 'postgres_privileges',(select jsonb_agg(jsonb_build_object('table',q.table_name,
   'select',case when r.oid is not null then pg_catalog.has_table_privilege('postgres',r.oid,'SELECT') else false end,
   'trigger',case when r.oid is not null then pg_catalog.has_table_privilege('postgres',r.oid,'TRIGGER') else false end
 ) order by q.table_name) from (select distinct table_name from required_columns) q left join relations r on r.relname=q.table_name),
 'expected_triggers',(select jsonb_agg(jsonb_build_object('table',q.table_name,'trigger',q.trigger_name,
   'present',t.oid is not null,'enabled',coalesce(t.tgenabled in ('O','A'),false),
   'function_matches',coalesce(n.nspname='life_private' and p.proname=q.function_name,false)
 ) order by q.table_name,q.trigger_name) from required_triggers q
 left join relations r on r.relname=q.table_name
 left join pg_catalog.pg_trigger t on t.tgrelid=r.oid and t.tgname=q.trigger_name and not t.tgisinternal
 left join pg_catalog.pg_proc p on p.oid=t.tgfoid left join pg_catalog.pg_namespace n on n.oid=p.pronamespace),
 'notice','Catalog only; runtime events, provider support and data access are not verified.'
) as auth_preflight;
