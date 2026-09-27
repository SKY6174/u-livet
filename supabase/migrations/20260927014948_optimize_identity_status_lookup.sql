-- Resolve session status once while preserving every person_id authorization condition.
create or replace function life_private.person_id() returns uuid
language sql stable security definer set search_path = '' as $function$
  with auth_state as materialized (
    select life_private.auth_status() as value
  )
  select a.person_id
  from public.life_auth_links a
  cross join auth_state s
  where a.auth_user_id = auth.uid()
    and (s.value->>'active')::boolean
    and not (s.value->>'needs_reset')::boolean
    and (
      (not life_private.mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2')
      or life_private.mfa_verified()
    )
$function$;
