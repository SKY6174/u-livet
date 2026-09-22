-- Preserve the server-owned plan budget when a responsible instructor first saves results.
create function life_private.operation_default_budget(f uuid,k text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare legacy jsonb; plan_budget jsonb; rows_value jsonb;
begin
 select payload into legacy from public.life_course_reports where offering_id=f;
 select budget into plan_budget from public.life_operation_documents where offering_id=f and kind='plan';
 if k='result' and jsonb_array_length(coalesce(legacy->'budgets','[]'::jsonb))>0 then
  select jsonb_agg(jsonb_build_object('category',r->>'category','calculation','','planned',coalesce(r->>'planned',''),'spent',coalesce(r->>'spent',''),'note',coalesce(r->>'note',''))) into rows_value from jsonb_array_elements(legacy->'budgets') r;
 elsif k='result' and plan_budget is not null then
  select jsonb_agg(jsonb_build_object('category',category,'calculation','','planned',
   coalesce((select sum(coalesce(nullif(r->>'planned',''),'0')::numeric)::text from jsonb_array_elements(plan_budget->'rows') r
    where case when category='강사료' then r->>'category' in ('내부강사','외부강사','보조강사') else r->>'category'=category end),'0'),
   'spent','','note','') order by position) into rows_value
  from unnest(array['운영비','인쇄비','재료비','강사료']) with ordinality as categories(category,position);
 else
  select jsonb_agg(jsonb_build_object('category',category,'calculation','','planned','','spent','','note','') order by position) into rows_value
  from unnest(case when k='plan' then array['내부강사','외부강사','보조강사','보조인력','장학금','운영비','인쇄비','재료비','수강료'] else array['운영비','인쇄비','재료비','강사료'] end) with ordinality as categories(category,position);
 end if;
 return jsonb_build_object('rows',rows_value,
  'scholarshipCount',case when k='result' then coalesce(legacy->'sourceReport'->>'scholarshipRecipients','') else '' end,
  'scholarshipAmount',case when k='result' then coalesce(legacy->'sourceReport'->>'scholarshipAmount','') else '' end,'scholarshipNote','');
end$$;
revoke all on function life_private.operation_default_budget(uuid,text) from public,anon,authenticated,service_role;

create or replace function life_private.operation_save(f uuid,k text,c jsonb,b jsonb,expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.life_operation_documents; manager boolean; budget_value jsonb;begin
 if not life_private.operation_access(f) then raise exception 'FORBIDDEN';end if;
 manager:=life_private.operation_manager(f);
 if not manager and b is not null then raise exception 'BUDGET_FORBIDDEN';end if;
 perform 1 from public.life_offerings where id=f for update;
 select * into d from public.life_operation_documents where offering_id=f and kind=k;
 if coalesce(d.revision,0) is distinct from expected_revision then raise exception 'REVISION_CHANGED';end if;
 if d.status='SUBMITTED' or (d.status='REVIEW' and not manager) then raise exception 'DOCUMENT_LOCKED';end if;
 if not life_private.operation_content_valid(c,k) then raise exception 'INVALID_CONTENT';end if;
 budget_value:=coalesce(b,d.budget,life_private.operation_default_budget(f,k));
 if not life_private.operation_budget_valid(budget_value,k) then raise exception 'INVALID_BUDGET';end if;
 insert into public.life_operation_documents(offering_id,kind,content,budget,updated_by) values(f,k,c,budget_value,life_private.person_id())
 on conflict(offering_id,kind) do update set content=c,budget=budget_value,revision=public.life_operation_documents.revision+1,updated_at=now(),updated_by=life_private.person_id();
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details) select org_id,life_private.person_id(),'OPERATION_DOCUMENT_SAVED',f,jsonb_build_object('kind',k,'revision',coalesce(d.revision,0)+1) from public.life_offerings where id=f;
 return life_private.operation_context(f);
end$$;
