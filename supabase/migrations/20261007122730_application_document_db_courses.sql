begin;

-- New applications always carry an explicit, publicly discoverable DB offering.
-- Keep historical retries bound to their original record, including unlinked PDFs.
create or replace function life_private.submit_learner_document(
 k text,f uuid,request_key uuid,course_name text,applicant_name text,phone text,
 occurrence text,amount integer,pdf_base64 text,pdf_sha256 text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare p uuid:=life_private.person_id(); existing public.life_learner_document_requests;
begin
 if p is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into existing from public.life_learner_document_requests d
 where d.person_id=p and d.request_key=submit_learner_document.request_key;
 if existing.id is not null then
  if k='APPLICATION' and f is null then f:=existing.offering_id; end if;
 elsif k='APPLICATION' then
  if f is null or not exists(
   select 1 from public.life_offerings o where o.id=f and (
    exists(select 1 from life_private.course_introductions(o.id))
    or exists(select 1 from public.life_course_guides guide where guide.offering_id=o.id and guide.published)
   )
  ) then raise exception 'COURSE_NOT_FOUND'; end if;
 end if;
 return life_private.submit_learner_document_base(k,f,request_key,course_name,applicant_name,phone,occurrence,amount,pdf_base64,pdf_sha256);
end$$;

-- CREATE OR REPLACE retains the existing checked wrapper's owner and grants.
notify pgrst,'reload schema';
commit;
