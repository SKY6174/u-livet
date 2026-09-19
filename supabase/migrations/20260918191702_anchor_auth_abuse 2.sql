-- Website auth throttling. Native Auth rate limits/CAPTCHA remain necessary.
create table life_private.auth_request_buckets (
 scope text not null,
 key_digest text not null check (key_digest ~ '^[0-9a-f]{64}$'),
 attempts integer not null check (attempts > 0),
 expires_at timestamptz not null,
 primary key(scope,key_digest)
);
create index auth_request_buckets_expiry_idx on life_private.auth_request_buckets(expires_at);
alter table life_private.auth_request_buckets enable row level security;
revoke all on life_private.auth_request_buckets from public,anon,authenticated,service_role;

create function life_private.check_auth_request(p_action text,p_subject text,p_network text,p_pair text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 scopes text[]; keys text[]; limits integer[]; durations integer[];
 i integer; row_count integer; row_expiry timestamptz;
 retry integer:=0; at_time timestamptz:=clock_timestamp();
begin
 if coalesce(auth.jwt()->>'role','') <> 'service_role' then
   raise exception 'AUTH_LIMIT_FORBIDDEN' using errcode='42501';
 end if;
 if p_action is null or p_action not in ('login','signup','recovery','reset')
 or p_subject is null or p_subject !~ '^[0-9a-f]{64}$'
 or p_network is null or p_network !~ '^[0-9a-f]{64}$'
 or p_pair is null or p_pair !~ '^[0-9a-f]{64}$' then
   raise exception 'AUTH_LIMIT_INVALID' using errcode='22023';
 end if;
 case p_action
 when 'login' then
   scopes:=array['login:network','login:pair','login:subject'];
   keys:=array[p_network,p_pair,p_subject]; limits:=array[60,8,30]; durations:=array[300,300,900];
 when 'signup' then
   scopes:=array['signup:network','signup:subject'];
   keys:=array[p_network,p_subject]; limits:=array[10,3]; durations:=array[3600,3600];
 when 'recovery' then
   scopes:=array['recovery:cooldown','recovery:network','recovery:subject'];
   keys:=array[p_subject,p_network,p_subject]; limits:=array[1,10,3]; durations:=array[60,900,900];
 when 'reset' then
   scopes:=array['reset:network','reset:subject'];
   keys:=array[p_network,p_subject]; limits:=array[30,5]; durations:=array[900,900];
 end case;
 -- Each request takes its scopes in the same order, including absent rows.
 for i in 1..array_length(scopes,1) loop
   perform pg_advisory_xact_lock(hashtextextended('life:auth:'||scopes[i]||':'||keys[i],0));
 end loop;
 -- Use a fresh clock after waiting for concurrent requests.
 at_time:=clock_timestamp();
 for i in 1..array_length(scopes,1) loop
   select attempts,expires_at into row_count,row_expiry from life_private.auth_request_buckets
     where scope=scopes[i] and key_digest=keys[i];
   if row_expiry>at_time and row_count>=limits[i] then
     retry:=greatest(retry,ceil(extract(epoch from row_expiry-at_time))::integer);
   end if;
 end loop;
 if retry>0 then return jsonb_build_object('allowed',false,'retry_after',retry); end if;
 for i in 1..array_length(scopes,1) loop
   insert into life_private.auth_request_buckets as b(scope,key_digest,attempts,expires_at)
   values(scopes[i],keys[i],1,at_time+make_interval(secs=>durations[i]))
   on conflict(scope,key_digest) do update set
     attempts=case when b.expires_at<=at_time then 1 else b.attempts+1 end,
     expires_at=case when b.expires_at<=at_time then excluded.expires_at else b.expires_at end;
 end loop;
 -- Bounded opportunistic cleanup. Scheduled cleanup is still needed when idle.
 delete from life_private.auth_request_buckets where (scope,key_digest) in
   (select scope,key_digest from life_private.auth_request_buckets
    where expires_at<at_time-interval '24 hours' order by expires_at limit 100 for update skip locked);
 return jsonb_build_object('allowed',true,'retry_after',0);
end $$;

create function public.life_check_auth_request(p_action text,p_subject text,p_network text,p_pair text)
returns jsonb language sql security invoker set search_path='' as $$
 select life_private.check_auth_request(p_action,p_subject,p_network,p_pair)
$$;
create function life_private.prune_auth_requests() returns integer
language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 if coalesce(auth.jwt()->>'role','') <> 'service_role' then
   raise exception 'AUTH_LIMIT_FORBIDDEN' using errcode='42501';
 end if;
 delete from life_private.auth_request_buckets where (scope,key_digest) in
   (select scope,key_digest from life_private.auth_request_buckets
    where expires_at<clock_timestamp()-interval '24 hours' order by expires_at limit 10000 for update skip locked);
 get diagnostics affected=row_count;
 return affected;
end $$;
create function public.life_prune_auth_requests() returns integer
language sql security invoker set search_path='' as $$select life_private.prune_auth_requests()$$;
revoke all on function life_private.check_auth_request(text,text,text,text),public.life_check_auth_request(text,text,text,text),life_private.prune_auth_requests(),public.life_prune_auth_requests() from public,anon,authenticated,service_role;
grant usage on schema life_private to service_role;
grant execute on function life_private.check_auth_request(text,text,text,text),public.life_check_auth_request(text,text,text,text),life_private.prune_auth_requests(),public.life_prune_auth_requests() to service_role;
