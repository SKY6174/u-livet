-- Synthetic local fixtures only. Never included in migrations or automatic seeds.
-- Executed solely inside the dedicated supabase_db_uc-life-core container.
insert into public.life_people(id,name) values('20000000-0000-4000-8000-000000000001','로컬 테스트 정책 승인자') on conflict do nothing;
insert into public.life_policy_versions(id,org_id,kind,version,title,body,status,approved_by,approved_at)
values
('20000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000001','ACCOUNT_PRIVACY','local-test-v1','[테스트] 회원가입 개인정보 안내','로컬 검증용 정책입니다. 실제 운영 방침이 아닙니다. 가상 이름·이메일만 입력하세요. 목적: 로컬 기능 검증. 보유기간: 테스트 환경 삭제 시까지. 동의를 거부하면 테스트 가입이 제한됩니다.','APPROVED','20000000-0000-4000-8000-000000000001',now()),
('20000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000001','ENROLLMENT','local-test-v1','[테스트] 무료 과정 신청 안내','로컬 검증용 모집입니다. 실제 모집이 아닙니다. 목적: 신청·학습 흐름 검증. 수집항목: 가상 이름·계정·신청과 학습기록. 보유기간: 테스트 환경 삭제 시까지. 필수 동의 거부 시 신청할 수 없습니다. 수강료: 무료.','APPROVED','20000000-0000-4000-8000-000000000001',now()),
('20000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000001','COMPLETION','local-test-v1','[테스트] 수료 판정 제외','로컬 검증 과정은 실제 수료·이수증·디지털배지를 발급하지 않습니다. 자료 열람은 출석이나 수료로 인정되지 않습니다.','APPROVED','20000000-0000-4000-8000-000000000001',now()) on conflict do nothing;
insert into public.life_courses(id,org_id,title,academy) values('20000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000001','[테스트] 디지털 업무 활용','디지털 역량') on conflict do nothing;
insert into public.life_course_versions(id,org_id,course_id,summary,curriculum,status,completion_policy_id,approved_by)
values('20000000-0000-4000-8000-000000000022','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000021','일상 업무에 필요한 디지털 도구를 익히는 로컬 테스트 과정입니다.','1. 업무 정보 정리\n2. 협업 문서 작성\n3. 나의 업무 개선 과제','APPROVED','20000000-0000-4000-8000-000000000013','20000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.life_offerings(id,org_id,project_year_id,course_version_id,name,mode,location,capacity,selection_method,status,apply_from,apply_until,starts_on,ends_on,enrollment_policy_id)
values('20000000-0000-4000-8000-000000000023','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000022','[테스트] 디지털 업무 활용 · 1기','ONLINE','홈페이지 강의실',20,'FIRST_COME','PUBLISHED',now()-interval '1 day',now()+interval '30 days',(now() at time zone 'Asia/Seoul')::date+1,(now() at time zone 'Asia/Seoul')::date+45,'20000000-0000-4000-8000-000000000012') on conflict do nothing;
insert into public.life_lessons(id,offering_id,title,position,content,published)
values('20000000-0000-4000-8000-000000000031','20000000-0000-4000-8000-000000000023','디지털 업무의 첫걸음',1,'반복되는 업무를 한 가지 골라 보세요. 현재의 작업 순서와 개선할 점을 정리해 과제로 제출합니다. 실제 개인정보는 입력하지 마세요.',true) on conflict do nothing;
insert into public.life_assignments(id,offering_id,title,instructions,due_at,published)
values('20000000-0000-4000-8000-000000000032','20000000-0000-4000-8000-000000000023','나의 업무 개선 계획','가상의 업무 사례로 현재 절차와 개선 계획을 설명해 주세요.',now()+interval '30 days',true) on conflict do nothing;
