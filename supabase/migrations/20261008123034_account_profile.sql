begin;

create table life_private.account_profiles (
  person_id uuid primary key references public.life_people(id),
  school_email text check (length(school_email)<=254 and school_email ~ '^[^@[:space:]]+@[^@[:space:].]+(\.[^@[:space:].]+)+$'),
  personal_email text check (length(personal_email)<=254 and personal_email ~ '^[^@[:space:]]+@[^@[:space:].]+(\.[^@[:space:].]+)+$'),
  affiliation text check (length(affiliation)<=100),
  job_title text check (length(job_title)<=100),
  updated_at timestamptz not null default now()
);
alter table life_private.account_profiles enable row level security;
revoke all on life_private.account_profiles from public,anon,authenticated,service_role;

create function life_private.my_account_profile() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p uuid:=life_private.person_id();
begin
  if p is null or coalesce(life_private.login_context()->>'audience','') not in ('office','internal','external') then
    raise exception 'FORBIDDEN';
  end if;
  return (
    select jsonb_build_object(
      'mobile_phone',case when a.person_id is not null then m.mobile_phone
        else coalesce(m.mobile_phone,l.phone,case when m.instructor_phone is not null then '+82'||substr(m.instructor_phone,2) end) end,
      'office_phone',m.office_phone,
      'school_email',case when a.person_id is not null then a.school_email else case when u.email ~* '@uc\.ac\.kr$' then u.email end end,
      'personal_email',case when a.person_id is not null then a.personal_email else case when u.email !~* '@uc\.ac\.kr$' then u.email end end,
      'affiliation',a.affiliation,'job_title',a.job_title,
      'has_profile',a.person_id is not null,'office_position',c.office_position)
    from auth.users u
    left join life_private.account_profiles a on a.person_id=p
    left join life_private.member_profiles m on m.person_id=p
    left join life_private.learner_contacts l on l.user_id=u.id
    left join life_private.account_classifications c on c.person_id=p
    where u.id=auth.uid()
  );
end $$;

create function life_private.save_account_profile(p_mobile_phone text,p_office_phone text,
  p_school_email text,p_personal_email text,p_affiliation text,p_job_title text) returns void
language plpgsql security definer set search_path='' as $$
declare p uuid:=life_private.person_id(); instructor boolean;
begin
  if p is null or coalesce(life_private.login_context()->>'audience','') not in ('office','internal','external') then
    raise exception 'FORBIDDEN';
  end if;
  if (p_mobile_phone is not null and p_mobile_phone !~ '^\+82(10[0-9]{8}|1[16789][0-9]{7,8})$')
    or (p_office_phone is not null and p_office_phone !~ '^0[0-9]{8,10}$')
    or (p_school_email is not null and (length(p_school_email)>254 or p_school_email !~ '^[^@[:space:]]+@[^@[:space:].]+(\.[^@[:space:].]+)+$'))
    or (p_personal_email is not null and (length(p_personal_email)>254 or p_personal_email !~ '^[^@[:space:]]+@[^@[:space:].]+(\.[^@[:space:].]+)+$'))
    or length(p_affiliation)>100 or length(p_job_title)>100 then raise exception 'INVALID_INPUT';
  end if;
  instructor:=exists(select 1 from public.life_role_assignments r where r.person_id=p and r.role='INSTRUCTOR'
    and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()));
  insert into life_private.member_profiles(person_id,mobile_phone,office_phone,instructor_phone,updated_by)
    values(p,p_mobile_phone,p_office_phone,case when instructor and p_mobile_phone is not null then '0'||substr(p_mobile_phone,4) end,p)
    on conflict(person_id) do update set mobile_phone=excluded.mobile_phone,office_phone=excluded.office_phone,
      instructor_phone=case when instructor then excluded.instructor_phone else life_private.member_profiles.instructor_phone end,
      revision=life_private.member_profiles.revision+1,updated_at=now(),updated_by=p;
  insert into life_private.account_profiles(person_id,school_email,personal_email,affiliation,job_title)
    values(p,nullif(lower(btrim(p_school_email)),''),nullif(lower(btrim(p_personal_email)),''),nullif(btrim(p_affiliation),''),nullif(btrim(p_job_title),''))
    on conflict(person_id) do update set school_email=excluded.school_email,personal_email=excluded.personal_email,
      affiliation=excluded.affiliation,job_title=excluded.job_title,updated_at=now();
end $$;

create function public.life_my_account_profile() returns jsonb
language sql stable security invoker set search_path='' as $$select life_private.my_account_profile()$$;
create function public.life_save_account_profile(p_mobile_phone text,p_office_phone text,
  p_school_email text,p_personal_email text,p_affiliation text,p_job_title text) returns void
language sql security invoker set search_path='' as $$
  select life_private.save_account_profile(p_mobile_phone,p_office_phone,p_school_email,p_personal_email,p_affiliation,p_job_title)
$$;

revoke all on function life_private.my_account_profile(),life_private.save_account_profile(text,text,text,text,text,text),
  public.life_my_account_profile(),public.life_save_account_profile(text,text,text,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function life_private.my_account_profile(),life_private.save_account_profile(text,text,text,text,text,text),
  public.life_my_account_profile(),public.life_save_account_profile(text,text,text,text,text,text) to authenticated;

notify pgrst,'reload schema';
commit;
