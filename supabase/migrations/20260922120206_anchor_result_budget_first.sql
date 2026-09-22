begin;

-- A changed responsibility invalidates any pending result signature.
create or replace function life_private.operation_assign(f uuid,p uuid,expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare prior integer; prior_person uuid; begin
 if not life_private.operation_access(f) or not life_private.operation_manager(f) then raise exception 'FORBIDDEN';end if;
 perform 1 from public.life_offerings where id=f for update;
 select revision,person_id into prior,prior_person from public.life_operation_responsibilities where offering_id=f;
 if coalesce(prior,0) is distinct from expected_revision then raise exception 'REVISION_CHANGED';end if;
 if not exists(select 1 from public.life_offering_instructors i join public.life_offerings o on o.id=i.offering_id join public.life_people pp on pp.id=i.person_id where i.offering_id=f and i.person_id=p and pp.active and (i.valid_until is null or i.valid_until>now()) and exists(select 1 from public.life_role_assignments a where a.person_id=p and a.org_id=o.org_id and a.role='INSTRUCTOR' and a.valid_from<=now() and (a.valid_until is null or a.valid_until>now()))) then raise exception 'INVALID_RESPONSIBLE';end if;
 if prior_person=p then return;end if;
 insert into public.life_operation_responsibilities(offering_id,person_id,updated_by) values(f,p,life_private.person_id()) on conflict(offering_id) do update set person_id=p,revision=public.life_operation_responsibilities.revision+1,updated_at=now(),updated_by=life_private.person_id();
 update public.life_operation_documents set status='DRAFT',reviewed_at=null,reviewed_by=null,
 content=case when kind='result' then jsonb_set(content,'{signature}','""'::jsonb) else content end,
 revision=revision+1,return_note='책임강사가 변경되어 내용을 다시 확인해야 합니다.',updated_at=now(),updated_by=life_private.person_id() where offering_id=f and status<>'SUBMITTED';
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details) select org_id,life_private.person_id(),'OPERATION_RESPONSIBLE_ASSIGNED',f,jsonb_build_object('person_id',p) from public.life_offerings where id=f;
end$$;

create or replace function life_private.operation_save(f uuid,k text,c jsonb,b jsonb,expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.life_operation_documents; manager boolean; responsible boolean; budget_value jsonb;begin
 if not life_private.operation_access(f) then raise exception 'FORBIDDEN';end if;
 manager:=life_private.operation_manager(f);
 responsible:=exists(select 1 from public.life_operation_responsibilities where offering_id=f and person_id=life_private.person_id()) and life_private.teaches(f);
 if not manager and b is not null then raise exception 'BUDGET_FORBIDDEN';end if;
 perform 1 from public.life_offerings where id=f for update;
 select * into d from public.life_operation_documents where offering_id=f and kind=k;
 if coalesce(d.revision,0) is distinct from expected_revision then raise exception 'REVISION_CHANGED';end if;
 if d.status='SUBMITTED' or (k='plan' and d.status='REVIEW' and not manager) or (k='result' and coalesce(d.status,'DRAFT')='DRAFT' and not manager) then raise exception 'DOCUMENT_LOCKED';end if;
 if not life_private.operation_content_valid(c,k) then raise exception 'INVALID_CONTENT';end if;
 budget_value:=coalesce(b,d.budget,life_private.operation_default_budget(f,k));
 if not life_private.operation_budget_valid(budget_value,k) then raise exception 'INVALID_BUDGET';end if;
 if k='result' then
  if d.status='REVIEW' and budget_value is distinct from d.budget then raise exception 'BUDGET_LOCKED';end if;
  if coalesce(c->>'signature','')<>'' and (d.status is null or d.status='DRAFT') then raise exception 'SIGNATURE_STAGE';end if;
  if coalesce(c->>'signature','')<>'' and c->>'signature' is distinct from coalesce(d.content->>'signature','') and not responsible then raise exception 'SIGNATURE_FORBIDDEN';end if;
  if coalesce(c->>'signature','')<>'' and c->>'signature'=coalesce(d.content->>'signature','') and c-'signature' is distinct from d.content-'signature' then raise exception 'SIGNATURE_STALE';end if;
 end if;
 insert into public.life_operation_documents(offering_id,kind,content,budget,updated_by) values(f,k,c,budget_value,life_private.person_id())
 on conflict(offering_id,kind) do update set content=c,budget=budget_value,revision=public.life_operation_documents.revision+1,updated_at=now(),updated_by=life_private.person_id();
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details) select org_id,life_private.person_id(),'OPERATION_DOCUMENT_SAVED',f,jsonb_build_object('kind',k,'revision',coalesce(d.revision,0)+1) from public.life_offerings where id=f;
 return life_private.operation_context(f);
end$$;

create or replace function life_private.operation_transition(f uuid,k text,intent text,expected_revision integer,note text,confirmed boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.life_operation_documents; manager boolean; responsible boolean; next_status text;begin
 if not life_private.operation_access(f) then raise exception 'FORBIDDEN';end if;
 manager:=life_private.operation_manager(f);
 responsible:=exists(select 1 from public.life_operation_responsibilities where offering_id=f and person_id=life_private.person_id()) and life_private.teaches(f);
 perform 1 from public.life_offerings where id=f for update;
 select * into d from public.life_operation_documents where offering_id=f and kind=k;
 if d.revision is null or d.revision is distinct from expected_revision then raise exception 'REVISION_CHANGED';end if;
 if note is null or length(note)>2000 then raise exception 'INVALID_INPUT';end if;
 if intent='review' then
  if d.status<>'DRAFT' then raise exception 'INVALID_TRANSITION';end if;
  if not exists(select 1 from public.life_operation_responsibilities r join public.life_offering_instructors i on i.offering_id=r.offering_id and i.person_id=r.person_id join public.life_offerings o on o.id=r.offering_id join public.life_people p on p.id=r.person_id where r.offering_id=f and p.active and (i.valid_until is null or i.valid_until>now()) and exists(select 1 from public.life_role_assignments a where a.person_id=r.person_id and a.org_id=o.org_id and a.role='INSTRUCTOR' and a.valid_from<=now() and (a.valid_until is null or a.valid_until>now()))) then raise exception 'RESPONSIBLE_REQUIRED';end if;
  if k='result' then
   if not manager then raise exception 'FORBIDDEN';end if;
   if confirmed is distinct from true or not life_private.operation_budget_valid(d.budget,k,true) then raise exception 'BUDGET_REQUIRED';end if;
  elsif confirmed is distinct from true or not life_private.operation_content_valid(d.content,k,true) then raise exception 'CONTENT_REQUIRED';end if;
  next_status:='REVIEW';
 elsif intent='submit' then
  if (k='result' and not responsible) or (k='plan' and not manager) then raise exception 'FORBIDDEN';end if;
  if d.status<>'REVIEW' then raise exception 'INVALID_TRANSITION';end if;
  if confirmed is distinct from true or not life_private.operation_budget_valid(d.budget,k,true) then raise exception 'BUDGET_REQUIRED';end if;
  if not life_private.operation_content_valid(d.content,k,true) then raise exception 'CONTENT_REQUIRED';end if;
  if k='result' and coalesce(d.content->>'signature','')='' then raise exception 'SIGNATURE_REQUIRED';end if;
  next_status:='SUBMITTED';
 elsif intent in ('return','reopen') then
  if not manager then raise exception 'FORBIDDEN';end if;
  if (intent='return' and d.status<>'REVIEW') or (intent='reopen' and d.status<>'SUBMITTED') or btrim(note)='' then raise exception 'REASON_REQUIRED';end if;
  next_status:='DRAFT';
 else raise exception 'INVALID_TRANSITION';end if;
 update public.life_operation_documents set status=next_status,revision=revision+1,updated_at=now(),updated_by=life_private.person_id(),
 content=case when k='result' and next_status='DRAFT' then jsonb_set(content,'{signature}','""'::jsonb) else content end,
 reviewed_at=case when intent='review' then now() when next_status='DRAFT' then null else reviewed_at end,
 reviewed_by=case when intent='review' then life_private.person_id() when next_status='DRAFT' then null else reviewed_by end,
 submitted_at=case when next_status='SUBMITTED' then now() else null end,submitted_by=case when next_status='SUBMITTED' then life_private.person_id() else null end,
 return_note=case when next_status='DRAFT' then note else '' end where offering_id=f and kind=k;
 if next_status='SUBMITTED' then insert into public.life_operation_submissions(offering_id,kind,content,budget,revision,submitted_by) values(f,k,d.content,d.budget,d.revision+1,life_private.person_id());end if;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details) select org_id,life_private.person_id(),'OPERATION_DOCUMENT_'||upper(intent),f,jsonb_build_object('kind',k,'revision',d.revision+1,'note',note) from public.life_offerings where id=f;
 return life_private.operation_context(f);
end$$;

-- Existing in-progress reports must pass the new budget gate before editing resumes.
update public.life_operation_documents set status='DRAFT',reviewed_at=null,reviewed_by=null,
 content=jsonb_set(content,'{signature}','""'::jsonb),revision=revision+1,updated_at=now(),
 return_note='제출 절차가 변경되어 담당자 예산 확정 후 책임강사가 작성·서명합니다.'
where kind='result' and status='REVIEW';
update public.life_operation_documents set content=jsonb_set(content,'{signature}','""'::jsonb),revision=revision+1,updated_at=now()
where kind='result' and status='DRAFT' and coalesce(content->>'signature','')<>'';

commit;
