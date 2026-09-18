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

-- The Auth API's AAL2 gate alone permits an old AAL2 session to enroll a new
-- factor. Bind factor changes to a short-lived approval from a recent session.
create table if not exists life_private.mfa_history (
 user_id uuid primary key references auth.users on delete cascade,
 initialized_at timestamptz not null default now()
);
create table if not exists life_private.mfa_change_permits (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users on delete cascade,
 session_id uuid not null references auth.sessions on delete cascade,
 kind text not null check(kind in ('ENROLL','REMOVE')),
 factor_id uuid,
 needs_recent boolean not null,
 expires_at timestamptz not null default now()+interval '1 minute'
);
alter table life_private.mfa_history enable row level security;
alter table life_private.mfa_change_permits enable row level security;
create unique index if not exists life_mfa_permit_user on life_private.mfa_change_permits(user_id);
create index if not exists life_mfa_permit_session on life_private.mfa_change_permits(session_id);
revoke all on life_private.mfa_history,life_private.mfa_change_permits from public,anon,authenticated,service_role;
insert into life_private.mfa_history(user_id) select distinct user_id from auth.mfa_factors where status='verified' on conflict do nothing;

create or replace function life_private.prepare_mfa_change(k text,f uuid) returns text
language plpgsql security definer set search_path='' as $$
declare st jsonb:=life_private.auth_status(); need boolean; permit uuid; sid uuid;
begin
 if not coalesce((st->>'active')::boolean,false) or coalesce((st->>'needs_reset')::boolean,true) or k not in ('ENROLL','REMOVE') or k is null then raise exception 'AUTH_REQUIRED';end if;
 select s.id into sid from auth.sessions s where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid();
 need:=exists(select 1 from life_private.mfa_history where user_id=auth.uid());
 if (need or k='REMOVE') and not life_private.mfa_recent() then raise exception 'MFA_REAUTH_REQUIRED';end if;
 if k='REMOVE' then
  if not exists(select 1 from auth.mfa_factors where id=f and user_id=auth.uid() and status='verified') then raise exception 'FORBIDDEN';end if;
  if life_private.staff_mfa_required() and (select count(*) from auth.mfa_factors where user_id=auth.uid() and status='verified')<=1 then raise exception 'MFA_LAST_FACTOR_REQUIRED';end if;
 end if;
 delete from life_private.mfa_change_permits where user_id=auth.uid();
 insert into life_private.mfa_change_permits(user_id,session_id,kind,factor_id,needs_recent) values(auth.uid(),sid,k,f,need or k='REMOVE') returning id into permit;
 return 'U-LIFE '||permit::text;
end $$;
create or replace function public.life_prepare_mfa_change(k text,f uuid default null) returns text
language sql security invoker set search_path='' as $$select life_private.prepare_mfa_change(k,f)$$;
revoke all on function life_private.prepare_mfa_change(text,uuid),public.life_prepare_mfa_change(text,uuid) from public,anon,authenticated,service_role;
grant execute on function life_private.prepare_mfa_change(text,uuid),public.life_prepare_mfa_change(text,uuid) to authenticated;

create or replace function life_private.mfa_factor_change_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare u uuid; permit life_private.mfa_change_permits; last_factor boolean;
begin
 u:=case when tg_op='INSERT' then new.user_id else old.user_id end;
 -- Deleting an Auth user must retain native cascading cleanup. A documented
 -- recovery transaction may be run only by the trusted database owner.
 if not exists(select 1 from auth.users where id=u) or (session_user='postgres' and current_setting('life.mfa_recovery_user',true)=u::text) then
  if tg_op='INSERT' then return new;else return old;end if;
 end if;
 if tg_op='DELETE' and old.status<>'verified' then return old;end if;
 select p.* into permit from life_private.mfa_change_permits p join auth.sessions s on s.id=p.session_id and s.user_id=p.user_id
 where p.user_id=u and p.expires_at>now() and (s.not_after is null or s.not_after>now())
 and ((tg_op='INSERT' and p.kind='ENROLL' and new.friendly_name='U-LIFE '||p.id::text)
 or (tg_op='DELETE' and p.kind='REMOVE' and p.factor_id=old.id))
 and (not p.needs_recent or (s.aal='aal2' and exists(select 1 from auth.mfa_factors f where f.id=s.factor_id and f.user_id=u and f.status='verified')
 and exists(select 1 from auth.mfa_amr_claims c where c.session_id=s.id and c.authentication_method='totp' and c.updated_at between now()-interval '15 minutes' and now())))
 for update of p;
 if permit.id is null then raise exception 'MFA_CHANGE_APPROVAL_REQUIRED';end if;
 if tg_op='DELETE' then
  last_factor:=(select count(*) from auth.mfa_factors where user_id=u and status='verified')<=1;
  if last_factor and exists(select 1 from public.life_auth_links a join public.life_role_assignments r on r.person_id=a.person_id where a.auth_user_id=u and r.role<>'INSTRUCTOR' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())) then raise exception 'MFA_LAST_FACTOR_REQUIRED';end if;
  if last_factor then delete from life_private.mfa_history where user_id=u;end if;
 end if;
 delete from life_private.mfa_change_permits where id=permit.id;
 if tg_op='INSERT' then return new;else return old;end if;
end $$;
create or replace function life_private.mfa_record_verified() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='verified' then insert into life_private.mfa_history(user_id) values(new.user_id) on conflict do nothing;end if;
 return new;
end $$;
revoke all on function life_private.mfa_factor_change_guard(),life_private.mfa_record_verified() from public,anon,authenticated,service_role;
drop trigger if exists life_mfa_factor_change on auth.mfa_factors;
create trigger life_mfa_factor_change before insert or delete on auth.mfa_factors for each row execute function life_private.mfa_factor_change_guard();
drop trigger if exists life_mfa_record_verified on auth.mfa_factors;
create trigger life_mfa_record_verified after insert or update of status on auth.mfa_factors for each row execute function life_private.mfa_record_verified();
revoke all on function life_private.recent_mfa_write_guard() from public,anon,authenticated,service_role;
do $$declare t record;begin
 for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and c.relname like 'life\_%' escape '\'
 loop
  execute format('drop trigger if exists life_recent_mfa_write on public.%I',t.relname);
  execute format('create trigger life_recent_mfa_write before insert or update or delete on public.%I for each statement execute function life_private.recent_mfa_write_guard()',t.relname);
 end loop;
end $$;
