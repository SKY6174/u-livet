begin;
create function life_private.operation_source_file_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if exists (select 1 from public.life_operation_documents d where d.offering_id=old.offering_id
   and d.content#>>'{sourceSignature,fileId}'=old.id::text) then
  raise exception 'SOURCE_SIGNATURE_IN_USE';
 end if;
 return old;
end$$;
create trigger life_operation_source_file_guard before delete on public.life_report_files
for each row execute function life_private.operation_source_file_guard();
commit;
