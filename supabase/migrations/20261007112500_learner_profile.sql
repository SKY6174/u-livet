begin;

create table life_private.learner_profile_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text check (nickname is null or (length(nickname) between 1 and 24 and nickname=btrim(nickname))),
  character_key text check (character_key is null or character_key in ('sprout','book','star','flower')),
  photo_path text check (photo_path is null or photo_path ~ ('^' || user_id::text || '/[a-f0-9-]{36}\.(jpg|png|webp)$')),
  updated_at timestamptz not null default now()
);
alter table life_private.learner_profile_preferences enable row level security;
revoke all on life_private.learner_profile_preferences from public, anon, authenticated, service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('learner-profile-photos','learner-profile-photos',false,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=2097152,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create policy learner_profile_photo_read on storage.objects for select to authenticated
using (bucket_id='learner-profile-photos' and split_part(name,'/',1)=auth.uid()::text
  and name ~ ('^' || auth.uid()::text || '/[a-f0-9-]{36}\.(jpg|png|webp)$')
  and life_private.person_id() is not null);
create policy learner_profile_photo_insert on storage.objects for insert to authenticated
with check (bucket_id='learner-profile-photos' and split_part(name,'/',1)=auth.uid()::text
  and name ~ ('^' || auth.uid()::text || '/[a-f0-9-]{36}\.(jpg|png|webp)$')
  and life_private.person_id() is not null);
create policy learner_profile_photo_delete on storage.objects for delete to authenticated
using (bucket_id='learner-profile-photos' and split_part(name,'/',1)=auth.uid()::text
  and name ~ ('^' || auth.uid()::text || '/[a-f0-9-]{36}\.(jpg|png|webp)$')
  and life_private.person_id() is not null);

create function life_private.learner_profile_allowed() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and life_private.person_id() is not null
    and life_private.login_context()->>'audience'='learner'
$$;

create function public.life_my_learner_profile() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p uuid;
begin
  if not life_private.learner_profile_allowed() then raise exception 'FORBIDDEN'; end if;
  p:=life_private.person_id();
  return (
    select jsonb_build_object(
      'phone',coalesce(m.mobile_phone,c.phone,''),
      'nickname',v.nickname,'character_key',v.character_key,'photo_path',v.photo_path)
    from (select 1) base
    left join life_private.member_profiles m on m.person_id=p
    left join life_private.learner_contacts c on c.user_id=auth.uid()
    left join life_private.learner_profile_preferences v on v.user_id=auth.uid()
  );
end $$;

create function public.life_save_learner_profile(p_phone text,p_nickname text,p_character text)
returns void language plpgsql security definer set search_path='' as $$
declare p uuid; clean_nickname text:=nullif(btrim(p_nickname),'');
begin
  if not life_private.learner_profile_allowed() then raise exception 'FORBIDDEN'; end if;
  if p_phone is null or p_phone !~ '^\+82(10[0-9]{8}|1[16789][0-9]{7,8})$'
    or length(coalesce(p_nickname,''))>100 or length(clean_nickname)>24
    or (p_character is not null and p_character not in ('sprout','book','star','flower'))
    then raise exception 'INVALID_INPUT'; end if;
  p:=life_private.person_id();
  insert into life_private.member_profiles(person_id,mobile_phone,updated_by)
    values(p,p_phone,p)
    on conflict(person_id) do update set mobile_phone=excluded.mobile_phone,
      revision=life_private.member_profiles.revision+1,updated_at=now(),updated_by=p;
  update life_private.learner_contacts set phone=p_phone,phone_verified_at=null where user_id=auth.uid();
  insert into life_private.learner_profile_preferences(user_id,nickname,character_key)
    values(auth.uid(),clean_nickname,p_character)
    on conflict(user_id) do update set nickname=excluded.nickname,
      character_key=excluded.character_key,updated_at=now();
end $$;

create function public.life_set_learner_photo(p_path text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not life_private.learner_profile_allowed() then raise exception 'FORBIDDEN'; end if;
  if p_path is not null and (p_path !~ ('^' || auth.uid()::text || '/[a-f0-9-]{36}\.(jpg|png|webp)$')
    or not exists(select 1 from storage.objects where bucket_id='learner-profile-photos' and name=p_path))
    then raise exception 'INVALID_PHOTO'; end if;
  insert into life_private.learner_profile_preferences(user_id,photo_path)
    values(auth.uid(),p_path)
    on conflict(user_id) do update set photo_path=excluded.photo_path,updated_at=now();
end $$;

-- Keep directory email fields consistent when Auth finishes a verified address change.
create function life_private.sync_learner_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.email is distinct from old.email then
    update public.user_profiles set email=coalesce(new.email,'') where id=new.id;
    update life_private.manual_members set email=lower(new.email)
      where person_id=(select person_id from public.life_auth_links where auth_user_id=new.id)
        and member_group='learner' and new.email is not null;
  end if;
  return new;
end $$;
create trigger life_sync_learner_email after update of email on auth.users
for each row execute function life_private.sync_learner_email();

revoke all on function life_private.learner_profile_allowed(),
  public.life_my_learner_profile(),public.life_save_learner_profile(text,text,text),
  public.life_set_learner_photo(text),life_private.sync_learner_email()
  from public,anon,authenticated,service_role;
grant execute on function public.life_my_learner_profile(),
  public.life_save_learner_profile(text,text,text),public.life_set_learner_photo(text)
  to authenticated;

notify pgrst,'reload schema';
commit;
