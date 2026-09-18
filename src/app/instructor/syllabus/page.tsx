'use client';

// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 신규 강좌 제안 및 강의계획서 작성
// ==============================================================================
// 파일 경로: src/app/instructor/syllabus/page.tsx
// 설명:
//   승인된 산업체 전문가 강사가 본인의 실무 노하우를 기반으로 신규 강좌를 기획하고,
//   주차별 실습 계획, 소요 기자재, 평가 기준을 작성하여 사업단에 제출하는 화면입니다.
// ==============================================================================

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  FileText, 
  Award, 
  Send, 
  CheckCircle2, 
  Sparkles,
  BookOpen
} from 'lucide-react';

interface SyllabusWeek {
  id: number;
  week: number;
  title: string;
  content: string;
  equipment: string;
  hours: number;
}

export default function InstructorSyllabusPage() {
  // 강좌 기본 정보 상태
  const [courseInfo, setCourseInfo] = useState({
    title: '친환경 수소선박 연료전지 파워팩 설계 및 안전운항 실무',
    category: '조선·해양',
    course_type: 'BLENDED',
    total_hours: 45,
    capacity: 20,
    target_audience: '울산 조선해양 기자재 기업 엔지니어 및 기계/전기 전공 졸업생',
    overview: '국제해사기구(IMO) 탄소배출 규제 강화에 대응하여 친환경 수소 연료전지 시스템의 기본 구조와 현장 안전운항 실무 기술을 다룹니다.',
    min_attendance: 80,
    assignment_weight: 40,
    quiz_weight: 20,
  });

  // 주차별 계획 목록 상태 (동적 추가/삭제)
  const [weeks, setWeeks] = useState<SyllabusWeek[]>([
    {
      id: 1,
      week: 1,
      title: '수소 에너지 및 선박용 연료전지 시스템의 이해',
      content: 'PEMFC 및 SOFC 기본 원리, 해상 환경 특성 분석',
      equipment: '이러닝 영상 및 수소선박 도면',
      hours: 6,
    },
    {
      id: 2,
      week: 2,
      title: '고압 수소 저장 탱크 및 배관 밸브 안전 설계 실습',
      content: '방폭 규정, 가스 감지기 배치, 3D CAD 배관 라우팅',
      equipment: '스마트선박 실습실 CAD SW',
      hours: 9,
    },
    {
      id: 3,
      week: 3,
      title: '연료전지 하이브리드 전력제어 PMS 시뮬레이션',
      content: '배터리-연료전지 부하 분담 제어 알고리즘 실습',
      equipment: '전력변환 시뮬레이터 툴',
      hours: 9,
    },
  ]);

  const [isSubmitted, setIsSubmitted] = useState(false);

  // 주차 추가 핸들러
  const handleAddWeek = () => {
    const nextWeekNo = weeks.length + 1;
    setWeeks((prev) => [
      ...prev,
      {
        id: Date.now(),
        week: nextWeekNo,
        title: '',
        content: '',
        equipment: '',
        hours: 6,
      },
    ]);
  };

  // 주차 삭제 핸들러
  const handleRemoveWeek = (id: number) => {
    if (weeks.length <= 1) {
      alert('최소 1개 이상의 주차 계획이 필요합니다.');
      return;
    }
    setWeeks((prev) => prev.filter((w) => w.id !== id).map((w, idx) => ({ ...w, week: idx + 1 })));
  };

  // 주차 내용 변경 핸들러
  const handleWeekChange = (id: number, field: keyof SyllabusWeek, value: string | number) => {
    setWeeks((prev) =>
      prev.map((w) => (w.id === id ? { ...w, [field]: value } : w))
    );
  };

  // 제출 핸들러
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseInfo.title.trim()) {
      alert('강좌명을 입력해 주세요.');
      return;
    }
    setIsSubmitted(true);
  };

  return (
    <div className="bg-slate-50 min-h-screen py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* 상단 뒤로가기 */}
        <Link
          href="/instructor"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-uc-navy transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>강사 풀 메인으로 돌아가기</span>
        </Link>

        {/* 1. 상단 배너 */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-2">
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-uc-orange bg-orange-50 px-3 py-1 rounded-full">
            <Sparkles className="w-3.5 h-3.5" />
            <span>산업체 맞춤형 직무교육 제안</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-uc-navy">
            신규 강좌 제안 및 강의계획서(Syllabus) 제출
          </h1>
          <p className="text-sm text-slate-600">
            제출된 강의계획서는 앵커사업단 운영위원회의 직무 적합성 심사를 거쳐 
            정규 개설 및 수강생 모집이 진행됩니다.
          </p>
        </div>

        {/* 2. 제출 완료 화면 */}
        {isSubmitted ? (
          <div className="bg-white rounded-3xl p-10 border border-slate-200 shadow-md text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">
                강의계획서가 성공적으로 제출되었습니다!
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                사업단 담당 연구원이 내용을 검토한 후, 보완 요청 또는 개설 확정 결과를 안내해 드립니다.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/admin/instructors"
                className="px-6 py-3 bg-uc-navy text-white rounded-xl font-bold text-sm shadow hover:bg-uc-navy-light transition"
              >
                사업단 심사 현황(운영자 뷰) 확인하기
              </Link>
            </div>
          </div>
        ) : (
          /* 3. 강의계획서 작성 폼 */
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-sm space-y-8">
            {/* 기본 정보 */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-uc-blue" />
                <span>1. 강좌 기본 개요</span>
              </h3>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">제안 강좌명 *</label>
                <input
                  type="text"
                  value={courseInfo.title}
                  onChange={(e) => setCourseInfo({ ...courseInfo, title: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-blue font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">산업분야 카테고리 *</label>
                  <select
                    value={courseInfo.category}
                    onChange={(e) => setCourseInfo({ ...courseInfo, category: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-blue"
                  >
                    <option value="조선·해양">조선·해양산업</option>
                    <option value="미래모빌리티">친환경 미래모빌리티</option>
                    <option value="이차전지·신소재">이차전지·신소재</option>
                    <option value="디지털·스마트제조">디지털·스마트제조 AI</option>
                    <option value="직무소양·교양">공통 직무소양</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">교육 진행 방식 *</label>
                  <select
                    value={courseInfo.course_type}
                    onChange={(e) => setCourseInfo({ ...courseInfo, course_type: e.target.value as any })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-blue"
                  >
                    <option value="OFFLINE">대면 집합실습 (OFFLINE)</option>
                    <option value="ONLINE">원격 이러닝 (ONLINE)</option>
                    <option value="BLENDED">혼합형 (BLENDED)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">총 교육시수 (시간) *</label>
                  <input
                    type="number"
                    value={courseInfo.total_hours}
                    onChange={(e) => setCourseInfo({ ...courseInfo, total_hours: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">주요 교육 대상 *</label>
                <input
                  type="text"
                  value={courseInfo.target_audience}
                  onChange={(e) => setCourseInfo({ ...courseInfo, target_audience: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">강좌 개요 및 교육 목표 *</label>
                <textarea
                  rows={3}
                  value={courseInfo.overview}
                  onChange={(e) => setCourseInfo({ ...courseInfo, overview: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-uc-blue leading-relaxed"
                />
              </div>
            </div>

            {/* 주차별 실습 계획서 (동적 행) */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-uc-blue" />
                  <span>2. 주차별 실습 및 강의 계획 (Syllabus)</span>
                </h3>
                <button
                  type="button"
                  onClick={handleAddWeek}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>주차 추가</span>
                </button>
              </div>

              <div className="space-y-4">
                {weeks.map((item) => (
                  <div key={item.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 relative">
                    <div className="flex justify-between items-center">
                      <span className="w-8 h-8 rounded-lg bg-uc-navy text-white text-xs font-bold flex items-center justify-center">
                        {item.week}주
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveWeek(item.id)}
                        className="text-slate-400 hover:text-rose-600 transition p-1"
                        title="주차 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">차시 주제</label>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => handleWeekChange(item.id, 'title', e.target.value)}
                          placeholder="예: 3D 블록 모델링 및 부재 간섭 검사 실습"
                          required
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-uc-blue"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">교육 시수</label>
                        <input
                          type="number"
                          value={item.hours}
                          onChange={(e) => handleWeekChange(item.id, 'hours', Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-uc-blue"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">세부 실습 내용</label>
                        <input
                          type="text"
                          value={item.content}
                          onChange={(e) => handleWeekChange(item.id, 'content', e.target.value)}
                          placeholder="실제 실습 진행 내용 요약"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-uc-blue"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">필요 기자재 및 SW</label>
                        <input
                          type="text"
                          value={item.equipment}
                          onChange={(e) => handleWeekChange(item.id, 'equipment', e.target.value)}
                          placeholder="예: 선박CAD 라이선스, 3D 스캐너 등"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-uc-blue"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 수료 평가 기준 설정 */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center space-x-2">
                <Award className="w-5 h-5 text-uc-orange" />
                <span>3. 수료 평가 기준 설정</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-1">최소 출석률 요건</span>
                  <strong className="text-base text-uc-navy">80% 이상 필수</strong>
                  <p className="text-[11px] text-slate-500 mt-1">대학 및 국비 규정상 고정값입니다.</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-1">실습 과제 배점 비율 (%)</span>
                  <input
                    type="number"
                    value={courseInfo.assignment_weight}
                    onChange={(e) => setCourseInfo({ ...courseInfo, assignment_weight: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs mt-1"
                  />
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-1">형성평가/시험 배점 비율 (%)</span>
                  <input
                    type="number"
                    value={courseInfo.quiz_weight}
                    onChange={(e) => setCourseInfo({ ...courseInfo, quiz_weight: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs mt-1"
                  />
                </div>
              </div>
            </div>

            {/* 제출 버튼 */}
            <button
              type="submit"
              className="w-full py-4 bg-uc-navy hover:bg-uc-navy-light text-white rounded-2xl font-bold text-base shadow-md transition flex items-center justify-center space-x-2"
            >
              <Send className="w-5 h-5 text-uc-orange" />
              <span>강의계획서 사업단 최종 제출</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
