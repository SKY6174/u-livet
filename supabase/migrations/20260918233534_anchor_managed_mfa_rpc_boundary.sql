-- Keep privileged implementation outside the exposed Data API schema.
alter function public.life_prepare_mfa_change(text,uuid) set schema life_private;
create function public.life_prepare_mfa_change(k text,f uuid default null) returns text
language sql security invoker set search_path='' as $$
 select life_private.life_prepare_mfa_change(k,f)
$$;
revoke all on function public.life_prepare_mfa_change(text,uuid),life_private.life_prepare_mfa_change(text,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.life_prepare_mfa_change(text,uuid),life_private.life_prepare_mfa_change(text,uuid) to authenticated;
