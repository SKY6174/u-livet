begin;

-- Server-only snapshot of the authoritative manual roster for Auth metadata sync.
create function public.life_manual_member_auth_profile(p_person uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'person_id',m.person_id,
    'auth_user_id',a.auth_user_id,
    'org_id',m.org_id,
    'member_group',m.member_group,
    'email',m.email,
    'name',p.name,
    'office_position',c.office_position,
    'instructor_kind',c.instructor_kind,
    'office_phone',mp.office_phone,
    'mobile_phone',mp.mobile_phone,
    'instructor_phone',mp.instructor_phone,
    'birth_date',mp.birth_date,
    'notes',mp.notes,
    'activation_complete',u.id is not null and u.email_confirmed_at is not null
      and credential.policy_version=1 and exists(
        select 1 from public.life_consent_events consent
        where consent.person_id=m.person_id and consent.accepted
          and consent.source in ('MEMBER_FIRST_PASSWORD','MANUAL_MEMBER_EMAIL_VERIFIED','SIGNUP')))
  from life_private.manual_members m
  join public.life_people p on p.id=m.person_id and p.active
  left join life_private.member_profiles mp on mp.person_id=m.person_id
  left join life_private.account_classifications c on c.person_id=m.person_id
  left join public.life_auth_links a on a.person_id=m.person_id
  left join auth.users u on u.id=a.auth_user_id
  left join life_private.credential_state credential on credential.user_id=u.id
  where m.person_id=p_person
$$;
revoke all on function public.life_manual_member_auth_profile(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.life_manual_member_auth_profile(uuid) to service_role;

notify pgrst,'reload schema';
commit;
