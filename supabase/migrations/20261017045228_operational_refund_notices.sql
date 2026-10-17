begin;

-- Existing policies, invoice policy snapshots and all financial history remain
-- unchanged. Refund rates require the institution's separate policy approval.
create function life_private.guard_operational_refund_policy() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  selected_policy uuid;
  offering_name text;
  policy public.life_policy_versions;
  writing_guide constant text := E'기관이 확정한 환불 사유·접수 절차·시점별 반환 기준을 작성합니다.\n승인할 때 계산 조항을 함께 등록합니다. 기존 승인본 변경은 새 버전으로 작성합니다.';
begin
  if tg_table_name = 'life_offering_finance' then
    select name into offering_name from public.life_offerings
    where id = new.offering_id for share;
    selected_policy := new.policy_id;
  else
    offering_name := new.name;
    select policy_id into selected_policy from public.life_offering_finance
    where offering_id = new.id;
  end if;
  if selected_policy is null or offering_name like '[검증용]%' then return new; end if;
  select * into policy from public.life_policy_versions
  where id = selected_policy and kind = 'REFUND';
  if concat_ws(E'\n', policy.title, policy.version, policy.body)
      ~* '(검증용|검증[[:space:]]*전용|\[테스트\]|issue[[:space:]]*[0-9]+|dummy-[0-9]+|fixture)'
    or btrim(replace(policy.body, E'\r\n', E'\n'), E' \t\r\n') = writing_guide then
    raise exception 'NON_OPERATIONAL_REFUND_POLICY';
  end if;
  return new;
end $$;
revoke all on function life_private.guard_operational_refund_policy()
from public, anon, authenticated, service_role;
create trigger life_operational_refund_finance
before insert or update of offering_id, policy_id on public.life_offering_finance
for each row execute function life_private.guard_operational_refund_policy();
create trigger life_operational_refund_offering
before update of name, status on public.life_offerings
for each row execute function life_private.guard_operational_refund_policy();

commit;
