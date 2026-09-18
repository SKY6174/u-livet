-- Managed Cloud native password policy must be configured before applying.
-- Only supported auth.users triggers; never depends on Auth audit log storage.
-- Requires the matching native Auth password policy before deployment.
create table if not exists life_private.credential_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  policy_version integer not null check(policy_version in (0,1)),
  changed_at timestamptz not null,
  pending_txid bigint
);
alter table life_private.credential_state enable row level security;
revoke all on life_private.credential_state from public,anon,authenticated,service_role;

create or replace function life_private.record_credential_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' or new.encrypted_password is distinct from old.encrypted_password then
    if coalesce(new.encrypted_password,'')<>'' then
      insert into life_private.credential_state(user_id,policy_version,changed_at,pending_txid)
      values(new.id,1,clock_timestamp(),null)
      on conflict(user_id) do update set policy_version=excluded.policy_version,changed_at=excluded.changed_at,pending_txid=excluded.pending_txid;
    else
      delete from life_private.credential_state where user_id=new.id;
    end if;
  end if;
  return new;
end $$;
revoke all on function life_private.record_credential_change() from public,anon,authenticated,service_role;
drop trigger if exists life_record_credential_change on auth.users;
create trigger life_record_credential_change after insert or update of encrypted_password on auth.users
for each row execute function life_private.record_credential_change();

create or replace function life_private.auth_status() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('active',exists(
    select 1 from auth.users u join auth.sessions s on s.user_id=u.id
    join public.life_auth_links a on a.auth_user_id=u.id join public.life_people p on p.id=a.person_id
    where u.id=auth.uid() and s.id::text=auth.jwt()->>'session_id'
      and (s.not_after is null or s.not_after>now())
      and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()) and p.active
  ),'needs_reset',not exists(select 1 from life_private.credential_state c where c.user_id=auth.uid() and c.policy_version=1))
$$;
create or replace function public.life_auth_status() returns jsonb language sql stable security invoker set search_path='' as $$select life_private.auth_status()$$;
revoke all on function life_private.auth_status(),public.life_auth_status() from public,anon,authenticated,service_role;
grant execute on function life_private.auth_status(),public.life_auth_status() to authenticated;

create or replace function life_private.person_id() returns uuid language sql stable security definer set search_path='' as $$
  select p.id from public.life_people p join public.life_auth_links a on a.person_id=p.id
    join auth.users u on u.id=a.auth_user_id
    join life_private.credential_state c on c.user_id=u.id and c.policy_version=1
    join auth.sessions s on s.user_id=u.id and s.id::text=auth.jwt()->>'session_id'
  where u.id=auth.uid() and p.active and u.deleted_at is null
    and (u.banned_until is null or u.banned_until<=now())
    and s.created_at>=c.changed_at and (s.not_after is null or s.not_after>now())
$$;

-- Native TOTP must be enabled before this migration is deployed.
create or replace function life_private.staff_mfa_required() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.life_auth_links a join public.life_role_assignments r on r.person_id=a.person_id
 where a.auth_user_id=auth.uid() and r.role<>'INSTRUCTOR' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()))
$$;
create or replace function life_private.mfa_required() returns boolean
language sql stable security definer set search_path='' as $$
 select life_private.staff_mfa_required() or exists(select 1 from auth.mfa_factors where user_id=auth.uid() and factor_type='totp' and status='verified')
$$;
create or replace function life_private.mfa_verified() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'aal'='aal2',false) and exists(
 select 1 from auth.sessions s join auth.mfa_factors f on f.id=s.factor_id and f.user_id=s.user_id
 where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid() and s.aal='aal2'
 and (s.not_after is null or s.not_after>now()) and f.factor_type='totp' and f.status='verified')
$$;
create or replace function life_private.mfa_recent() returns boolean
language sql stable security definer set search_path='' as $$
 select life_private.mfa_verified() and exists(
 select 1 from auth.mfa_amr_claims c join auth.sessions s on s.id=c.session_id
 where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid() and c.authentication_method='totp'
 and c.updated_at between now()-interval '15 minutes' and now()
 ) and exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) e
 where e->>'method'='totp' and case when e->>'timestamp' ~ '^[0-9]{1,12}$'
 then (e->>'timestamp')::bigint between extract(epoch from now()-interval '15 minutes') and extract(epoch from now()) else false end)
$$;
create or replace function life_private.security_status() returns jsonb
language sql stable security definer set search_path='' as $$
 select life_private.auth_status() || jsonb_build_object(
 'staff_required',life_private.staff_mfa_required(),'mfa_required',life_private.mfa_required(),
 'mfa_verified',life_private.mfa_verified(),'recent',life_private.mfa_recent(),'fresh_minutes',15)
$$;
create or replace function public.life_security_status() returns jsonb
language sql stable security invoker set search_path='' as $$select life_private.security_status()$$;
revoke all on function life_private.staff_mfa_required(),life_private.mfa_required(),life_private.mfa_verified(),life_private.mfa_recent(),life_private.security_status(),public.life_security_status() from public,anon,authenticated,service_role;
grant execute on function life_private.security_status(),public.life_security_status() to authenticated;

create or replace function life_private.person_id() returns uuid language sql stable security definer set search_path='' as $$
 select p.id from public.life_people p join public.life_auth_links a on a.person_id=p.id
 join auth.users u on u.id=a.auth_user_id
 join life_private.credential_state c on c.user_id=u.id and c.policy_version=1
 join auth.sessions s on s.user_id=u.id and s.id::text=auth.jwt()->>'session_id'
 where u.id=auth.uid() and p.active and u.deleted_at is null
 and (u.banned_until is null or u.banned_until<=now())
 and s.created_at>=c.changed_at and (s.not_after is null or s.not_after>now())
 and ((not life_private.mfa_required() and coalesce(auth.jwt()->>'aal','aal1')<>'aal2') or life_private.mfa_verified())
$$;

create or replace function life_private.recent_mfa_write_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and life_private.staff_mfa_required() and not life_private.mfa_recent() then
   raise exception 'MFA_REAUTH_REQUIRED' using errcode='42501';
 end if;
 return null;
end $$;



-- Factor changes use native Auth's AAL2 policy. The application adds recent-auth
-- and last-staff-factor checks; no unsupported auth.mfa_factors triggers.
create or replace function public.life_prepare_mfa_change(k text,f uuid default null) returns text
language plpgsql security definer set search_path='' as $$
declare st jsonb:=life_private.auth_status();
begin
 if not coalesce((st->>'active')::boolean,false) or coalesce((st->>'needs_reset')::boolean,true)
 or k is null or k not in ('ENROLL','REMOVE') then raise exception 'AUTH_REQUIRED';end if;
 if (k='REMOVE' or exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified'))
 and not life_private.mfa_recent() then raise exception 'MFA_REAUTH_REQUIRED';end if;
 if k='REMOVE' then
  if not exists(select 1 from auth.mfa_factors where user_id=auth.uid() and id=f and status='verified') then raise exception 'FORBIDDEN';end if;
  if life_private.staff_mfa_required() and (select count(*) from auth.mfa_factors where user_id=auth.uid() and status='verified')<=1 then raise exception 'MFA_LAST_FACTOR_REQUIRED';end if;
 end if;
 return 'U-LIFE '||gen_random_uuid()::text;
end $$;
revoke all on function public.life_prepare_mfa_change(text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.life_prepare_mfa_change(text,uuid) to authenticated;

revoke all on function life_private.recent_mfa_write_guard() from public,anon,authenticated,service_role;
do $$declare t record;begin
 for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and c.relname like 'life\_%' escape '\'
 loop
  execute format('drop trigger if exists life_recent_mfa_write on public.%I',t.relname);
  execute format('create trigger life_recent_mfa_write before insert or update or delete on public.%I for each statement execute function life_private.recent_mfa_write_guard()',t.relname);
 end loop;
end $$;
