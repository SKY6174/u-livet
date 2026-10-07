-- Keep policy text under the existing immutable, versioned evidence model.
create function life_private.create_recruitment_policy_draft(
  org_id uuid, policy_kind text, policy_version text, policy_title text, policy_body text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare policy_id uuid;
begin
  if not life_private.has_role(org_id, 'COURSE_MANAGER') then raise exception 'FORBIDDEN'; end if;
  if policy_kind not in ('ENROLLMENT', 'COMPLETION')
    or length(trim(policy_version)) not between 1 and 50
    or length(trim(policy_title)) not between 3 and 120
    or length(trim(policy_body)) not between 20 and 20000
  then raise exception 'INVALID_POLICY'; end if;
  insert into public.life_policy_versions(org_id, kind, version, title, body, status)
  values(org_id, policy_kind, trim(policy_version), trim(policy_title), trim(policy_body), 'DRAFT')
  returning id into policy_id;
  insert into public.life_audit_events(org_id, actor_id, action, entity_id)
  values(org_id, life_private.person_id(), 'POLICY_DRAFT_CREATED', policy_id);
  return policy_id;
end $$;

create function public.life_create_recruitment_policy_draft(
  org_id uuid, policy_kind text, policy_version text, policy_title text, policy_body text
) returns uuid language sql security invoker set search_path = '' as $$
  select life_private.create_recruitment_policy_draft(org_id, policy_kind, policy_version, policy_title, policy_body)
$$;

create function life_private.update_recruitment_policy_draft(
  policy_id uuid, expected_title text, expected_body text, policy_title text, policy_body text
) returns void language plpgsql security definer set search_path = '' as $$
declare current_policy public.life_policy_versions;
begin
  select * into current_policy from public.life_policy_versions where id=policy_id for update;
  if current_policy.id is null or not life_private.has_role(current_policy.org_id, 'COURSE_MANAGER')
    then raise exception 'FORBIDDEN'; end if;
  if current_policy.kind not in ('ENROLLMENT', 'COMPLETION') or current_policy.status <> 'DRAFT'
    then raise exception 'POLICY_NOT_DRAFT'; end if;
  if current_policy.title is distinct from expected_title or current_policy.body is distinct from expected_body
    then raise exception 'REVISION_CHANGED'; end if;
  if length(trim(policy_title)) not between 3 and 120 or length(trim(policy_body)) not between 20 and 20000
    then raise exception 'INVALID_POLICY'; end if;
  update public.life_policy_versions set title=trim(policy_title), body=trim(policy_body) where id=policy_id;
  insert into public.life_audit_events(org_id, actor_id, action, entity_id)
  values(current_policy.org_id, life_private.person_id(), 'POLICY_DRAFT_UPDATED', policy_id);
end $$;

create function public.life_update_recruitment_policy_draft(
  policy_id uuid, expected_title text, expected_body text, policy_title text, policy_body text
) returns void language sql security invoker set search_path = '' as $$
  select life_private.update_recruitment_policy_draft(policy_id, expected_title, expected_body, policy_title, policy_body)
$$;

create function life_private.approve_recruitment_policy_draft(
  policy_id uuid, expected_title text, expected_body text
) returns void language plpgsql security definer set search_path = '' as $$
declare current_policy public.life_policy_versions;
begin
  select * into current_policy from public.life_policy_versions where id=policy_id for update;
  if current_policy.id is null or not life_private.has_role(current_policy.org_id, 'COURSE_MANAGER')
    then raise exception 'FORBIDDEN'; end if;
  if current_policy.kind not in ('ENROLLMENT', 'COMPLETION') or current_policy.status <> 'DRAFT'
    then raise exception 'POLICY_NOT_DRAFT'; end if;
  if current_policy.title is distinct from expected_title or current_policy.body is distinct from expected_body
    then raise exception 'REVISION_CHANGED'; end if;
  update public.life_policy_versions
  set status='APPROVED', approved_by=life_private.person_id(), approved_at=now(), effective_from=now()
  where id=policy_id;
  insert into public.life_audit_events(org_id, actor_id, action, entity_id)
  values(current_policy.org_id, life_private.person_id(), 'POLICY_APPROVED', policy_id);
end $$;

create function public.life_approve_recruitment_policy_draft(
  policy_id uuid, expected_title text, expected_body text
) returns void language sql security invoker set search_path = '' as $$
  select life_private.approve_recruitment_policy_draft(policy_id, expected_title, expected_body)
$$;

revoke all on function public.life_create_recruitment_policy_draft(uuid,text,text,text,text),
  public.life_update_recruitment_policy_draft(uuid,text,text,text,text),
  public.life_approve_recruitment_policy_draft(uuid,text,text) from public, anon;
grant execute on function life_private.create_recruitment_policy_draft(uuid,text,text,text,text),
  life_private.update_recruitment_policy_draft(uuid,text,text,text,text),
  life_private.approve_recruitment_policy_draft(uuid,text,text),
  public.life_create_recruitment_policy_draft(uuid,text,text,text,text),
  public.life_update_recruitment_policy_draft(uuid,text,text,text,text),
  public.life_approve_recruitment_policy_draft(uuid,text,text) to authenticated;
