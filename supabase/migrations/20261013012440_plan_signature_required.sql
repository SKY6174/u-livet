begin;

-- Keep draft saves and existing submission snapshots unchanged. Enforce both
-- review and final submission inside the existing authorized transaction.
create function life_private.require_plan_signature() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.kind='plan' and new.status in ('REVIEW','SUBMITTED') and coalesce(new.content->>'signature','')='' then
  raise exception 'PLAN_SIGNATURE_REQUIRED';
 end if;
 return new;
end $$;
revoke all on function life_private.require_plan_signature() from public,anon,authenticated,service_role;

create trigger life_operation_plan_signature_required
before insert or update of status on public.life_operation_documents
for each row execute function life_private.require_plan_signature();

commit;
