begin;

-- Link the member only after every other guarded public write.
create or replace function life_private.link_verified_manual_member(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare u auth.users; claim life_private.manual_member_claims; member life_private.manual_members; person public.life_people;
begin
  select * into u from auth.users where id=p_user for update;
  if u.id is null or u.email_confirmed_at is null or u.deleted_at is not null
    or (u.banned_until is not null and u.banned_until>now())
    or coalesce(u.raw_app_meta_data->>'provider','email')<>'email' then return; end if;
  select * into claim from life_private.manual_member_claims where user_id=p_user for update;
  if not found or claim.verified_at is not null or claim.policy_id is null then return; end if;
  select * into member from life_private.manual_members where person_id=claim.person_id for update;
  select * into person from public.life_people where id=claim.person_id for update;
  if member.person_id is null or person.active is distinct from true
    or lower(u.email) is distinct from member.email
    or not life_private.policy_valid(claim.policy_id,member.org_id,'ACCOUNT_PRIVACY')
    or exists(select 1 from public.life_auth_links where person_id=claim.person_id or auth_user_id=p_user)
    then return; end if;
  insert into public.user_profiles(id,email,name,role) values(u.id,u.email,person.name,'LEARNER');
  insert into public.life_consent_events(person_id,policy_id,accepted,source)
    values(person.id,claim.policy_id,true,'MANUAL_MEMBER_EMAIL_VERIFIED');
  if claim.phone is not null then
    insert into life_private.learner_contacts(user_id,phone,signup_source,policy_id)
      values(u.id,claim.phone,'EMAIL',claim.policy_id);
  end if;
  if member.member_group='instructor' and not exists(select 1 from public.life_role_assignments
    where person_id=person.id and org_id=member.org_id and role='INSTRUCTOR'
      and valid_from<=now() and (valid_until is null or valid_until>now())) then
    insert into public.life_role_assignments(person_id,org_id,role) values(person.id,member.org_id,'INSTRUCTOR');
  end if;
  update life_private.manual_member_claims set verified_at=now() where user_id=u.id;
  insert into public.life_audit_events(org_id,actor_id,action,entity_id)
    values(member.org_id,person.id,'MANUAL_MEMBER_AUTH_LINKED',person.id);
  insert into public.life_auth_links(person_id,auth_user_id) values(person.id,u.id);
end $$;

commit;
