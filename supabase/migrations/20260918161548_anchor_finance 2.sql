begin;
alter table public.life_policy_versions drop constraint life_policy_versions_kind_check;
alter table public.life_policy_versions add constraint life_policy_versions_kind_check check(kind in ('ACCOUNT_PRIVACY','ENROLLMENT','COMPLETION','MARKETING','REFUND'));
alter table public.life_applications drop constraint life_applications_status_check;
alter table public.life_applications add constraint life_applications_status_check check(status in ('SUBMITTED','WAITLISTED','PENDING_PAYMENT','ACCEPTED','REJECTED','CANCELLED'));

create table public.life_finance_grants (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.life_organizations,
 person_id uuid not null references public.life_people, permission text not null check(permission in ('RECORD','APPROVE','PAYOUT')),
 valid_from timestamptz not null, valid_until timestamptz not null, approved_by uuid not null references public.life_people,
 approval_reference text not null check(length(trim(approval_reference)) between 1 and 300), check(valid_until>valid_from)
);
create table public.life_refund_rules (
 id uuid primary key default gen_random_uuid(), policy_id uuid not null references public.life_policy_versions,
 label text not null check(length(trim(label)) between 1 and 300), basis text not null check(basis in ('TUITION','PAID')),
 numerator integer not null, denominator integer not null check(denominator between 1 and 100000),
 check(numerator between 0 and denominator), unique(id,policy_id)
);
create table public.life_offering_finance (
 offering_id uuid primary key, org_id uuid not null, policy_id uuid not null,
 reservation_hours integer not null check(reservation_hours between 1 and 720),
 instructions text not null check(length(trim(instructions)) between 1 and 3000), configured_by uuid not null references public.life_people,
 foreign key(offering_id,org_id) references public.life_offerings(id,org_id),
 foreign key(policy_id,org_id) references public.life_policy_versions(id,org_id)
);
create table public.life_invoices (
 id uuid primary key default gen_random_uuid(), application_id uuid not null unique,
 offering_id uuid not null, person_id uuid not null, org_id uuid not null, policy_id uuid not null,
 amount bigint not null check(amount between 1 and 100000000), due_at timestamptz not null,
 status text not null default 'OPEN' check(status in ('OPEN','SETTLED','CANCELLED','EXPIRED')), created_at timestamptz not null default now(),
 unique(id,org_id,person_id), foreign key(application_id,offering_id,person_id) references public.life_applications(id,offering_id,person_id),
 foreign key(offering_id,org_id) references public.life_offerings(id,org_id), foreign key(policy_id,org_id) references public.life_policy_versions(id,org_id)
);
create table public.life_payment_reports (
 id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.life_invoices,
 amount bigint not null check(amount between 1 and 100000000), depositor text not null check(length(trim(depositor)) between 1 and 100),
 deposited_at timestamptz not null, request_key uuid not null unique, created_at timestamptz not null default now()
);
create table public.life_payments (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.life_organizations, person_id uuid not null references public.life_people,
 amount bigint not null check(amount between 1 and 100000000), deposited_at timestamptz not null,
 depositor text not null check(length(trim(depositor)) between 1 and 100), external_ref text not null check(length(trim(external_ref)) between 1 and 200),
 evidence text not null check(length(trim(evidence)) between 1 and 1000), verified_by uuid not null references public.life_people,
 created_at timestamptz not null default now(), unique(org_id,external_ref), unique(id,org_id,person_id)
);
create table public.life_payment_allocations (
 id uuid primary key default gen_random_uuid(), payment_id uuid not null, invoice_id uuid not null,
 org_id uuid not null, person_id uuid not null, amount bigint not null check(amount>0), request_key uuid not null unique,
 created_at timestamptz not null default now(), allocated_by uuid not null references public.life_people,
 foreign key(payment_id,org_id,person_id) references public.life_payments(id,org_id,person_id),
 foreign key(invoice_id,org_id,person_id) references public.life_invoices(id,org_id,person_id)
);
create index life_allocation_invoice on public.life_payment_allocations(invoice_id);
create index life_allocation_payment on public.life_payment_allocations(payment_id);
create table public.life_credit_notes (
 id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.life_invoices, amount bigint not null check(amount<>0),
 reason text not null, source_key text not null unique, created_at timestamptz not null default now()
);
create table public.life_refunds (
 id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.life_invoices,
 reason text not null check(length(trim(reason)) between 1 and 1000), requested_at timestamptz not null default now(),
 status text not null default 'REQUESTED' check(status in ('REQUESTED','REVIEWED','APPROVED','PROCESSING','RECONCILING','PAID','REJECTED')),
 revision integer not null default 1, request_key uuid not null unique, snapshot jsonb not null,
 rule_id uuid references public.life_refund_rules, amount bigint check(amount>=0), calculation_basis text,
 reviewed_by uuid references public.life_people, reviewed_at timestamptz, financial_snapshot jsonb,
 approved_by uuid references public.life_people, approved_at timestamptz, decision_reason text, payee_reference text
);
create unique index life_one_open_refund on public.life_refunds(invoice_id) where status in ('REQUESTED','REVIEWED','APPROVED','PROCESSING','RECONCILING');
create table public.life_refund_allocations (
 refund_id uuid not null references public.life_refunds, allocation_id uuid not null references public.life_payment_allocations,
 amount bigint not null check(amount>0), primary key(refund_id,allocation_id)
);
create table public.life_refund_transfers (
 id uuid primary key default gen_random_uuid(), refund_id uuid not null references public.life_refunds, org_id uuid not null references public.life_organizations,
 status text not null default 'PROCESSING' check(status in ('PROCESSING','RECONCILING','PAID','NOT_PAID')),
 amount bigint not null check(amount>0), started_by uuid not null references public.life_people, started_at timestamptz not null default now(),
 external_ref text, evidence text, resolved_at timestamptz, resolved_by uuid references public.life_people,
 unique(org_id,external_ref)
);
create unique index life_one_live_transfer on public.life_refund_transfers(refund_id) where status in ('PROCESSING','RECONCILING','PAID');
create table public.life_finance_events (
 id bigint generated always as identity primary key, invoice_id uuid not null references public.life_invoices,
 actor_id uuid references public.life_people, action text not null, details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create function life_private.fin_allowed(o uuid,p text) returns boolean language sql stable security definer set search_path='' as $$
 select life_private.has_role(o,'FINANCE') and exists(select 1 from public.life_finance_grants g where g.org_id=o and g.person_id=life_private.person_id() and g.permission=p and g.valid_from<=now() and g.valid_until>now())
$$;
create function life_private.fin_staff(o uuid) returns boolean language sql stable security definer set search_path='' as $$
 select life_private.fin_allowed(o,'RECORD') or life_private.fin_allowed(o,'APPROVE') or life_private.fin_allowed(o,'PAYOUT')
$$;
create function life_private.fin_totals(i uuid) returns table(paid bigint,refunded bigint,reserved bigint,credited bigint) language sql stable security definer set search_path='' as $$
 select coalesce((select sum(amount) from public.life_payment_allocations where invoice_id=i),0)::bigint,
 coalesce((select sum(amount) from public.life_refunds where invoice_id=i and status='PAID'),0)::bigint,
 coalesce((select sum(amount) from public.life_refunds where invoice_id=i and status in ('APPROVED','PROCESSING','RECONCILING')),0)::bigint,
 coalesce((select sum(amount) from public.life_credit_notes where invoice_id=i),0)::bigint
$$;
create function life_private.fin_event(i uuid,a text,d jsonb default '{}'::jsonb) returns void language sql security definer set search_path='' as $$
 insert into public.life_finance_events(invoice_id,actor_id,action,details) values(i,life_private.person_id(),a,d)
$$;
create function life_private.fin_frozen() returns trigger language plpgsql set search_path='' as $$begin raise exception 'FINANCE_RECORD_IMMUTABLE';end$$;
create trigger refund_rule_frozen before update or delete on public.life_refund_rules for each row execute function life_private.fin_frozen();

create function life_private.configure_finance(f uuid,tuition bigint,policy uuid,hours integer,instructions text) returns void language plpgsql security definer set search_path='' as $$
declare o public.life_offerings;
begin
 select * into o from public.life_offerings where id=f for update;
 if not life_private.manages(f) then raise exception 'FORBIDDEN';end if;
 if o.status<>'DRAFT' then raise exception 'INVALID_TRANSITION';end if;
 if tuition is null or tuition not between 1 and 100000000 or not life_private.policy_valid(policy,o.org_id,'REFUND') or not exists(select 1 from public.life_refund_rules where policy_id=policy) then raise exception 'APPROVED_REFUND_POLICY_REQUIRED';end if;
 insert into public.life_offering_finance values(f,o.org_id,policy,hours,trim(instructions),life_private.person_id())
 on conflict(offering_id) do update set policy_id=excluded.policy_id,reservation_hours=excluded.reservation_hours,instructions=excluded.instructions,configured_by=excluded.configured_by;
 update public.life_offerings set tuition=configure_finance.tuition where id=f;
end $$;
create function life_private.offering_finance(f uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('policy_id',p.id,'title',p.title,'version',p.version,'body',p.body,'reservation_hours',c.reservation_hours,'instructions',c.instructions,'valid',life_private.policy_valid(p.id,p.org_id,'REFUND'))
 from public.life_offering_finance c join public.life_policy_versions p on p.id=c.policy_id where c.offering_id=f and life_private.read_offering(f)
$$;
create function life_private.expire_finance(f uuid) returns void language plpgsql security definer set search_path='' as $$
declare v public.life_invoices;t record;
begin
 -- Callers hold the offering lock first. Expiration is also lazy on each seat/ledger mutation.
 for v in select * from public.life_invoices where offering_id=f and status='OPEN' and due_at<=clock_timestamp() order by id for update loop
 select * into t from life_private.fin_totals(v.id);
 update public.life_invoices set status='EXPIRED' where id=v.id;
 update public.life_applications set status='CANCELLED' where id=v.application_id and status='PENDING_PAYMENT';
 if v.amount>t.paid then insert into public.life_credit_notes(invoice_id,amount,reason,source_key) values(v.id,v.amount-t.paid,'납부기한 만료 미납 조정','expire:'||v.id);end if;
 perform life_private.fin_event(v.id,'INVOICE_EXPIRED');
 end loop;
end $$;
create function life_private.issue_invoice(a uuid) returns void language plpgsql security definer set search_path='' as $$
declare v public.life_applications;o public.life_offerings;c public.life_offering_finance;d timestamptz;i uuid;
begin
 select * into v from public.life_applications where id=a;select * into o from public.life_offerings where id=v.offering_id;
 select * into c from public.life_offering_finance where offering_id=o.id;
 if not life_private.policy_valid(c.policy_id,o.org_id,'REFUND') then raise exception 'APPROVED_REFUND_POLICY_REQUIRED';end if;
 d:=least(clock_timestamp()+make_interval(hours=>c.reservation_hours),o.starts_on::timestamp at time zone 'Asia/Seoul');
 if d<=clock_timestamp() then raise exception 'APPLICATION_CLOSED';end if;
 insert into public.life_invoices(application_id,offering_id,person_id,org_id,policy_id,amount,due_at) values(a,o.id,v.person_id,o.org_id,c.policy_id,o.tuition,d) returning id into i;
 perform life_private.fin_event(i,'INVOICE_CREATED',jsonb_build_object('amount',o.tuition,'due_at',d));
end $$;
-- Preserve tested free-course behavior; intercept paid paths only.
alter function life_private.apply(uuid,uuid) rename to apply_free;
alter function life_private.decide(uuid,text) rename to decide_free;
alter function life_private.publish(uuid,uuid,uuid) rename to publish_free;
create function life_private.apply(f uuid,policy uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.life_offerings;p uuid:=life_private.person_id();a uuid;s text;n integer;
begin
 if p is null then raise exception 'AUTH_REQUIRED';end if;
 select * into o from public.life_offerings where id=f for update;
 if o.id is null then raise exception 'NOT_FOUND';end if;
 if o.tuition=0 then return life_private.apply_free(f,policy);end if;
 select id into a from public.life_applications where offering_id=f and person_id=p;if a is not null then return a;end if;
 if o.status<>'PUBLISHED' or now()<o.apply_from or now()>=o.apply_until or (clock_timestamp() at time zone 'Asia/Seoul')::date>=o.starts_on then raise exception 'APPLICATION_CLOSED';end if;
 if policy is distinct from o.enrollment_policy_id or not life_private.policy_valid(policy,o.org_id,'ENROLLMENT') then raise exception 'POLICY_CHANGED';end if;
 if not exists(select 1 from public.life_offering_finance c where c.offering_id=f and life_private.policy_valid(c.policy_id,o.org_id,'REFUND')) then raise exception 'APPROVED_REFUND_POLICY_REQUIRED';end if;
 perform life_private.expire_finance(f);
 select (select count(*) from public.life_enrollments where offering_id=f and status='ACTIVE')+(select count(*) from public.life_applications where offering_id=f and status='PENDING_PAYMENT') into n;
 s:=case when o.selection_method='REVIEW' then 'SUBMITTED' when n<o.capacity then 'PENDING_PAYMENT' else 'WAITLISTED' end;
 insert into public.life_applications(offering_id,person_id,status,policy_id) values(f,p,s,policy) returning id into a;
 insert into public.life_consent_events(person_id,policy_id,accepted,source) values(p,policy,true,'APPLICATION');
 insert into public.life_consent_events(person_id,policy_id,accepted,source) select p,policy_id,true,'PAID_APPLICATION' from public.life_offering_finance where offering_id=f;
 if s='PENDING_PAYMENT' then perform life_private.issue_invoice(a);end if;return a;
end $$;
create or replace function public.life_apply(f uuid,policy uuid) returns uuid language sql security invoker set search_path='' as $$select life_private.apply(f,policy)$$;
create function life_private.decide(a uuid,decision text) returns void language plpgsql security definer set search_path='' as $$
declare v public.life_applications;o public.life_offerings;i public.life_invoices;t record;n integer;
begin
 select * into v from public.life_applications where id=a;select * into o from public.life_offerings where id=v.offering_id for update;
 if o.id is null then raise exception 'NOT_FOUND';end if;
 if o.tuition=0 then perform life_private.decide_free(a,decision);return;end if;
 perform life_private.expire_finance(o.id);select * into v from public.life_applications where id=a for update;
 if decision='CANCELLED' then
 if v.person_id is distinct from life_private.person_id() and not life_private.manages(o.id) then raise exception 'FORBIDDEN';end if;
 if v.status='CANCELLED' then return;end if;
 if v.status='REJECTED' then raise exception 'INVALID_TRANSITION';end if;
 select * into i from public.life_invoices where application_id=a for update;
 if i.id is not null then
 select * into t from life_private.fin_totals(i.id);if t.paid>0 then raise exception 'REFUND_REQUEST_REQUIRED';end if;
 insert into public.life_credit_notes(invoice_id,amount,reason,source_key) values(i.id,i.amount,'신청 취소 미납 조정','cancel:'||i.id);
 update public.life_invoices set status='CANCELLED' where id=i.id;perform life_private.fin_event(i.id,'APPLICATION_CANCELLED');end if;
 update public.life_applications set status='CANCELLED' where id=a;return;
 end if;
 if not life_private.manages(o.id) then raise exception 'FORBIDDEN';end if;
 if decision='ACCEPTED' and v.status in ('PENDING_PAYMENT','ACCEPTED') then return;end if;
 if decision='REJECTED' and v.status='REJECTED' then return;end if;
 if v.status not in ('SUBMITTED','WAITLISTED') or decision not in ('ACCEPTED','REJECTED') then raise exception 'INVALID_TRANSITION';end if;
 if decision='ACCEPTED' then
 if o.status='DRAFT' then raise exception 'INVALID_TRANSITION';end if;
 select (select count(*) from public.life_enrollments where offering_id=o.id and status='ACTIVE')+(select count(*) from public.life_applications where offering_id=o.id and status='PENDING_PAYMENT') into n;
 if n>=o.capacity then raise exception 'CAPACITY_FULL';end if;
 update public.life_applications set status='PENDING_PAYMENT' where id=a;perform life_private.issue_invoice(a);
 else update public.life_applications set status='REJECTED' where id=a;end if;
end $$;
create or replace function public.life_decide(a uuid,decision text) returns void language sql security invoker set search_path='' as $$select life_private.decide(a,decision)$$;
create function life_private.publish(f uuid,enrollment_policy uuid,completion_policy uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.life_offerings;
begin
 select * into o from public.life_offerings where id=f for update;
 if o.tuition=0 then perform life_private.publish_free(f,enrollment_policy,completion_policy);return;end if;
 if not life_private.manages(f) then raise exception 'FORBIDDEN';end if;
 if o.status<>'DRAFT' then raise exception 'INVALID_TRANSITION';end if;
 if not life_private.policy_valid(enrollment_policy,o.org_id,'ENROLLMENT') or not life_private.policy_valid(completion_policy,o.org_id,'COMPLETION') then raise exception 'APPROVED_POLICY_REQUIRED';end if;
 if not exists(select 1 from public.life_offering_finance c where c.offering_id=f and life_private.policy_valid(c.policy_id,o.org_id,'REFUND') and exists(select 1 from public.life_refund_rules r where r.policy_id=c.policy_id)) then raise exception 'APPROVED_REFUND_POLICY_REQUIRED';end if;
 update public.life_course_versions set status='APPROVED',completion_policy_id=completion_policy,approved_by=life_private.person_id() where id=o.course_version_id;
 update public.life_offerings set status='PUBLISHED',enrollment_policy_id=enrollment_policy where id=f;
end $$;
create or replace function public.life_publish(f uuid,enrollment_policy uuid,completion_policy uuid) returns void language sql security invoker set search_path='' as $$select life_private.publish(f,enrollment_policy,completion_policy)$$;
create function life_private.payment_report(i uuid,amount bigint,depositor text,deposited_at timestamptz,request_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v public.life_invoices;r public.life_payment_reports;
begin
 select * into v from public.life_invoices where id=i;
 if v.id is null or v.person_id is distinct from life_private.person_id() then raise exception 'FORBIDDEN';end if;
 select * into r from public.life_payment_reports p where p.request_key=payment_report.request_key;
 if r.id is not null then if r.invoice_id<>i or r.amount<>amount or r.depositor<>trim(depositor) or r.deposited_at<>deposited_at then raise exception 'IDEMPOTENCY_CONFLICT';end if;return r.id;end if;
 if deposited_at is null or deposited_at>clock_timestamp() then raise exception 'INVALID_INPUT';end if;
 insert into public.life_payment_reports(invoice_id,amount,depositor,deposited_at,request_key) values(i,amount,trim(depositor),deposited_at,request_key) returning * into r;
 perform life_private.fin_event(i,'PAYMENT_REPORTED',jsonb_build_object('amount',amount));return r.id;
end $$;
create function life_private.record_payment(i uuid,amount bigint,depositor text,deposited_at timestamptz,external_ref text,evidence text) returns uuid language plpgsql security definer set search_path='' as $$
declare v public.life_invoices;p public.life_payments;
begin
 select * into v from public.life_invoices where id=i;
 if v.id is null or not life_private.fin_allowed(v.org_id,'RECORD') or v.person_id=life_private.person_id() then raise exception 'FORBIDDEN';end if;
 if deposited_at is null or deposited_at>clock_timestamp() then raise exception 'INVALID_INPUT';end if;
 -- Unique bank reference serializes concurrent duplicate records; different facts cannot overwrite it.
 insert into public.life_payments(org_id,person_id,amount,depositor,deposited_at,external_ref,evidence,verified_by)
 values(v.org_id,v.person_id,amount,trim(depositor),deposited_at,trim(external_ref),trim(evidence),life_private.person_id()) on conflict on constraint life_payments_org_id_external_ref_key do nothing;
 select * into p from public.life_payments x where x.org_id=v.org_id and x.external_ref=trim(record_payment.external_ref);
 if p.person_id<>v.person_id or p.amount<>amount or p.deposited_at<>deposited_at or p.depositor<>trim(depositor) or p.evidence<>trim(evidence) then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 perform life_private.fin_event(i,'PAYMENT_VERIFIED',jsonb_build_object('payment_id',p.id,'amount',amount,'reference',external_ref));return p.id;
end $$;
create function life_private.allocate_payment(i uuid,p uuid,amount bigint,request_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v public.life_invoices;o public.life_offerings;pay public.life_payments;t record;allocated bigint;a public.life_payment_allocations;
begin
 select * into v from public.life_invoices where id=i;
 if v.id is null or not life_private.fin_allowed(v.org_id,'RECORD') or v.person_id=life_private.person_id() then raise exception 'FORBIDDEN';end if;
 select * into o from public.life_offerings where id=v.offering_id for update;perform life_private.expire_finance(o.id);
 select * into v from public.life_invoices where id=i for update;
 select * into pay from public.life_payments where id=p for update;
 if pay.id is null or pay.org_id<>v.org_id or pay.person_id<>v.person_id then raise exception 'PAYMENT_SCOPE_MISMATCH';end if;
 select * into a from public.life_payment_allocations x where x.request_key=allocate_payment.request_key;
 if a.id is not null then if a.invoice_id<>i or a.payment_id<>p or a.amount<>amount then raise exception 'IDEMPOTENCY_CONFLICT';end if;return a.id;end if;
 if exists(select 1 from public.life_refunds where invoice_id=i and status in ('REQUESTED','REVIEWED','APPROVED','PROCESSING','RECONCILING')) then raise exception 'REFUND_IN_PROGRESS';end if;
 select * into t from life_private.fin_totals(i);select coalesce(sum(x.amount),0) into allocated from public.life_payment_allocations x where x.payment_id=p;
 if amount is null or amount<=0 or amount>pay.amount-allocated or amount>v.amount-t.paid then raise exception 'ALLOCATION_EXCEEDS_BALANCE';end if;
 insert into public.life_payment_allocations(invoice_id,payment_id,org_id,person_id,amount,request_key,allocated_by) values(i,p,v.org_id,v.person_id,amount,request_key,life_private.person_id()) returning * into a;
 if v.status in ('CANCELLED','EXPIRED') then
 insert into public.life_credit_notes(invoice_id,amount,reason,source_key) values(i,-amount,'취소 후 입금 배분에 따른 미납 조정 환원','late:'||a.id);
 elsif t.paid+amount=v.amount then
 if v.due_at<=clock_timestamp() then raise exception 'PAYMENT_DEADLINE_CHANGED';end if;
 if not exists(select 1 from public.life_applications where id=v.application_id and status='PENDING_PAYMENT') then raise exception 'INVALID_TRANSITION';end if;
 insert into public.life_enrollments(application_id,offering_id,person_id) values(v.application_id,v.offering_id,v.person_id);
 update public.life_applications set status='ACCEPTED' where id=v.application_id;
 update public.life_invoices set status='SETTLED' where id=i;
 end if;
 perform life_private.fin_event(i,'PAYMENT_ALLOCATED',jsonb_build_object('payment_id',p,'amount',amount,'late',v.status in ('CANCELLED','EXPIRED')));return a.id;
end $$;
create function life_private.expire_invoices(f uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.life_offerings;
begin
 select * into o from public.life_offerings where id=f for update;
 if not life_private.fin_staff(o.org_id) and not life_private.manages(f) then raise exception 'FORBIDDEN';end if;
 perform life_private.expire_finance(f);
end $$;
create function life_private.request_refund(i uuid,reason text,request_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v public.life_invoices;o public.life_offerings;t record;r public.life_refunds;
begin
 select * into v from public.life_invoices where id=i;
 if v.id is null or v.person_id is distinct from life_private.person_id() then raise exception 'FORBIDDEN';end if;
 select * into o from public.life_offerings where id=v.offering_id for update;perform life_private.expire_finance(o.id);
 select * into v from public.life_invoices where id=i for update;
 select * into r from public.life_refunds x where x.request_key=request_refund.request_key;
 if r.id is not null then if r.invoice_id<>i or r.reason<>trim(reason) then raise exception 'IDEMPOTENCY_CONFLICT';end if;return r.id;end if;
 select * into r from public.life_refunds where invoice_id=i and status in ('REQUESTED','REVIEWED','APPROVED','PROCESSING','RECONCILING');
 if r.id is not null then return r.id;end if;
 select * into t from life_private.fin_totals(i);
 if t.paid-t.refunded<=0 then raise exception 'NO_REFUND_BALANCE';end if;
 -- Honor the approved policy frozen on this invoice even after its enrollment validity window ends.
 if not exists(select 1 from public.life_policy_versions where id=v.policy_id and status='APPROVED' and kind='REFUND') then raise exception 'APPROVED_REFUND_POLICY_REQUIRED';end if;
 insert into public.life_refunds(invoice_id,reason,request_key,snapshot) values(i,trim(reason),request_key,jsonb_build_object('requested_at',clock_timestamp(),'starts_on',o.starts_on,'ends_on',o.ends_on,'policy_id',v.policy_id,'academic_revision',o.academic_revision,'sessions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'starts_at',s.starts_at,'ends_at',s.ends_at,'status',s.status)) from public.life_class_sessions s where s.offering_id=o.id),'[]'::jsonb))) returning * into r;
 if v.status in ('OPEN','SETTLED') then
 if v.amount>t.paid then insert into public.life_credit_notes(invoice_id,amount,reason,source_key) values(i,v.amount-t.paid,'환불신청 수강취소 미납 조정','withdraw:'||i);end if;
 update public.life_invoices set status='CANCELLED' where id=i;
 end if;
 update public.life_applications set status='CANCELLED' where id=v.application_id;
 update public.life_enrollments set status='WITHDRAWN' where application_id=v.application_id;
 perform life_private.fin_event(i,'REFUND_REQUESTED',jsonb_build_object('refund_id',r.id,'reason',reason));return r.id;
end $$;
create function life_private.review_refund(r uuid,expected_revision integer,rule uuid,basis text,payee_reference text) returns bigint language plpgsql security definer set search_path='' as $$
declare q public.life_refunds;v public.life_invoices;t record;c public.life_refund_rules;n bigint;
begin
 select * into q from public.life_refunds where id=r;select * into v from public.life_invoices where id=q.invoice_id;
 if v.id is null or not life_private.fin_allowed(v.org_id,'RECORD') or v.person_id=life_private.person_id() then raise exception 'FORBIDDEN';end if;
 perform 1 from public.life_offerings where id=v.offering_id for update;perform 1 from public.life_invoices where id=v.id for update;select * into q from public.life_refunds where id=r for update;
 if q.revision<>expected_revision then raise exception 'REVISION_CHANGED';end if;
 if q.status not in ('REQUESTED','REVIEWED') then raise exception 'INVALID_TRANSITION';end if;
 if basis is null or length(trim(basis)) not between 1 and 2000 or payee_reference is null or length(trim(payee_reference)) not between 1 and 300 then raise exception 'INVALID_INPUT';end if;
 select * into c from public.life_refund_rules where id=rule and policy_id=v.policy_id;if c.id is null then raise exception 'REFUND_RULE_MISMATCH';end if;
 select * into t from life_private.fin_totals(v.id);
 n:=least(t.paid-t.refunded,greatest(0,floor((case when c.basis='TUITION' then v.amount else t.paid end)::numeric*c.numerator/c.denominator)::bigint-t.refunded));
 update public.life_refunds set status='REVIEWED',revision=revision+1,rule_id=rule,amount=n,calculation_basis=trim(basis),payee_reference=trim(review_refund.payee_reference),reviewed_by=life_private.person_id(),reviewed_at=now(),financial_snapshot=jsonb_build_object('paid',t.paid,'refunded',t.refunded) where id=r;
 perform life_private.fin_event(v.id,'REFUND_REVIEWED',jsonb_build_object('refund_id',r,'amount',n,'basis',basis,'rule',c.label));return n;
end $$;
create function life_private.decide_refund(r uuid,expected_revision integer,approve boolean,reason text) returns void language plpgsql security definer set search_path='' as $$
declare q public.life_refunds;v public.life_invoices;t record;a record;remaining bigint;available bigint;part bigint;
begin
 select * into q from public.life_refunds where id=r;select * into v from public.life_invoices where id=q.invoice_id;
 if v.id is null or not life_private.fin_allowed(v.org_id,'APPROVE') or v.person_id=life_private.person_id() then raise exception 'FORBIDDEN';end if;
 perform 1 from public.life_offerings where id=v.offering_id for update;perform 1 from public.life_invoices where id=v.id for update;select * into q from public.life_refunds where id=r for update;
 if q.status='APPROVED' and approve then return;end if;
 if q.status='REJECTED' and not approve then return;end if;
 if q.revision<>expected_revision then raise exception 'REVISION_CHANGED';end if;
 if q.status not in ('REQUESTED','REVIEWED') or approve is null or reason is null or length(trim(reason)) not between 1 and 1000 then raise exception 'INVALID_TRANSITION';end if;
 if q.reviewed_by=life_private.person_id() then raise exception 'SELF_APPROVAL_FORBIDDEN';end if;
 if not approve then update public.life_refunds set status='REJECTED',revision=revision+1,approved_by=life_private.person_id(),approved_at=now(),decision_reason=trim(decide_refund.reason) where id=r;
 perform life_private.fin_event(v.id,'REFUND_REJECTED',jsonb_build_object('refund_id',r,'reason',reason));return;end if;
 if q.status<>'REVIEWED' or q.amount is null or q.amount<=0 then raise exception 'REFUND_REVIEW_REQUIRED';end if;
 select * into t from life_private.fin_totals(v.id);
 if q.financial_snapshot<>jsonb_build_object('paid',t.paid,'refunded',t.refunded) or q.amount>t.paid-t.refunded-t.reserved then raise exception 'REFUND_BALANCE_CHANGED';end if;
 remaining:=q.amount;
 for a in select * from public.life_payment_allocations where invoice_id=v.id order by created_at,id loop
 select a.amount-coalesce(sum(ra.amount),0) into available from public.life_refund_allocations ra join public.life_refunds rr on rr.id=ra.refund_id where ra.allocation_id=a.id and rr.status in ('APPROVED','PROCESSING','RECONCILING','PAID');
 part:=least(remaining,available);
 if part>0 then insert into public.life_refund_allocations values(r,a.id,part);remaining:=remaining-part;end if;
 exit when remaining=0;
 end loop;
 if remaining<>0 then raise exception 'REFUND_BALANCE_CHANGED';end if;
 update public.life_refunds set status='APPROVED',revision=revision+1,approved_by=life_private.person_id(),approved_at=now(),decision_reason=trim(decide_refund.reason) where id=r;
 perform life_private.fin_event(v.id,'REFUND_APPROVED',jsonb_build_object('refund_id',r,'amount',q.amount,'reason',reason));
end $$;
create function life_private.start_refund_transfer(r uuid,expected_revision integer) returns uuid language plpgsql security definer set search_path='' as $$
declare q public.life_refunds;v public.life_invoices;t uuid;
begin
 select * into q from public.life_refunds where id=r;select * into v from public.life_invoices where id=q.invoice_id;
 if v.id is null or not life_private.fin_allowed(v.org_id,'PAYOUT') or v.person_id=life_private.person_id() or q.approved_by=life_private.person_id() then raise exception 'FORBIDDEN';end if;
 perform 1 from public.life_offerings where id=v.offering_id for update;perform 1 from public.life_invoices where id=v.id for update;select * into q from public.life_refunds where id=r for update;
 if q.approved_by=life_private.person_id() then raise exception 'FORBIDDEN';end if;
 if q.status='PROCESSING' then select id into t from public.life_refund_transfers where refund_id=r and status='PROCESSING';return t;end if;
 if q.status<>'APPROVED' then raise exception 'RECONCILIATION_REQUIRED';end if;
 if q.revision<>expected_revision then raise exception 'REVISION_CHANGED';end if;
 insert into public.life_refund_transfers(refund_id,org_id,amount,started_by) values(r,v.org_id,q.amount,life_private.person_id()) returning id into t;
 update public.life_refunds set status='PROCESSING',revision=revision+1 where id=r;
 perform life_private.fin_event(v.id,'REFUND_PROCESSING',jsonb_build_object('refund_id',r,'transfer_id',t));return t;
end $$;
create function life_private.resolve_refund_transfer(t uuid,result text,external_ref text,evidence text,confirmed_amount bigint) returns void language plpgsql security definer set search_path='' as $$
declare x public.life_refund_transfers;q public.life_refunds;v public.life_invoices;
begin
 select * into x from public.life_refund_transfers where id=t;select * into q from public.life_refunds where id=x.refund_id;select * into v from public.life_invoices where id=q.invoice_id;
 if v.id is null or not life_private.fin_allowed(v.org_id,'PAYOUT') or v.person_id=life_private.person_id() or q.approved_by=life_private.person_id() then raise exception 'FORBIDDEN';end if;
 perform 1 from public.life_offerings where id=v.offering_id for update;perform 1 from public.life_invoices where id=v.id for update;select * into q from public.life_refunds where id=x.refund_id for update;select * into x from public.life_refund_transfers where id=t for update;
 if q.approved_by=life_private.person_id() then raise exception 'FORBIDDEN';end if;
 if x.status='PAID' and result='PAID' and x.external_ref=trim(resolve_refund_transfer.external_ref) and x.amount=confirmed_amount then return;end if;
 if x.status not in ('PROCESSING','RECONCILING') or result is null or result not in ('PAID','RECONCILING','NOT_PAID') then raise exception 'INVALID_TRANSITION';end if;
 if evidence is null or length(trim(evidence)) not between 1 and 1000 then raise exception 'INVALID_INPUT';end if;
 if result='PAID' and (external_ref is null or length(trim(external_ref)) not between 1 and 200 or confirmed_amount is distinct from x.amount) then raise exception 'TRANSFER_AMOUNT_MISMATCH';end if;
 update public.life_refund_transfers set status=result,external_ref=case when result='PAID' then trim(resolve_refund_transfer.external_ref) else null end,evidence=trim(resolve_refund_transfer.evidence),resolved_at=now(),resolved_by=life_private.person_id() where id=t;
 update public.life_refunds set status=case when result='NOT_PAID' then 'APPROVED' else result end,revision=revision+1 where id=x.refund_id;
 if result='PAID' then insert into public.life_credit_notes(invoice_id,amount,reason,source_key) values(v.id,x.amount,'환불 지급 청구 조정','refund:'||q.id);end if;
 perform life_private.fin_event(v.id,'REFUND_'||result,jsonb_build_object('refund_id',q.id,'transfer_id',t,'amount',x.amount,'evidence',evidence));
end $$;
create function life_private.finance_overview(as_staff boolean) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if life_private.person_id() is null then raise exception 'AUTH_REQUIRED';end if;
 if as_staff is null then raise exception 'INVALID_INPUT';end if;
 select jsonb_build_object(
 'permissions',coalesce((select jsonb_agg(jsonb_build_object('org_id',org_id,'permission',permission)) from public.life_finance_grants where person_id=life_private.person_id() and valid_from<=now() and valid_until>now() and life_private.has_role(org_id,'FINANCE')),'[]'::jsonb),
 'invoices',coalesce((select jsonb_agg(to_jsonb(z) order by z.created_at desc) from (
 select i.*,o.name as offering_name,p.name as person_name,pv.title as policy_title,pv.version as policy_version,pv.body as policy_body,c.instructions,
 t.paid,t.refunded,t.reserved,t.credited,i.amount-t.credited-t.paid+t.refunded as balance,
 coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.life_payment_reports r where r.invoice_id=i.id),'[]'::jsonb) as reports,
 coalesce((select jsonb_agg(to_jsonb(a)) from public.life_payment_allocations a where a.invoice_id=i.id),'[]'::jsonb) as allocations,
 coalesce((select jsonb_agg(to_jsonb(r)) from public.life_refund_rules r where r.policy_id=i.policy_id),'[]'::jsonb) as rules,
 coalesce((select jsonb_agg(to_jsonb(x) order by x.requested_at desc) from (select r.*,rr.label as rule_label,rr.basis as rule_basis,rr.numerator,rr.denominator,
 coalesce((select jsonb_agg(to_jsonb(tr) order by tr.started_at) from public.life_refund_transfers tr where tr.refund_id=r.id),'[]'::jsonb) as transfers
 from public.life_refunds r left join public.life_refund_rules rr on rr.id=r.rule_id where r.invoice_id=i.id)x),'[]'::jsonb) as refunds,
 coalesce((select jsonb_agg(jsonb_build_object('action',e.action,'details',e.details,'created_at',e.created_at) order by e.id) from public.life_finance_events e where e.invoice_id=i.id),'[]'::jsonb) as events
 from public.life_invoices i join public.life_offerings o on o.id=i.offering_id join public.life_people p on p.id=i.person_id
 join public.life_policy_versions pv on pv.id=i.policy_id join public.life_offering_finance c on c.offering_id=i.offering_id cross join lateral life_private.fin_totals(i.id)t
 where (as_staff and life_private.fin_staff(i.org_id)) or (not as_staff and i.person_id=life_private.person_id())
 order by i.created_at desc limit 100)z),'[]'::jsonb),
 'payments',coalesce((select jsonb_agg(to_jsonb(z) order by z.created_at desc) from (
 select p.*,pp.name as person_name,p.amount-coalesce((select sum(a.amount) from public.life_payment_allocations a where a.payment_id=p.id),0) as unallocated
 from public.life_payments p join public.life_people pp on pp.id=p.person_id where (as_staff and life_private.fin_staff(p.org_id)) or (not as_staff and p.person_id=life_private.person_id()) order by p.created_at desc limit 100)z),'[]'::jsonb)
 ) into result;return result;
end $$;

-- The read-only API wrappers preserve the non-exposed schema boundary.
create function public.life_configure_finance(f uuid,tuition bigint,policy uuid,hours integer,instructions text) returns void language sql security invoker set search_path='' as $$select life_private.configure_finance(f,tuition,policy,hours,instructions)$$;
create function public.life_offering_finance(f uuid) returns jsonb language sql stable security invoker set search_path='' as $$select life_private.offering_finance(f)$$;
create function public.life_payment_report(i uuid,amount bigint,depositor text,deposited_at timestamptz,request_key uuid) returns uuid language sql security invoker set search_path='' as $$select life_private.payment_report(i,amount,depositor,deposited_at,request_key)$$;
create function public.life_record_payment(i uuid,amount bigint,depositor text,deposited_at timestamptz,external_ref text,evidence text) returns uuid language sql security invoker set search_path='' as $$select life_private.record_payment(i,amount,depositor,deposited_at,external_ref,evidence)$$;
create function public.life_allocate_payment(i uuid,p uuid,amount bigint,request_key uuid) returns uuid language sql security invoker set search_path='' as $$select life_private.allocate_payment(i,p,amount,request_key)$$;
create function public.life_expire_invoices(f uuid) returns void language sql security invoker set search_path='' as $$select life_private.expire_invoices(f)$$;
create function public.life_request_refund(i uuid,reason text,request_key uuid) returns uuid language sql security invoker set search_path='' as $$select life_private.request_refund(i,reason,request_key)$$;
create function public.life_review_refund(r uuid,expected_revision integer,rule uuid,basis text,payee_reference text) returns bigint language sql security invoker set search_path='' as $$select life_private.review_refund(r,expected_revision,rule,basis,payee_reference)$$;
create function public.life_decide_refund(r uuid,expected_revision integer,approve boolean,reason text) returns void language sql security invoker set search_path='' as $$select life_private.decide_refund(r,expected_revision,approve,reason)$$;
create function public.life_start_refund_transfer(r uuid,expected_revision integer) returns uuid language sql security invoker set search_path='' as $$select life_private.start_refund_transfer(r,expected_revision)$$;
create function public.life_resolve_refund_transfer(t uuid,result text,external_ref text,evidence text,confirmed_amount bigint) returns void language sql security invoker set search_path='' as $$select life_private.resolve_refund_transfer(t,result,external_ref,evidence,confirmed_amount)$$;
create function public.life_finance_overview(as_staff boolean) returns jsonb language sql stable security invoker set search_path='' as $$select life_private.finance_overview(as_staff)$$;

-- All ledger tables are accessed only through scoped RPCs, never via browser writes or broad SELECT.
do $$declare t text;fn text;f record;begin
 foreach t in array array['life_finance_grants','life_refund_rules','life_offering_finance','life_invoices','life_payment_reports','life_payments','life_payment_allocations','life_credit_notes','life_refunds','life_refund_allocations','life_refund_transfers','life_finance_events'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);end loop;
 foreach fn in array array['fin_allowed','fin_staff','fin_totals','fin_event','fin_frozen','expire_finance','issue_invoice','apply_free','decide_free','publish_free','apply','decide','publish','configure_finance','offering_finance','payment_report','record_payment','allocate_payment','expire_invoices','request_refund','review_refund','decide_refund','start_refund_transfer','resolve_refund_transfer','finance_overview'] loop
 for f in select p.oid::regprocedure as sig,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='life_private' and p.proname=fn) or (n.nspname='public' and p.proname='life_'||fn) loop
 execute format('revoke all on function %s from public,anon,authenticated',f.sig);
 if fn in ('apply','decide','publish','configure_finance','offering_finance','payment_report','record_payment','allocate_payment','expire_invoices','request_refund','review_refund','decide_refund','start_refund_transfer','resolve_refund_transfer','finance_overview') then execute format('grant execute on function %s to authenticated',f.sig);end if;
 if fn='offering_finance' then execute format('grant execute on function %s to anon',f.sig);end if;
 end loop;end loop;
end $$;
notify pgrst,'reload schema';
commit;
