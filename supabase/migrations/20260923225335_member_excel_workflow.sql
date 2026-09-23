begin;

create or replace function life_private.member_excel_export(p_group text, p_query text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; row_count integer;
begin
  if life_private.person_id() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.life_role_assignments r where r.person_id=life_private.person_id() and r.role='SYSTEM_ADMIN' and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now()))
     and not exists(select 1 from life_private.member_entry_orgs()) then raise exception 'FORBIDDEN'; end if;
  if p_group is null or p_group not in ('office','instructor','learner') or p_query is null or length(p_query)>100 then raise exception 'INVALID_INPUT'; end if;

  with scope as materialized (select * from life_private.member_scope_for(false)),
  rows as (
    select p.id person_id,p.name,coalesce(u.email,mm.email) email,c.office_position position,c.instructor_kind kind,
      m.office_phone,coalesce(m.mobile_phone,lc.phone) mobile_phone,m.instructor_phone,m.birth_date,
      coalesce(m.notes,'') notes,coalesce(m.revision,0) revision,
      case when p_group='office' then case c.office_position
        when 'DIRECTOR' then 1 when 'DIVISION_HEAD' then 2 when 'CENTER_HEAD' then 3 when 'OPERATIONS_HEAD' then 4
        when 'PRINCIPAL_RESEARCHER' then 5 when 'SENIOR_RESEARCHER' then 6 when 'RESEARCHER' then 7 else 8 end else 0 end position_order
    from scope s join public.life_people p on p.id=s.person_id
    left join public.life_auth_links a on a.person_id=p.id left join auth.users u on u.id=a.auth_user_id
    left join life_private.manual_members mm on mm.person_id=p.id
    left join life_private.account_classifications c on c.person_id=p.id
    left join life_private.member_profiles m on m.person_id=p.id
    left join life_private.learner_contacts lc on lc.user_id=u.id
    where (case p_group when 'office' then s.is_office when 'instructor' then s.is_instructor else s.is_learner end)
      and (p_query='' or strpos(lower(p.name),lower(p_query))>0 or strpos(lower(coalesce(u.email,mm.email,'')),lower(p_query))>0)
    order by position_order,case when p_group='office' then p.name end collate pg_catalog."ko-x-icu",p.name,p.id
    limit 1001
  )
  select count(*)::integer,coalesce(jsonb_agg(to_jsonb(rows)-'position_order' order by position_order,case when p_group='office' then name end collate pg_catalog."ko-x-icu",name,person_id),'[]'::jsonb)
  into row_count,result from rows;
  if row_count>1000 then raise exception 'EXPORT_LIMIT'; end if;
  return result;
end $$;

create or replace function public.life_member_excel_export(p_group text,p_query text) returns jsonb
language sql stable security invoker set search_path='' as $$select life_private.member_excel_export(p_group,p_query)$$;

create or replace function life_private.member_excel_import(p_group text,p_org uuid,p_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row_data jsonb; row_number integer:=0; created integer:=0; updated integer:=0; target uuid; current_email text;
begin
  if life_private.person_id() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not life_private.mfa_recent() then raise exception 'MFA_REAUTH_REQUIRED'; end if;
  if p_group is null or p_group not in ('office','instructor','learner') or p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 100 then raise exception 'INVALID_INPUT'; end if;
  for row_data in select value from jsonb_array_elements(p_rows) loop
    row_number:=row_number+1;
    begin
      if jsonb_typeof(row_data)<>'object' then raise exception 'INVALID_INPUT'; end if;
      if nullif(row_data->>'person_id','') is null then
        perform life_private.create_member((row_data->>'request_id')::uuid,p_org,p_group,row_data->>'name',row_data->>'email',
          nullif(row_data->>'position',''),nullif(row_data->>'kind',''),nullif(row_data->>'office_phone',''),nullif(row_data->>'mobile_phone',''),
          nullif(row_data->>'instructor_phone',''),nullif(row_data->>'birth_date','')::date,coalesce(row_data->>'notes',''));
        created:=created+1;
      else
        target:=(row_data->>'person_id')::uuid;
        select lower(coalesce(u.email,mm.email)) into current_email from public.life_people p
          left join public.life_auth_links a on a.person_id=p.id left join auth.users u on u.id=a.auth_user_id
          left join life_private.manual_members mm on mm.person_id=p.id where p.id=target and p.active;
        if nullif(row_data->>'email','') is not null and lower(row_data->>'email') is distinct from current_email then raise exception 'MEMBER_EMAIL_MISMATCH'; end if;
        perform life_private.save_member(target,p_group,row_data->>'name',nullif(row_data->>'position',''),nullif(row_data->>'kind',''),
          nullif(row_data->>'office_phone',''),nullif(row_data->>'mobile_phone',''),nullif(row_data->>'instructor_phone',''),
          nullif(row_data->>'birth_date','')::date,coalesce(row_data->>'notes',''),(row_data->>'revision')::integer);
        updated:=updated+1;
      end if;
    exception when others then
      raise exception 'ROW_%: %',row_number,sqlerrm;
    end;
  end loop;
  return jsonb_build_object('created',created,'updated',updated);
end $$;

create or replace function public.life_member_excel_import(p_group text,p_org uuid,p_rows jsonb) returns jsonb
language sql security invoker set search_path='' as $$select life_private.member_excel_import(p_group,p_org,p_rows)$$;

revoke all on function life_private.member_excel_export(text,text),public.life_member_excel_export(text,text),
  life_private.member_excel_import(text,uuid,jsonb),public.life_member_excel_import(text,uuid,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function life_private.member_excel_export(text,text),public.life_member_excel_export(text,text),
  life_private.member_excel_import(text,uuid,jsonb),public.life_member_excel_import(text,uuid,jsonb)
  to authenticated;
notify pgrst,'reload schema';
commit;
