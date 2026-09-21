-- Auth links identify the current user. Existing completed email signup also
-- qualifies after Auth links a supported OAuth identity to that same user.
-- Preserve session, account activity, audience and MFA protections.
create or replace function life_private.auth_status() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('active',life_private.native_session_valid()
 and exists(select 1 from public.life_auth_links a join public.life_people p on p.id=a.person_id where a.auth_user_id=auth.uid() and p.active)
 and (coalesce(life_private.login_context()->>'audience','')<>'internal' or exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email) ~ '^[^@[:space:]]+@uc\.ac\.kr$'))
 and (not life_private.oauth_session() or (life_private.kakao_learner_session()
   and exists(select 1 from life_private.learner_contacts where user_id=auth.uid() and signup_source in ('EMAIL','KAKAO','SOCIAL')))),
 'needs_reset',case when life_private.oauth_session() then not life_private.kakao_learner_session()
 else not exists(select 1 from life_private.credential_state where user_id=auth.uid() and policy_version=1) end)
$$;

create or replace function life_private.registration_status() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('state',case
 when not life_private.native_session_valid() then 'SIGNED_OUT'
 when not life_private.kakao_learner_session() then 'EMAIL_LOGIN_REQUIRED'
 when exists(select 1 from public.life_auth_links a join public.life_people p on p.id=a.person_id where a.auth_user_id=auth.uid() and not p.active) then 'UNAVAILABLE'
 when exists(select 1 from life_private.learner_contacts c join public.life_auth_links a on a.auth_user_id=c.user_id where c.user_id=auth.uid() and c.signup_source in ('EMAIL','KAKAO','SOCIAL')) then 'COMPLETE'
 when life_private.signup_policy() is null then 'CLOSED'
 else 'PENDING' end)
$$;
