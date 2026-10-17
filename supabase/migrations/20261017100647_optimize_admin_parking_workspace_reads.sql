begin;

-- Narrow workspace lists need offering fields and the year label, not the
-- course/version detail joins (and their repeated RLS evaluation).
-- Both source relations continue to apply the caller's existing SELECT RLS.
create view public.life_workspace_catalog with(security_invoker=true) as
 select o.id,o.org_id,o.name,o.status,o.capacity,y.label as year_label,
  o.starts_on,o.ends_on,o.created_at
 from public.life_offerings o
 join public.life_project_years y on y.id=o.project_year_id;
revoke all on public.life_workspace_catalog from public,anon,authenticated,service_role;
grant select on public.life_workspace_catalog to anon,authenticated;

create or replace function life_private.parking_admin_context(y integer,c text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $function$
declare
 v_user uuid;
 v_person uuid;
 v_orgs uuid[];
 v_review_centers text[];
begin
 if y not between 2020 and 2100 or (c is not null and c not in ('RCC','ECC','AID-X')) then raise exception 'INVALID_INPUT';end if;
 v_user:=auth.uid();
 v_person:=life_private.person_id();
 if v_user is null or v_person is null or not life_private.mfa_verified() then raise exception 'FORBIDDEN';end if;
 select coalesce(array_agg(distinct ra.org_id),'{}'::uuid[]) into v_orgs
 from public.life_role_assignments ra
 where ra.person_id=v_person and ra.role in ('COURSE_MANAGER','SYSTEM_ADMIN')
  and ra.valid_from<=now() and (ra.valid_until is null or ra.valid_until>now());
 if cardinality(v_orgs)=0 then raise exception 'FORBIDDEN';end if;
 -- Every returned request is already in v_orgs. The remaining reviewer test
 -- depends only on the verified caller's email and the configured center.
 select coalesce(array_agg(pc.code),'{}'::text[]) into v_review_centers
 from public.life_parking_centers pc join auth.users u on lower(u.email)=pc.reviewer_email
 where u.id=v_user and u.email_confirmed_at is not null and u.deleted_at is null;
 return jsonb_build_object(
 'centers',(select coalesce(jsonb_agg(jsonb_build_object('code',pc.code,'label',pc.label,'reviewer_name',pc.reviewer_name,'reviewer_email',pc.reviewer_email) order by pc.code),'[]'::jsonb) from public.life_parking_centers pc),
 'organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) order by o.name),'[]'::jsonb) from public.life_organizations o where o.id=any(v_orgs)),
 'offerings',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'org_id',o.org_id,'name',o.name,'starts_on',o.starts_on,'ends_on',o.ends_on,'center_code',m.center_code) order by o.starts_on desc,o.name),'[]'::jsonb) from public.life_offerings o left join public.life_parking_offering_centers m on m.offering_id=o.id where o.starts_on>=make_date(y,1,1) and o.starts_on<make_date(y+1,1,1) and o.org_id=any(v_orgs)),
 'stock',(select coalesce(jsonb_agg(jsonb_build_object('org_id',s.org_id,'center_code',s.center_code,'balance',s.balance) order by s.center_code),'[]'::jsonb) from public.life_parking_stock s where s.org_id=any(v_orgs)),
 'requests',(select coalesce(jsonb_agg(row_to_json(r) order by r.requested_at desc),'[]'::jsonb) from (
  select q.id,q.org_id,q.offering_id,q.center_code,q.course_name,q.recipient_name,q.phone,q.use_on,q.quantity,q.status,q.requested_at,q.reviewed_at,q.decision_note,q.remaining_after,
   p.name requester_name,rv.name reviewer_name,q.center_code=any(v_review_centers) can_decide
  from public.life_parking_requests q join public.life_people p on p.id=q.person_id left join public.life_people rv on rv.id=q.reviewer_id
  where q.use_on>=make_date(y,1,1) and q.use_on<make_date(y+1,1,1) and (c is null or q.center_code=c) and q.org_id=any(v_orgs)
  order by q.requested_at desc) r)
 );
end $function$;

notify pgrst,'reload schema';
commit;
