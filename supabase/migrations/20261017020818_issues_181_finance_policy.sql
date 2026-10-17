begin;

-- Existing policy functions retain scope, immutable approval and optimistic checks.
do $$declare fn regprocedure; definition text;begin
 foreach fn in array array['life_private.create_recruitment_policy_draft(uuid,text,text,text,text)'::regprocedure,'life_private.update_recruitment_policy_draft(uuid,text,text,text,text)'::regprocedure,'life_private.approve_recruitment_policy_draft(uuid,text,text)'::regprocedure] loop
  definition:=pg_get_functiondef(fn);
  definition:=replace(definition,'''ENROLLMENT'', ''COMPLETION''','''ENROLLMENT'', ''COMPLETION'', ''REFUND''');
  if fn='life_private.approve_recruitment_policy_draft(uuid,text,text)'::regprocedure then
   definition:=replace(definition,'  update public.life_policy_versions',$patch$
  if current_policy.kind='REFUND' and not exists(select 1 from public.life_refund_rules r where r.policy_id=current_policy.id) then raise exception 'REFUND_RULES_REQUIRED';end if;
  update public.life_policy_versions$patch$);
  end if;
  execute definition;
 end loop;
end$$;

create function life_private.approve_refund_policy(policy_id uuid,expected_title text,expected_body text,rules jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare policy public.life_policy_versions; rule jsonb;begin
 select * into policy from public.life_policy_versions where id=policy_id for update;
 if policy.id is null or not life_private.has_role(policy.org_id,'COURSE_MANAGER') then raise exception 'FORBIDDEN';end if;
 if policy.kind<>'REFUND' or policy.status<>'DRAFT' then raise exception 'POLICY_NOT_DRAFT';end if;
 if policy.title is distinct from expected_title or policy.body is distinct from expected_body then raise exception 'REVISION_CHANGED';end if;
 if rules is null or jsonb_typeof(rules)<>'array' or jsonb_array_length(rules) not between 1 and 20 then raise exception 'REFUND_RULES_REQUIRED';end if;
 for rule in select * from jsonb_array_elements(rules) loop
  if jsonb_typeof(rule)<>'object' or not rule ?& array['label','basis','numerator','denominator'] or (select count(*) from jsonb_object_keys(rule))<>4
   or length(btrim(rule->>'label')) not between 1 and 300 or rule->>'basis' not in ('TUITION','PAID')
   or coalesce(rule->>'numerator','') !~ '^\d{1,6}$' or coalesce(rule->>'denominator','') !~ '^\d{1,6}$'
   or (rule->>'denominator')::integer not between 1 and 100000 or (rule->>'numerator')::integer not between 0 and (rule->>'denominator')::integer then raise exception 'INVALID_REFUND_RULE';end if;
  insert into public.life_refund_rules(policy_id,label,basis,numerator,denominator) values(policy.id,btrim(rule->>'label'),rule->>'basis',(rule->>'numerator')::integer,(rule->>'denominator')::integer);
 end loop;
 perform life_private.approve_recruitment_policy_draft(policy_id,expected_title,expected_body);
end$$;
create function public.life_approve_refund_policy(policy_id uuid,expected_title text,expected_body text,rules jsonb) returns void
language sql security invoker set search_path='' as $$select life_private.approve_refund_policy(policy_id,expected_title,expected_body,rules)$$;

create function life_private.configure_course_finance(f uuid,expected_revision bigint,tuition bigint,policy uuid,hours integer,instructions text) returns void
language plpgsql security definer set search_path='' as $$
declare o public.life_offerings;begin
 select * into o from public.life_offerings where id=f for update;
 if not life_private.manages(f) then raise exception 'FORBIDDEN';end if;
 if o.academic_revision is distinct from expected_revision then raise exception 'REVISION_CHANGED';end if;
 if o.status not in ('DRAFT','PUBLISHED','CLOSED') or o.academic_sealed then raise exception 'COURSE_READ_ONLY';end if;
 if exists(select 1 from public.life_applications where offering_id=f) or exists(select 1 from public.life_learner_document_requests where offering_id=f and deleted_at is null) or exists(select 1 from public.life_invoices where offering_id=f) then raise exception 'FINANCE_TERMS_LOCKED';end if;
 if tuition is null or tuition not between 0 and 100000000 then raise exception 'INVALID_INPUT';end if;
 if tuition=0 then
  delete from public.life_offering_finance where offering_id=f;
 else
  if hours is null or hours not between 1 and 720 or instructions is null or length(btrim(instructions)) not between 1 and 3000 then raise exception 'INVALID_INPUT';end if;
  if not life_private.policy_valid(policy,o.org_id,'REFUND') or not exists(select 1 from public.life_refund_rules where policy_id=policy) then raise exception 'APPROVED_REFUND_POLICY_REQUIRED';end if;
  insert into public.life_offering_finance values(f,o.org_id,policy,hours,btrim(instructions),life_private.person_id())
  on conflict(offering_id) do update set policy_id=excluded.policy_id,reservation_hours=excluded.reservation_hours,instructions=excluded.instructions,configured_by=excluded.configured_by;
 end if;
 update public.life_offerings set tuition=configure_course_finance.tuition,academic_revision=academic_revision+1 where id=f;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details) values(o.org_id,life_private.person_id(),'COURSE_FINANCE_UPDATED',f,jsonb_build_object('tuition',tuition,'policy_id',case when tuition=0 then null else policy end,'previous_tuition',o.tuition));
end$$;
create function public.life_configure_course_finance(f uuid,expected_revision bigint,tuition bigint,policy uuid,hours integer,instructions text) returns void
language sql security invoker set search_path='' as $$select life_private.configure_course_finance(f,expected_revision,tuition,policy,hours,instructions)$$;

revoke all on function life_private.approve_refund_policy(uuid,text,text,jsonb),public.life_approve_refund_policy(uuid,text,text,jsonb),life_private.configure_course_finance(uuid,bigint,bigint,uuid,integer,text),public.life_configure_course_finance(uuid,bigint,bigint,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function life_private.approve_refund_policy(uuid,text,text,jsonb),public.life_approve_refund_policy(uuid,text,text,jsonb),life_private.configure_course_finance(uuid,bigint,bigint,uuid,integer,text),public.life_configure_course_finance(uuid,bigint,bigint,uuid,integer,text) to authenticated;
notify pgrst,'reload schema';
commit;
