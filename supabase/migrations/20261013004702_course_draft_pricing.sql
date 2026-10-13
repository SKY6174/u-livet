begin;

-- Preserve old 13-field working copies while accepting optional draft pricing.
create or replace function life_private.valid_opening_copy(v jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare k text; t text; maximum integer; fee text;
begin
 if jsonb_typeof(v) is distinct from 'object' or octet_length(v::text)>150000 then return false; end if;
 if exists(select 1 from jsonb_object_keys(v) as keys(key) where key not in
  ('year','title','academy','location','mode','selection_method','capacity','apply_from','apply_until','starts_on','ends_on','summary','curriculum','fee_type','tuition')) then return false; end if;
 foreach k in array array['year','title','academy','location','mode','selection_method','capacity','apply_from','apply_until','starts_on','ends_on','summary','curriculum'] loop
  maximum:=case k when 'title' then 200 when 'academy' then 100 when 'location' then 200 when 'summary' then 3000 when 'curriculum' then 20000 else 36 end;
  if jsonb_typeof(v->k) is distinct from 'string' or length(v->>k)>maximum then return false; end if;
 end loop;
 foreach k in array array['fee_type','tuition'] loop
  if v ? k and (jsonb_typeof(v->k) is distinct from 'string' or length(v->>k)>case k when 'fee_type' then 4 else 9 end) then return false; end if;
 end loop;
 fee:=coalesce(nullif(v->>'fee_type',''),'FREE');
 if fee not in ('FREE','PAID') then return false; end if;
 t:=coalesce(v->>'tuition','');
 if t<>'' then
  if t!~ '^[0-9]{1,9}$' or t::integer not between 0 and 100000000 then return false; end if;
  if (fee='FREE' and t::integer<>0) or (fee='PAID' and t::integer=0) then return false; end if;
 end if;
 if v->>'year'<>'' and v->>'year'!~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
 if v->>'mode' not in ('','OFFLINE','ONLINE','BLENDED') or v->>'selection_method' not in ('','REVIEW','FIRST_COME') then return false; end if;
 t:=v->>'capacity';
 if t<>'' and (t!~ '^[0-9]{1,4}$' or t::integer not between 1 and 1000) then return false; end if;
 foreach k in array array['starts_on','ends_on'] loop
  t:=v->>k;
  if t<>'' and (t!~ '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$' or to_char(t::date,'YYYY-MM-DD')<>t) then return false; end if;
 end loop;
 foreach k in array array['apply_from','apply_until'] loop
  t:=v->>k;
  if t<>'' and (t!~ '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$' or to_char(t::timestamp,'YYYY-MM-DD"T"HH24:MI')<>t) then return false; end if;
 end loop;
 return true;
 exception when others then return false;
end $$;

-- A distinct RPC keeps legacy creation signatures and clients compatible.
create function life_private.create_offering_with_tuition(
 o uuid,y uuid,title text,academy text,summary text,curriculum text,
 mode text,location text,capacity integer,selection_method text,
 apply_from timestamptz,apply_until timestamptz,starts_on date,ends_on date,
 tuition integer,source_id text
) returns uuid language plpgsql security definer set search_path='' as $$
declare offering uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not life_private.mfa_recent() then raise exception 'MFA_REAUTH_REQUIRED'; end if;
 if not life_private.has_role(o,'COURSE_MANAGER') then raise exception 'FORBIDDEN'; end if;
 if tuition is null or tuition not between 0 and 100000000 then raise exception 'INVALID_TUITION'; end if;
 if source_id is null then
  offering:=life_private.create_offering(o,y,title,academy,summary,curriculum,
   mode,location,capacity,selection_method,apply_from,apply_until,starts_on,ends_on);
 else
  offering:=life_private.create_source_offering(source_id,o,y,title,academy,summary,curriculum,
   mode,location,capacity,selection_method,apply_from,apply_until,starts_on,ends_on);
 end if;
 update public.life_offerings set tuition=create_offering_with_tuition.tuition
 where id=offering and status='DRAFT';
 if not found then raise exception 'INVALID_TRANSITION'; end if;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
 values(o,life_private.person_id(),'OFFERING_DRAFT_TUITION_SET',offering,jsonb_build_object('tuition',tuition));
 return offering;
end $$;

create function public.life_create_offering_with_tuition(
 o uuid,y uuid,title text,academy text,summary text,curriculum text,
 mode text,location text,capacity integer,selection_method text,
 apply_from timestamptz,apply_until timestamptz,starts_on date,ends_on date,
 tuition integer,source_id text default null
) returns uuid language sql security invoker set search_path='' as $$
 select life_private.create_offering_with_tuition(o,y,title,academy,summary,curriculum,
  mode,location,capacity,selection_method,apply_from,apply_until,starts_on,ends_on,tuition,source_id)
$$;

revoke all on function life_private.create_offering_with_tuition(uuid,uuid,text,text,text,text,text,text,integer,text,timestamptz,timestamptz,date,date,integer,text),
 public.life_create_offering_with_tuition(uuid,uuid,text,text,text,text,text,text,integer,text,timestamptz,timestamptz,date,date,integer,text)
 from public,anon,authenticated,service_role;
grant execute on function life_private.create_offering_with_tuition(uuid,uuid,text,text,text,text,text,text,integer,text,timestamptz,timestamptz,date,date,integer,text),
 public.life_create_offering_with_tuition(uuid,uuid,text,text,text,text,text,text,integer,text,timestamptz,timestamptz,date,date,integer,text)
 to authenticated;

notify pgrst,'reload schema';
commit;
