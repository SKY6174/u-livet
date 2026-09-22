-- Keep the whole selected year's ledger visible rather than silently truncating it.
begin;
create index life_parking_requests_year on public.life_parking_requests(org_id,use_on,center_code);
create or replace function life_private.parking_admin_context(y integer,c text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if y not between 2020 and 2100 or (c is not null and c not in ('RCC','ECC','AID-X')) then raise exception 'INVALID_INPUT';end if;
 if not exists(select 1 from public.life_role_assignments ra where ra.person_id=life_private.person_id() and ra.role in ('COURSE_MANAGER','SYSTEM_ADMIN') and ra.valid_from<=now() and (ra.valid_until is null or ra.valid_until>now()) and life_private.parking_staff(ra.org_id)) then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object(
 'centers',(select coalesce(jsonb_agg(jsonb_build_object('code',pc.code,'label',pc.label,'reviewer_name',pc.reviewer_name,'reviewer_email',pc.reviewer_email) order by pc.code),'[]'::jsonb) from public.life_parking_centers pc),
 'organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.name),'[]'::jsonb) from public.life_organizations o where life_private.parking_staff(o.id)),
 'offerings',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'org_id',o.org_id,'name',o.name,'starts_on',o.starts_on,'ends_on',o.ends_on,'center_code',m.center_code) order by o.starts_on desc,o.name),'[]'::jsonb) from public.life_offerings o left join public.life_parking_offering_centers m on m.offering_id=o.id where o.starts_on>=make_date(y,1,1) and o.starts_on<make_date(y+1,1,1) and life_private.parking_staff(o.org_id)),
 'stock',(select coalesce(jsonb_agg(jsonb_build_object('org_id',s.org_id,'center_code',s.center_code,'balance',s.balance) order by s.center_code),'[]'::jsonb) from public.life_parking_stock s where life_private.parking_staff(s.org_id)),
 'requests',(select coalesce(jsonb_agg(row_to_json(r) order by r.requested_at desc),'[]'::jsonb) from (
  select q.id,q.org_id,q.offering_id,q.center_code,q.course_name,q.recipient_name,q.phone,q.use_on,q.quantity,q.status,q.requested_at,q.reviewed_at,q.decision_note,q.remaining_after,
   p.name requester_name,rv.name reviewer_name,life_private.parking_reviewer(q.org_id,q.center_code) can_decide
  from public.life_parking_requests q join public.life_people p on p.id=q.person_id left join public.life_people rv on rv.id=q.reviewer_id
  where q.use_on>=make_date(y,1,1) and q.use_on<make_date(y+1,1,1) and (c is null or q.center_code=c) and life_private.parking_staff(q.org_id)
  order by q.requested_at desc) r)
 );
end$$;
notify pgrst,'reload schema';
commit;
