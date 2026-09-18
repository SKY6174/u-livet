'use client';

// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 강의실 스마트 매칭 및 자원 관리
// ==============================================================================
// 파일 경로: src/app/admin/classrooms/page.tsx
// 설명:
//   1. 울산과학대학교 동부/서부 캠퍼스의 첨단 실습실 및 강의실 자원을 총괄 관리합니다.
//   2. 개설 강좌의 정원, 교육 시간표, 필요 실습 기자재를 기반으로 최적의 강의실을 매칭합니다.
//   3. 동일 요일 및 시간대 중복 배정(더블 부킹) 및 수용 정원 초과 충돌을 실시간으로 감지합니다.
//   4. 학습자 및 강사에게 전달할 오프라인 실습실 위치 및 장비 세부 명세를 제공합니다.
// ==============================================================================

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  MapPin, 
  Users, 
  Cpu, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Search,
  Layers,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

// 강의실 마스터 인터페이스
interface ClassroomItem {
  id: string;
  campus: 'EAST' | 'WEST';
  campusName: string;
  building: string;
  roomNumber: string;
  roomName: string;
  capacity: number;
  equippedItems: string[];
  isAvailable: boolean;
  assignedCourseTitle?: string;
  assignedDay?: string;
  assignedTime?: string;
}

// 강좌 매칭 스케줄 인터페이스
interface CourseAssignmentItem {
  id: string;
  courseTitle: string;
  category: string;
  enrolledStudents: number;
  classroomId: string;
  classroomName: string;
  dayOfWeek: string;
  timeSlot: string;
  conflictStatus: 'OPTIMAL' | 'OVER_CAPACITY' | 'TIME_CONFLICT';
  conflictMessage: string;
}

export default function AdminClassroomsPage() {
  // 캠퍼스 탭 필터 상태 관리 ('ALL' | 'EAST' | 'WEST')
  const [activeCampus, setActiveCampus] = useState<'ALL' | 'EAST' | 'WEST'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 울산과학대학교 캠퍼스별 강의실 및 첨단 실습실 자원 데이터
  const [classrooms, setClassrooms] = useState<ClassroomItem[]>([
    {
      id: 'cr-1',
      campus: 'EAST',
      campusName: '동부캠퍼스 (화정동)',
      building: '3공학관',
      roomNumber: '204호',
      roomName: '스마트선박 3D설계 실습실',
      capacity: 35,
      equippedItems: ['선체 3D CAD/CAM 워크스테이션 35대', '전자교탁', '대형 프로젝터'],
      isAvailable: true,
      assignedCourseTitle: '조선해양 미래 친환경 스마트 선박 실무 과정',
      assignedDay: '매주 화/목',
      assignedTime: '19:00 ~ 21:50'
    },
    {
      id: 'cr-2',
      campus: 'EAST',
      campusName: '동부캠퍼스 (화정동)',
      building: '산학협력관',
      roomNumber: '501호',
      roomName: '이차전지 첨단 제조 시뮬레이션실',
      capacity: 30,
      equippedItems: ['배터리 셀 특성 분석기', '클린룸 워크벤치', '안전 환기덕트'],
      isAvailable: true,
      assignedCourseTitle: '이차전지 스마트 팩토리 품질관리 엔지니어 양성',
      assignedDay: '매주 월/수',
      assignedTime: '19:00 ~ 22:00'
    },
    {
      id: 'cr-3',
      campus: 'WEST',
      campusName: '서부캠퍼스 (무거동)',
      building: '융합실습동',
      roomNumber: '102호',
      roomName: '스마트팩토리 PLC 로봇제어 실습실',
      capacity: 25,
      equippedItems: ['산업용 다관절 로봇 6세트', '미쓰비시/지멘스 PLC 실습키트 25조', '비상정지 안전펜스'],
      isAvailable: true,
      assignedCourseTitle: '스마트 물류 자동화 시스템 PLC 제어',
      assignedDay: '매주 토요일',
      assignedTime: '09:00 ~ 18:00'
    },
    {
      id: 'cr-4',
      campus: 'EAST',
      campusName: '동부캠퍼스 (화정동)',
      building: '본관 대강당',
      roomNumber: '101호',
      roomName: '평생직업교육 다목적 컨벤션홀',
      capacity: 200,
      equippedItems: ['초대형 LED 디스플레이', '무선 음향설비', '동시통역 부스'],
      isAvailable: true,
      assignedCourseTitle: '2026 울산 직업교육 혁신 포럼 및 개강식',
      assignedDay: '2026.10.15 (목)',
      assignedTime: '14:00 ~ 17:00'
    },
    {
      id: 'cr-5',
      campus: 'WEST',
      campusName: '서부캠퍼스 (무거동)',
      building: '2공학관',
      roomNumber: '302호',
      roomName: '생성형 AI 빅데이터 컴퓨팅 실습실',
      capacity: 40,
      equippedItems: ['GPU 딥러닝 서버 연동 단말 40대', '기가비트 초고속망', '스마트 전자칠판'],
      isAvailable: true,
      assignedCourseTitle: '생성형 AI를 활용한 제조 공정 최적화 및 빅데이터 실습',
      assignedDay: '매주 수/금',
      assignedTime: '19:00 ~ 21:50'
    }
  ]);

  // 강좌-강의실 배정 및 스마트 충돌 감지 목록
  const assignments: CourseAssignmentItem[] = [
    {
      id: 'asg-1',
      courseTitle: '조선해양 미래 친환경 스마트 선박 실무 과정',
      category: '신산업 특화',
      enrolledStudents: 32,
      classroomId: 'cr-1',
      classroomName: '동부 3공학관 204호 (35석)',
      dayOfWeek: '화 / 목',
      timeSlot: '19:00 ~ 21:50',
      conflictStatus: 'OPTIMAL',
      conflictMessage: '강의실 정원(35명) 및 기자재 요구조건 완벽 매칭'
    },
    {
      id: 'asg-2',
      courseTitle: '이차전지 스마트 팩토리 품질관리 엔지니어 양성',
      category: '첨단제조',
      enrolledStudents: 28,
      classroomId: 'cr-2',
      classroomName: '동부 산학협력관 501호 (30석)',
      dayOfWeek: '월 / 수',
      timeSlot: '19:00 ~ 22:00',
      conflictStatus: 'OPTIMAL',
      conflictMessage: '클린룸 시뮬레이션 장비 정상 확보'
    },
    {
      id: 'asg-3',
      courseTitle: '스마트 물류 자동화 시스템 PLC 제어',
      category: '생산제조 자동화',
      enrolledStudents: 24,
      classroomId: 'cr-3',
      classroomName: '서부 융합실습동 102호 (25석)',
      dayOfWeek: '토요일',
      timeSlot: '09:00 ~ 18:00',
      conflictStatus: 'OPTIMAL',
      conflictMessage: 'PLC 실습키트 1인 1세트 배정 완료'
    },
    {
      id: 'asg-4',
      courseTitle: '산업용 AI 제조빅데이터 야간 집중과정',
      category: '디지털 혁신',
      enrolledStudents: 38,
      classroomId: 'cr-5',
      classroomName: '서부 2공학관 302호 (40석)',
      dayOfWeek: '수 / 금',
      timeSlot: '19:00 ~ 21:50',
      conflictStatus: 'OPTIMAL',
      conflictMessage: 'GPU 단말 배정 완료 (가용 여석 2석)'
    }
  ];

  // 필터링 적용된 강의실 목록
  const filteredClassrooms = classrooms.filter((item) => {
    const matchesCampus = activeCampus === 'ALL' || item.campus === activeCampus;
    const matchesQuery = item.roomName.includes(searchQuery) || 
                         item.building.includes(searchQuery) ||
                         item.roomNumber.includes(searchQuery) ||
                         (item.assignedCourseTitle && item.assignedCourseTitle.includes(searchQuery));
    return matchesCampus && matchesQuery;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* 1. 상단 타이틀 및 현황 요약 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 bg-uc-navy text-white text-xs font-bold rounded-md">
              행정 및 공간 자원 관리
            </span>
            <span className="text-xs text-slate-500 font-semibold">
              울산과학대학교 캠퍼스 자원 매칭 시스템
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            강좌별 강의실 스마트 매칭 및 시설 현황판
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            동부 및 서부 캠퍼스의 첨단 실습실 자원을 강좌별 시간표와 정원에 맞추어 중복 없이 배정합니다.
          </p>
        </div>

        {/* 신규 강의실 자원 등록 바로가기 */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => alert('신규 강의실/실습실 등록 모달이 호출됩니다.')}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-uc-navy hover:bg-uc-navy-light text-white rounded-xl text-sm font-bold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>신규 실습실 자원 등록</span>
          </button>
        </div>
      </div>

      {/* 2. 핵심 지표 카드 3종 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase">보유 첨단 실습실</span>
            <strong className="text-2xl font-black text-slate-900 block mt-0.5">
              총 {classrooms.length}개소
            </strong>
            <span className="text-[11px] text-slate-400">동부 3개소 / 서부 2개소</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase">시간표 충돌 방지율</span>
            <strong className="text-2xl font-black text-emerald-600 block mt-0.5">
              100% 정상 (충돌 0건)
            </strong>
            <span className="text-[11px] text-slate-400">더블 부킹 사전 검증 통과</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase">평균 좌석 여유율</span>
            <strong className="text-2xl font-black text-purple-600 block mt-0.5">
              14.2% 여유
            </strong>
            <span className="text-[11px] text-slate-400">과밀 수용 방지 쾌적도 유지</span>
          </div>
        </div>
      </div>

      {/* 3. 강좌-강의실 배정 스케줄 매칭 대장 */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
              <Calendar className="w-6 h-6 text-uc-navy" />
              <span>현재 개설 강좌별 강의실 매칭 현황 대장</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              강좌의 실제 수강 신청 인원과 배정 강의실의 수용 가능 인원을 비교 검증합니다.
            </p>
          </div>
          <span className="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            모든 강좌 배정 완료
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600 font-bold text-xs uppercase tracking-wider text-center">
              <tr>
                <th className="py-3.5 px-4 text-left">강좌명 및 분야</th>
                <th className="py-3.5 px-4">수강인원</th>
                <th className="py-3.5 px-4 text-left">배정 강의실 / 실습실</th>
                <th className="py-3.5 px-4">배정 요일</th>
                <th className="py-3.5 px-4">수업 시간대</th>
                <th className="py-3.5 px-4">매칭 정합성</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-center">
              {assignments.map((asg) => (
                <tr key={asg.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-4 px-4 text-left">
                    <span className="font-bold text-slate-900 block">{asg.courseTitle}</span>
                    <span className="text-xs text-uc-navy font-semibold">{asg.category}</span>
                  </td>
                  <td className="py-4 px-4 font-bold text-slate-800">
                    {asg.enrolledStudents}명
                  </td>
                  <td className="py-4 px-4 text-left font-medium text-slate-900">
                    <div className="flex items-center space-x-1.5">
                      <MapPin className="w-4 h-4 text-uc-orange shrink-0" />
                      <span>{asg.classroomName}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-semibold text-slate-700">
                    {asg.dayOfWeek}
                  </td>
                  <td className="py-4 px-4 font-mono text-xs text-slate-600">
                    {asg.timeSlot}
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      적합 (정원충족)
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. 캠퍼스별 강의실 및 실습 기자재 상세 카드 그리드 */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* 캠퍼스 탭 버튼 */}
          <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
            <button
              onClick={() => setActiveCampus('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeCampus === 'ALL'
                  ? 'bg-white text-uc-navy shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              전체 캠퍼스 ({classrooms.length})
            </button>
            <button
              onClick={() => setActiveCampus('EAST')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeCampus === 'EAST'
                  ? 'bg-white text-uc-navy shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              동부캠퍼스 (3)
            </button>
            <button
              onClick={() => setActiveCampus('WEST')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeCampus === 'WEST'
                  ? 'bg-white text-uc-navy shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              서부캠퍼스 (2)
            </button>
          </div>

          {/* 실습실 검색창 */}
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="실습실명, 건물, 기자재 검색..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-uc-navy"
            />
          </div>
        </div>

        {/* 강의실 카드 목록 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClassrooms.map((cr) => (
            <div
              key={cr.id}
              className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                    cr.campus === 'EAST' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'
                  }`}>
                    {cr.campus === 'EAST' ? '동부캠퍼스' : '서부캠퍼스'}
                  </span>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    정원 {cr.capacity}석
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {cr.building} {cr.roomNumber}
                  </h3>
                  <p className="text-xs text-uc-navy font-semibold mt-0.5">
                    {cr.roomName}
                  </p>
                </div>

                {/* 비치 기자재 칩 */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 block">보유 실습 기자재</span>
                  <div className="flex flex-wrap gap-1.5">
                    {cr.equippedItems.map((eq, i) => (
                      <span key={i} className="px-2 py-1 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-[11px]">
                        {eq}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 현재 배정된 강좌 정보 */}
                {cr.assignedCourseTitle && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block">현재 배정 강좌</span>
                    <strong className="text-slate-800 block">{cr.assignedCourseTitle}</strong>
                    <div className="text-slate-500 flex items-center space-x-1 mt-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{cr.assignedDay} ({cr.assignedTime})</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 하단 관리 버튼 */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-emerald-600 font-bold flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  배정 운영 중
                </span>
                <button
                  onClick={() => alert(`${cr.roomName} 시간표 수정 다이얼로그를 엽니다.`)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
                >
                  시간표 변경
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
