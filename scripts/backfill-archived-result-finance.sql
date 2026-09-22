-- One-time, source-verified correction for the three archived operation drafts.
-- Execute only against the intended production project with Supabase Management API.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $backfill$
declare item record; next_budget jsonb; changed integer; processed integer:=0;
begin
 if auth.uid() is not null then raise exception 'ADMINISTRATIVE_OPERATION_ONLY'; end if;
 for item in
  select d.offering_id,d.revision,d.status,d.budget,d.content,o.org_id,r.payload,f.body,
         r.payload#>>'{sourceReport,sha256}' as source_hash
  from public.life_operation_documents d
  join public.life_offerings o on o.id=d.offering_id
  join public.life_course_reports r on r.offering_id=d.offering_id
  join public.life_report_files f on f.offering_id=d.offering_id and f.kind='result'
  where d.kind='result' and d.offering_id in (
   '361eda75-8153-4b2b-86dc-3724a5105f17'::uuid,
   '6f436e94-61df-4822-bea3-eccbf25b4c5b'::uuid,
   '1e1e0bb6-f2b2-4b2a-b99f-127e462db915'::uuid
  ) for update of d
 loop
  processed:=processed+1;
  if item.revision<>1 or item.status<>'DRAFT' or item.budget->>'scholarshipAmount'<>''
     or exists(select 1 from jsonb_array_elements(item.budget->'rows') b where b->>'planned'<>'' or b->>'spent'<>'')
     or item.source_hash is null or item.source_hash<>encode(sha256(decode(item.body,'base64')),'hex')
     or jsonb_typeof(item.payload->'budgets')<>'array' then
   raise exception 'SOURCE_OR_DRAFT_CHANGED: %',item.offering_id;
  end if;
  select jsonb_build_object(
   'rows',jsonb_agg(jsonb_build_object('category',v->>'category','calculation','',
      'planned',v->>'planned','spent',v->>'spent','note',coalesce(v->>'note','')) order by ord),
   'scholarshipCount',item.payload#>>'{sourceReport,scholarshipRecipients}',
   'scholarshipAmount',item.payload#>>'{sourceReport,scholarshipAmount}',
   'scholarshipNote','원본 결과보고서 기준') into next_budget
  from jsonb_array_elements(item.payload->'budgets') with ordinality as x(v,ord);
  if not life_private.operation_budget_valid(next_budget,'result') then
   raise exception 'INVALID_SOURCE_BUDGET: %',item.offering_id;
  end if;
  update public.life_operation_documents set budget=next_budget,revision=revision+1,updated_at=now()
   where offering_id=item.offering_id and kind='result' and revision=1 and status='DRAFT';
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'REVISION_CHANGED: %',item.offering_id; end if;
  insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
   values(item.org_id,null,'ARCHIVED_OPERATION_FINANCE_IMPORTED',item.offering_id,
    jsonb_build_object('source_sha256',item.source_hash,'budget_rows',jsonb_array_length(next_budget->'rows'),
     'scholarship_count',next_budget->>'scholarshipCount','status','DRAFT'));
 end loop;
 if processed<>3 then raise exception 'EXPECTED_THREE_ARCHIVED_DRAFTS_FOUND_%',processed; end if;
end $backfill$;

select offering_id,status,revision,jsonb_array_length(budget->'rows') as budget_rows,
       budget->>'scholarshipCount' as scholarship_count,budget->>'scholarshipAmount' as scholarship_amount
from public.life_operation_documents
where kind='result' and offering_id in (
 '361eda75-8153-4b2b-86dc-3724a5105f17',
 '6f436e94-61df-4822-bea3-eccbf25b4c5b',
 '1e1e0bb6-f2b2-4b2a-b99f-127e462db915');
commit;
