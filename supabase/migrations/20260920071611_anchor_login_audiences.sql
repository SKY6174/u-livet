-- Trusted display/classification data. No role is granted by selecting a login tab.
create table life_private.account_classifications (
  person_id uuid primary key references public.life_people(id) on delete cascade,
  office_position text check(office_position in ('DIRECTOR','CENTER_HEAD','RESEARCHER')),
  instructor_kind text check(instructor_kind in ('INTERNAL','EXTERNAL')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.life_people(id)
);
alter table life_private.account_classifications enable row level security;
revoke all on life_private.account_classifications from public,anon,authenticated,service_role;

-- Snapshot the initial affiliation; changing an email never silently changes it.
insert into life_private.account_classifications(person_id,instructor_kind)
select distinct r.person_id,case when lower(u.email) ~ '^[^@[:space:]]+@uc\.ac\.kr$' then 'INTERNAL' else 'EXTERNAL' end
from public.life_role_assignments r join public.life_auth_links a on a.person_id=r.person_id
join auth.users u on u.id=a.auth_user_id where r.role='INSTRUCTOR';
insert into life_private.account_classifications(person_id,office_position)
select a.person_id,'DIRECTOR' from public.life_auth_links a join auth.users u on u.id=a.auth_user_id
where lower(u.email)='kysong@uc.ac.kr' and exists(select 1 from public.life_role_assignments r where r.person_id=a.person_id and r.role='SYSTEM_ADMIN')
on conflict(person_id) do update set office_position=excluded.office_position;

create function life_private.seed_instructor_classification() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.role='INSTRUCTOR' then
    insert into life_private.account_classifications(person_id,instructor_kind)
    select new.person_id,case when lower(u.email) ~ '^[^@[:space:]]+@uc\.ac\.kr$' then 'INTERNAL' else 'EXTERNAL' end
    from public.life_auth_links a join auth.users u on u.id=a.auth_user_id where a.person_id=new.person_id
    on conflict(person_id) do update set instructor_kind=coalesce(life_private.account_classifications.instructor_kind,excluded.instructor_kind);
  end if;
  return new;
end $$;
create trigger life_seed_instructor_classification after insert or update of role,person_id on public.life_role_assignments
for each row execute function life_private.seed_instructor_classification();

create function life_private.login_context() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('audience',case
    when exists(select 1 from public.life_role_assignments r where r.person_id=p.id and r.role<>'INSTRUCTOR' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())) then 'office'
    when exists(select 1 from public.life_role_assignments r where r.person_id=p.id and r.role='INSTRUCTOR' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()))
      then case when c.instructor_kind='EXTERNAL' then 'external' else 'internal' end
    else 'learner' end,
    'office_position',c.office_position,'instructor_kind',c.instructor_kind,
    'roles',coalesce((select jsonb_agg(distinct r.role) from public.life_role_assignments r where r.person_id=p.id and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())),'[]'::jsonb))
  from public.life_auth_links a join public.life_people p on p.id=a.person_id
  left join life_private.account_classifications c on c.person_id=p.id
  where a.auth_user_id=auth.uid() and p.active and life_private.native_session_valid()
$$;
create function public.life_login_context() returns jsonb language sql stable security invoker set search_path='' as $$select life_private.login_context()$$;

-- Keep the existing helper name so all current callers use the new policy.
create or replace function life_private.kakao_learner_session() returns boolean
language sql stable security definer set search_path='' as $$
  select life_private.oauth_session()
  and exists(select 1 from auth.identities i where i.user_id=auth.uid() and i.provider in ('kakao','google','custom:naver'))
  and not exists(select 1 from public.life_auth_links a join public.life_role_assignments r on r.person_id=a.person_id
    left join life_private.account_classifications c on c.person_id=a.person_id
    where a.auth_user_id=auth.uid() and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
    and (r.role<>'INSTRUCTOR' or c.instructor_kind is distinct from 'EXTERNAL'))
$$;

create or replace function life_private.auth_status() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('active',life_private.native_session_valid()
 and exists(select 1 from public.life_auth_links a join public.life_people p on p.id=a.person_id where a.auth_user_id=auth.uid() and p.active)
 and (coalesce(life_private.login_context()->>'audience','')<>'internal' or exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email) ~ '^[^@[:space:]]+@uc\.ac\.kr$'))
 and (not life_private.oauth_session() or (life_private.kakao_learner_session()
   and exists(select 1 from life_private.learner_contacts where user_id=auth.uid() and signup_source in ('KAKAO','SOCIAL')))),
 'needs_reset',case when life_private.oauth_session() then not life_private.kakao_learner_session()
 else not exists(select 1 from life_private.credential_state where user_id=auth.uid() and policy_version=1) end)
$$;

alter table life_private.learner_contacts drop constraint learner_contacts_signup_source_check;
alter table life_private.learner_contacts add constraint learner_contacts_signup_source_check check(signup_source in ('EMAIL','KAKAO','SOCIAL'));
create or replace function life_private.registration_status() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('state',case
 when not life_private.native_session_valid() then 'SIGNED_OUT'
 when not life_private.kakao_learner_session() then 'EMAIL_LOGIN_REQUIRED'
 when exists(select 1 from public.life_auth_links a join public.life_people p on p.id=a.person_id where a.auth_user_id=auth.uid() and not p.active) then 'UNAVAILABLE'
 when exists(select 1 from life_private.learner_contacts c join public.life_auth_links a on a.auth_user_id=c.user_id where c.user_id=auth.uid() and c.signup_source in ('KAKAO','SOCIAL')) then 'COMPLETE'
 when life_private.signup_policy() is null then 'CLOSED'
 else 'PENDING' end)
$$;

create or replace function life_private.complete_registration(p_name text,p_phone text,p_policy uuid,p_accepted boolean) returns void
language plpgsql security definer set search_path='' as $$
declare p uuid; st text; source text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 perform 1 from auth.users where id=auth.uid() for update;
 st:=life_private.registration_status()->>'state';
 if st='COMPLETE' then return; end if;
 if st<>'PENDING' then raise exception 'REGISTRATION_UNAVAILABLE'; end if;
 if p_name is null or length(trim(p_name)) not between 1 and 100 or p_phone is null or p_phone !~ '^\+82(10[0-9]{8}|1[16789][0-9]{7,8})$' then raise exception 'INVALID_SIGNUP_INPUT'; end if;
 if p_accepted is distinct from true or p_policy is null or p_policy is distinct from life_private.signup_policy() then raise exception 'POLICY_CHANGED'; end if;
 select person_id into p from public.life_auth_links where auth_user_id=auth.uid();
 if p is null then
   insert into public.life_people(name) values(trim(p_name)) returning id into p;
   insert into public.life_auth_links values(p,auth.uid());
   insert into public.user_profiles(id,email,name,role) select id,coalesce(email,''),trim(p_name),'LEARNER' from auth.users where id=auth.uid();
 end if;
 source:=case when exists(select 1 from auth.identities where user_id=auth.uid() and provider='kakao') then 'KAKAO' else 'SOCIAL' end;
 insert into life_private.learner_contacts(user_id,phone,signup_source,policy_id) values(auth.uid(),p_phone,source,p_policy)
 on conflict(user_id) do update set phone=excluded.phone,phone_verified_at=null,signup_source=excluded.signup_source,policy_id=excluded.policy_id;
 insert into public.life_consent_events(person_id,policy_id,accepted,source) values(p,p_policy,true,source||'_SIGNUP');
end $$;

create or replace function life_private.identity() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'name',p.name,'office_position',c.office_position,'instructor_kind',c.instructor_kind,
 'roles',coalesce((select jsonb_agg(jsonb_build_object('role',r.role,'org_id',r.org_id)) from public.life_role_assignments r
 where r.person_id=p.id and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())),'[]'::jsonb))
 from public.life_people p left join life_private.account_classifications c on c.person_id=p.id where p.id=life_private.person_id()
$$;

create function life_private.manageable_accounts() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(row_to_json(account) order by account.name,account.person_id),'[]'::jsonb) from (
 select p.id person_id,p.name,u.email,c.office_position,c.instructor_kind,
 (select jsonb_agg(distinct r.role) from public.life_role_assignments r where r.person_id=p.id and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())) roles
 from public.life_people p join public.life_auth_links a on a.person_id=p.id join auth.users u on u.id=a.auth_user_id
 left join life_private.account_classifications c on c.person_id=p.id
 where auth.uid() is not null and p.active and u.deleted_at is null and exists(select 1 from public.life_role_assignments r
 where r.person_id=p.id and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()) and life_private.has_role(r.org_id,'SYSTEM_ADMIN'))
 order by p.name,p.id limit 200) account
$$;
create function public.life_manageable_accounts() returns jsonb language sql stable security invoker set search_path='' as $$select life_private.manageable_accounts()$$;

create function life_private.set_account_classification(p_person uuid,p_position text,p_kind text) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=life_private.person_id(); office boolean; instructor boolean; target_email text; email_verified boolean;
begin
 if actor is null or auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not life_private.mfa_recent() then raise exception 'MFA_REAUTH_REQUIRED'; end if;
 perform 1 from public.life_people where id=p_person and active for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if not exists(select 1 from public.life_role_assignments r where r.person_id=p_person and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()))
 or exists(select 1 from public.life_role_assignments r where r.person_id=p_person and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()) and not life_private.has_role(r.org_id,'SYSTEM_ADMIN')) then raise exception 'FORBIDDEN'; end if;
 select bool_or(r.role<>'INSTRUCTOR'),bool_or(r.role='INSTRUCTOR') into office,instructor from public.life_role_assignments r where r.person_id=p_person and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now());
 if (p_position is not null and (p_position not in ('DIRECTOR','CENTER_HEAD','RESEARCHER') or not office))
 or (p_kind is not null and (p_kind not in ('INTERNAL','EXTERNAL') or not instructor))
 or (instructor and p_kind is null) then raise exception 'INVALID_CLASSIFICATION'; end if;
 select u.email,u.email_confirmed_at is not null into target_email,email_verified from auth.users u join public.life_auth_links a on a.auth_user_id=u.id where a.person_id=p_person;
 if p_kind='INTERNAL' and (email_verified is distinct from true or coalesce(lower(target_email) ~ '^[^@[:space:]]+@uc\.ac\.kr$',false) is not true) then raise exception 'SCHOOL_EMAIL_REQUIRED'; end if;
 insert into life_private.account_classifications(person_id,office_position,instructor_kind,updated_by)
 values(p_person,p_position,p_kind,actor) on conflict(person_id) do update set office_position=excluded.office_position,instructor_kind=excluded.instructor_kind,updated_at=now(),updated_by=actor;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id)
 select distinct r.org_id,actor,'ACCOUNT_CLASSIFICATION_UPDATED',p_person from public.life_role_assignments r where r.person_id=p_person and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now());
end $$;
create function public.life_set_account_classification(p_person uuid,p_position text,p_kind text) returns void
language sql security invoker set search_path='' as $$select life_private.set_account_classification(p_person,p_position,p_kind)$$;

revoke all on function life_private.seed_instructor_classification(),life_private.login_context(),public.life_login_context(),life_private.manageable_accounts(),public.life_manageable_accounts(),life_private.set_account_classification(uuid,text,text),public.life_set_account_classification(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function life_private.login_context(),public.life_login_context(),life_private.manageable_accounts(),public.life_manageable_accounts(),life_private.set_account_classification(uuid,text,text),public.life_set_account_classification(uuid,text,text) to authenticated;

-- Provider keys and approved privacy text must be configured before opening new providers.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare p uuid; v public.life_policy_versions; n text:=trim(new.raw_user_meta_data->>'name');
  mobile text:=new.raw_user_meta_data->>'mobile_phone';
begin
  if new.raw_app_meta_data->>'provider' in ('kakao','google','custom:naver') then
    if life_private.signup_policy() is null then raise exception 'PUBLIC_SIGNUP_CLOSED'; end if;
    return new; -- Auth-only pending account, no access to application data.
  end if;
  select * into v from public.life_policy_versions where id=(new.raw_user_meta_data->>'privacy_policy_id')::uuid;
  if v.id is null or not life_private.policy_valid(v.id,v.org_id,'ACCOUNT_PRIVACY')
    or coalesce(new.raw_user_meta_data->>'privacy_accepted','false')<>'true' then
    raise exception 'APPROVED_ACCOUNT_PRIVACY_REQUIRED';
  end if;
  -- Native invitations retain their individually approved consent workflow.
  if new.invited_at is null then
    if life_private.signup_policy() is null or v.id is distinct from life_private.signup_policy() then
      raise exception 'PUBLIC_SIGNUP_CLOSED_OR_POLICY_CHANGED';
    end if;
    if n is null or length(n) not between 1 and 100 or mobile is null
      or mobile !~ '^\+82(10[0-9]{8}|1[16789][0-9]{7,8})$' then raise exception 'INVALID_SIGNUP_INPUT'; end if;
  end if;
  insert into public.user_profiles(id,email,name,role)
    values(new.id,coalesce(new.email,''),left(coalesce(nullif(n,''),'학습자'),100),'LEARNER');
  insert into public.life_people(name) values(left(coalesce(nullif(n,''),'학습자'),100)) returning id into p;
  insert into public.life_auth_links values(p,new.id);
  insert into public.life_consent_events(person_id,policy_id,accepted,source) values(p,v.id,true,'SIGNUP');
  if new.invited_at is null then
    insert into life_private.learner_contacts(user_id,phone,signup_source,policy_id) values(new.id,mobile,'EMAIL',v.id);
  end if;
  return new;
end $$;

