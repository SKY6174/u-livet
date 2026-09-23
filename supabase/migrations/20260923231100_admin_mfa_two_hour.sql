begin;

-- Keep both the database authentication event and the signed JWT's TOTP event
-- within the same two-hour window. Token refresh alone must not renew it.
create or replace function life_private.mfa_recent() returns boolean
language sql stable security definer set search_path='' as $$
 select life_private.mfa_verified() and exists(
 select 1 from auth.mfa_amr_claims c join auth.sessions s on s.id=c.session_id
 where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid() and c.authentication_method='totp'
 and c.updated_at between now()-interval '2 hours' and now()
 ) and exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) e
 where e->>'method'='totp' and case when e->>'timestamp' ~ '^[0-9]{1,12}$'
 then (e->>'timestamp')::bigint between extract(epoch from now()-interval '2 hours') and extract(epoch from now()) else false end)
$$;

create or replace function life_private.security_status() returns jsonb
language sql stable security definer set search_path='' as $$
 select life_private.auth_status() || jsonb_build_object(
 'staff_required',life_private.staff_mfa_required(),'mfa_required',life_private.mfa_required(),
 'mfa_verified',life_private.mfa_verified(),'recent',life_private.mfa_recent(),'fresh_minutes',120)
$$;

revoke all on function life_private.mfa_recent(),life_private.security_status() from public,anon,authenticated,service_role;
grant execute on function life_private.security_status() to authenticated;

commit;
