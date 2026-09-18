-- A password change also revokes access to MFA management from older sessions.
-- Accounts without a credential policy record can still reach password recovery.
create or replace function life_private.auth_status() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('active',exists(
    select 1 from auth.users u join auth.sessions s on s.user_id=u.id
    join public.life_auth_links a on a.auth_user_id=u.id
    join public.life_people p on p.id=a.person_id
    left join life_private.credential_state c on c.user_id=u.id
    where u.id=auth.uid() and s.id::text=auth.jwt()->>'session_id'
      and (s.not_after is null or s.not_after>now())
      and (c.user_id is null or s.created_at>=c.changed_at)
      and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()) and p.active
  ),'needs_reset',not exists(
    select 1 from life_private.credential_state c where c.user_id=auth.uid() and c.policy_version=1
  ))
$$;
