-- Course-linked free parking vouchers. The source paper ledger is a print view,
-- while requests, stock movements and decisions remain immutable database evidence.
begin;
create table public.life_parking_centers (
  code text primary key check (code in ('RCC','ECC','AID-X')),
  label text not null,
  reviewer_name text not null,
  reviewer_email text not null unique
);
insert into public.life_parking_centers(code,label,reviewer_name,reviewer_email) values
 ('RCC','RCC센터','이연향','yhlee4@uc.ac.kr'),
 ('ECC','ECC센터','이은주','ejlee7@uc.ac.kr'),
 ('AID-X','AID-X지원센터','임은애','jslover85@uc.ac.kr');

create table public.life_parking_offering_centers (
 offering_id uuid primary key,
 org_id uuid not null,
 center_code text not null references public.life_parking_centers(code),
 set_by uuid not null references public.life_people(id),
 set_at timestamptz not null default now(),
 foreign key(offering_id,org_id) references public.life_offerings(id,org_id)
);
create index life_parking_offering_centers_org on public.life_parking_offering_centers(org_id,center_code);

create table public.life_parking_stock (
 org_id uuid not null references public.life_organizations(id),
 center_code text not null references public.life_parking_centers(code),
 balance integer not null default 0 check(balance between 0 and 1000000),
 updated_at timestamptz not null default now(),
 primary key(org_id,center_code)
);
create table public.life_parking_stock_events (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null,
 center_code text not null,
 quantity integer not null check(quantity between 1 and 10000),
 balance_after integer not null check(balance_after>=0),
 note text not null check(length(note) between 1 and 500),
 actor_id uuid not null references public.life_people(id),
 created_at timestamptz not null default now(),
 foreign key(org_id,center_code) references public.life_parking_stock(org_id,center_code)
);
create index life_parking_stock_events_center on public.life_parking_stock_events(org_id,center_code,created_at desc);

create table public.life_parking_requests (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null,
 offering_id uuid not null,
 center_code text not null references public.life_parking_centers(code),
 person_id uuid not null references public.life_people(id),
 applicant_kind text not null check(applicant_kind in ('LEARNER','EXTERNAL_INSTRUCTOR')),
 course_name text not null check(length(course_name) between 1 and 200),
 recipient_name text not null check(length(recipient_name) between 1 and 100),
 phone text not null check(phone ~ '^0[0-9-]{8,15}$'),
 use_on date not null,
 quantity integer not null check(quantity between 1 and 10),
 status text not null default 'PENDING' check(status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
 requested_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewer_id uuid references public.life_people(id),
 decision_note text not null default '' check(length(decision_note)<=500),
 remaining_after integer check(remaining_after>=0),
 foreign key(offering_id,org_id) references public.life_offerings(id,org_id),
 check ((status='APPROVED' and reviewed_at is not null and reviewer_id is not null and remaining_after is not null)
   or (status='REJECTED' and reviewed_at is not null and reviewer_id is not null and length(decision_note)>0 and remaining_after is null)
   or (status in ('PENDING','CANCELLED') and remaining_after is null))
);
create unique index life_parking_one_active_day on public.life_parking_requests(offering_id,person_id,use_on)
 where status in ('PENDING','APPROVED');
create index life_parking_requests_queue on public.life_parking_requests(org_id,center_code,status,requested_at desc);
create index life_parking_requests_ledger on public.life_parking_requests(org_id,center_code,reviewed_at desc) where status='APPROVED';
create index life_parking_requests_person on public.life_parking_requests(person_id,requested_at desc);

create function life_private.parking_staff(o uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and life_private.person_id() is not null
 and life_private.mfa_verified()
 and (life_private.has_role(o,'COURSE_MANAGER') or life_private.has_role(o,'SYSTEM_ADMIN'))
$$;
create function life_private.parking_reviewer(o uuid,c text) returns boolean
language sql stable security definer set search_path='' as $$
 select life_private.parking_staff(o) and exists(
  select 1 from public.life_parking_centers pc join auth.users u on lower(u.email)=pc.reviewer_email
  where pc.code=c and u.id=auth.uid() and u.email_confirmed_at is not null and u.deleted_at is null
 )
$$;
create function life_private.parking_applicant(f uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare o public.life_offerings; p uuid:=life_private.person_id();begin
 if p is null then return null;end if;
 select * into o from public.life_offerings where id=f;
 if o.id is null or o.status not in ('PUBLISHED','CLOSED') then return null;end if;
 if life_private.enrolled(f) then return 'LEARNER';end if;
 if life_private.teaches(f) and exists(select 1 from life_private.account_classifications c where c.person_id=p and c.instructor_kind='EXTERNAL') then return 'EXTERNAL_INSTRUCTOR';end if;
 return null;
end$$;
create function life_private.parking_my_context() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p uuid:=life_private.person_id();today date:=(now() at time zone 'Asia/Seoul')::date;begin
 if p is null then raise exception 'AUTH_REQUIRED';end if;
 return jsonb_build_object(
 'offerings',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'starts_on',o.starts_on,'ends_on',o.ends_on,'center_code',m.center_code,'kind',life_private.parking_applicant(o.id)) order by o.starts_on,o.name)
  from public.life_offerings o left join public.life_parking_offering_centers m on m.offering_id=o.id
  where o.ends_on>=today and o.status in ('PUBLISHED','CLOSED') and life_private.parking_applicant(o.id) is not null),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(to_jsonb(r) order by r.requested_at desc) from
  (select id,offering_id,center_code,course_name,recipient_name,phone,use_on,quantity,status,requested_at,reviewed_at,decision_note from public.life_parking_requests where person_id=p order by requested_at desc limit 200) r),'[]'::jsonb)
 );
end$$;
create function life_private.parking_admin_context(y integer,c text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if y not between 2020 and 2100 or (c is not null and c not in ('RCC','ECC','AID-X')) then raise exception 'INVALID_INPUT';end if;
 if not exists(select 1 from public.life_role_assignments ra where ra.person_id=life_private.person_id() and ra.role in ('COURSE_MANAGER','SYSTEM_ADMIN') and ra.valid_from<=now() and (ra.valid_until is null or ra.valid_until>now()) and life_private.parking_staff(ra.org_id)) then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object(
 'centers',(select coalesce(jsonb_agg(jsonb_build_object('code',pc.code,'label',pc.label,'reviewer_name',pc.reviewer_name,'reviewer_email',pc.reviewer_email) order by pc.code),'[]'::jsonb) from public.life_parking_centers pc),
 'organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.name),'[]'::jsonb) from public.life_organizations o where life_private.parking_staff(o.id)),
 'offerings',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'org_id',o.org_id,'name',o.name,'starts_on',o.starts_on,'ends_on',o.ends_on,'center_code',m.center_code) order by o.starts_on desc,o.name),'[]'::jsonb) from public.life_offerings o left join public.life_parking_offering_centers m on m.offering_id=o.id where extract(year from o.starts_on)=y and life_private.parking_staff(o.org_id)),
 'stock',(select coalesce(jsonb_agg(jsonb_build_object('org_id',s.org_id,'center_code',s.center_code,'balance',s.balance) order by s.center_code),'[]'::jsonb) from public.life_parking_stock s where life_private.parking_staff(s.org_id)),
 'requests',(select coalesce(jsonb_agg(row_to_json(r) order by r.requested_at desc),'[]'::jsonb) from (
  select q.id,q.org_id,q.offering_id,q.center_code,q.course_name,q.recipient_name,q.phone,q.use_on,q.quantity,q.status,q.requested_at,q.reviewed_at,q.decision_note,q.remaining_after,
   p.name requester_name,rv.name reviewer_name,life_private.parking_reviewer(q.org_id,q.center_code) can_decide
  from public.life_parking_requests q join public.life_people p on p.id=q.person_id left join public.life_people rv on rv.id=q.reviewer_id
  where extract(year from q.use_on)=y and (c is null or q.center_code=c) and life_private.parking_staff(q.org_id)
  order by q.requested_at desc limit 3000) r)
 );
end$$;
create function life_private.parking_request(f uuid,d date,n integer,contact text) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.life_offerings;m public.life_parking_offering_centers;p uuid:=life_private.person_id();k text;r uuid;today date:=(now() at time zone 'Asia/Seoul')::date;begin
 if p is null then raise exception 'AUTH_REQUIRED';end if;
 if n is null or n not between 1 and 10 or contact is null or contact !~ '^0[0-9-]{8,15}$' then raise exception 'INVALID_INPUT';end if;
 select * into o from public.life_offerings where id=f;
 select * into m from public.life_parking_offering_centers where offering_id=f;
 k:=life_private.parking_applicant(f);
 if o.id is null or k is null or m.offering_id is null or d is null or d<today or d<o.starts_on or d>o.ends_on then raise exception 'REQUEST_UNAVAILABLE';end if;
 insert into public.life_parking_requests(org_id,offering_id,center_code,person_id,applicant_kind,course_name,recipient_name,phone,use_on,quantity)
 select o.org_id,f,m.center_code,p,k,o.name,people.name,contact,d,n from public.life_people people where people.id=p returning id into r;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details) values(o.org_id,p,'PARKING_REQUESTED',r,jsonb_build_object('center',m.center_code,'quantity',n));
 return r;
exception when unique_violation then raise exception 'DUPLICATE_REQUEST';
end$$;
create function life_private.parking_cancel(r uuid) returns void
language plpgsql security definer set search_path='' as $$
declare q public.life_parking_requests;p uuid:=life_private.person_id();begin
 if p is null then raise exception 'AUTH_REQUIRED';end if;
 select * into q from public.life_parking_requests where id=r for update;
 if q.id is null or q.person_id<>p or q.status<>'PENDING' then raise exception 'FORBIDDEN';end if;
 update public.life_parking_requests set status='CANCELLED' where id=r;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id) values(q.org_id,p,'PARKING_CANCELLED',r);
end$$;
create function life_private.parking_assign(f uuid,c text) returns void
language plpgsql security definer set search_path='' as $$
declare o public.life_offerings;p uuid:=life_private.person_id();begin
 select * into o from public.life_offerings where id=f;
 if o.id is null or not life_private.parking_staff(o.org_id) or not life_private.mfa_recent() then raise exception 'FORBIDDEN';end if;
 if c is null or not exists(select 1 from public.life_parking_centers where code=c) then raise exception 'INVALID_INPUT';end if;
 perform 1 from public.life_offerings where id=f for update;
 if exists(select 1 from public.life_parking_requests where offering_id=f and status='PENDING' and center_code<>c) then raise exception 'PENDING_REQUESTS';end if;
 insert into public.life_parking_offering_centers(offering_id,org_id,center_code,set_by) values(f,o.org_id,c,p)
 on conflict(offering_id) do update set center_code=excluded.center_code,set_by=p,set_at=now();
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details) values(o.org_id,p,'PARKING_CENTER_ASSIGNED',f,jsonb_build_object('center',c));
end$$;
create function life_private.parking_add_stock(o uuid,c text,n integer,note text) returns void
language plpgsql security definer set search_path='' as $$
declare p uuid:=life_private.person_id();balance_value integer;begin
 if not life_private.parking_staff(o) or not life_private.mfa_recent() then raise exception 'FORBIDDEN';end if;
 if c is null or not exists(select 1 from public.life_parking_centers where code=c) or n is null or n not between 1 and 10000 or note is null or length(btrim(note)) not between 1 and 500 then raise exception 'INVALID_INPUT';end if;
 insert into public.life_parking_stock(org_id,center_code,balance) values(o,c,0) on conflict do nothing;
 update public.life_parking_stock set balance=balance+n,updated_at=now() where org_id=o and center_code=c and balance+n<=1000000 returning balance into balance_value;
 if balance_value is null then raise exception 'STOCK_LIMIT';end if;
 insert into public.life_parking_stock_events(org_id,center_code,quantity,balance_after,note,actor_id) values(o,c,n,balance_value,btrim(note),p);
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details) values(o,p,'PARKING_STOCK_ADDED',gen_random_uuid(),jsonb_build_object('center',c,'quantity',n,'balance',balance_value));
end$$;
create function life_private.parking_decide(r uuid,approve boolean,note text) returns void
language plpgsql security definer set search_path='' as $$
declare q public.life_parking_requests;p uuid:=life_private.person_id();balance_value integer;begin
 if p is null or not life_private.mfa_recent() then raise exception 'FORBIDDEN';end if;
 select * into q from public.life_parking_requests where id=r for update;
 if q.id is null or q.status<>'PENDING' or not life_private.parking_reviewer(q.org_id,q.center_code) then raise exception 'FORBIDDEN';end if;
 if approve is null or note is null or length(note)>500 or (not approve and btrim(note)='') then raise exception 'INVALID_INPUT';end if;
 if approve then
  update public.life_parking_stock set balance=balance-q.quantity,updated_at=now()
   where org_id=q.org_id and center_code=q.center_code and balance>=q.quantity returning balance into balance_value;
  if balance_value is null then raise exception 'INSUFFICIENT_STOCK';end if;
 end if;
 update public.life_parking_requests set status=case when approve then 'APPROVED' else 'REJECTED' end,
  reviewed_at=now(),reviewer_id=p,decision_note=btrim(note),remaining_after=balance_value where id=r;
 insert into public.life_audit_events(org_id,actor_id,action,entity_id,details) values(q.org_id,p,case when approve then 'PARKING_APPROVED' else 'PARKING_REJECTED' end,r,jsonb_build_object('center',q.center_code,'quantity',q.quantity,'balance',balance_value));
end$$;

create function public.life_parking_my_context() returns jsonb language sql stable security invoker set search_path='' as $$select life_private.parking_my_context()$$;
create function public.life_parking_admin_context(y integer,c text default null) returns jsonb language sql stable security invoker set search_path='' as $$select life_private.parking_admin_context(y,c)$$;
create function public.life_parking_request(f uuid,d date,n integer,contact text) returns uuid language sql security invoker set search_path='' as $$select life_private.parking_request(f,d,n,contact)$$;
create function public.life_parking_cancel(r uuid) returns void language sql security invoker set search_path='' as $$select life_private.parking_cancel(r)$$;
create function public.life_parking_assign(f uuid,c text) returns void language sql security invoker set search_path='' as $$select life_private.parking_assign(f,c)$$;
create function public.life_parking_add_stock(o uuid,c text,n integer,note text) returns void language sql security invoker set search_path='' as $$select life_private.parking_add_stock(o,c,n,note)$$;
create function public.life_parking_decide(r uuid,approve boolean,note text) returns void language sql security invoker set search_path='' as $$select life_private.parking_decide(r,approve,note)$$;

do $$declare t text;f record;begin
 foreach t in array array['life_parking_centers','life_parking_offering_centers','life_parking_stock','life_parking_stock_events','life_parking_requests'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
 for f in select p.oid::regprocedure::text sig,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','life_private') and p.proname like '%parking_%' loop
  execute 'revoke all on function '||f.sig||' from public,anon,authenticated,service_role';
  execute 'grant execute on function '||f.sig||' to authenticated';
 end loop;
end$$;
notify pgrst,'reload schema';
commit;
