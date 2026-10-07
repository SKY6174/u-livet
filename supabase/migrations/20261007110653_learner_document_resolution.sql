begin;

-- Approval resolves application documents; financial approvals await payment.
-- A blank optional staff note preserves the last displayed message.
create or replace function life_private.decide_learner_document(r uuid,next_status text,note text,expected_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare req public.life_learner_document_requests; p uuid:=life_private.person_id();
 staff_note text:=btrim(coalesce(note,''));
begin
 if p is null or not life_private.mfa_recent() then raise exception 'MFA_REAUTH_REQUIRED';end if;
 select * into req from public.life_learner_document_requests x where x.id=r for update;
 if req.id is null then raise exception 'NOT_FOUND';end if;
 if not life_private.learner_document_staff(req.org_id) then raise exception 'FORBIDDEN';end if;
 if expected_revision is distinct from req.revision then raise exception 'STALE_REVISION';end if;
 if length(staff_note)>1000 then raise exception 'NOTE_TOO_LONG';end if;
 if not ((req.status='RECEIVED' and next_status in ('REVIEWING','APPROVED','REJECTED'))
  or (req.status='REVIEWING' and next_status in ('APPROVED','REJECTED'))
  or (req.status='APPROVED' and next_status='COMPLETED')) then raise exception 'INVALID_TRANSITION';end if;
 update public.life_learner_document_requests set status=next_status,
  current_note=coalesce(nullif(staff_note,''),req.current_note),reviewer_id=p,
  revision=revision+1,updated_at=now(),resolved_at=case
   when next_status in ('REJECTED','COMPLETED') or (req.kind='APPLICATION' and next_status='APPROVED')
    then coalesce(req.resolved_at,now()) else null end where id=r;
 insert into public.life_learner_document_events(request_id,actor_id,from_status,to_status,note)
 values(r,p,req.status,next_status,staff_note);
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
 values(req.org_id,p,'LEARNER_DOCUMENT_'||next_status,r,jsonb_build_object('kind',req.kind,'from_status',req.status,'revision',req.revision+1));
end$$;

update public.life_learner_document_requests set resolved_at=updated_at
where kind='APPLICATION' and status='APPROVED' and resolved_at is null;

commit;
