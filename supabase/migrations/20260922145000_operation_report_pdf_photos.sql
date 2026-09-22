-- Allow two ceremony slots and up to thirty imported operation photo slots.
create or replace function life_private.operation_content_valid(c jsonb,k text,complete boolean default false) returns boolean language plpgsql immutable set search_path='' as $$
declare spec jsonb; x jsonb; t jsonb; r jsonb; col jsonb; ff jsonb; tt jsonb;begin
 if k is null or k not in ('plan','result') or jsonb_typeof(c) is distinct from 'object' or octet_length(c::text)>3000000 then return false;end if;
 if (select count(*) from jsonb_object_keys(c))<>4 or not c ?& array['fields','tables','photos','signature'] or jsonb_typeof(c->'fields') is distinct from 'object' or jsonb_typeof(c->'tables') is distinct from 'object' or jsonb_typeof(c->'photos') is distinct from 'array' then return false;end if;
 spec:=life_private.operation_schema(k);ff:=spec->'fields';tt:=spec->'tables';
 if (select count(*) from jsonb_object_keys(c->'fields'))<>jsonb_array_length(ff) or (select count(*) from jsonb_object_keys(c->'tables'))<>jsonb_array_length(tt) then return false;end if;
 for x in select * from jsonb_array_elements(ff) loop
  if not life_private.operation_field(c->'fields'->(x->>'key'),x) or (complete and coalesce((x->>'required')::boolean,false) and btrim(c->'fields'->>(x->>'key'))='') then return false;end if;
 end loop;
 if c->'fields'->>'startsOn'<>'' and c->'fields'->>'endsOn'<>'' and c->'fields'->>'startsOn'>c->'fields'->>'endsOn' then return false;end if;
 for t in select * from jsonb_array_elements(tt) loop
  if jsonb_typeof(c->'tables'->(t->>'key')) is distinct from 'array' or jsonb_array_length(c->'tables'->(t->>'key'))>(t->>'max')::integer or (complete and jsonb_array_length(c->'tables'->(t->>'key'))<coalesce((t->>'min')::integer,0)) then return false;end if;
  for r in select * from jsonb_array_elements(c->'tables'->(t->>'key')) loop
   if jsonb_typeof(r) is distinct from 'object' or (select count(*) from jsonb_object_keys(r))<>jsonb_array_length(t->'columns') then return false;end if;
   for col in select * from jsonb_array_elements(t->'columns') loop
    if not life_private.operation_field(r->(col->>'key'),col) then return false;end if;
   end loop;
   if complete and t->>'key'='schedule' and (btrim(r->>'date')='' or btrim(r->>'topic')='' or btrim(r->>'instructor')='' or r->>'hours'='' or btrim(r->>'location')='') then return false;end if;
   if complete and t->>'key'='instructors' and btrim(r->>'name')='' then return false;end if;
  end loop;
 end loop;
 if (case when k='result' then jsonb_array_length(c->'photos') not between 2 and 32 else jsonb_array_length(c->'photos')<>0 end) or not life_private.operation_image(c->'signature',200000) then return false;end if;
 for r in select * from jsonb_array_elements(c->'photos') loop
  if jsonb_typeof(r) is distinct from 'object' or (select count(*) from jsonb_object_keys(r))<>3 or not r ?& array['caption','date','image'] or not life_private.operation_field(r->'caption','{"type":"text","max":100}'::jsonb) or not life_private.operation_field(r->'date','{"type":"date","max":10}'::jsonb) or not life_private.operation_image(r->'image',400000) then return false;end if;
 end loop;
 return true;exception when others then return false;
end$$;
