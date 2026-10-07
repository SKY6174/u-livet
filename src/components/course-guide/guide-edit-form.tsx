"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatGuidePeriod, formatGuideSchedule, GUIDE_WEEKDAYS, MAX_GUIDE_SCHEDULE_ROWS, parseGuidePeriod, parseGuideSchedule, type CourseGuide, type GuideScheduleRow } from "@/lib/course-guide/model";
import { validCourseLocation } from "@/lib/course-guide/locations";
import { CourseLocationFields } from "@/components/course-guide/course-location-fields";

const ACADEMIES = ["스마트테크 아카데미", "라이프케어 아카데미", "로컬창업 아카데미", "팝업 아카데미"];
const inputClass = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-200";

export function GuideEditForm({ course }: { course: CourseGuide }) {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState(course.card_image_url ?? "");
  const [revision, setRevision] = useState(course.revision);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const initialPeriod = parseGuidePeriod(course.period_label, course.year);
  const initialSchedule = parseGuideSchedule(course.time_label);
  const [startDate, setStartDate] = useState(initialPeriod?.startDate ?? "");
  const [endDate, setEndDate] = useState(initialPeriod?.endDate ?? "");
  const [schedule, setSchedule] = useState(() => (initialSchedule ?? [{ day: "", startTime: "", endTime: "" }]).map((row, index) => ({ ...row, key: String(index) })));
  const [scheduleEdited, setScheduleEdited] = useState(false);
  const periodRequired = !!initialPeriod || !!startDate || !!endDate;
  const scheduleRequired = !!initialSchedule || scheduleEdited;
  const periodPreview = formatGuidePeriod(startDate, endDate);
  function updateSchedule(key: string, field: keyof GuideScheduleRow, value: string) {
    setScheduleEdited(true);
    setSchedule(rows => rows.map(row => row.key === key ? { ...row, [field]: value } : row));
  }
  let previewUrl: string | null = null;
  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol === "https:" && parsed.hostname) previewUrl = parsed.href;
  } catch { /* Wait for a complete HTTPS address before showing the preview. */ }
  async function uploadImage(file?: File) {
    if (!file) return;
    const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[file.type];
    if (!extension || file.size > 5 * 1024 * 1024) {
      setMessage("JPG, PNG 또는 WebP 이미지를 5MB 이하로 선택해 주세요.");
      return;
    }
    setUploading(true);
    setMessage("");
    try {
      const client = createClient();
      const path = `${course.org_id}/${course.id}/${crypto.randomUUID()}.${extension}`;
      const { error } = await client.storage.from("life-course-covers").upload(path, file, { contentType: file.type });
      if (error) throw error;
      setImageUrl(client.storage.from("life-course-covers").getPublicUrl(path).data.publicUrl);
      setMessage("이미지가 업로드됐습니다. 변경사항 저장을 눌러 카드에 반영해 주세요.");
    } catch { setMessage("이미지를 업로드하지 못했습니다. 권한과 연결 상태를 확인해 주세요."); }
    finally { setUploading(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || uploading) return;
    const form = new FormData(event.currentTarget);
    const location = course.offering_id ? course.location : String(form.get("location") ?? "");
    if (!validCourseLocation(location)) { setMessage("교육장소는 최대 3곳까지 각각 입력하고 전체 160자 이내로 작성해 주세요."); return; }
    const periodLabel = course.offering_id ? course.period_label : periodRequired ? periodPreview : course.period_label;
    const timeLabel = scheduleRequired ? formatGuideSchedule(schedule) : course.time_label;
    if (!periodLabel) { setMessage("교육 시작일과 종료일을 확인해 주세요. 종료일은 시작일보다 빠를 수 없습니다."); return; }
    if (!timeLabel) { setMessage("각 행의 요일과 시작·종료 시간을 입력해 주세요. 종료시간은 시작시간보다 늦어야 합니다."); return; }
    const url = String(form.get("card_image_url") ?? "").trim();
    if (url) {
      try { if (new URL(url).protocol !== "https:") throw new Error(); }
      catch { setMessage("배경 이미지는 HTTPS 주소를 입력해 주세요."); return; }
    }
    const lines = (key: string) => String(form.get(key) ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
    const payload = {
      name: course.offering_id ? course.name : String(form.get("name") ?? "").trim(), academy: String(form.get("academy") ?? ""),
      summary: String(form.get("summary") ?? "").trim(), curriculum: lines("curriculum"),
      mode: course.offering_id ? course.mode : String(form.get("mode") ?? ""), capacity: course.offering_id ? course.capacity : Number(form.get("capacity")),
      teaching_hours: Number(form.get("teaching_hours")),
      period_label: periodLabel,
      schedule_history: lines("schedule_history"), time_label: timeLabel,
      location,
      certificate: String(form.get("certificate") ?? "").trim() || null,
      card_image_url: url || null,
    };
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await createClient().rpc("life_save_course_guide", {
        g: course.id, payload, expected_revision: revision,
      });
      if (error) {
        setMessage(error.message.includes("REVISION_CHANGED") ? "다른 담당자가 먼저 수정했습니다. 페이지를 새로고침한 뒤 다시 확인해 주세요." :
          error.message.includes("FORBIDDEN") ? "과정 수정 권한을 확인해 주세요." :
          error.message.includes("LINKED_COURSE_SHARED_FIELDS") ? "개설 과정의 기본 정보가 변경됐습니다. 새로고침 후 확인해 주세요." :
          error.message.includes("INVALID_INPUT") ? "입력 길이와 이미지 주소를 확인해 주세요." : "저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      } else {
        setRevision(Number(data));
        setMessage("과정 안내를 저장했습니다.");
        router.refresh();
      }
    } catch { setMessage("저장에 실패했습니다. 연결 상태를 확인해 주세요."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="space-y-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
    {course.offering_id && <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950">
      이 안내는 실제 개설 과정과 연결돼 있습니다. 과정명·운영방식·정원·교육기간·교육장소는 개설 과정에서 한 번만 수정하면 이 안내에도 반영됩니다.
      <Link href={`/admin/offerings/${course.offering_id}/manage`} className="ml-2 font-bold underline">과정 기본 정보 수정 →</Link>
    </div>}
    <div className="grid gap-5 sm:grid-cols-2">
      {course.offering_id ? <div className="text-sm font-semibold">과정명<p className="mt-2 rounded-xl bg-slate-50 px-4 py-3 font-normal">{course.name}</p></div> : <label className="text-sm font-semibold">과정명<input className={inputClass} name="name" required maxLength={160} defaultValue={course.name} /></label>}
      <label className="text-sm font-semibold">아카데미<select className={inputClass} name="academy" defaultValue={course.academy}>{ACADEMIES.map((item) => <option key={item}>{item}</option>)}</select></label>
    </div>
    <label className="block text-sm font-semibold">과정 카드 소개<textarea className={inputClass} name="summary" rows={3} required maxLength={1000} defaultValue={course.summary} /></label>
    <label className="block text-sm font-semibold">교육내용 · 한 줄에 한 항목<textarea className={inputClass} name="curriculum" rows={6} required defaultValue={course.curriculum.join("\n")} /></label>
    <div className="grid gap-5 sm:grid-cols-3">
      {course.offering_id ? <div className="text-sm font-semibold">운영방식<p className="mt-2 rounded-xl bg-slate-50 px-4 py-3 font-normal">{{ OFFLINE: "대면", ONLINE: "온라인", BLENDED: "혼합" }[course.mode]}</p></div> : <label className="text-sm font-semibold">운영방식<select className={inputClass} name="mode" defaultValue={course.mode}><option value="OFFLINE">대면</option><option value="ONLINE">온라인</option><option value="BLENDED">혼합</option></select></label>}
      {course.offering_id ? <div className="text-sm font-semibold">정원<p className="mt-2 rounded-xl bg-slate-50 px-4 py-3 font-normal">{course.capacity}명</p></div> : <label className="text-sm font-semibold">정원<input className={inputClass} name="capacity" type="number" min={1} max={999} required defaultValue={course.capacity} /></label>}
      <label className="text-sm font-semibold">교육시수<input className={inputClass} name="teaching_hours" type="number" min={1} max={999} required defaultValue={course.teaching_hours} /></label>
    </div>
    {course.offering_id ? <div className="text-sm font-semibold">교육기간<p className="mt-2 rounded-xl bg-slate-50 px-4 py-3 font-normal">{course.period_label}</p></div> : <><div className="grid gap-5 sm:grid-cols-2">
      <label className="min-w-0 text-sm font-semibold">교육시작일<input className={`${inputClass} min-w-0`} name="start_date" type="date" max="9999-12-31" required={periodRequired} value={startDate} onChange={event => setStartDate(event.target.value)} /></label>
      <label className="min-w-0 text-sm font-semibold">교육종료일<input className={`${inputClass} min-w-0`} name="end_date" type="date" min={startDate || undefined} max="9999-12-31" required={periodRequired} value={endDate} onChange={event => setEndDate(event.target.value)} /></label>
    </div>
    <p className="text-sm text-slate-600">{periodPreview ? `교육기간: ${periodPreview}` : !initialPeriod ? `기존 교육기간 안내: ${course.period_label}` : "교육 시작일과 종료일을 입력해 주세요."}</p></>}
    <fieldset className="min-w-0 space-y-4">
      <legend className="mb-3 text-sm font-semibold">요일별 교육시간</legend>
      {!initialSchedule && <p className="text-sm text-slate-600">기존 요일·시간 안내: {course.time_label}</p>}
      {schedule.map((row, index) => <div key={row.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="min-w-0 text-sm font-semibold">요일<select className={inputClass} name={`weekday_${index}`} aria-label={`요일 ${index + 1}`} required={scheduleRequired} value={row.day} onChange={event => updateSchedule(row.key, "day", event.target.value)}><option value="">요일 선택</option>{GUIDE_WEEKDAYS.map(day => <option key={day} value={day}>{day}요일</option>)}</select></label>
          <label className="min-w-0 text-sm font-semibold">시작시간<input className={`${inputClass} min-w-0`} name={`start_time_${index}`} aria-label={`시작시간 ${index + 1}`} type="time" required={scheduleRequired} value={row.startTime} onChange={event => updateSchedule(row.key, "startTime", event.target.value)} /></label>
          <label className="min-w-0 text-sm font-semibold">종료시간<input className={`${inputClass} min-w-0`} name={`end_time_${index}`} aria-label={`종료시간 ${index + 1}`} type="time" required={scheduleRequired} value={row.endTime} onChange={event => updateSchedule(row.key, "endTime", event.target.value)} /></label>
        </div>
        {schedule.length > 1 && <button type="button" disabled={busy} className="mt-3 min-h-10 text-sm font-semibold text-slate-600 hover:text-red-700" aria-label={`시간표 ${index + 1} 삭제`} onClick={() => { setScheduleEdited(true); setSchedule(rows => rows.filter(item => item.key !== row.key)); }}>시간표 삭제</button>}
      </div>)}
      <button type="button" disabled={busy || schedule.length >= MAX_GUIDE_SCHEDULE_ROWS} className="btn-secondary !text-[13px]" onClick={() => { setScheduleEdited(true); setSchedule(rows => [...rows, { key: crypto.randomUUID(), day: "", startTime: "", endTime: "" }]); }}>+요일·시간</button>
    </fieldset>
    {course.offering_id ? <div className="text-sm font-semibold">교육장소<p className="mt-2 whitespace-pre-line rounded-xl bg-slate-50 px-4 py-3 font-normal">{course.location}</p></div> : <CourseLocationFields initialLocation={course.location} />}
    <label className="block text-sm font-semibold">관련 자격증<input className={inputClass} name="certificate" maxLength={160} defaultValue={course.certificate ?? ""} /></label>
    <label className="block text-sm font-semibold">일정 변경 안내 · 한 줄에 한 항목<textarea className={inputClass} name="schedule_history" rows={3} defaultValue={course.schedule_history.join("\n")} /></label>
    <div className="rounded-xl bg-slate-50 p-5">
      <label className="block text-sm font-semibold">이미지 파일 올리기<input className="mt-2 block w-full text-sm" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || busy} onChange={(event) => { void uploadImage(event.target.files?.[0]); event.target.value = ""; }} /></label>
      <label className="block text-sm font-semibold">카드 배경 이미지 HTTPS 주소<input className={inputClass} name="card_image_url" type="url" maxLength={2048} placeholder="https://example.com/course-image.jpg" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} /></label>
      <p className="mt-2 text-xs text-slate-500">JPG·PNG·WebP, 최대 5MB. 이미지 주소를 비우면 기존 흰색 카드가 표시됩니다. 권장 비율 16:9.</p>
      {previewUrl && <div className="relative mt-4 h-40 overflow-hidden rounded-xl bg-slate-200"><Image src={previewUrl} alt="카드 배경 미리보기" fill sizes="600px" className="object-cover" unoptimized /></div>}
      {imageUrl && <button type="button" className="mt-3 text-sm font-semibold text-teal-800 hover:underline" onClick={() => setImageUrl("")}>이미지 제거</button>}
    </div>
    {message && <p role="status" className="rounded-xl bg-teal-50 p-3 text-sm font-semibold text-teal-900">{message}</p>}
    <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy || uploading} className="btn-primary">{uploading ? "이미지 업로드 중…" : busy ? "저장 중…" : "변경사항 저장"}</button><Link href={`/courses/${course.id}`} className="btn-secondary">공개 페이지 보기</Link></div>
  </form>;
}
