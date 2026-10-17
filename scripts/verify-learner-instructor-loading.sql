-- Additional equivalence and performance checks after the full academic regression.
create function pg_temp.compare_learning(label text) returns void language plpgsql as $$
declare a jsonb;b jsonb;begin
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into a from pg_temp.before_instructor_home_summary() x;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into b from public.life_instructor_home_summary() x;
 if a is distinct from b then raise exception 'SUMMARY_SCOPE_MISMATCH %',label;end if;
 -- The history API has no array ordering contract. Compare every field per entry.
 select coalesce(jsonb_agg(x order by x::text),'[]') into a from jsonb_array_elements(pg_temp.before_completion_history()) x;
 select coalesce(jsonb_agg(x order by x::text),'[]') into b from jsonb_array_elements(public.life_completion_history()) x;
 if a is distinct from b then raise exception 'HISTORY_SCOPE_MISMATCH %',label;end if;
 raise notice 'PASS %: instructor scope and complete personal history match',label;
end$$;
create temp table loading_roles as select * from public.life_role_assignments where person_id='454e4e2b-09b0-4619-9470-c0bf4ac228e0';
create temp table loading_assignments as select * from public.life_offering_instructors where person_id='454e4e2b-09b0-4619-9470-c0bf4ac228e0';
select set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal2","session_id":"1a0d6d22-2dd8-433f-a086-5f932d61d162"}',true);
set local role authenticated;
select pg_temp.compare_learning('assigned instructor');
do $$declare pair int;kind text;started timestamptz;old_ms numeric;new_ms numeric;plan jsonb;begin
 foreach kind in array array['summary','history'] loop
  if kind='history' then
   perform set_config('request.jwt.claims','{"sub":"41d6ddcd-af44-49aa-9579-c48231377a2d","role":"authenticated","aal":"aal2","session_id":"d4880b5a-cde3-433f-9457-74a713ad5a3c"}',true);
  end if;
  for pair in 1..8 loop
   if pair%2=0 then
    started:=clock_timestamp();if kind='summary' then perform * from public.life_instructor_home_summary();else perform public.life_completion_history();end if;
    new_ms:=round(extract(epoch from clock_timestamp()-started)*1000,2);
   end if;
   started:=clock_timestamp();if kind='summary' then perform * from pg_temp.before_instructor_home_summary();else perform pg_temp.before_completion_history();end if;
   old_ms:=round(extract(epoch from clock_timestamp()-started)*1000,2);
   if pair%2=1 then
    started:=clock_timestamp();if kind='summary' then perform * from public.life_instructor_home_summary();else perform public.life_completion_history();end if;
    new_ms:=round(extract(epoch from clock_timestamp()-started)*1000,2);
   end if;
   raise notice 'PAIR % % old_ms % new_ms %',kind,pair,old_ms,new_ms;
  end loop;
 end loop;
 perform set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal2","session_id":"1a0d6d22-2dd8-433f-a086-5f932d61d162"}',true);
 execute 'explain(analyze,buffers,format json) select * from pg_temp.before_instructor_home_summary()' into plan;raise notice 'PLAN old %',plan;
 execute 'explain(analyze,buffers,format json) select * from public.life_instructor_home_summary()' into plan;raise notice 'PLAN new %',plan;
end$$;
reset role;
-- Rebuild only local roles; all changes roll back with the outer transaction.
do $$declare org uuid;foreign_org uuid;actor uuid:='454e4e2b-09b0-4619-9470-c0bf4ac228e0';profile text;begin
 select o.org_id into org from academic_scope s join public.life_offerings o on o.id=s.f;
 select o.org_id into foreign_org from public.life_offerings o where o.org_id<>org limit 1;
 foreach profile in array array['none','expired','future','boundary-expired','duplicate-active','multiple-orgs'] loop
  perform set_config('request.jwt.claims','{}',true);
  delete from public.life_role_assignments where person_id=actor;
  if profile<>'none' then
   insert into public.life_role_assignments(person_id,org_id,role,valid_from,valid_until)
   values(actor,org,'INSTRUCTOR',case when profile='future' then now()+interval '1 day' else now()-interval '2 days' end,
    case when profile='expired' then now()-interval '1 day' when profile='boundary-expired' then now() end);
  end if;
  if profile='duplicate-active' then
   insert into public.life_role_assignments(person_id,org_id,role,valid_from) values(actor,org,'INSTRUCTOR',now()-interval '1 day');
  elsif profile='multiple-orgs' then
   insert into public.life_role_assignments(person_id,org_id,role) values(actor,foreign_org,'INSTRUCTOR');
   insert into public.life_offering_instructors(offering_id,person_id)
    select o.id,actor from public.life_offerings o where o.org_id=foreign_org
     and not exists(select 1 from public.life_offering_instructors i where i.offering_id=o.id and i.person_id=actor) limit 1;
  end if;
  perform set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal2","session_id":"1a0d6d22-2dd8-433f-a086-5f932d61d162"}',true);
  set local role authenticated;
  perform pg_temp.compare_learning(profile);
  if profile in('none','expired','future','boundary-expired') and exists(select 1 from public.life_instructor_home_summary()) then raise exception 'INVALID_ROLE_VISIBLE';end if;
  reset role;
 end loop;
 perform set_config('request.jwt.claims','{}',true);
 delete from public.life_role_assignments where person_id=actor;
 insert into public.life_role_assignments select * from loading_roles;
 delete from public.life_offering_instructors where person_id=actor;
 insert into public.life_offering_instructors select * from loading_assignments;
 update public.life_offering_instructors set valid_until=now() where person_id=actor;
 perform set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal2","session_id":"1a0d6d22-2dd8-433f-a086-5f932d61d162"}',true);
 set local role authenticated;perform pg_temp.compare_learning('expired assignment');reset role;
 perform set_config('request.jwt.claims','{}',true);
 delete from public.life_offering_instructors where person_id=actor;
 insert into public.life_offering_instructors select * from loading_assignments;
end$$;
select set_config('request.jwt.claims','{"sub":"41d6ddcd-af44-49aa-9579-c48231377a2d","role":"authenticated","aal":"aal2","session_id":"d4880b5a-cde3-433f-9457-74a713ad5a3c"}',true);
set local role authenticated;
select pg_temp.compare_learning('learner active/withdrawn/latest/stale/approved history');
reset role;
select set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal2","session_id":"00000000-0000-4000-8000-000000000000"}',true);
set local role authenticated;
select pg_temp.compare_learning('invalid session');
do $$begin
 if exists(select 1 from public.life_instructor_home_summary()) or public.life_completion_history()<>'[]'::jsonb then raise exception 'INVALID_SESSION_EXPOSED';end if;
end$$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$begin
 begin perform * from public.life_instructor_home_summary();raise exception 'ANON_SUMMARY_EXPOSED';exception when insufficient_privilege then null;end;
 begin perform public.life_completion_history();raise exception 'ANON_HISTORY_EXPOSED';exception when insufficient_privilege then null;end;
 raise notice 'PASS anonymous RPC privileges unchanged';
end$$;
reset role;
do $$declare r record;h text;begin
 for r in select * from academic_preserved loop
  execute format('select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,''[]'')) from %s x',r.label) into h;
  if h is distinct from r.hash then raise exception 'ORIGINAL_HISTORY_MUTATED %',r.label;end if;
 end loop;
 raise notice 'PASS all original academic/evidence hashes preserved after equivalence checks';
end$$;
rollback;
