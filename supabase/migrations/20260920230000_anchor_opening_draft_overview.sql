begin;
create function life_private.opening_working_copy_summaries(o uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p uuid:=life_private.person_id(); result jsonb;
begin
 if p is null or not life_private.has_role(o,'COURSE_MANAGER') then raise exception 'FORBIDDEN'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('source_id',c.source_id,'revision',c.revision,'updated_at',c.updated_at) order by c.source_id),'[]'::jsonb)
 into result from public.life_opening_working_copies c where c.org_id=o and c.person_id=p;
 return result;
end $$;
create function public.life_opening_working_copy_summaries(o uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select life_private.opening_working_copy_summaries(o)$$;
revoke all on function life_private.opening_working_copy_summaries(uuid),public.life_opening_working_copy_summaries(uuid) from public,anon,authenticated,service_role;
grant execute on function life_private.opening_working_copy_summaries(uuid),public.life_opening_working_copy_summaries(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
