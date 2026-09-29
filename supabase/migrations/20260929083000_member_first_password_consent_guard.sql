begin;

-- A provisional office account needs to record consent before its credential
-- becomes final. Permit only that single write from the validated setup RPC.
create or replace function life_private.recent_mfa_write_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_schema='public' and tg_table_name='life_consent_events'
    and pg_catalog.current_setting('app.member_first_password_consent',true)=auth.uid()::text
    and exists(select 1 from life_private.member_auth_state where user_id=auth.uid())
    then return null; end if;
  if auth.uid() is not null and life_private.staff_mfa_required()
    and not life_private.mfa_recent() then
    raise exception 'MFA_REAUTH_REQUIRED' using errcode='42501';
  end if;
  return null;
end $$;

create or replace function life_private.accept_member_privacy(p_policy uuid) returns void
language plpgsql security definer set search_path='' as $$
declare member_id uuid; member_org uuid; member_email text; user_email text;
begin
  if auth.uid() is null or not life_private.native_session_valid() or not exists(
    select 1 from life_private.member_auth_state where user_id=auth.uid())
    then raise exception 'MEMBER_SETUP_REQUIRED'; end if;
  select m.person_id,m.org_id,m.email,u.email into member_id,member_org,member_email,user_email from life_private.manual_members m
    join public.life_auth_links a on a.person_id=m.person_id
    join auth.users u on u.id=a.auth_user_id
    where a.auth_user_id=auth.uid() for update of m;
  if member_id is null or lower(user_email) is distinct from member_email
    or p_policy is distinct from life_private.member_activation_policy()
    or not life_private.policy_valid(p_policy,member_org,'ACCOUNT_PRIVACY')
    then raise exception 'MEMBER_POLICY_CHANGED'; end if;
  if not exists(select 1 from public.life_consent_events where person_id=member_id
    and policy_id=p_policy and accepted and source='MEMBER_FIRST_PASSWORD') then
    perform pg_catalog.set_config('app.member_first_password_consent',auth.uid()::text,true);
    insert into public.life_consent_events(person_id,policy_id,accepted,source)
      values(member_id,p_policy,true,'MEMBER_FIRST_PASSWORD');
    perform pg_catalog.set_config('app.member_first_password_consent','',true);
  end if;
end $$;

commit;
