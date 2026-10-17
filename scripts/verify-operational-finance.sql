-- LOCAL ONLY. Apply prerequisite/current migrations in the same transaction.
-- Fixtures, grants, documents and schema changes all roll back.
begin;
create temp table finance_fixture(n int,f uuid,person uuid,invoice uuid);
create temp table finance_payment_fixture(kind text,id uuid);
grant select on finance_fixture,finance_payment_fixture to authenticated;
do $$
declare actor uuid:='454e4e2b-09b0-4619-9470-c0bf4ac228e0';
 other_person uuid:='6ff24c6b-5d15-424e-963c-1b24dbff3903';
 hidden_person uuid:=gen_random_uuid();org uuid;seed public.life_offerings;policy uuid:=gen_random_uuid();enrollment_policy uuid;
 f uuid;person uuid;app uuid;i uuid;p uuid;r uuid;kind text;amount bigint;target uuid;
begin
 select org_id into org from public.life_role_assignments where person_id=actor and role='COURSE_MANAGER' limit 1;
 select * into seed from public.life_offerings where org_id=org limit 1;
 select id into enrollment_policy from public.life_policy_versions pv where pv.org_id=org and pv.kind='ENROLLMENT' limit 1;
 if seed.id is null or enrollment_policy is null then raise exception 'LOCAL_COURSE_FIXTURE_REQUIRED';end if;
 insert into public.life_people(id,name) values(hidden_person,'finance-hidden-person');
 insert into life_private.non_operational_members(person_id,reason) values(hidden_person,'Local visibility fixture');
 insert into public.life_role_assignments(person_id,org_id,role) values(actor,org,'FINANCE');
 insert into public.life_finance_grants(org_id,person_id,permission,valid_from,valid_until,approved_by,approval_reference)
 values(org,actor,'RECORD',now()-interval '1 day',now()+interval '1 day',other_person,'Local-only role fixture');
 insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at)
 values(policy,org,'REFUND',policy::text,'Local policy','Local policy','APPROVED',other_person,now());
 for n in 1..106 loop
  f:=gen_random_uuid();i:=gen_random_uuid();person:=case n when 3 then hidden_person when 5 then other_person else actor end;
  insert into public.life_offerings select (jsonb_populate_record(null::public.life_offerings,to_jsonb(seed)||jsonb_build_object('id',f,'name','finance-course-'||n))).*;
  if n=2 or n>=6 then insert into life_private.non_operational_offerings(offering_id,reason) values(f,'Local course fixture');end if;
  insert into public.life_offering_finance values(f,org,policy,24,'Local notice',actor);
  insert into public.life_applications(offering_id,person_id,policy_id,status) values(f,person,enrollment_policy,'SUBMITTED') returning id into app;
  insert into public.life_enrollments(offering_id,person_id,application_id) values(f,person,app);
  insert into public.life_invoices(id,application_id,offering_id,person_id,org_id,policy_id,amount,due_at,status,created_at)
  values(i,app,f,person,org,policy,10000,now()+interval '1 day',case n when 4 then 'EXPIRED' else 'SETTLED' end,now()+n*interval '1 minute');
  insert into public.life_refunds(invoice_id,reason,status,request_key,snapshot,amount)
  values(i,'Local fixture',case n when 4 then 'RECONCILING' else 'PAID' end,gen_random_uuid(),'{}',300) returning id into r;
  insert into public.life_refund_transfers(refund_id,org_id,status,amount,started_by) values(r,org,case n when 4 then 'RECONCILING' else 'PAID' end,300,other_person);
  if n=1 then
   insert into public.life_refunds(invoice_id,reason,status,request_key,snapshot,amount) values(i,'Local rejection','REJECTED',gen_random_uuid(),'{}',0);
   insert into public.life_credit_notes(invoice_id,amount,reason,source_key) values(i,100,'Local credit',i::text);
  end if;
  insert into public.life_payment_reports(invoice_id,amount,depositor,deposited_at,request_key) values(i,100,'Local report',now(),gen_random_uuid());
  insert into public.life_finance_events(invoice_id,actor_id,action) values(i,actor,'LOCAL_READ_FIXTURE');
  insert into finance_fixture values(n,f,person,i);
  if n>=6 then
   insert into public.life_payments(org_id,person_id,amount,deposited_at,depositor,external_ref,evidence,verified_by,created_at)
   values(org,person,10000,now(),'Local depositor',i::text,'Local evidence',actor,now()+n*interval '1 minute') returning id into p;
   insert into public.life_payment_allocations(payment_id,invoice_id,org_id,person_id,amount,request_key,allocated_by) values(p,i,org,person,10000,gen_random_uuid(),actor);
  end if;
 end loop;
 foreach kind in array array['mixed','hidden','person','unallocated','other','partial'] loop
  person:=case kind when 'person' then hidden_person when 'other' then other_person else actor end;
  amount:=case kind when 'mixed' then 10000 when 'hidden' then 3000 when 'partial' then 2500 else 5000 end;
  insert into public.life_payments(org_id,person_id,amount,deposited_at,depositor,external_ref,evidence,verified_by)
  values(org,person,amount,now(),'Local depositor',gen_random_uuid()::text,'Local evidence',actor) returning id into p;
  insert into finance_payment_fixture values(kind,p);
  if kind in ('mixed','hidden','partial','other') then
   select invoice into target from finance_fixture where n=case kind when 'other' then 5 else 2 end;
   insert into public.life_payment_allocations(payment_id,invoice_id,org_id,person_id,amount,request_key,allocated_by)
   values(p,target,org,person,case kind when 'partial' then 1000 when 'other' then 2000 else 3000 end,gen_random_uuid(),actor);
  end if;
  if kind='mixed' then
   select invoice into target from finance_fixture where n=1;
   insert into public.life_payment_allocations(payment_id,invoice_id,org_id,person_id,amount,request_key,allocated_by) values(p,target,org,actor,6000,gen_random_uuid(),actor);
  end if;
 end loop;
 insert into public.life_course_reports(offering_id,payload,updated_by)
 select cf.f,jsonb_build_object('scholarships',case n when 1 then jsonb_build_array(
 jsonb_build_object('personId',actor,'amount',100,'paidOn','2026-01-01'),
 jsonb_build_object('personId',other_person,'amount',200,'paidOn',''),
 jsonb_build_object('personId',hidden_person,'amount',9999,'paidOn','2026-01-01'),
 jsonb_build_object('personId','legacy-unmatched','amount',50,'paidOn',''))
 else jsonb_build_array(jsonb_build_object('personId',actor,'amount',5000,'paidOn','')) end,
 'sourceReport',jsonb_build_object('scholarshipAmount',12000)),actor from finance_fixture cf where n in (1,2);
 -- ID classification survives renaming; no name heuristics are used.
 update public.life_people set name='finance-renamed-person' where id=hidden_person;
 update public.life_offerings set name='finance-renamed-course' where id=(select cf.f from finance_fixture cf where n=2);
 perform set_config('request.jwt.claims','{"sub":"b3ec6670-7950-4a2c-9562-fb266e004dd0","role":"authenticated","aal":"aal2","session_id":"1a0d6d22-2dd8-433f-a086-5f932d61d162"}',true);
 if life_private.person_id()<>actor then raise exception 'LOCAL_VERIFIED_ACTOR_REQUIRED';end if;
end$$;
create temp table finance_preserved as
 select 'invoices' label,md5(jsonb_agg(to_jsonb(t) order by id)::text) hash from public.life_invoices t
 union all select 'payments',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_payments t
 union all select 'allocations',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_payment_allocations t
 union all select 'refunds',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_refunds t
 union all select 'transfers',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_refund_transfers t
 union all select 'reports',md5(jsonb_agg(to_jsonb(t) order by offering_id)::text) from public.life_course_reports t;
do $$declare t record;begin
 if (select count(*) from life_private.operational_invoices where id in(select invoice from finance_fixture))<>3 or (select sum(amount) from life_private.operational_invoices where id in(select invoice from finance_fixture))<>30000
 or (select count(*) from life_private.operational_refunds)<>4 or (select count(*) from life_private.operational_refund_transfers)<>3 then raise exception 'INVOICE_REFUND_AGGREGATE_FAILED';end if;
 if (select count(*) from life_private.operational_payments)<>4 or (select sum(operational_amount) from life_private.operational_payments)<>18500 then raise exception 'PAYMENT_AGGREGATE_FAILED';end if;
 if (select count(*) from life_private.operational_scholarship_rows)<>3 or (select sum((entry->>'amount')::bigint) from life_private.operational_scholarship_rows)<>350 then raise exception 'SCHOLARSHIP_AGGREGATE_FAILED';end if;
 select * into t from life_private.fin_totals((select invoice from finance_fixture where n=1));
 if t.paid<>6000 or t.refunded<>300 or t.credited<>100 then raise exception 'RAW_TOTAL_CHANGED';end if;
 raise notice 'PASS common count/sum/status projections, original bank amounts and real unmatched scholarship rows';
end$$;
set local role authenticated;
do $$declare x jsonb;item jsonb;pay jsonb;begin
 x:=public.life_finance_overview(true);
 if (select count(*) from jsonb_array_elements(x->'invoices') v join finance_fixture f on f.invoice::text=v->>'id')<>3 or jsonb_array_length(x->'payments')<>4 then raise exception 'STAFF_SCOPE_OR_LIMIT_FAILED';end if;
 select v into item from jsonb_array_elements(x->'invoices') v where v->>'id'=(select invoice::text from finance_fixture where n=1);
 if (item->>'balance')::bigint<>4200 or jsonb_array_length(item->'refunds')<>2 or jsonb_array_length(item->'reports')<>1 or jsonb_array_length(item->'events')<>1 then raise exception 'NORMAL_HISTORY_OR_BALANCE_LOST';end if;
 select v into pay from jsonb_array_elements(x->'payments') v where v->>'id'=(select id::text from finance_payment_fixture where kind='mixed');
 if (pay->>'amount')::bigint<>10000 or (pay->>'operational_amount')::bigint<>7000 or (pay->>'unallocated')::bigint<>1000 then raise exception 'MIXED_PAYMENT_RECONCILIATION_FAILED';end if;
 select v into pay from jsonb_array_elements(x->'payments') v where v->>'id'=(select id::text from finance_payment_fixture where kind='partial');
 if (pay->>'operational_amount')::bigint<>1500 or (pay->>'unallocated')::bigint<>1500 then raise exception 'REAL_UNALLOCATED_CASH_LOST';end if;
 x:=public.life_finance_overview(false);
 if (select count(*) from jsonb_array_elements(x->'invoices') v join finance_fixture f on f.invoice::text=v->>'id')<>2 or jsonb_array_length(x->'payments')<>3 then raise exception 'PERSONAL_SCOPE_FAILED';end if;
 x:=public.life_my_learning();
 if jsonb_array_length(x->'scholarships')<>1 or (x#>>'{scholarships,0,amount}')::int<>100 then raise exception 'LEARNER_SCHOLARSHIP_SCOPE_FAILED';end if;
 x:=public.life_course_workspace((select f from finance_fixture where n=1));
 if (x#>>'{0,scholarship_count}')::int<>3 or (x#>>'{0,scholarship_unpaid}')::int<>2 then raise exception 'WORKSPACE_SCHOLARSHIP_STATS_FAILED';end if;
 if has_table_privilege(current_user,'life_private.operational_payments','SELECT') or has_table_privilege(current_user,'life_private.operational_scholarship_rows','SELECT') then raise exception 'PRIVATE_VIEW_EXPOSED';end if;
 begin perform public.life_finance_overview(null);raise exception 'NULL_INPUT_ACCEPTED';exception when raise_exception then if sqlerrm<>'INVALID_INPUT' then raise;end if;end;
 raise notice 'PASS staff/self RPC, filter before latest 100, mixed payment/unallocated balance, nested history, learner/workspace scholarships';
end$$;
reset role;
do $$begin
 if exists(select * from finance_preserved except (
 select 'invoices',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_invoices t
 union all select 'payments',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_payments t
 union all select 'allocations',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_payment_allocations t
 union all select 'refunds',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_refunds t
 union all select 'transfers',md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.life_refund_transfers t
 union all select 'reports',md5(jsonb_agg(to_jsonb(t) order by offering_id)::text) from public.life_course_reports t)) then raise exception 'ORIGINAL_HISTORY_MUTATED';end if;
 raise notice 'PASS original ledger/document JSON hashes unchanged';
end$$;
select set_config('request.jwt.claims','{"sub":"41d6ddcd-af44-49aa-9579-c48231377a2d","role":"authenticated","aal":"aal2","session_id":"d4880b5a-cde3-433f-9457-74a713ad5a3c"}',true);
set local role authenticated;
do $$declare x jsonb;begin
 x:=public.life_finance_overview(true);
 if jsonb_array_length(x->'permissions')<>0 or jsonb_array_length(x->'invoices')<>0 or jsonb_array_length(x->'payments')<>0 then raise exception 'UNDELEGATED_STAFF_EXPOSED';end if;
 x:=public.life_finance_overview(false);
 if (select count(*) from jsonb_array_elements(x->'invoices') v join finance_fixture f on f.invoice::text=v->>'id')<>1 or jsonb_array_length(x->'payments')<>1 then raise exception 'OTHER_PERSON_SCOPE_EXPOSED';end if;
 raise notice 'PASS other organization/unassigned staff cannot read finance, own records retained';
end$$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$begin
 begin perform public.life_finance_overview(false);raise exception 'ANON_EXPOSED';exception when insufficient_privilege then null;end;
 if has_table_privilege(current_user,'life_private.operational_payments','SELECT') then raise exception 'ANON_VIEW_EXPOSED';end if;
 raise notice 'PASS anonymous/private view access denied';
end$$;
reset role;
rollback;
