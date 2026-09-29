begin;

-- GoTrue sets invited_at after its initial INSERT. The marker only creates a pending
-- claim; email proof, the real invited_at, and approved consent are still required.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare p uuid; v public.life_policy_versions; n text:=trim(new.raw_user_meta_data->>'name');
  member life_private.manual_members; mobile text:=new.raw_user_meta_data->>'mobile_phone';
  stored_phone text;
begin
  if new.raw_app_meta_data->>'provider' in ('kakao','google','custom:naver') then
    if life_private.signup_policy() is null then raise exception 'PUBLIC_SIGNUP_CLOSED'; end if;
    return new;
  end if;
  -- The existing, administrator-owned roster is the only invitation target.
  perform pg_advisory_xact_lock(hashtextextended(lower(new.email),420));
  select m.* into member from life_private.manual_members m
    join public.life_people p on p.id=m.person_id and p.active
    where m.email=lower(new.email) for update of m;
  if member.person_id is not null and exists(
    select 1 from public.life_auth_links where person_id=member.person_id) then
    raise exception 'MEMBER_ALREADY_LINKED';
  end if;
  if member.person_id is not null and (new.invited_at is not null or
    (new.raw_user_meta_data->>'manual_member_invitation'='true'
      and new.raw_user_meta_data->>'member_org_id'=member.org_id::text)) then
    select mobile_phone into stored_phone from life_private.member_profiles where person_id=member.person_id;
    insert into life_private.manual_member_claims(user_id,person_id,policy_id,phone)
      values(new.id,member.person_id,null,stored_phone);
    return new;
  end if;
  select * into v from public.life_policy_versions where id=(new.raw_user_meta_data->>'privacy_policy_id')::uuid;
  if v.id is null or not life_private.policy_valid(v.id,v.org_id,'ACCOUNT_PRIVACY')
    or coalesce(new.raw_user_meta_data->>'privacy_accepted','false')<>'true' then
    raise exception 'APPROVED_ACCOUNT_PRIVACY_REQUIRED';
  end if;
  if new.invited_at is null then
    if life_private.signup_policy() is null or v.id is distinct from life_private.signup_policy() then
      raise exception 'PUBLIC_SIGNUP_CLOSED_OR_POLICY_CHANGED';
    end if;
    if n is null or length(n) not between 1 and 100 or mobile is null
      or mobile !~ '^\+82(10[0-9]{8}|1[16789][0-9]{7,8})$' then raise exception 'INVALID_SIGNUP_INPUT'; end if;
  end if;
  if member.person_id is not null then
    if v.org_id is distinct from member.org_id then raise exception 'APPROVED_ACCOUNT_PRIVACY_REQUIRED'; end if;
    if new.raw_user_meta_data->>'member_audience' in ('office','internal')
      and new.raw_user_meta_data->>'member_audience'<>
        (case when member.member_group='office' then 'office' when member.member_group='instructor' then 'internal' else 'learner' end)
      then raise exception 'MEMBER_ACTIVATION_UNAVAILABLE'; end if;
    insert into life_private.manual_member_claims(user_id,person_id,policy_id,phone)
      values(new.id,member.person_id,v.id,case when new.invited_at is null then mobile end);
    perform life_private.link_verified_manual_member(new.id);
    return new;
  end if;
  if new.raw_user_meta_data->>'member_audience' in ('office','internal') then raise exception 'MEMBER_ACTIVATION_UNAVAILABLE'; end if;
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

notify pgrst,'reload schema';
commit;
