begin;
create table public.life_opening_working_copies (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.life_organizations,
 person_id uuid not null references public.life_people,
 source_id text not null check(source_id ~ '^P(0[1-9]|1[0-6])$'),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=150000),
 revision integer not null default 1 check(revision>0), updated_at timestamptz not null default now(),
 unique(org_id,person_id,source_id)
);
alter table public.life_opening_working_copies enable row level security;
revoke all on public.life_opening_working_copies from public,anon,authenticated,service_role;
create trigger life_recent_mfa_write before insert or update or delete on public.life_opening_working_copies
 for each statement execute function life_private.recent_mfa_write_guard();

create function life_private.valid_opening_copy(v jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare k text; t text; maximum integer;
begin
 if jsonb_typeof(v) is distinct from 'object' or octet_length(v::text)>150000 then return false; end if;
 if (select count(*) from jsonb_object_keys(v))<>13 then return false; end if;
 foreach k in array array['year','title','academy','location','mode','selection_method','capacity','apply_from','apply_until','starts_on','ends_on','summary','curriculum'] loop
  maximum:=case k when 'title' then 200 when 'academy' then 100 when 'location' then 200 when 'summary' then 3000 when 'curriculum' then 20000 else 36 end;
  if jsonb_typeof(v->k) is distinct from 'string' or length(v->>k)>maximum then return false; end if;
 end loop;
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

create function life_private.opening_working_copy(o uuid, source text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p uuid:=life_private.person_id(); result jsonb;
begin
 if p is null or not life_private.has_role(o,'COURSE_MANAGER') then raise exception 'FORBIDDEN'; end if;
 if source is null or source!~ '^P(0[1-9]|1[0-6])$' then raise exception 'INVALID_INPUT'; end if;
 select jsonb_build_object('payload',c.payload,'revision',c.revision,'updated_at',c.updated_at) into result
 from public.life_opening_working_copies c where c.org_id=o and c.person_id=p and c.source_id=source;
 return result;
end $$;
create function life_private.save_opening_working_copy(o uuid, source text, payload jsonb, expected_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p uuid:=life_private.person_id(); prior integer; entry public.life_opening_working_copies;
begin
 if p is null or not life_private.has_role(o,'COURSE_MANAGER') then raise exception 'FORBIDDEN'; end if;
 if source is null or source!~ '^P(0[1-9]|1[0-6])$' or expected_revision is null or expected_revision<0 or expected_revision>=2147483647
 or not life_private.valid_opening_copy(payload) then raise exception 'INVALID_INPUT'; end if;
 if payload->>'year'<>'' and not exists(select 1 from public.life_project_years y where y.id=(payload->>'year')::uuid and y.org_id=o) then raise exception 'INVALID_INPUT'; end if;
 -- Serialize initial inserts as well as subsequent revisions for this author.
 perform 1 from public.life_people where id=p for update;
 select c.revision into prior from public.life_opening_working_copies c where c.org_id=o and c.person_id=p and c.source_id=source;
 if coalesce(prior,0)<>expected_revision then raise exception 'REVISION_CHANGED'; end if;
 insert into public.life_opening_working_copies(org_id,person_id,source_id,payload) values(o,p,source,payload)
 on conflict(org_id,person_id,source_id) do update set payload=excluded.payload,revision=public.life_opening_working_copies.revision+1,updated_at=now()
 returning * into entry;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details)
 values(o,p,'OPENING_WORKING_COPY_SAVED',entry.id,jsonb_build_object('source_id',source,'revision',entry.revision));
 return jsonb_build_object('revision',entry.revision,'updated_at',entry.updated_at);
end $$;
create function public.life_opening_working_copy(o uuid, source text) returns jsonb
language sql stable security invoker set search_path='' as $$select life_private.opening_working_copy(o,source)$$;
create function public.life_save_opening_working_copy(o uuid, source text, payload jsonb, expected_revision integer) returns jsonb
language sql security invoker set search_path='' as $$select life_private.save_opening_working_copy(o,source,payload,expected_revision)$$;
revoke all on function life_private.valid_opening_copy(jsonb),life_private.opening_working_copy(uuid,text),life_private.save_opening_working_copy(uuid,text,jsonb,integer),
 public.life_opening_working_copy(uuid,text),public.life_save_opening_working_copy(uuid,text,jsonb,integer) from public,anon,authenticated,service_role;
grant execute on function life_private.opening_working_copy(uuid,text),life_private.save_opening_working_copy(uuid,text,jsonb,integer),
 public.life_opening_working_copy(uuid,text),public.life_save_opening_working_copy(uuid,text,jsonb,integer) to authenticated;
notify pgrst,'reload schema';
commit;
