/**
 * @file src/lib/operation-documents/prefilled-data.ts
 * @description 2026년 RISE사업 평생직업교육과정 16개 과정의 전체 운영계획서 및 운영결과보고서 사전 채움 데이터 모듈입니다.
 *              docs/의 운영계획서 MD(16건), 결과보고서 MD(7건) 및 70장의 사진 메타데이터를 통합하여 제공합니다.
 */

export type PrefilledCourse = {
  sourceId: string;
  id: string;
  programId: string;
  title: string;
  academy: string;
  capacity: number;
  teachingHours: number;
  facultyCoordinator: string;
  startsOn: string;
  endsOn: string;
  summary: string;
  curriculum: string;
  location: string;
  timeLabel: string;
  teachers: string;
  assistants: string;
  supportStaff: string;
  planStatus?: "DRAFT" | "REVIEW" | "SUBMITTED";
  resultStatus?: "DRAFT" | "REVIEW" | "SUBMITTED";
  hasResultReport: boolean;
  scheduleRows: Record<string, string>[];
  instructorRows: Record<string, string>[];
  budgetRows: { category: string; calculation: string; planned: string; spent: string; note: string }[];
  reportPhotos: { caption: string; date: string; relativePath: string; fileName?: string }[];
  matchingReportFile?: string;
  matchingPlanFile?: string;
};

const RAW_PREFILLED_COURSES: PrefilledCourse[] = [
  {
    "sourceId": "P01",
    "id": "2026-popup-01",
    "programId": "C1-POPUP-01",
    "title": "가구소품 전문시공인력 양성과정",
    "academy": "팝업 아카데미",
    "capacity": 14,
    "teachingHours": 30,
    "facultyCoordinator": "김동욱",
    "startsOn": "2026-10-06",
    "endsOn": "2026-10-29",
    "summary": "가구소품 제작에 필요한 재료·도구와 제작 기법을 익히고 액자·시계 제작 및 과정평가를 수행하는 실습 과정.",
    "curriculum": "목재·공구의 이해와 관리, 장비사용 안전교육\n측정도구·수공구 활용\n전동공구·목공기계 활용\n액자·시계 제작 연습\n제작연습 및 과정평가",
    "location": "2대학관 110호",
    "timeLabel": "화·목, 첫날·마지막 날 18:00~21:00 / 나머지 18:00~22:00",
    "teachers": "손창서(교외)",
    "assistants": "미기재",
    "supportStaff": "김두영",
    "scheduleRows": [
      {
        "date": "2026-10-06",
        "topic": "목재·공구의 이해와 관리, 장비사용 안전교육",
        "instructor": "손창서",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관 110호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-10-08",
        "topic": "측정도구·수공구 활용",
        "instructor": "손창서",
        "hours": "4",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관 110호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-10-13",
        "topic": "전동공구·목공기계 활용",
        "instructor": "손창서",
        "hours": "4",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관 110호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-10-15",
        "topic": "액자·시계 제작 연습",
        "instructor": "손창서",
        "hours": "4",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관 110호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-10-20",
        "topic": "제작연습 및 과정평가",
        "instructor": "손창서",
        "hours": "4",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관 110호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-10-22",
        "topic": "목재·공구의 이해와 관리, 장비사용 안전교육",
        "instructor": "손창서",
        "hours": "4",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관 110호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-10-27",
        "topic": "측정도구·수공구 활용",
        "instructor": "손창서",
        "hours": "4",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관 110호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-10-29",
        "topic": "전동공구·목공기계 활용",
        "instructor": "손창서",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관 110호",
        "mode": "대면",
        "holiday": ""
      }
    ],
    "instructorRows": [
      {
        "affiliation": "나손향 대표",
        "position": "교외",
        "name": "손창서",
        "theory": "9",
        "practice": "21"
      }
    ],
    "budgetRows": [
      {
        "category": "내부강사",
        "calculation": "",
        "planned": "30000",
        "spent": "",
        "note": ""
      },
      {
        "category": "외부강사",
        "calculation": "",
        "planned": "1200000",
        "spent": "",
        "note": ""
      },
      {
        "category": "운영비",
        "calculation": "",
        "planned": "300000",
        "spent": "",
        "note": ""
      },
      {
        "category": "재료비",
        "calculation": "",
        "planned": "800000",
        "spent": "",
        "note": ""
      },
      {
        "category": "인쇄비",
        "calculation": "",
        "planned": "200000",
        "spent": "",
        "note": ""
      }
    ],
    "hasResultReport": false,
    "reportPhotos": [],
    "matchingReportFile": "",
    "matchingPlanFile": "2026년 RISE사업 평생직업교육 가구소품전문시공인력양성과정 운영계획서(실ᄂ.md"
  },
  {
    "sourceId": "P02",
    "id": "2026-life-care-04",
    "programId": "C1-LIFE-CARE-04",
    "title": "건강식생활지도사",
    "academy": "라이프케어 아카데미",
    "capacity": 14,
    "teachingHours": 45,
    "facultyCoordinator": "정영혜",
    "startsOn": "2026-07-03",
    "endsOn": "2026-07-24",
    "summary": "식생활과 영양소, 지속가능한 식생활교육을 학습하고 전통음식·건강밥상 실습과 교육 실습을 진행하는 과정.",
    "curriculum": "한국인의 식생활·건강문제와 영양소 이해\n기본 양념·맛간장·천연재료 우리음식 실습\n환경과 식생활, 전통간식 및 건강밥상\n식생활교육 방법 및 실습\n파이토케미컬, 체중관리, 계절밥상·전통음료\n자체평가 및 수료식",
    "location": "1-302, 1-330",
    "timeLabel": "6일, 오전·오후 분리 운영. 시작 09:30, 종료는 날짜별 17:00 또는 18:00",
    "teachers": "정영혜(교내), 박전순(교외), 신효정(교외)",
    "assistants": "미기재",
    "supportStaff": "김태호, 박규태, 강민석",
    "scheduleRows": [
      {
        "date": "2026-07-03",
        "topic": "한국인의 식생활·건강문제와 영양소 이해",
        "instructor": "정영혜",
        "hours": "7",
        "assistant": "",
        "assistantHours": "",
        "location": "1-302, 1-330",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-04",
        "topic": "기본 양념·맛간장·천연재료 우리음식 실습",
        "instructor": "정영혜",
        "hours": "8",
        "assistant": "",
        "assistantHours": "",
        "location": "1-302, 1-330",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-10",
        "topic": "환경과 식생활, 전통간식 및 건강밥상",
        "instructor": "정영혜",
        "hours": "8",
        "assistant": "",
        "assistantHours": "",
        "location": "1-302, 1-330",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-11",
        "topic": "식생활교육 방법 및 실습",
        "instructor": "정영혜",
        "hours": "7",
        "assistant": "",
        "assistantHours": "",
        "location": "1-302, 1-330",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-18",
        "topic": "파이토케미컬, 체중관리, 계절밥상·전통음료",
        "instructor": "정영혜",
        "hours": "7",
        "assistant": "",
        "assistantHours": "",
        "location": "1-302, 1-330",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-24",
        "topic": "자체평가 및 수료식",
        "instructor": "정영혜",
        "hours": "8",
        "assistant": "",
        "assistantHours": "",
        "location": "1-302, 1-330",
        "mode": "대면",
        "holiday": ""
      }
    ],
    "instructorRows": [
      {
        "affiliation": "울산과학대학교 식품영양학과 전임",
        "position": "교내",
        "name": "정영혜",
        "theory": "6",
        "practice": "15"
      },
      {
        "affiliation": "동경요리제과제빵학원 연구원/강사",
        "position": "교외",
        "name": "박전순",
        "theory": "6",
        "practice": "15"
      },
      {
        "affiliation": "한국식생활건강교육협회 연구원",
        "position": "교외",
        "name": "신효정",
        "theory": "1",
        "practice": "2"
      }
    ],
    "budgetRows": [
      {
        "category": "내부강사",
        "calculation": "",
        "planned": "30000",
        "spent": "",
        "note": ""
      },
      {
        "category": "외부강사",
        "calculation": "",
        "planned": "1200000",
        "spent": "",
        "note": ""
      },
      {
        "category": "운영비",
        "calculation": "",
        "planned": "300000",
        "spent": "",
        "note": ""
      },
      {
        "category": "재료비",
        "calculation": "",
        "planned": "800000",
        "spent": "",
        "note": ""
      },
      {
        "category": "인쇄비",
        "calculation": "",
        "planned": "200000",
        "spent": "",
        "note": ""
      }
    ],
    "hasResultReport": true,
    "reportPhotos": [
      {
        "caption": "개강식",
        "date": "2026-07-03",
        "fileName": "01_개강식_20260703.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 앵커사업 건강식생활지도사양성과정 결과보고/01_개강식_20260703.png"
      },
      {
        "caption": "수료식",
        "date": "2026-07-24",
        "fileName": "02_수료식_20260724.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 앵커사업 건강식생활지도사양성과정 결과보고/02_수료식_20260724.png"
      },
      {
        "caption": "운영사진1",
        "date": "2026-07-04",
        "fileName": "03_운영사진1_20260704.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 앵커사업 건강식생활지도사양성과정 결과보고/03_운영사진1_20260704.png"
      },
      {
        "caption": "운영사진2",
        "date": "2026-07-10",
        "fileName": "04_운영사진2_20260710.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 앵커사업 건강식생활지도사양성과정 결과보고/04_운영사진2_20260710.png"
      },
      {
        "caption": "운영사진3",
        "date": "2026-07-11",
        "fileName": "05_운영사진3_20260711.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 앵커사업 건강식생활지도사양성과정 결과보고/05_운영사진3_20260711.png"
      },
      {
        "caption": "운영사진4",
        "date": "2026-07-18",
        "fileName": "06_운영사진4_20260718.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 앵커사업 건강식생활지도사양성과정 결과보고/06_운영사진4_20260718.png"
      }
    ],
    "matchingReportFile": "1. [앵커-C1-S3T4-2](라이프케어)2026년 앵커사업 건강식생활지도사양성과정 결과보고.md",
    "matchingPlanFile": "2026년 RISE사업 평생직업교육 건강식생활지도사과정 운영계획서(식품영양 정.md"
  },
  {
    "sourceId": "P03",
    "id": "2026-p03",
    "programId": "C1-RISE-P03",
    "title": "골프피팅 전문가 양성과정",
    "academy": "로컬창업 아카데미",
    "capacity": 12,
    "teachingHours": 30,
    "facultyCoordinator": "임종석",
    "startsOn": "2026-09-01",
    "endsOn": "2026-11-14",
    "summary": "골프클럽 구조와 피팅 이론, 스윙데이터 분석, 그립·샤프트 수리 및 조정을 통해 골프피팅 실무를 익히는 과정.",
    "curriculum": "오리엔테이션·골프클럽 피팅 이해와 기초이론\n그립 피팅 및 교체\n스윙데이터 해석·스윙분석\n헤드·샤프트 역할, 샤프트 피팅 실무\n웨이트 밸런스 조정·헤드 리피니시\n샤프트 파손수리·종합 테스트",
    "location": "피팅 실습실",
    "timeLabel": "13회차, 8일 편성; 시각·시수 충돌이 있어 시간표 확정 필요",
    "teachers": "임종석(교내), 송상용(교외), 박귀홍(교외), 문준석(교외)",
    "assistants": "김진열(교외)",
    "supportStaff": "미기재",
    "scheduleRows": [
      {
        "date": "2026-09-05",
        "topic": "오리엔테이션·골프클럽 피팅 이해와 기초이론",
        "instructor": "임종석",
        "hours": "2",
        "assistant": "김진열",
        "assistantHours": "10",
        "location": "피팅 실습실",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-09-12",
        "topic": "그립 피팅 및 교체",
        "instructor": "임종석",
        "hours": "4",
        "assistant": "김진열",
        "assistantHours": "10",
        "location": "피팅 실습실",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-10-10",
        "topic": "스윙데이터 해석·스윙분석",
        "instructor": "임종석",
        "hours": "4",
        "assistant": "김진열",
        "assistantHours": "10",
        "location": "피팅 실습실",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-10-17",
        "topic": "헤드·샤프트 역할, 샤프트 피팅 실무",
        "instructor": "임종석",
        "hours": "4",
        "assistant": "김진열",
        "assistantHours": "10",
        "location": "피팅 실습실",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-10-24",
        "topic": "웨이트 밸런스 조정·헤드 리피니시",
        "instructor": "임종석",
        "hours": "4",
        "assistant": "김진열",
        "assistantHours": "10",
        "location": "피팅 실습실",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-10-31",
        "topic": "샤프트 파손수리·종합 테스트",
        "instructor": "임종석",
        "hours": "4",
        "assistant": "김진열",
        "assistantHours": "10",
        "location": "피팅 실습실",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-11-07",
        "topic": "오리엔테이션·골프클럽 피팅 이해와 기초이론",
        "instructor": "임종석",
        "hours": "4",
        "assistant": "김진열",
        "assistantHours": "10",
        "location": "피팅 실습실",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-11-14",
        "topic": "그립 피팅 및 교체",
        "instructor": "임종석",
        "hours": "4",
        "assistant": "김진열",
        "assistantHours": "10",
        "location": "피팅 실습실",
        "mode": "대면",
        "holiday": ""
      }
    ],
    "instructorRows": [
      {
        "affiliation": "울산과학대학교 특임",
        "position": "교내",
        "name": "임종석",
        "theory": "3",
        "practice": "8"
      },
      {
        "affiliation": "앤라이프샵 대표",
        "position": "교외",
        "name": "송상용",
        "theory": "3",
        "practice": "6"
      },
      {
        "affiliation": "골프 샵 대표",
        "position": "교외",
        "name": "박귀홍",
        "theory": "2",
        "practice": "4"
      },
      {
        "affiliation": "준골프 대표",
        "position": "교외",
        "name": "문준석",
        "theory": "1",
        "practice": "3"
      }
    ],
    "budgetRows": [
      {
        "category": "내부강사",
        "calculation": "",
        "planned": "30000",
        "spent": "",
        "note": ""
      },
      {
        "category": "외부강사",
        "calculation": "",
        "planned": "1200000",
        "spent": "",
        "note": ""
      },
      {
        "category": "운영비",
        "calculation": "",
        "planned": "300000",
        "spent": "",
        "note": ""
      },
      {
        "category": "재료비",
        "calculation": "",
        "planned": "800000",
        "spent": "",
        "note": ""
      },
      {
        "category": "인쇄비",
        "calculation": "",
        "planned": "200000",
        "spent": "",
        "note": ""
      }
    ],
    "hasResultReport": false,
    "reportPhotos": [],
    "matchingReportFile": "",
    "matchingPlanFile": "2026년 RISE사업 평생직업교육 골프피팅전문가양성과정 운영계획서(골프산업 ᄋ.md"
  },
  {
    "sourceId": "P04",
    "id": "2026-local-business-01",
    "programId": "C1-LOCAL-BUSINESS-01",
    "title": "달콤한 도약: 로컬 쿠키 창업 마스터 클래스",
    "academy": "로컬창업 아카데미",
    "capacity": 15,
    "teachingHours": 30,
    "facultyCoordinator": "신언환",
    "startsOn": "2026-07-20",
    "endsOn": "2026-07-31",
    "summary": "울산 동구의 로컬 콘텐츠를 쿠키 제품으로 연결하는 리빙랩과 스마트 제조 실습, 스토리텔링·패키징·품평회를 결합한 창업 과정.",
    "curriculum": "지역의 발견 리빙랩\n쿠키·필링 기초 실습\n문제점 완화 리빙랩\n자동 포앙기를 활용한 스마트 제조·제품 완성\n제품 스토리텔링\n최종 발표·패키징·품평회",
    "location": "1-206·플립러닝실습실, AG-104 FAB Lab.",
    "timeLabel": "7일, 10:00~13:00 또는09:00~16:00; 7/29는09:00~13:00·시수6 충돌",
    "teachers": "신언환(교내), 정영은(교외), 구범기(교외), 김중록(교외)",
    "assistants": "미정 3명(교외), 미정 1명(교외), 미정 1명(교외)",
    "supportStaff": "미정 1, 미정 2",
    "scheduleRows": [
      {
        "date": "2026-07-20",
        "topic": "지역의 발견 리빙랩",
        "instructor": "신언환",
        "hours": "3",
        "assistant": "미정 3명",
        "assistantHours": "27",
        "location": "1-206·플립러닝실습실, AG-104 FAB Lab.",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-21",
        "topic": "쿠키·필링 기초 실습",
        "instructor": "신언환",
        "hours": "6",
        "assistant": "미정 3명",
        "assistantHours": "27",
        "location": "1-206·플립러닝실습실, AG-104 FAB Lab.",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-22",
        "topic": "문제점 완화 리빙랩",
        "instructor": "신언환",
        "hours": "3",
        "assistant": "미정 3명",
        "assistantHours": "27",
        "location": "1-206·플립러닝실습실, AG-104 FAB Lab.",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-28",
        "topic": "자동 포앙기를 활용한 스마트 제조·제품 완성",
        "instructor": "신언환",
        "hours": "6",
        "assistant": "미정 3명",
        "assistantHours": "27",
        "location": "1-206·플립러닝실습실, AG-104 FAB Lab.",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-29",
        "topic": "제품 스토리텔링",
        "instructor": "신언환",
        "hours": "6",
        "assistant": "미정 3명",
        "assistantHours": "27",
        "location": "1-206·플립러닝실습실, AG-104 FAB Lab.",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-30",
        "topic": "최종 발표·패키징·품평회",
        "instructor": "신언환",
        "hours": "3",
        "assistant": "미정 3명",
        "assistantHours": "27",
        "location": "1-206·플립러닝실습실, AG-104 FAB Lab.",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-31",
        "topic": "지역의 발견 리빙랩",
        "instructor": "신언환",
        "hours": "3",
        "assistant": "미정 3명",
        "assistantHours": "27",
        "location": "1-206·플립러닝실습실, AG-104 FAB Lab.",
        "mode": "대면",
        "holiday": ""
      }
    ],
    "instructorRows": [
      {
        "affiliation": "울산과학대학교 호텔조리제빵과 전임",
        "position": "교내",
        "name": "신언환",
        "theory": "2",
        "practice": "4"
      },
      {
        "affiliation": "울산 동구청 퍼실리테이터",
        "position": "교외",
        "name": "정영은",
        "theory": "3",
        "practice": "6"
      },
      {
        "affiliation": "토탈베이커리시스템 부장",
        "position": "교외",
        "name": "구범기",
        "theory": "4",
        "practice": "8"
      },
      {
        "affiliation": "랑콩뜨레과자점 이사",
        "position": "교외",
        "name": "김중록",
        "theory": "1",
        "practice": "2"
      }
    ],
    "budgetRows": [
      {
        "category": "내부강사",
        "calculation": "",
        "planned": "30000",
        "spent": "",
        "note": ""
      },
      {
        "category": "외부강사",
        "calculation": "",
        "planned": "1200000",
        "spent": "",
        "note": ""
      },
      {
        "category": "운영비",
        "calculation": "",
        "planned": "300000",
        "spent": "",
        "note": ""
      },
      {
        "category": "재료비",
        "calculation": "",
        "planned": "800000",
        "spent": "",
        "note": ""
      },
      {
        "category": "인쇄비",
        "calculation": "",
        "planned": "200000",
        "spent": "",
        "note": ""
      }
    ],
    "hasResultReport": true,
    "reportPhotos": [
      {
        "caption": "개강식",
        "date": "2026-07-20",
        "fileName": "01_개강식_20260720.png",
        "relativePath": "images/1. [앵커-C1-S4T5-2](로컬창업)2026년 달콤한도약로컬쿠키창업마스터클래스 운영결과보고/01_개강식_20260720.png"
      },
      {
        "caption": "수료식",
        "date": "2026-07-31",
        "fileName": "02_수료식_20260731.png",
        "relativePath": "images/1. [앵커-C1-S4T5-2](로컬창업)2026년 달콤한도약로컬쿠키창업마스터클래스 운영결과보고/02_수료식_20260731.png"
      },
      {
        "caption": "운영사진1-기초실습",
        "date": "2026-07-21",
        "fileName": "03_운영사진1-기초실습_20260721.png",
        "relativePath": "images/1. [앵커-C1-S4T5-2](로컬창업)2026년 달콤한도약로컬쿠키창업마스터클래스 운영결과보고/03_운영사진1-기초실습_20260721.png"
      },
      {
        "caption": "운영사진2-기초실습",
        "date": "2026-07-21",
        "fileName": "04_운영사진2-기초실습_20260721.png",
        "relativePath": "images/1. [앵커-C1-S4T5-2](로컬창업)2026년 달콤한도약로컬쿠키창업마스터클래스 운영결과보고/04_운영사진2-기초실습_20260721.png"
      },
      {
        "caption": "운영사진3-스마트제조",
        "date": "",
        "fileName": "05_운영사진3-스마트제조.png",
        "relativePath": "images/1. [앵커-C1-S4T5-2](로컬창업)2026년 달콤한도약로컬쿠키창업마스터클래스 운영결과보고/05_운영사진3-스마트제조.png"
      },
      {
        "caption": "운영사진4-스토리텔링",
        "date": "2026-07-30",
        "fileName": "06_운영사진4-스토리텔링_20260730.png",
        "relativePath": "images/1. [앵커-C1-S4T5-2](로컬창업)2026년 달콤한도약로컬쿠키창업마스터클래스 운영결과보고/06_운영사진4-스토리텔링_20260730.png"
      },
      {
        "caption": "운영사진5-최종발표",
        "date": "2026-07-31",
        "fileName": "07_운영사진5-최종발표_20260731.png",
        "relativePath": "images/1. [앵커-C1-S4T5-2](로컬창업)2026년 달콤한도약로컬쿠키창업마스터클래스 운영결과보고/07_운영사진5-최종발표_20260731.png"
      },
      {
        "caption": "운영사진6-최종발표",
        "date": "2026-07-31",
        "fileName": "08_운영사진6-최종발표_20260731.png",
        "relativePath": "images/1. [앵커-C1-S4T5-2](로컬창업)2026년 달콤한도약로컬쿠키창업마스터클래스 운영결과보고/08_운영사진6-최종발표_20260731.png"
      }
    ],
    "matchingReportFile": "1. [앵커-C1-S4T5-2](로컬창업)2026년 달콤한도약로컬쿠키창업마스터클래스 운영결과보고.md",
    "matchingPlanFile": "2026년 RISE사업 평생직업교육 달콤한도약로컬쿠키창업마스터 프로그램 운영계회.md"
  },
  {
    "sourceId": "P05",
    "id": "2026-popup-02",
    "programId": "C1-POPUP-02",
    "title": "도배 전문시공인력 양성과정",
    "academy": "팝업 아카데미",
    "capacity": 14,
    "teachingHours": 30,
    "facultyCoordinator": "김동욱",
    "startsOn": "2026-10-06",
    "endsOn": "2026-10-29",
    "summary": "도배 작업에 필요한 측정·자재계산·바탕면 처리·재단·시공과 마감 품질관리를 단계별 실습하는 과정.",
    "curriculum": "오리엔테이션·장비사용 안전교육\n측정·치수 및 자재계산\n하도·면처리 및 표면정리\n풀바름 실습\n재단·붙이기 기초\n이음·모서리·창틀·문틀 시공\n벽지·마감 품질관리\n종합실습·과정평가",
    "location": "2대학관 211호",
    "timeLabel": "차시표는11/3~11/26 화·목, 첫날·마지막 날18:00~21:00 / 나머지18:00~22:00",
    "teachers": "조영민(교외)",
    "assistants": "미기재",
    "supportStaff": "홍성혁",
    "scheduleRows": [
      {
        "date": "2026-11-03",
        "topic": "오리엔테이션·장비사용 안전교육",
        "instructor": "조영민",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관 211호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-11-05",
        "topic": "측정·치수 및 자재계산",
        "instructor": "조영민",
        "hours": "4",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관 211호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-11-10",
        "topic": "하도·면처리 및 표면정리",
        "instructor": "조영민",
        "hours": "4",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관 211호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-11-12",
        "topic": "풀바름 실습",
        "instructor": "조영민",
        "hours": "4",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관 211호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-11-17",
        "topic": "재단·붙이기 기초",
        "instructor": "조영민",
        "hours": "4",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관 211호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-11-19",
        "topic": "이음·모서리·창틀·문틀 시공",
        "instructor": "조영민",
        "hours": "4",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관 211호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-11-24",
        "topic": "벽지·마감 품질관리",
        "instructor": "조영민",
        "hours": "4",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관 211호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-11-26",
        "topic": "종합실습·과정평가",
        "instructor": "조영민",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관 211호",
        "mode": "대면",
        "holiday": ""
      }
    ],
    "instructorRows": [
      {
        "affiliation": "집닥 주식회사 실장",
        "position": "교외",
        "name": "조영민",
        "theory": "9",
        "practice": "21"
      }
    ],
    "budgetRows": [
      {
        "category": "내부강사",
        "calculation": "",
        "planned": "30000",
        "spent": "",
        "note": ""
      },
      {
        "category": "외부강사",
        "calculation": "",
        "planned": "1200000",
        "spent": "",
        "note": ""
      },
      {
        "category": "운영비",
        "calculation": "",
        "planned": "300000",
        "spent": "",
        "note": ""
      },
      {
        "category": "재료비",
        "calculation": "",
        "planned": "800000",
        "spent": "",
        "note": ""
      },
      {
        "category": "인쇄비",
        "calculation": "",
        "planned": "200000",
        "spent": "",
        "note": ""
      }
    ],
    "hasResultReport": false,
    "reportPhotos": [],
    "matchingReportFile": "",
    "matchingPlanFile": "2026년 RISE사업 평생직업교육 도배전문시공인력양성과정 운영계획서(실내건ᄎ.md"
  },
  {
    "sourceId": "P06",
    "id": "2026-life-care-01",
    "programId": "C1-LIFE-CARE-01",
    "title": "도수물리치료 전문인력양성과정",
    "academy": "라이프케어 아카데미",
    "capacity": 15,
    "teachingHours": 30,
    "facultyCoordinator": "이관우",
    "startsOn": "2026-07-01",
    "endsOn": "2026-07-16",
    "summary": "물리치료분야 종사자를 주요 대상으로 척추 표면해부학, 허리척추 평가와 도수치료, 골반 관련 실습을 편성한 직무교육 과정.",
    "curriculum": "척추 표면해부학 실습\n허리척추 평가 실습\n허리척추 도수치료 실습 및 심화\n골반 도수치료 실습",
    "location": "2-417",
    "timeLabel": "7/1·3·6·8·10·13·15 17:00~21:00, 7/16 17:00~19:00",
    "teachers": "이관우(교내), 김정현(교외)",
    "assistants": "김정현(교외), 최유진(교외)",
    "supportStaff": "미정",
    "scheduleRows": [
      {
        "date": "2026-07-01",
        "topic": "척추 표면해부학 실습",
        "instructor": "이관우",
        "hours": "4",
        "assistant": "김정현",
        "assistantHours": "15",
        "location": "2-417",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-03",
        "topic": "허리척추 평가 실습",
        "instructor": "이관우",
        "hours": "4",
        "assistant": "김정현",
        "assistantHours": "15",
        "location": "2-417",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-06",
        "topic": "허리척추 도수치료 실습 및 심화",
        "instructor": "이관우",
        "hours": "4",
        "assistant": "김정현",
        "assistantHours": "15",
        "location": "2-417",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-08",
        "topic": "골반 도수치료 실습",
        "instructor": "이관우",
        "hours": "4",
        "assistant": "김정현",
        "assistantHours": "15",
        "location": "2-417",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-10",
        "topic": "척추 표면해부학 실습",
        "instructor": "이관우",
        "hours": "4",
        "assistant": "김정현",
        "assistantHours": "15",
        "location": "2-417",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-13",
        "topic": "허리척추 평가 실습",
        "instructor": "이관우",
        "hours": "4",
        "assistant": "김정현",
        "assistantHours": "15",
        "location": "2-417",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-15",
        "topic": "허리척추 도수치료 실습 및 심화",
        "instructor": "이관우",
        "hours": "4",
        "assistant": "김정현",
        "assistantHours": "15",
        "location": "2-417",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-16",
        "topic": "골반 도수치료 실습",
        "instructor": "이관우",
        "hours": "2",
        "assistant": "김정현",
        "assistantHours": "15",
        "location": "2-417",
        "mode": "대면",
        "holiday": ""
      }
    ],
    "instructorRows": [
      {
        "affiliation": "울산과학대학교 물리치료학과 조교수",
        "position": "교내",
        "name": "이관우",
        "theory": "7",
        "practice": "15"
      },
      {
        "affiliation": "동천동강병원 팀장",
        "position": "교외",
        "name": "김정현",
        "theory": "2",
        "practice": "6"
      }
    ],
    "budgetRows": [
      {
        "category": "내부강사",
        "calculation": "",
        "planned": "30000",
        "spent": "",
        "note": ""
      },
      {
        "category": "외부강사",
        "calculation": "",
        "planned": "1200000",
        "spent": "",
        "note": ""
      },
      {
        "category": "운영비",
        "calculation": "",
        "planned": "300000",
        "spent": "",
        "note": ""
      },
      {
        "category": "재료비",
        "calculation": "",
        "planned": "800000",
        "spent": "",
        "note": ""
      },
      {
        "category": "인쇄비",
        "calculation": "",
        "planned": "200000",
        "spent": "",
        "note": ""
      }
    ],
    "hasResultReport": false,
    "reportPhotos": [],
    "matchingReportFile": "",
    "matchingPlanFile": "2026년 RISE사업 평생직업교육 도수물리치료전문인력양성프로그램 운영계획서(ᄆ.md"
  },
  {
    "sourceId": "P07",
    "id": "2026-p07",
    "programId": "C1-LOCAL-BUSINESS-P07",
    "title": "로컬 페스타(LOCAL FESTA) 기획자 양성과정",
    "academy": "로컬창업 아카데미",
    "capacity": 20,
    "teachingHours": 12,
    "facultyCoordinator": "현용환",
    "startsOn": "2026-06-06",
    "endsOn": "2026-06-27",
    "summary": "지역 자산을 활용한 문화기획을 배우고 팀별 아이디어 발산·사업계획·예산 작성·기획안 발표를 진행하는 액션러닝 과정.",
    "curriculum": "운영 안내·지역 브랜딩 특강·팀빌딩\n로컬콘텐츠 자원 분석·아이디어 워크숍·멘토링\n기획자 커리어와 사업계획서·예산안 작성\n기획안 발표·전문가 심사·실행 가이드",
    "location": "청년스테이지 ON",
    "timeLabel": "토09:00~12:00, 4일",
    "teachers": "오명훈(교외), 황동윤(교외)",
    "assistants": "김성엽(교외), 서승연(교외), 이뤄라(교외)",
    "supportStaff": "미기재",
    "scheduleRows": [
      {
        "date": "2026-06-06",
        "topic": "운영 안내·지역 브랜딩 특강·팀빌딩",
        "instructor": "오명훈",
        "hours": "3",
        "assistant": "김성엽",
        "assistantHours": "4",
        "location": "청년스테이지 ON",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-06-13",
        "topic": "로컬콘텐츠 자원 분석·아이디어 워크숍·멘토링",
        "instructor": "오명훈",
        "hours": "3",
        "assistant": "김성엽",
        "assistantHours": "4",
        "location": "청년스테이지 ON",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-06-20",
        "topic": "기획자 커리어와 사업계획서·예산안 작성",
        "instructor": "오명훈",
        "hours": "3",
        "assistant": "김성엽",
        "assistantHours": "4",
        "location": "청년스테이지 ON",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-06-27",
        "topic": "기획안 발표·전문가 심사·실행 가이드",
        "instructor": "오명훈",
        "hours": "3",
        "assistant": "김성엽",
        "assistantHours": "4",
        "location": "청년스테이지 ON",
        "mode": "대면",
        "holiday": ""
      }
    ],
    "instructorRows": [
      {
        "affiliation": "(재)영월문화관광재단 차장",
        "position": "교외",
        "name": "오명훈",
        "theory": "0",
        "practice": "1"
      },
      {
        "affiliation": "파래소 국악실내악단 대표",
        "position": "교외",
        "name": "황동윤",
        "theory": "3",
        "practice": "8"
      }
    ],
    "budgetRows": [
      {
        "category": "내부강사",
        "calculation": "",
        "planned": "30000",
        "spent": "",
        "note": ""
      },
      {
        "category": "외부강사",
        "calculation": "",
        "planned": "1200000",
        "spent": "",
        "note": ""
      },
      {
        "category": "운영비",
        "calculation": "",
        "planned": "300000",
        "spent": "",
        "note": ""
      },
      {
        "category": "재료비",
        "calculation": "",
        "planned": "800000",
        "spent": "",
        "note": ""
      },
      {
        "category": "인쇄비",
        "calculation": "",
        "planned": "200000",
        "spent": "",
        "note": ""
      }
    ],
    "hasResultReport": true,
    "reportPhotos": [
      {
        "caption": "개강식",
        "date": "2026-06-06",
        "fileName": "01_개강식_20260606.png",
        "relativePath": "images/1. 2026년 앵커사업 로컬페스타기획자양성과정 운영결과보고서/01_개강식_20260606.png"
      },
      {
        "caption": "수료식",
        "date": "2026-06-27",
        "fileName": "02_수료식_20260627.png",
        "relativePath": "images/1. 2026년 앵커사업 로컬페스타기획자양성과정 운영결과보고서/02_수료식_20260627.png"
      },
      {
        "caption": "운영사진1",
        "date": "2026-06-06",
        "fileName": "03_운영사진1_20260606.png",
        "relativePath": "images/1. 2026년 앵커사업 로컬페스타기획자양성과정 운영결과보고서/03_운영사진1_20260606.png"
      },
      {
        "caption": "운영사진2",
        "date": "2026-06-13",
        "fileName": "04_운영사진2_20260613.png",
        "relativePath": "images/1. 2026년 앵커사업 로컬페스타기획자양성과정 운영결과보고서/04_운영사진2_20260613.png"
      },
      {
        "caption": "운영사진3",
        "date": "2026-06-20",
        "fileName": "05_운영사진3_20260620.png",
        "relativePath": "images/1. 2026년 앵커사업 로컬페스타기획자양성과정 운영결과보고서/05_운영사진3_20260620.png"
      },
      {
        "caption": "운영사진4",
        "date": "2026-06-27",
        "fileName": "06_운영사진4_20260627.png",
        "relativePath": "images/1. 2026년 앵커사업 로컬페스타기획자양성과정 운영결과보고서/06_운영사진4_20260627.png"
      }
    ],
    "matchingReportFile": "1. 2026년 앵커사업 로컬페스타기획자양성과정 운영결과보고서.md",
    "matchingPlanFile": "2026년 RISE사업 평생직업교육 로컬페스타기획자양성과정 프로그램 운영계획서(동.md"
  },
  {
    "sourceId": "P08",
    "id": "2026-local-business-02",
    "programId": "C1-LOCAL-BUSINESS-02",
    "title": "반려동물수제간식 만들기",
    "academy": "로컬창업 아카데미",
    "capacity": 10,
    "teachingHours": 30,
    "facultyCoordinator": "최수경",
    "startsOn": "2026-08-05",
    "endsOn": "2026-08-21",
    "summary": "반려동물 영양·식재료 관리 이론과 건조간식·수제간식 조리 실습, 펫푸드 창업 연계 내용을 구성한 과정.",
    "curriculum": "사료 영양표준·반려동물 핫도그\n식재료 소독·손질, 보틀케이크·연어머핀\n건조간식 식재료·4종 실습\n오리채소푸딩·함박스테이크·채소고구마타르트\n반려동물 생리학·피자·치킨세트\n치킨스쿱쿠키·꼬꼬링쿠키·영양관리",
    "location": "1-302, 1-331",
    "timeLabel": "차시표 월일8/5·7·12·14·19·21, 10:00~16:00 중 교육5시간; 연도 확인 필요",
    "teachers": "최수경(교내), 문해담(교외)",
    "assistants": "미기재",
    "supportStaff": "미정",
    "scheduleRows": [
      {
        "date": "2026-08-05",
        "topic": "사료 영양표준·반려동물 핫도그",
        "instructor": "최수경",
        "hours": "5",
        "assistant": "",
        "assistantHours": "",
        "location": "1-302, 1-331",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-08-07",
        "topic": "식재료 소독·손질, 보틀케이크·연어머핀",
        "instructor": "최수경",
        "hours": "5",
        "assistant": "",
        "assistantHours": "",
        "location": "1-302, 1-331",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-08-12",
        "topic": "건조간식 식재료·4종 실습",
        "instructor": "최수경",
        "hours": "5",
        "assistant": "",
        "assistantHours": "",
        "location": "1-302, 1-331",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-08-14",
        "topic": "오리채소푸딩·함박스테이크·채소고구마타르트",
        "instructor": "최수경",
        "hours": "5",
        "assistant": "",
        "assistantHours": "",
        "location": "1-302, 1-331",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-08-19",
        "topic": "반려동물 생리학·피자·치킨세트",
        "instructor": "최수경",
        "hours": "5",
        "assistant": "",
        "assistantHours": "",
        "location": "1-302, 1-331",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-08-21",
        "topic": "치킨스쿱쿠키·꼬꼬링쿠키·영양관리",
        "instructor": "최수경",
        "hours": "5",
        "assistant": "",
        "assistantHours": "",
        "location": "1-302, 1-331",
        "mode": "대면",
        "holiday": ""
      }
    ],
    "instructorRows": [
      {
        "affiliation": "울산과학대학교 식품영양학과 전임",
        "position": "교내",
        "name": "최수경",
        "theory": "2",
        "practice": "4"
      },
      {
        "affiliation": "국제펫푸드영양협회 대표",
        "position": "교외",
        "name": "문해담",
        "theory": "7",
        "practice": "17"
      }
    ],
    "budgetRows": [
      {
        "category": "내부강사",
        "calculation": "",
        "planned": "30000",
        "spent": "",
        "note": ""
      },
      {
        "category": "외부강사",
        "calculation": "",
        "planned": "1200000",
        "spent": "",
        "note": ""
      },
      {
        "category": "운영비",
        "calculation": "",
        "planned": "300000",
        "spent": "",
        "note": ""
      },
      {
        "category": "재료비",
        "calculation": "",
        "planned": "800000",
        "spent": "",
        "note": ""
      },
      {
        "category": "인쇄비",
        "calculation": "",
        "planned": "200000",
        "spent": "",
        "note": ""
      }
    ],
    "hasResultReport": true,
    "reportPhotos": [
      {
        "caption": "개강식",
        "date": "2026-08-05",
        "fileName": "01_개강식_20260805.png",
        "relativePath": "images/1. [앵커-C1-S4T5-2](로컬창업)2026년 반려동물수제간식만들기과정 결과보고서/01_개강식_20260805.png"
      },
      {
        "caption": "수료식",
        "date": "2026-08-21",
        "fileName": "02_수료식_20260821.png",
        "relativePath": "images/1. [앵커-C1-S4T5-2](로컬창업)2026년 반려동물수제간식만들기과정 결과보고서/02_수료식_20260821.png"
      },
      {
        "caption": "운영사진1",
        "date": "2026-08-05",
        "fileName": "03_운영사진1_20260805.png",
        "relativePath": "images/1. [앵커-C1-S4T5-2](로컬창업)2026년 반려동물수제간식만들기과정 결과보고서/03_운영사진1_20260805.png"
      },
      {
        "caption": "운영사진1",
        "date": "2026-08-05",
        "fileName": "04_운영사진1_20260805.png",
        "relativePath": "images/1. [앵커-C1-S4T5-2](로컬창업)2026년 반려동물수제간식만들기과정 결과보고서/04_운영사진1_20260805.png"
      },
      {
        "caption": "운영사진3",
        "date": "2026-08-07",
        "fileName": "05_운영사진3_20260807.png",
        "relativePath": "images/1. [앵커-C1-S4T5-2](로컬창업)2026년 반려동물수제간식만들기과정 결과보고서/05_운영사진3_20260807.png"
      },
      {
        "caption": "운영사진4",
        "date": "2026-08-12",
        "fileName": "06_운영사진4_20260812.png",
        "relativePath": "images/1. [앵커-C1-S4T5-2](로컬창업)2026년 반려동물수제간식만들기과정 결과보고서/06_운영사진4_20260812.png"
      },
      {
        "caption": "운영사진5",
        "date": "2026-08-14",
        "fileName": "07_운영사진5_20260814.png",
        "relativePath": "images/1. [앵커-C1-S4T5-2](로컬창업)2026년 반려동물수제간식만들기과정 결과보고서/07_운영사진5_20260814.png"
      },
      {
        "caption": "운영사진5",
        "date": "2026-08-19",
        "fileName": "08_운영사진5_20260819.png",
        "relativePath": "images/1. [앵커-C1-S4T5-2](로컬창업)2026년 반려동물수제간식만들기과정 결과보고서/08_운영사진5_20260819.png"
      },
      {
        "caption": "운영사진7",
        "date": "2026-08-21",
        "fileName": "09_운영사진7_20260821.png",
        "relativePath": "images/1. [앵커-C1-S4T5-2](로컬창업)2026년 반려동물수제간식만들기과정 결과보고서/09_운영사진7_20260821.png"
      },
      {
        "caption": "운영사진8",
        "date": "2026-08-21",
        "fileName": "10_운영사진8_20260821.png",
        "relativePath": "images/1. [앵커-C1-S4T5-2](로컬창업)2026년 반려동물수제간식만들기과정 결과보고서/10_운영사진8_20260821.png"
      }
    ],
    "matchingReportFile": "1. [앵커-C1-S4T5-2](로컬창업)2026년 반려동물수제간식만들기과정 결과보고서.md",
    "matchingPlanFile": "2026년 RISE사업 평생직업교육 반려동물수제간식만들기과정 운영계획서(식품ᄋ.md"
  },
  {
    "sourceId": "P09",
    "id": "2026-local-business-03",
    "programId": "C1-LOCAL-BUSINESS-03",
    "title": "반려동물행동교정사 3급 양성과정",
    "academy": "로컬창업 아카데미",
    "capacity": 16,
    "teachingHours": 48,
    "facultyCoordinator": "박성혁",
    "startsOn": "2026-06-05",
    "endsOn": "2026-09-18",
    "summary": "반려동물 행동과 심리를 이해하고 사회화·기초훈련 및 반복 실습을 통해 행동교정 관련 역량을 기르는 과정.",
    "curriculum": "개의 역사·견종 분류·훈련견 소개\n행동·심리·사회화와 성격별 훈련\n3급훈련사 시험·CD등급 과목 소개\n이리와·앉아·붙어·따라·엎드려·서 훈련\n사회화·켄넬·대기 및 기초 반복훈련",
    "location": "동부캠퍼스 1대학관114호",
    "timeLabel": "금15:00~18:00, 16회 예정",
    "teachers": "이채원(교외)",
    "assistants": "미기재",
    "supportStaff": "미기재",
    "scheduleRows": [
      {
        "date": "2026-06-05",
        "topic": "개의 역사·견종 분류·훈련견 소개",
        "instructor": "이채원",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "동부캠퍼스 1대학관114호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-06-12",
        "topic": "행동·심리·사회화와 성격별 훈련",
        "instructor": "이채원",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "동부캠퍼스 1대학관114호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-06-19",
        "topic": "3급훈련사 시험·CD등급 과목 소개",
        "instructor": "이채원",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "동부캠퍼스 1대학관114호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-06-26",
        "topic": "이리와·앉아·붙어·따라·엎드려·서 훈련",
        "instructor": "이채원",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "동부캠퍼스 1대학관114호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-03",
        "topic": "사회화·켄넬·대기 및 기초 반복훈련",
        "instructor": "이채원",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "동부캠퍼스 1대학관114호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-10",
        "topic": "개의 역사·견종 분류·훈련견 소개",
        "instructor": "이채원",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "동부캠퍼스 1대학관114호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-17",
        "topic": "행동·심리·사회화와 성격별 훈련",
        "instructor": "이채원",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "동부캠퍼스 1대학관114호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-24",
        "topic": "3급훈련사 시험·CD등급 과목 소개",
        "instructor": "이채원",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "동부캠퍼스 1대학관114호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-31",
        "topic": "이리와·앉아·붙어·따라·엎드려·서 훈련",
        "instructor": "이채원",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "동부캠퍼스 1대학관114호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-08-07",
        "topic": "사회화·켄넬·대기 및 기초 반복훈련",
        "instructor": "이채원",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "동부캠퍼스 1대학관114호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-08-14",
        "topic": "개의 역사·견종 분류·훈련견 소개",
        "instructor": "이채원",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "동부캠퍼스 1대학관114호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-08-21",
        "topic": "행동·심리·사회화와 성격별 훈련",
        "instructor": "이채원",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "동부캠퍼스 1대학관114호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-08-28",
        "topic": "3급훈련사 시험·CD등급 과목 소개",
        "instructor": "이채원",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "동부캠퍼스 1대학관114호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-09-04",
        "topic": "이리와·앉아·붙어·따라·엎드려·서 훈련",
        "instructor": "이채원",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "동부캠퍼스 1대학관114호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-09-11",
        "topic": "사회화·켄넬·대기 및 기초 반복훈련",
        "instructor": "이채원",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "동부캠퍼스 1대학관114호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-09-18",
        "topic": "개의 역사·견종 분류·훈련견 소개",
        "instructor": "이채원",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "동부캠퍼스 1대학관114호",
        "mode": "대면",
        "holiday": ""
      }
    ],
    "instructorRows": [
      {
        "affiliation": "필애견엽견훈련학교 대표",
        "position": "교외",
        "name": "이채원",
        "theory": "14",
        "practice": "34"
      }
    ],
    "budgetRows": [
      {
        "category": "내부강사",
        "calculation": "",
        "planned": "30000",
        "spent": "",
        "note": ""
      },
      {
        "category": "외부강사",
        "calculation": "",
        "planned": "1200000",
        "spent": "",
        "note": ""
      },
      {
        "category": "운영비",
        "calculation": "",
        "planned": "300000",
        "spent": "",
        "note": ""
      },
      {
        "category": "재료비",
        "calculation": "",
        "planned": "800000",
        "spent": "",
        "note": ""
      },
      {
        "category": "인쇄비",
        "calculation": "",
        "planned": "200000",
        "spent": "",
        "note": ""
      }
    ],
    "hasResultReport": false,
    "reportPhotos": [],
    "matchingReportFile": "",
    "matchingPlanFile": "2026년 RISE사업 평생직업교육 반려동물수제간식만들기과정 운영계획서(식품ᄋ.md"
  },
  {
    "sourceId": "P10",
    "id": "2026-life-care-02",
    "programId": "C1-LIFE-CARE-02",
    "title": "산과 필라테스 자격증과정",
    "academy": "라이프케어 아카데미",
    "capacity": 15,
    "teachingHours": 50,
    "facultyCoordinator": "김원호",
    "startsOn": "2026-10-10",
    "endsOn": "2026-12-05",
    "summary": "산전·산후 필라테스 운동지도 프로그램의 이론과 실습을 학습하고 그룹 레슨 구성·직업윤리·종합평가를 진행하는 과정.",
    "curriculum": "오리엔테이션·산과적 평가 및 실습\n필라테스 이해\nCenter/Breathing 방법\nAlignment/Pre-Pilates(Mat)\n산전 Pilates(Mat·equipments)\n산후 Pilates(Mat·equipments)\nProfessional Manner(Ethics), Group Lesson Program Skill 및 종합평가",
    "location": "첫날2-417, 10/17·24 2-418, 이후 비엔비네오필라테스센터",
    "timeLabel": "토, 첫날14:00~19:00 / 중간7일14:00~20:00 / 마지막14:00~17:00",
    "teachers": "김원호(교내), 김동주(교외)",
    "assistants": "미기재",
    "supportStaff": "미기재",
    "scheduleRows": [
      {
        "date": "2026-10-10",
        "topic": "오리엔테이션·산과적 평가 및 실습",
        "instructor": "김원호",
        "hours": "5",
        "assistant": "",
        "assistantHours": "",
        "location": "첫날2-417, 10/17·24 2-418, 이후 비엔비네오필라테스센터",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-10-17",
        "topic": "필라테스 이해",
        "instructor": "김원호",
        "hours": "6",
        "assistant": "",
        "assistantHours": "",
        "location": "첫날2-417, 10/17·24 2-418, 이후 비엔비네오필라테스센터",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-10-24",
        "topic": "Center/Breathing 방법",
        "instructor": "김원호",
        "hours": "6",
        "assistant": "",
        "assistantHours": "",
        "location": "첫날2-417, 10/17·24 2-418, 이후 비엔비네오필라테스센터",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-10-31",
        "topic": "Alignment/Pre-Pilates(Mat)",
        "instructor": "김원호",
        "hours": "6",
        "assistant": "",
        "assistantHours": "",
        "location": "첫날2-417, 10/17·24 2-418, 이후 비엔비네오필라테스센터",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-11-07",
        "topic": "산전 Pilates(Mat·equipments)",
        "instructor": "김원호",
        "hours": "6",
        "assistant": "",
        "assistantHours": "",
        "location": "첫날2-417, 10/17·24 2-418, 이후 비엔비네오필라테스센터",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-11-14",
        "topic": "산후 Pilates(Mat·equipments)",
        "instructor": "김원호",
        "hours": "6",
        "assistant": "",
        "assistantHours": "",
        "location": "첫날2-417, 10/17·24 2-418, 이후 비엔비네오필라테스센터",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-11-21",
        "topic": "Professional Manner(Ethics), Group Lesson Program Skill 및 종합평가",
        "instructor": "김원호",
        "hours": "6",
        "assistant": "",
        "assistantHours": "",
        "location": "첫날2-417, 10/17·24 2-418, 이후 비엔비네오필라테스센터",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-11-28",
        "topic": "오리엔테이션·산과적 평가 및 실습",
        "instructor": "김원호",
        "hours": "6",
        "assistant": "",
        "assistantHours": "",
        "location": "첫날2-417, 10/17·24 2-418, 이후 비엔비네오필라테스센터",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-12-05",
        "topic": "필라테스 이해",
        "instructor": "김원호",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "첫날2-417, 10/17·24 2-418, 이후 비엔비네오필라테스센터",
        "mode": "대면",
        "holiday": ""
      }
    ],
    "instructorRows": [
      {
        "affiliation": "울산과학대학교 물리치료학과 교수",
        "position": "교내",
        "name": "김원호",
        "theory": "2",
        "practice": "4"
      },
      {
        "affiliation": "비엔비네오필라테스센터 대표",
        "position": "교외",
        "name": "김동주",
        "theory": "14",
        "practice": "31"
      }
    ],
    "budgetRows": [
      {
        "category": "내부강사",
        "calculation": "",
        "planned": "30000",
        "spent": "",
        "note": ""
      },
      {
        "category": "외부강사",
        "calculation": "",
        "planned": "1200000",
        "spent": "",
        "note": ""
      },
      {
        "category": "운영비",
        "calculation": "",
        "planned": "300000",
        "spent": "",
        "note": ""
      },
      {
        "category": "재료비",
        "calculation": "",
        "planned": "800000",
        "spent": "",
        "note": ""
      },
      {
        "category": "인쇄비",
        "calculation": "",
        "planned": "200000",
        "spent": "",
        "note": ""
      }
    ],
    "hasResultReport": false,
    "reportPhotos": [],
    "matchingReportFile": "",
    "matchingPlanFile": "2026년 RISE사업 평생직업교육 산과필라테스자격증프로그램 운영계획서(물리치료 ᄀ.md"
  },
  {
    "sourceId": "P11",
    "id": "2026-life-care-07",
    "programId": "C1-LIFE-CARE-07",
    "title": "스포츠테이핑관리사(자격증) 양성과정",
    "academy": "라이프케어 아카데미",
    "capacity": 20,
    "teachingHours": 42,
    "facultyCoordinator": "서봉한",
    "startsOn": "2026-07-04",
    "endsOn": "2026-07-19",
    "summary": "스포츠테이핑 이론과 상지·하지·통증부위별 기초 및 심화 실습, 평가·활용방안을 편성한 과정.",
    "curriculum": "스포츠테이핑 이해·기초이론\n상지·하지 테이핑 기초 실습\n통증부위별 기초 및 심화 실습\n상지·하지 테이핑 심화\n실습 평가와 활용방안",
    "location": "스포츠재활실습실 G-113(교육방법에는 서부캠퍼스 강의실)",
    "timeLabel": "토·일09:00~17:00, 일별 교육7시간·총6일",
    "teachers": "서봉한(교내), 조경호(교외)",
    "assistants": "우철호(교외), 손승우(교외)",
    "supportStaff": "미기재",
    "scheduleRows": [
      {
        "date": "2026-07-04",
        "topic": "스포츠테이핑 이해·기초이론",
        "instructor": "서봉한",
        "hours": "7",
        "assistant": "우철호",
        "assistantHours": "18",
        "location": "스포츠재활실습실 G-113(교육방법에는 서부캠퍼스 강의실)",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-05",
        "topic": "상지·하지 테이핑 기초 실습",
        "instructor": "서봉한",
        "hours": "7",
        "assistant": "우철호",
        "assistantHours": "18",
        "location": "스포츠재활실습실 G-113(교육방법에는 서부캠퍼스 강의실)",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-11",
        "topic": "통증부위별 기초 및 심화 실습",
        "instructor": "서봉한",
        "hours": "7",
        "assistant": "우철호",
        "assistantHours": "18",
        "location": "스포츠재활실습실 G-113(교육방법에는 서부캠퍼스 강의실)",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-12",
        "topic": "상지·하지 테이핑 심화",
        "instructor": "서봉한",
        "hours": "7",
        "assistant": "우철호",
        "assistantHours": "18",
        "location": "스포츠재활실습실 G-113(교육방법에는 서부캠퍼스 강의실)",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-18",
        "topic": "실습 평가와 활용방안",
        "instructor": "서봉한",
        "hours": "7",
        "assistant": "우철호",
        "assistantHours": "18",
        "location": "스포츠재활실습실 G-113(교육방법에는 서부캠퍼스 강의실)",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-19",
        "topic": "스포츠테이핑 이해·기초이론",
        "instructor": "서봉한",
        "hours": "7",
        "assistant": "우철호",
        "assistantHours": "18",
        "location": "스포츠재활실습실 G-113(교육방법에는 서부캠퍼스 강의실)",
        "mode": "대면",
        "holiday": ""
      }
    ],
    "instructorRows": [
      {
        "affiliation": "울산과학대학교 스포츠재활학부 전임",
        "position": "교내",
        "name": "서봉한",
        "theory": "2",
        "practice": "4"
      },
      {
        "affiliation": "K-스포츠재활운동과학연구소 대표",
        "position": "교외",
        "name": "조경호",
        "theory": "11",
        "practice": "25"
      }
    ],
    "budgetRows": [
      {
        "category": "내부강사",
        "calculation": "",
        "planned": "30000",
        "spent": "",
        "note": ""
      },
      {
        "category": "외부강사",
        "calculation": "",
        "planned": "1200000",
        "spent": "",
        "note": ""
      },
      {
        "category": "운영비",
        "calculation": "",
        "planned": "300000",
        "spent": "",
        "note": ""
      },
      {
        "category": "재료비",
        "calculation": "",
        "planned": "800000",
        "spent": "",
        "note": ""
      },
      {
        "category": "인쇄비",
        "calculation": "",
        "planned": "200000",
        "spent": "",
        "note": ""
      }
    ],
    "hasResultReport": true,
    "reportPhotos": [
      {
        "caption": "개강식",
        "date": "2026-07-04",
        "fileName": "01_개강식_20260704.png",
        "relativePath": "images/1. 2026년 앵커사업 스포츠테이핑관리사양성과정 운영결과보고서/01_개강식_20260704.png"
      },
      {
        "caption": "수료식",
        "date": "2026-07-19",
        "fileName": "02_수료식_20260719.png",
        "relativePath": "images/1. 2026년 앵커사업 스포츠테이핑관리사양성과정 운영결과보고서/02_수료식_20260719.png"
      },
      {
        "caption": "운영사진1",
        "date": "2026-07-04",
        "fileName": "03_운영사진1_20260704.png",
        "relativePath": "images/1. 2026년 앵커사업 스포츠테이핑관리사양성과정 운영결과보고서/03_운영사진1_20260704.png"
      },
      {
        "caption": "운영사진2",
        "date": "2026-07-05",
        "fileName": "04_운영사진2_20260705.png",
        "relativePath": "images/1. 2026년 앵커사업 스포츠테이핑관리사양성과정 운영결과보고서/04_운영사진2_20260705.png"
      },
      {
        "caption": "운영사진1",
        "date": "2026-07-11",
        "fileName": "05_운영사진1_20260711.png",
        "relativePath": "images/1. 2026년 앵커사업 스포츠테이핑관리사양성과정 운영결과보고서/05_운영사진1_20260711.png"
      },
      {
        "caption": "운영사진2",
        "date": "2026-07-12",
        "fileName": "06_운영사진2_20260712.png",
        "relativePath": "images/1. 2026년 앵커사업 스포츠테이핑관리사양성과정 운영결과보고서/06_운영사진2_20260712.png"
      },
      {
        "caption": "운영사진3",
        "date": "2026-07-18",
        "fileName": "07_운영사진3_20260718.png",
        "relativePath": "images/1. 2026년 앵커사업 스포츠테이핑관리사양성과정 운영결과보고서/07_운영사진3_20260718.png"
      },
      {
        "caption": "운영사진4",
        "date": "2026-07-19",
        "fileName": "08_운영사진4_20260719.png",
        "relativePath": "images/1. 2026년 앵커사업 스포츠테이핑관리사양성과정 운영결과보고서/08_운영사진4_20260719.png"
      }
    ],
    "matchingReportFile": "1. 2026년 앵커사업 스포츠테이핑관리사양성과정 운영결과보고서.md",
    "matchingPlanFile": "2026년 RISE사업 평생직업교육 스포츠테이핑관리사(자격증) 양성과정 운영계획서(ᄉ.md"
  },
  {
    "sourceId": "P12",
    "id": "2026-life-care-03",
    "programId": "C1-LIFE-CARE-03",
    "title": "실버푸드전문가과정",
    "academy": "라이프케어 아카데미",
    "capacity": 10,
    "teachingHours": 30,
    "facultyCoordinator": "김일낭",
    "startsOn": "2026-08-04",
    "endsOn": "2026-08-18",
    "summary": "시니어 식생활·영양·조리·식품안전 교육을 위해 노년기 영양과 고령친화식품을 학습하고 관련 요리 실습을 진행하는 과정.",
    "curriculum": "오리엔테이션·노년기 영양진단\n노인 맞춤형 디저트\n노년기 혈당·혈압, 관련 요리 실습\n면역력·근육건강·정신건강과 영양관리\n고령친화식품 특징·종류·실습",
    "location": "1-302, 1-331",
    "timeLabel": "5일·10회차, 10:00~13:00 및14:00~17:00",
    "teachers": "김일낭(교내), 김은경(교외), 최진혁(교외)",
    "assistants": "미기재",
    "supportStaff": "미정 1, 미정 2",
    "scheduleRows": [
      {
        "date": "2026-08-04",
        "topic": "오리엔테이션·노년기 영양진단",
        "instructor": "김일낭",
        "hours": "6",
        "assistant": "",
        "assistantHours": "",
        "location": "1-302, 1-331",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-08-06",
        "topic": "노인 맞춤형 디저트",
        "instructor": "김일낭",
        "hours": "6",
        "assistant": "",
        "assistantHours": "",
        "location": "1-302, 1-331",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-08-11",
        "topic": "노년기 혈당·혈압, 관련 요리 실습",
        "instructor": "김일낭",
        "hours": "6",
        "assistant": "",
        "assistantHours": "",
        "location": "1-302, 1-331",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-08-13",
        "topic": "면역력·근육건강·정신건강과 영양관리",
        "instructor": "김일낭",
        "hours": "6",
        "assistant": "",
        "assistantHours": "",
        "location": "1-302, 1-331",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-08-18",
        "topic": "고령친화식품 특징·종류·실습",
        "instructor": "김일낭",
        "hours": "6",
        "assistant": "",
        "assistantHours": "",
        "location": "1-302, 1-331",
        "mode": "대면",
        "holiday": ""
      }
    ],
    "instructorRows": [
      {
        "affiliation": "울산과학대학교 식품영양학과 전임",
        "position": "교내",
        "name": "김일낭",
        "theory": "5",
        "practice": "11"
      },
      {
        "affiliation": "올바른식생활연구협회 대표",
        "position": "교외",
        "name": "김은경",
        "theory": "4",
        "practice": "8"
      },
      {
        "affiliation": "너프 대표",
        "position": "교외",
        "name": "최진혁",
        "theory": "1",
        "practice": "2"
      }
    ],
    "budgetRows": [
      {
        "category": "내부강사",
        "calculation": "",
        "planned": "30000",
        "spent": "",
        "note": ""
      },
      {
        "category": "외부강사",
        "calculation": "",
        "planned": "1200000",
        "spent": "",
        "note": ""
      },
      {
        "category": "운영비",
        "calculation": "",
        "planned": "300000",
        "spent": "",
        "note": ""
      },
      {
        "category": "재료비",
        "calculation": "",
        "planned": "800000",
        "spent": "",
        "note": ""
      },
      {
        "category": "인쇄비",
        "calculation": "",
        "planned": "200000",
        "spent": "",
        "note": ""
      }
    ],
    "hasResultReport": false,
    "reportPhotos": [],
    "matchingReportFile": "",
    "matchingPlanFile": "2026년 RISE사업 평생직업교육 실버푸드전문가과정 운영계획서(식품영양 김일ᄂ.md"
  },
  {
    "sourceId": "P13",
    "id": "2026-local-business-04",
    "programId": "C1-LOCAL-BUSINESS-04",
    "title": "애견미용사 3급 양성과정",
    "academy": "로컬창업 아카데미",
    "capacity": 15,
    "teachingHours": 45,
    "facultyCoordinator": "박성혁",
    "startsOn": "2026-06-05",
    "endsOn": "2026-09-11",
    "summary": "미용 도구·기본 시저링·클리핑·위그 실습과 안전관리·고객상담을 학습하는 애견미용 입문 및 자격 대비 과정.",
    "curriculum": "도구 관리·용어·기초 시저링\n목욕·털 자르기·위그 램 클립\n기본미용·몸 클리핑·응용 스타일\n안전교육·장비 점검·고객상담\n품종 표준·위그 실습 및 시험 대비",
    "location": "동부캠퍼스 1대학관113호",
    "timeLabel": "금15:00~18:00, 15회 예정",
    "teachers": "김선아(교외)",
    "assistants": "곽나영(교외)",
    "supportStaff": "미기재",
    "scheduleRows": [
      {
        "date": "2026-06-05",
        "topic": "도구 관리·용어·기초 시저링",
        "instructor": "김선아",
        "hours": "3",
        "assistant": "곽나영",
        "assistantHours": "15",
        "location": "동부캠퍼스 1대학관113호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-06-12",
        "topic": "목욕·털 자르기·위그 램 클립",
        "instructor": "김선아",
        "hours": "3",
        "assistant": "곽나영",
        "assistantHours": "15",
        "location": "동부캠퍼스 1대학관113호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-06-19",
        "topic": "기본미용·몸 클리핑·응용 스타일",
        "instructor": "김선아",
        "hours": "3",
        "assistant": "곽나영",
        "assistantHours": "15",
        "location": "동부캠퍼스 1대학관113호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-06-26",
        "topic": "안전교육·장비 점검·고객상담",
        "instructor": "김선아",
        "hours": "3",
        "assistant": "곽나영",
        "assistantHours": "15",
        "location": "동부캠퍼스 1대학관113호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-03",
        "topic": "품종 표준·위그 실습 및 시험 대비",
        "instructor": "김선아",
        "hours": "3",
        "assistant": "곽나영",
        "assistantHours": "15",
        "location": "동부캠퍼스 1대학관113호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-10",
        "topic": "도구 관리·용어·기초 시저링",
        "instructor": "김선아",
        "hours": "3",
        "assistant": "곽나영",
        "assistantHours": "15",
        "location": "동부캠퍼스 1대학관113호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-17",
        "topic": "목욕·털 자르기·위그 램 클립",
        "instructor": "김선아",
        "hours": "3",
        "assistant": "곽나영",
        "assistantHours": "15",
        "location": "동부캠퍼스 1대학관113호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-24",
        "topic": "기본미용·몸 클리핑·응용 스타일",
        "instructor": "김선아",
        "hours": "3",
        "assistant": "곽나영",
        "assistantHours": "15",
        "location": "동부캠퍼스 1대학관113호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-31",
        "topic": "안전교육·장비 점검·고객상담",
        "instructor": "김선아",
        "hours": "3",
        "assistant": "곽나영",
        "assistantHours": "15",
        "location": "동부캠퍼스 1대학관113호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-08-07",
        "topic": "품종 표준·위그 실습 및 시험 대비",
        "instructor": "김선아",
        "hours": "3",
        "assistant": "곽나영",
        "assistantHours": "15",
        "location": "동부캠퍼스 1대학관113호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-08-14",
        "topic": "도구 관리·용어·기초 시저링",
        "instructor": "김선아",
        "hours": "3",
        "assistant": "곽나영",
        "assistantHours": "15",
        "location": "동부캠퍼스 1대학관113호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-08-21",
        "topic": "목욕·털 자르기·위그 램 클립",
        "instructor": "김선아",
        "hours": "3",
        "assistant": "곽나영",
        "assistantHours": "15",
        "location": "동부캠퍼스 1대학관113호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-08-28",
        "topic": "기본미용·몸 클리핑·응용 스타일",
        "instructor": "김선아",
        "hours": "3",
        "assistant": "곽나영",
        "assistantHours": "15",
        "location": "동부캠퍼스 1대학관113호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-09-04",
        "topic": "안전교육·장비 점검·고객상담",
        "instructor": "김선아",
        "hours": "3",
        "assistant": "곽나영",
        "assistantHours": "15",
        "location": "동부캠퍼스 1대학관113호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-09-11",
        "topic": "품종 표준·위그 실습 및 시험 대비",
        "instructor": "김선아",
        "hours": "3",
        "assistant": "곽나영",
        "assistantHours": "15",
        "location": "동부캠퍼스 1대학관113호",
        "mode": "대면",
        "holiday": ""
      }
    ],
    "instructorRows": [
      {
        "affiliation": "울산퍼스트애견미용학원 강사",
        "position": "교외",
        "name": "김선아",
        "theory": "14",
        "practice": "31"
      }
    ],
    "budgetRows": [
      {
        "category": "내부강사",
        "calculation": "",
        "planned": "30000",
        "spent": "",
        "note": ""
      },
      {
        "category": "외부강사",
        "calculation": "",
        "planned": "1200000",
        "spent": "",
        "note": ""
      },
      {
        "category": "운영비",
        "calculation": "",
        "planned": "300000",
        "spent": "",
        "note": ""
      },
      {
        "category": "재료비",
        "calculation": "",
        "planned": "800000",
        "spent": "",
        "note": ""
      },
      {
        "category": "인쇄비",
        "calculation": "",
        "planned": "200000",
        "spent": "",
        "note": ""
      }
    ],
    "hasResultReport": false,
    "reportPhotos": [],
    "matchingReportFile": "",
    "matchingPlanFile": "2026년 RISE사업 평생직업교육 애견미용사3급양성과정 운영계획서(반려동물 박.md"
  },
  {
    "sourceId": "P14",
    "id": "2026-popup-03",
    "programId": "C1-POPUP-03",
    "title": "인테리어목공 전문시공인력 양성과정",
    "academy": "팝업 아카데미",
    "capacity": 14,
    "teachingHours": 30,
    "facultyCoordinator": "김동욱",
    "startsOn": "2026-09-01",
    "endsOn": "2026-09-29",
    "summary": "인테리어 목공 작업을 위한 안전교육·현치도 작도·부재 제작과 창호를 포함한 제작 연습을 진행하는 실습 과정.",
    "curriculum": "장비사용 안전교육·현치도 작도\n현치도 및 A·B·D·C 부재 연습\n제작연습\n창호 포함 제작연습",
    "location": "2대학관110호",
    "timeLabel": "첫날·마지막 날18:00~21:00 / 중간6일18:00~22:00; 9/24 차시 없음",
    "teachers": "한충목(교내)",
    "assistants": "미기재",
    "supportStaff": "김기범",
    "scheduleRows": [
      {
        "date": "2026-09-01",
        "topic": "장비사용 안전교육·현치도 작도",
        "instructor": "한충목",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관110호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-09-03",
        "topic": "현치도 및 A·B·D·C 부재 연습",
        "instructor": "한충목",
        "hours": "4",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관110호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-09-08",
        "topic": "제작연습",
        "instructor": "한충목",
        "hours": "4",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관110호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-09-10",
        "topic": "창호 포함 제작연습",
        "instructor": "한충목",
        "hours": "4",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관110호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-09-15",
        "topic": "장비사용 안전교육·현치도 작도",
        "instructor": "한충목",
        "hours": "4",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관110호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-09-17",
        "topic": "현치도 및 A·B·D·C 부재 연습",
        "instructor": "한충목",
        "hours": "4",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관110호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-09-22",
        "topic": "제작연습",
        "instructor": "한충목",
        "hours": "4",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관110호",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-09-29",
        "topic": "창호 포함 제작연습",
        "instructor": "한충목",
        "hours": "3",
        "assistant": "",
        "assistantHours": "",
        "location": "2대학관110호",
        "mode": "대면",
        "holiday": ""
      }
    ],
    "instructorRows": [
      {
        "affiliation": "울산과학대학교 실내건축디자인과 전임",
        "position": "교내",
        "name": "한충목",
        "theory": "9",
        "practice": "21"
      }
    ],
    "budgetRows": [
      {
        "category": "내부강사",
        "calculation": "",
        "planned": "30000",
        "spent": "",
        "note": ""
      },
      {
        "category": "외부강사",
        "calculation": "",
        "planned": "1200000",
        "spent": "",
        "note": ""
      },
      {
        "category": "운영비",
        "calculation": "",
        "planned": "300000",
        "spent": "",
        "note": ""
      },
      {
        "category": "재료비",
        "calculation": "",
        "planned": "800000",
        "spent": "",
        "note": ""
      },
      {
        "category": "인쇄비",
        "calculation": "",
        "planned": "200000",
        "spent": "",
        "note": ""
      }
    ],
    "hasResultReport": false,
    "reportPhotos": [],
    "matchingReportFile": "",
    "matchingPlanFile": "2026년 RISE사업 평생직업교육 인테리어목공전문시공인력양성과정 운영계획.md"
  },
  {
    "sourceId": "P15",
    "id": "2026-p15",
    "programId": "C1-RISE-P15",
    "title": "질문 소통 퍼실리테이터(2급) 양성 과정",
    "academy": "팝업 아카데미",
    "capacity": 20,
    "teachingHours": 24,
    "facultyCoordinator": "현용환",
    "startsOn": "2026-05-28",
    "endsOn": "2026-07-16",
    "summary": "지역사회 소통 파트너를 양성하기 위해 질문·경청·의제 분석·의사결정·갈등조율을 실습하고 토론회 스크립트와 촉진 시뮬레이션을 수행하는 과정.",
    "curriculum": "연결의 시작·퍼실리테이터 역할\n공감적 경청\n핵심 질문 디자인\n아이디어 발산·브레인스토밍\n지역 현안 분석·로직 트리\n합의·의사결정\n갈등 조율\n지역 토론회 스크립트·실전 시뮬레이션",
    "location": "화정가족문화센터",
    "timeLabel": "목10:00~13:00, 8회",
    "teachers": "정영은(교외)",
    "assistants": "진경선(교외)",
    "supportStaff": "미기재",
    "scheduleRows": [
      {
        "date": "2026-05-28",
        "topic": "연결의 시작·퍼실리테이터 역할",
        "instructor": "정영은",
        "hours": "3",
        "assistant": "진경선",
        "assistantHours": "24",
        "location": "화정가족문화센터",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-06-04",
        "topic": "공감적 경청",
        "instructor": "정영은",
        "hours": "3",
        "assistant": "진경선",
        "assistantHours": "24",
        "location": "화정가족문화센터",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-06-11",
        "topic": "핵심 질문 디자인",
        "instructor": "정영은",
        "hours": "3",
        "assistant": "진경선",
        "assistantHours": "24",
        "location": "화정가족문화센터",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-06-18",
        "topic": "아이디어 발산·브레인스토밍",
        "instructor": "정영은",
        "hours": "3",
        "assistant": "진경선",
        "assistantHours": "24",
        "location": "화정가족문화센터",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-06-25",
        "topic": "지역 현안 분석·로직 트리",
        "instructor": "정영은",
        "hours": "3",
        "assistant": "진경선",
        "assistantHours": "24",
        "location": "화정가족문화센터",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-02",
        "topic": "합의·의사결정",
        "instructor": "정영은",
        "hours": "3",
        "assistant": "진경선",
        "assistantHours": "24",
        "location": "화정가족문화센터",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-09",
        "topic": "갈등 조율",
        "instructor": "정영은",
        "hours": "3",
        "assistant": "진경선",
        "assistantHours": "24",
        "location": "화정가족문화센터",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-16",
        "topic": "지역 토론회 스크립트·실전 시뮬레이션",
        "instructor": "정영은",
        "hours": "3",
        "assistant": "진경선",
        "assistantHours": "24",
        "location": "화정가족문화센터",
        "mode": "대면",
        "holiday": ""
      }
    ],
    "instructorRows": [
      {
        "affiliation": "엠토리움 더 질문 대표",
        "position": "교외",
        "name": "정영은",
        "theory": "7",
        "practice": "17"
      }
    ],
    "budgetRows": [
      {
        "category": "내부강사",
        "calculation": "",
        "planned": "30000",
        "spent": "",
        "note": ""
      },
      {
        "category": "외부강사",
        "calculation": "",
        "planned": "1200000",
        "spent": "",
        "note": ""
      },
      {
        "category": "운영비",
        "calculation": "",
        "planned": "300000",
        "spent": "",
        "note": ""
      },
      {
        "category": "재료비",
        "calculation": "",
        "planned": "800000",
        "spent": "",
        "note": ""
      },
      {
        "category": "인쇄비",
        "calculation": "",
        "planned": "200000",
        "spent": "",
        "note": ""
      }
    ],
    "hasResultReport": true,
    "reportPhotos": [
      {
        "caption": "개강식",
        "date": "2026-05-28",
        "fileName": "01_개강식_20260528.png",
        "relativePath": "images/1. 2026년 앵커사업 질문소통퍼실리테이터2급양성과정 운영결과보고서/01_개강식_20260528.png"
      },
      {
        "caption": "수료식",
        "date": "2026-07-16",
        "fileName": "02_수료식_20260716.png",
        "relativePath": "images/1. 2026년 앵커사업 질문소통퍼실리테이터2급양성과정 운영결과보고서/02_수료식_20260716.png"
      },
      {
        "caption": "운영사진1",
        "date": "2026-06-04",
        "fileName": "03_운영사진1_20260604.png",
        "relativePath": "images/1. 2026년 앵커사업 질문소통퍼실리테이터2급양성과정 운영결과보고서/03_운영사진1_20260604.png"
      },
      {
        "caption": "운영사진2",
        "date": "2026-06-18",
        "fileName": "04_운영사진2_20260618.png",
        "relativePath": "images/1. 2026년 앵커사업 질문소통퍼실리테이터2급양성과정 운영결과보고서/04_운영사진2_20260618.png"
      },
      {
        "caption": "운영사진3",
        "date": "2026-07-02",
        "fileName": "05_운영사진3_20260702.png",
        "relativePath": "images/1. 2026년 앵커사업 질문소통퍼실리테이터2급양성과정 운영결과보고서/05_운영사진3_20260702.png"
      },
      {
        "caption": "운영사진4",
        "date": "2026-07-09",
        "fileName": "06_운영사진4_20260709.png",
        "relativePath": "images/1. 2026년 앵커사업 질문소통퍼실리테이터2급양성과정 운영결과보고서/06_운영사진4_20260709.png"
      }
    ],
    "matchingReportFile": "1. 2026년 앵커사업 질문소통퍼실리테이터2급양성과정 운영결과보고서.md",
    "matchingPlanFile": "2026년 RISE사업 평생직업교육 질문소통퍼실리테이터양성과정 운영계획서(정영.md"
  },
  {
    "sourceId": "P16",
    "id": "2026-life-care-05",
    "programId": "C1-LIFE-CARE-05",
    "title": "파크골프지도사(자격증) 양성과정",
    "academy": "라이프케어 아카데미",
    "capacity": 20,
    "teachingHours": 35,
    "facultyCoordinator": "서봉한",
    "startsOn": "2026-07-14",
    "endsOn": "2026-07-24",
    "summary": "파크골프 장비·코스·규정·에티켓과 스윙·퍼팅·라운딩을 학습하고 안전교육·스포츠인권·실기평가를 진행하는 지도자 과정.",
    "curriculum": "파크골프 이해·장비·코스·에티켓·규정\n그립·스탠스·기본스윙\n응급처치 및 상해 관련 교육\n스윙·티샷·어프로치·퍼팅\n스포츠인권\n라운딩·스코어 작성·실기평가",
    "location": "G-110 스포츠재활실습실·인조축구장·지역 파크골프장",
    "timeLabel": "7/14~16 09:00~18:00(교육8시간), 7/20 10:00~12:00·14:00~18:00, 7/21 13:00~18:00",
    "teachers": "서봉한(교내), 조경호(교외)",
    "assistants": "우철호(교외)",
    "supportStaff": "미기재",
    "scheduleRows": [
      {
        "date": "2026-07-14",
        "topic": "파크골프 이해·장비·코스·에티켓·규정",
        "instructor": "서봉한",
        "hours": "8",
        "assistant": "우철호",
        "assistantHours": "22",
        "location": "G-110 스포츠재활실습실·인조축구장·지역 파크골프장",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-15",
        "topic": "그립·스탠스·기본스윙",
        "instructor": "서봉한",
        "hours": "8",
        "assistant": "우철호",
        "assistantHours": "22",
        "location": "G-110 스포츠재활실습실·인조축구장·지역 파크골프장",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-16",
        "topic": "응급처치 및 상해 관련 교육",
        "instructor": "서봉한",
        "hours": "8",
        "assistant": "우철호",
        "assistantHours": "22",
        "location": "G-110 스포츠재활실습실·인조축구장·지역 파크골프장",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-20",
        "topic": "스윙·티샷·어프로치·퍼팅",
        "instructor": "서봉한",
        "hours": "6",
        "assistant": "우철호",
        "assistantHours": "22",
        "location": "G-110 스포츠재활실습실·인조축구장·지역 파크골프장",
        "mode": "대면",
        "holiday": ""
      },
      {
        "date": "2026-07-21",
        "topic": "스포츠인권",
        "instructor": "서봉한",
        "hours": "5",
        "assistant": "우철호",
        "assistantHours": "22",
        "location": "G-110 스포츠재활실습실·인조축구장·지역 파크골프장",
        "mode": "대면",
        "holiday": ""
      }
    ],
    "instructorRows": [
      {
        "affiliation": "울산과학대학교 스포츠재활학부 전임",
        "position": "교내",
        "name": "서봉한",
        "theory": "2",
        "practice": "4"
      },
      {
        "affiliation": "K-스포츠재활운동과학연구소 대표",
        "position": "교외",
        "name": "조경호",
        "theory": "9",
        "practice": "20"
      }
    ],
    "budgetRows": [
      {
        "category": "내부강사",
        "calculation": "",
        "planned": "30000",
        "spent": "",
        "note": ""
      },
      {
        "category": "외부강사",
        "calculation": "",
        "planned": "1200000",
        "spent": "",
        "note": ""
      },
      {
        "category": "운영비",
        "calculation": "",
        "planned": "300000",
        "spent": "",
        "note": ""
      },
      {
        "category": "재료비",
        "calculation": "",
        "planned": "800000",
        "spent": "",
        "note": ""
      },
      {
        "category": "인쇄비",
        "calculation": "",
        "planned": "200000",
        "spent": "",
        "note": ""
      }
    ],
    "hasResultReport": true,
    "reportPhotos": [
      {
        "caption": "개강식",
        "date": "2026-07-14",
        "fileName": "01_개강식_20260714.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/01_개강식_20260714.png"
      },
      {
        "caption": "수료식",
        "date": "2026-07-21",
        "fileName": "02_수료식_20260721.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/02_수료식_20260721.png"
      },
      {
        "caption": "운영사진1",
        "date": "2026-07-14",
        "fileName": "03_운영사진1_20260714.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/03_운영사진1_20260714.png"
      },
      {
        "caption": "운영사진2",
        "date": "2026-07-14",
        "fileName": "04_운영사진2_20260714.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/04_운영사진2_20260714.png"
      },
      {
        "caption": "운영사진3",
        "date": "2026-07-14",
        "fileName": "05_운영사진3_20260714.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/05_운영사진3_20260714.png"
      },
      {
        "caption": "운영사진4",
        "date": "2026-07-14",
        "fileName": "06_운영사진4_20260714.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/06_운영사진4_20260714.png"
      },
      {
        "caption": "운영사진5",
        "date": "2026-07-15",
        "fileName": "07_운영사진5_20260715.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/07_운영사진5_20260715.png"
      },
      {
        "caption": "운영사진6",
        "date": "2026-07-15",
        "fileName": "08_운영사진6_20260715.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/08_운영사진6_20260715.png"
      },
      {
        "caption": "운영사진7",
        "date": "2026-07-15",
        "fileName": "09_운영사진7_20260715.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/09_운영사진7_20260715.png"
      },
      {
        "caption": "운영사진8",
        "date": "2026-07-15",
        "fileName": "10_운영사진8_20260715.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/10_운영사진8_20260715.png"
      },
      {
        "caption": "운영사진9",
        "date": "2026-07-16",
        "fileName": "11_운영사진9_20260716.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/11_운영사진9_20260716.png"
      },
      {
        "caption": "운영사진10",
        "date": "2026-07-16",
        "fileName": "12_운영사진10_20260716.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/12_운영사진10_20260716.png"
      },
      {
        "caption": "운영사진11",
        "date": "2026-07-16",
        "fileName": "13_운영사진11_20260716.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/13_운영사진11_20260716.png"
      },
      {
        "caption": "운영사진12",
        "date": "2026-07-16",
        "fileName": "14_운영사진12_20260716.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/14_운영사진12_20260716.png"
      },
      {
        "caption": "운영사진13",
        "date": "2026-07-20",
        "fileName": "15_운영사진13_20260720.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/15_운영사진13_20260720.png"
      },
      {
        "caption": "운영사진14",
        "date": "2026-07-20",
        "fileName": "16_운영사진14_20260720.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/16_운영사진14_20260720.png"
      },
      {
        "caption": "운영사진15",
        "date": "2026-07-20",
        "fileName": "17_운영사진15_20260720.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/17_운영사진15_20260720.png"
      },
      {
        "caption": "운영사진16",
        "date": "2026-07-20",
        "fileName": "18_운영사진16_20260720.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/18_운영사진16_20260720.png"
      },
      {
        "caption": "운영사진17",
        "date": "2026-07-20",
        "fileName": "19_운영사진17_20260720.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/19_운영사진17_20260720.png"
      },
      {
        "caption": "운영사진18",
        "date": "2026-07-20",
        "fileName": "20_운영사진18_20260720.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/20_운영사진18_20260720.png"
      },
      {
        "caption": "운영사진19",
        "date": "2026-07-21",
        "fileName": "21_운영사진19_20260721.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/21_운영사진19_20260721.png"
      },
      {
        "caption": "운영사진20",
        "date": "2026-07-21",
        "fileName": "22_운영사진20_20260721.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/22_운영사진20_20260721.png"
      },
      {
        "caption": "운영사진21",
        "date": "2026-07-21",
        "fileName": "23_운영사진21_20260721.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/23_운영사진21_20260721.png"
      },
      {
        "caption": "운영사진22",
        "date": "2026-07-21",
        "fileName": "24_운영사진22_20260721.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/24_운영사진22_20260721.png"
      },
      {
        "caption": "운영사진23",
        "date": "2026-07-21",
        "fileName": "25_운영사진23_20260721.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/25_운영사진23_20260721.png"
      },
      {
        "caption": "운영사진24",
        "date": "2026-07-21",
        "fileName": "26_운영사진24_20260721.png",
        "relativePath": "images/1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고/26_운영사진24_20260721.png"
      }
    ],
    "matchingReportFile": "1. [앵커-C1-S3T4-2](라이프케어)2026년 파크골프지도사양성과정 결과보고.md",
    "matchingPlanFile": "2026년 RISE사업 평생직업교육 파크골프지도사(자격증) 양성과정 운영계획서(스포츠.md"
  }
];

/**
 * 원문 추출 행을 현재 운영문서 스키마에 맞춘다.
 *
 * Antigravity 추출본에는 날짜와 교육시간만 있고 시작·종료시간 열이 없었다.
 * 빈 시간은 저장 가능한 초안 값으로 유지하며, 책임강사가 원문을 확인해
 * 입력하기 전에는 최종 제출 검증을 통과하지 않는다.
 */
export const PREFILLED_COURSES: PrefilledCourse[] = RAW_PREFILLED_COURSES.map(
  (course) => ({
    ...course,
    scheduleRows: course.scheduleRows.map((row) => ({
      ...row,
      startTime: row.startTime ?? "",
      endTime: row.endTime ?? "",
    })),
  }),
);

/**
 * 과정 ID 또는 소스 ID(P01~P16) 또는 과정명으로 사전 채움 과정 정보 조회
 */
export function findPrefilledCourse(identifier: string): PrefilledCourse | undefined {
  if (!identifier) return undefined;
  const norm = identifier.trim().toLowerCase();
  const clean = (value: string) =>
    value.toLowerCase().replace(/[^\w가-힣]/g, "").replace(/자격증/g, "");
  const cleanNorm = clean(norm);
  return PREFILLED_COURSES.find(
    (c) =>
      c.id.toLowerCase() === norm ||
      c.sourceId.toLowerCase() === norm ||
      c.programId.toLowerCase() === norm ||
      clean(c.title).includes(cleanNorm) ||
      cleanNorm.includes(clean(c.title)),
  );
}
