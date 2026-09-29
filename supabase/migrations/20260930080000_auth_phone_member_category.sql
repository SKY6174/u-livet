begin;

-- Read-only, service-role snapshot for synchronizing Supabase Auth's native phone
-- and descriptive app metadata. Database roles remain the authorization source.
create function public.life_auth_directory_profile(p_user uuid default null, p_person uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
  with selected as (
    select u.id, u.raw_user_meta_data
    from auth.users u
    where u.id=coalesce(p_user,
      (select a.auth_user_id from public.life_auth_links a where a.person_id=p_person),
      (select claim.user_id from life_private.manual_member_claims claim where claim.person_id=p_person))
  ), profile as (
    select s.id as auth_user_id,
      coalesce(link.person_id,claim.person_id) as person_id,
      coalesce(mp.mobile_phone,contact.phone,s.raw_user_meta_data->>'mobile_phone') as mobile_phone,
      case
        when member.member_group='office' then 'office'
        when exists(select 1 from life_private.member_entry_operators operator
          where operator.auth_user_id=s.id) then 'office'
        when exists(select 1 from public.life_role_assignments role
          where role.person_id=link.person_id and role.role<>'INSTRUCTOR'
            and role.valid_from<=now() and (role.valid_until is null or role.valid_until>now())) then 'office'
        when classification.instructor_kind='EXTERNAL' then 'external_instructor'
        when classification.instructor_kind='INTERNAL' then 'internal_instructor'
        when member.member_group='instructor' then 'internal_instructor'
        when exists(select 1 from public.life_role_assignments role
          where role.person_id=link.person_id and role.role='INSTRUCTOR'
            and role.valid_from<=now() and (role.valid_until is null or role.valid_until>now())) then 'internal_instructor'
        when s.raw_user_meta_data->>'member_audience'='external' then 'external_instructor'
        else 'learner'
      end as member_category
    from selected s
    left join public.life_auth_links link on link.auth_user_id=s.id
    left join life_private.manual_member_claims claim on claim.user_id=s.id
    left join life_private.manual_members member on member.person_id=coalesce(link.person_id,claim.person_id)
    left join life_private.account_classifications classification
      on classification.person_id=coalesce(link.person_id,claim.person_id)
    left join life_private.member_profiles mp on mp.person_id=coalesce(link.person_id,claim.person_id)
    left join life_private.learner_contacts contact on contact.user_id=s.id
  )
  select jsonb_build_object(
    'auth_user_id',profile.auth_user_id,
    'person_id',profile.person_id,
    'member_category',profile.member_category,
    'mobile_phone',profile.mobile_phone,
    'phone_unique',profile.mobile_phone is not null and not exists (
      select 1 from auth.users other_user
      left join public.life_auth_links other_link on other_link.auth_user_id=other_user.id
      left join life_private.manual_member_claims other_claim on other_claim.user_id=other_user.id
      left join life_private.member_profiles other_member on other_member.person_id=coalesce(other_link.person_id,other_claim.person_id)
      left join life_private.learner_contacts other_contact on other_contact.user_id=other_user.id
      where other_user.id<>profile.auth_user_id and
        (other_user.phone=ltrim(profile.mobile_phone,'+') or
          coalesce(other_member.mobile_phone,other_contact.phone,
            other_user.raw_user_meta_data->>'mobile_phone')=profile.mobile_phone)
    )
  ) from profile
$$;
revoke all on function public.life_auth_directory_profile(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.life_auth_directory_profile(uuid,uuid) to service_role;

-- GoTrue's Admin API ignores an empty/null phone. Clear an unverified stale
-- phone explicitly when the canonical contact becomes shared or unavailable.
create function public.life_clear_auth_directory_phone(p_user uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  update auth.users set phone=null where id=p_user and phone is not null
    and phone_confirmed_at is null;
  return found;
end $$;
revoke all on function public.life_clear_auth_directory_phone(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.life_clear_auth_directory_phone(uuid) to service_role;

notify pgrst,'reload schema';
commit;
