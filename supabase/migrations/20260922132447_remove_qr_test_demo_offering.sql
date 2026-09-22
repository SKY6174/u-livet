-- Remove only the closed, temporary QR demo course shown in the result-report list.
-- Its historical audit events are retained; this migration does not touch other courses.
do $$
declare
  target_id constant uuid := '7172f6e6-4878-4152-9fe2-9c1b7cda55db';
  target public.life_offerings%rowtype;
begin
  select * into target from public.life_offerings where id = target_id for update;
  if not found then return; end if; -- Preview has no copy of this production demo.
  if target.name is distinct from '[QR 테스트] 실시간 출결 데모 · 송경영'
     or target.starts_on is distinct from date '2026-09-22'
     or target.ends_on is distinct from date '2026-09-23'
     or target.status is distinct from 'CLOSED' then
    raise exception 'QR demo offering identity changed; refusing deletion';
  end if;

  delete from life_private.qr_attendance_checkins
    where session_id in (select id from public.life_class_sessions where offering_id = target_id);
  delete from life_private.qr_attendance_tokens
    where session_id in (select id from public.life_class_sessions where offering_id = target_id);
  delete from public.life_enrollments where offering_id = target_id;
  delete from public.life_applications where offering_id = target_id;
  delete from public.life_class_sessions where offering_id = target_id;
  delete from public.life_offering_instructors where offering_id = target_id;
  delete from public.life_offerings where id = target_id;
  if not found then raise exception 'QR demo offering disappeared during deletion'; end if;
end $$;
