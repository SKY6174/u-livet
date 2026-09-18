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
      values(new.id,case when tg_op='INSERT' then 1 else 0 end,clock_timestamp(),case when tg_op='INSERT' then null else txid_current() end)
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

-- A storage re-encryption/rehash is not proof of compliance. Only an explicit
-- Auth password-change event in the SAME transaction approves an updated hash.
create or replace function life_private.approve_credential_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare target text;
begin
  if new.payload->>'action'='user_updated_password' then
    target:=new.payload->>'actor_id';
  elsif new.payload->>'action'='user_modified' then
    target:=new.payload->'traits'->>'user_id';
  end if;
  if target ~ '^[0-9a-fA-F-]{36}$' then
    update life_private.credential_state set policy_version=1,pending_txid=null
    where user_id::text=target and pending_txid=txid_current() and policy_version=0;
  end if;
  return new;
end $$;
revoke all on function life_private.approve_credential_change() from public,anon,authenticated,service_role;
drop trigger if exists life_approve_credential_change on auth.audit_log_entries;
create trigger life_approve_credential_change after insert on auth.audit_log_entries
for each row execute function life_private.approve_credential_change();

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
