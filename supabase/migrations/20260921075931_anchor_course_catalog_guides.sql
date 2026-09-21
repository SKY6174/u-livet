begin;

-- Public guide content is independent of admissions and protected work records.
create table public.life_course_guides (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  year integer not null check (year between 2000 and 2200),
  sort_order integer not null check (sort_order > 0),
  name text not null, academy text not null, summary text not null,
  curriculum text[] not null default '{}',
  mode text not null check (mode in ('ONLINE','OFFLINE','BLENDED')),
  capacity integer not null check (capacity > 0),
  teaching_hours integer not null check (teaching_hours > 0),
  period_label text not null, schedule_history text[] not null default '{}',
  time_label text not null, location text not null, certificate text,
  offering_id uuid unique references public.life_offerings(id) on delete set null,
  published boolean not null default false,
  unique(year,sort_order)
);
alter table public.life_course_guides enable row level security;
revoke all on public.life_course_guides from public, anon, authenticated;
grant select on public.life_course_guides to anon, authenticated;
grant all on public.life_course_guides to service_role;
create policy course_guides_public_read on public.life_course_guides
  for select to anon, authenticated using (published);

insert into public.life_course_guides(id,year,sort_order,name,academy,summary,curriculum,mode,capacity,teaching_hours,period_label,schedule_history,time_label,location,certificate,offering_id,published) values
('2026-manual-therapy',2026,1,'도수물리치료인력양성과정','라이프케어 아카데미','물리치료분야 종사자를 주요 대상으로 척추 표면해부학, 허리척추 평가와 도수치료, 골반 관련 실습을 편성한 직무교육 과정.',array['척추 표면해부학 실습','허리척추 평가 실습','허리척추 도수치료 실습 및 심화','골반 도수치료 실습']::text[],'OFFLINE',15,30,'2026년 12월 예정',array['최초: 2026.07.01–07.16','변경: 2026.06.30–07.23','2차: 12월 예정']::text[],'월·수·금 17:00–21:00','2-417',null,null,true),
('2026-obstetric-pilates',2026,2,'산과필라테스자격증과정','라이프케어 아카데미','산전·산후 필라테스 운동지도 프로그램의 이론과 실습을 학습하고 그룹 레슨 구성·직업윤리·종합평가를 진행하는 과정.',array['오리엔테이션·산과적 평가 및 실습','필라테스 이해','Center/Breathing 방법','Alignment/Pre-Pilates(Mat)','산전 Pilates(Mat·equipments)','산후 Pilates(Mat·equipments)','Professional Manner(Ethics), Group Lesson Program Skill 및 종합평가']::text[],'OFFLINE',15,50,'2026.10.10–12.05',array[]::text[],'토 14:00–20:00','2-418, 비앤비네오필라테스센터','산과필라테스자격증',null,true),
('2026-silver-food',2026,3,'실버푸드전문가과정','라이프케어 아카데미','시니어 식생활·영양·조리·식품안전 교육을 위해 노년기 영양과 고령친화식품을 학습하고 관련 요리 실습을 진행하는 과정.',array['오리엔테이션·노년기 영양진단','노인 맞춤형 디저트','노년기 혈당·혈압, 관련 요리 실습','면역력·근육건강·정신건강과 영양관리','고령친화식품 특징·종류·실습']::text[],'OFFLINE',10,30,'2026.09.04–10.16',array['최초: 2026.08.04–08.18','변경: 2026.09.04–10.16']::text[],'화·목 14:00–17:00','1-302, 331','시니어요리지도사',null,true),
('2026-healthy-diet',2026,4,'건강식생활지도사','라이프케어 아카데미','식생활과 영양소, 지속가능한 식생활교육을 학습하고 전통음식·건강밥상 실습과 교육 실습을 진행하는 과정.',array['한국인의 식생활·건강문제와 영양소 이해','기본 양념·맛간장·천연재료 우리음식 실습','환경과 식생활, 전통간식 및 건강밥상','식생활교육 방법 및 실습','파이토케미컬, 체중관리, 계절밥상·전통음료','자체평가 및 수료식']::text[],'OFFLINE',14,45,'2026.07.03–07.24',array[]::text[],'금·토 09:30–18:00','1-302, 330','건강식생활지도사',null,true),
('2026-park-golf',2026,5,'파크골프지도사양성과정','라이프케어 아카데미','파크골프 장비·코스·규정·에티켓과 스윙·퍼팅·라운딩을 학습하고 안전교육·스포츠인권·실기평가를 진행하는 지도자 과정.',array['파크골프 이해·장비·코스·에티켓·규정','그립·스탠스·기본스윙','응급처치 및 상해 관련 교육','스윙·티샷·어프로치·퍼팅','스포츠인권','라운딩·스코어 작성·실기평가']::text[],'OFFLINE',20,35,'2026.07.14–07.21',array[]::text[],'월–목 09:00–18:00','G-110, 지역파크골프장','파크골프지도사',(select id from public.life_offerings where id='6f436e94-61df-4822-bea3-eccbf25b4c5b' and org_id='10000000-0000-4000-8000-000000000001'),true),
('2026-sports-taping',2026,6,'스포츠테이핑관리사(자격증)양성과정','라이프케어 아카데미','스포츠테이핑 이론과 상지·하지·통증부위별 기초 및 심화 실습, 평가·활용방안을 편성한 과정.',array['스포츠테이핑 이해·기초이론','상지·하지 테이핑 기초 실습','통증부위별 기초 및 심화 실습','상지·하지 테이핑 심화','실습 평가와 활용방안']::text[],'OFFLINE',20,42,'2026.07.04–07.19',array[]::text[],'토·일 09:00–18:00','G-113','스포츠테이핑관리사',null,true),
('2026-local-cookie',2026,7,'로컬쿠키창업마스터클래스','로컬창업 아카데미','울산 동구의 로컬 콘텐츠를 쿠키 제품으로 연결하는 리빙랩과 스마트 제조 실습, 스토리텔링·패키징·품평회를 결합한 창업 과정.',array['지역의 발견 리빙랩','쿠키·필링 기초 실습','문제점 완화 리빙랩','자동 포앙기를 활용한 스마트 제조·제품 완성','제품 스토리텔링','최종 발표·패키징·품평회']::text[],'OFFLINE',15,30,'2026.07.20–07.31',array['최초: 2026.06.30–07.13','변경: 2026.07.20–07.31']::text[],'화–금 10:00–17:00','1-206, FAB Lab',null,(select id from public.life_offerings where id='1e1e0bb6-f2b2-4b2a-b99f-127e462db915' and org_id='10000000-0000-4000-8000-000000000001'),true),
('2026-pet-food',2026,8,'반려동물수제간식만들기','로컬창업 아카데미','반려동물 영양·식재료 관리 이론과 건조간식·수제간식 조리 실습, 펫푸드 창업 연계 내용을 구성한 과정.',array['사료 영양표준·반려동물 핫도그','식재료 소독·손질, 보틀케이크·연어머핀','건조간식 식재료·4종 실습','오리채소푸딩·함박스테이크·채소고구마타르트','반려동물 생리학·피자·치킨세트','치킨스쿱쿠키·꼬꼬링쿠키·영양관리']::text[],'OFFLINE',10,30,'2026.08.05–08.21',array[]::text[],'수·금 10:00–16:00','1-302, 331','반려동물영양전문가2급',(select id from public.life_offerings where id='361eda75-8153-4b2b-86dc-3724a5105f17' and org_id='10000000-0000-4000-8000-000000000001'),true),
('2026-pet-behavior',2026,9,'반려동물행동교정사3급양성과정','로컬창업 아카데미','반려동물 행동과 심리를 이해하고 사회화·기초훈련 및 반복 실습을 통해 행동교정 관련 역량을 기르는 과정.',array['개의 역사·견종 분류·훈련견 소개','행동·심리·사회화와 성격별 훈련','3급훈련사 시험·CD등급 과목 소개','이리와·앉아·붙어·따라·엎드려·서 훈련','사회화·켄넬·대기 및 기초 반복훈련']::text[],'OFFLINE',16,48,'2026.10.02–11.27',array['최초: 2026.06.05–09.18','변경: 2026.07.03–10.31','2차: 2026.10.02–11.27']::text[],'금 09:00–16:00','1-114','반려동물행동교정사3급',null,true),
('2026-pet-grooming',2026,10,'애견미용사3급양성과정','로컬창업 아카데미','미용 도구·기본 시저링·클리핑·위그 실습과 안전관리·고객상담을 학습하는 애견미용 입문 및 자격 대비 과정.',array['도구 관리·용어·기초 시저링','목욕·털 자르기·위그 램 클립','기본미용·몸 클리핑·응용 스타일','안전교육·장비 점검·고객상담','품종 표준·위그 실습 및 시험 대비']::text[],'OFFLINE',15,45,'2026.07.10–10.30',array['최초: 2026.06.05–09.11','변경: 2026.07.03–10.23','2차: 2026.07.10–10.30']::text[],'금 10:00–13:00','1-113','애견미용사3급',null,true),
('2026-local-planning',2026,11,'기획자양성과정(동구청협업)','로컬창업 아카데미','지역 자산을 활용한 문화기획을 배우고 팀별 아이디어 발산·사업계획·예산 작성·기획안 발표를 진행하는 액션러닝 과정.',array['운영 안내·지역 브랜딩 특강·팀빌딩','로컬콘텐츠 자원 분석·아이디어 워크숍·멘토링','기획자 커리어와 사업계획서·예산안 작성','기획안 발표·전문가 심사·실행 가이드']::text[],'OFFLINE',20,12,'2026.06.06–06.27',array[]::text[],'토 09:00–12:00','청년스테이지ON',null,null,true),
('2026-golf-fitting',2026,12,'골프피팅전문가양성과정','로컬창업 아카데미','골프클럽 구조와 피팅 이론, 스윙데이터 분석, 그립·샤프트 수리 및 조정을 통해 골프피팅 실무를 익히는 과정.',array['오리엔테이션·골프클럽 피팅 이해와 기초이론','그립 피팅 및 교체','스윙데이터 해석·스윙분석','헤드·샤프트 역할, 샤프트 피팅 실무','웨이트 밸런스 조정·헤드 리피니시','샤프트 파손수리·종합 테스트']::text[],'OFFLINE',12,30,'2026.09.05–11.14',array[]::text[],'토 18:00–22:00','피팅실습실','골프피팅전문가2급',null,true),
('2026-furniture',2026,13,'가구소품전문시공인력양성과정','팝업 아카데미','가구소품 제작에 필요한 재료·도구와 제작 기법을 익히고 액자·시계 제작 및 과정평가를 수행하는 실습 과정.',array['목재·공구의 이해와 관리, 장비사용 안전교육','측정도구·수공구 활용','전동공구·목공기계 활용','액자·시계 제작 연습','제작연습 및 과정평가']::text[],'OFFLINE',14,30,'2026.10.06–10.29',array[]::text[],'화·목 18:00–21:00','2-110',null,null,true),
('2026-wallpaper',2026,14,'도배전문시공인력양성과정','팝업 아카데미','도배 작업에 필요한 측정·자재계산·바탕면 처리·재단·시공과 마감 품질관리를 단계별 실습하는 과정.',array['오리엔테이션·장비사용 안전교육','측정·치수 및 자재계산','하도·면처리 및 표면정리','풀바름 실습','재단·붙이기 기초','이음·모서리·창틀·문틀 시공','벽지·마감 품질관리','종합실습·과정평가']::text[],'OFFLINE',14,30,'2026.11.03–11.26',array[]::text[],'화·목 18:00–21:00','2-211','도배시공사',null,true),
('2026-interior-woodwork',2026,15,'인테리어목공전문인력양성과정','팝업 아카데미','인테리어 목공 작업을 위한 안전교육·현치도 작도·부재 제작과 창호를 포함한 제작 연습을 진행하는 실습 과정.',array['장비사용 안전교육·현치도 작도','현치도 및 A·B·D·C 부재 연습','제작연습','창호 포함 제작연습']::text[],'OFFLINE',14,30,'2026.12.01–12.24',array['최초: 2026.09.01–09.29','변경: 2026.12.01–12.24']::text[],'화·목 18:00–21:00','2-110','목공지도사',null,true),
('2026-facilitator',2026,16,'퍼실리2급양성과정(동구청협업)','팝업 아카데미','지역사회 소통 파트너를 양성하기 위해 질문·경청·의제 분석·의사결정·갈등조율을 실습하고 토론회 스크립트와 촉진 시뮬레이션을 수행하는 과정.',array['연결의 시작·퍼실리테이터 역할','공감적 경청','핵심 질문 디자인','아이디어 발산·브레인스토밍','지역 현안 분석·로직 트리','합의·의사결정','갈등 조율','지역 토론회 스크립트·실전 시뮬레이션']::text[],'OFFLINE',20,24,'2026.05.28–07.16',array[]::text[],'목 10:00–13:00','화정가족문화센터','퍼실리테이터2급',null,true);

notify pgrst,'reload schema';
commit;
