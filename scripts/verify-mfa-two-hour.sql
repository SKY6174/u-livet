-- Included by verify-member-manual-entry.sql in an isolated local database.
reset role;
update auth.mfa_amr_claims set updated_at=now()-interval '119 minutes' where session_id=md5('session-1')::uuid;
set local role authenticated;
select pg_temp.actor(1);
select pg_temp.check_result((public.life_security_status()->>'fresh_minutes')::integer=120,
  'security status advertises a two-hour freshness window');
select pg_temp.check_result((public.life_security_status()->>'recent')::boolean,
  'database TOTP event from 119 minutes ago remains fresh');
select pg_temp.register_member(10,'office','mfa-119@example.invalid');
reset role;
update auth.mfa_amr_claims set updated_at=now()-interval '121 minutes' where session_id=md5('session-1')::uuid;
set local role authenticated;
select pg_temp.actor(1);
select pg_temp.check_result(not (public.life_security_status()->>'recent')::boolean,
  'database TOTP event from 121 minutes ago is stale');
select pg_temp.expect_error($cmd$select pg_temp.register_member(11,'office','mfa-121@example.invalid')$cmd$,
  'MFA_REAUTH_REQUIRED');
reset role;
update auth.mfa_amr_claims set updated_at=now() where session_id=md5('session-1')::uuid;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',md5('member-test-1')::uuid,
  'session_id',md5('session-1')::uuid,'aal','aal2','iat',floor(extract(epoch from now())),
  'amr',jsonb_build_array(jsonb_build_object('method','totp','timestamp',floor(extract(epoch from now()-interval '121 minutes')))))::text,true);
select pg_temp.check_result(not (public.life_security_status()->>'recent')::boolean,
  'refreshed JWT iat cannot revive a stale TOTP proof');
select pg_temp.expect_error($cmd$select pg_temp.register_member(12,'office','mfa-jwt@example.invalid')$cmd$,
  'MFA_REAUTH_REQUIRED');
select set_config('request.jwt.claims',jsonb_build_object('sub',md5('member-test-1')::uuid,
  'session_id',md5('session-1')::uuid,'aal','aal2',
  'amr',jsonb_build_array(jsonb_build_object('method','totp','timestamp',floor(extract(epoch from now()-interval '119 minutes')))))::text,true);
select pg_temp.check_result((public.life_security_status()->>'recent')::boolean,
  'JWT TOTP proof from 119 minutes ago remains fresh');
reset role;
