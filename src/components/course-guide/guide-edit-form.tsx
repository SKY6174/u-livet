"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { CourseGuide } from "@/lib/course-guide/model";

const ACADEMIES = ["스마트테크 아카데미", "라이프케어 아카데미", "로컬창업 아카데미", "팝업 아카데미"];
const inputClass = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-200";

export function GuideEditForm({ course }: { course: CourseGuide }) {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState(course.card_image_url ?? "");
  const [revision, setRevision] = useState(course.revision);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
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
    const url = String(form.get("card_image_url") ?? "").trim();
    if (url) {
      try { if (new URL(url).protocol !== "https:") throw new Error(); }
      catch { setMessage("배경 이미지는 HTTPS 주소를 입력해 주세요."); return; }
    }
    const lines = (key: string) => String(form.get(key) ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
    const payload = {
      name: String(form.get("name") ?? "").trim(), academy: String(form.get("academy") ?? ""),
      summary: String(form.get("summary") ?? "").trim(), curriculum: lines("curriculum"),
      mode: String(form.get("mode") ?? ""), capacity: Number(form.get("capacity")),
      teaching_hours: Number(form.get("teaching_hours")),
      period_label: String(form.get("period_label") ?? "").trim(),
      schedule_history: lines("schedule_history"), time_label: String(form.get("time_label") ?? "").trim(),
      location: String(form.get("location") ?? "").trim(),
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
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-semibold">과정명<input className={inputClass} name="name" required maxLength={160} defaultValue={course.name} /></label>
      <label className="text-sm font-semibold">아카데미<select className={inputClass} name="academy" defaultValue={course.academy}>{ACADEMIES.map((item) => <option key={item}>{item}</option>)}</select></label>
    </div>
    <label className="block text-sm font-semibold">과정 소개<textarea className={inputClass} name="summary" rows={3} required maxLength={1000} defaultValue={course.summary} /></label>
    <label className="block text-sm font-semibold">교육내용 · 한 줄에 한 항목<textarea className={inputClass} name="curriculum" rows={6} required defaultValue={course.curriculum.join("\n")} /></label>
    <div className="grid gap-5 sm:grid-cols-3">
      <label className="text-sm font-semibold">운영방식<select className={inputClass} name="mode" defaultValue={course.mode}><option value="OFFLINE">대면</option><option value="ONLINE">온라인</option><option value="BLENDED">혼합</option></select></label>
      <label className="text-sm font-semibold">정원<input className={inputClass} name="capacity" type="number" min={1} max={999} required defaultValue={course.capacity} /></label>
      <label className="text-sm font-semibold">교육시수<input className={inputClass} name="teaching_hours" type="number" min={1} max={999} required defaultValue={course.teaching_hours} /></label>
    </div>
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-semibold">교육기간<input className={inputClass} name="period_label" required maxLength={160} defaultValue={course.period_label} /></label>
      <label className="text-sm font-semibold">요일 · 시간<input className={inputClass} name="time_label" required maxLength={160} defaultValue={course.time_label} /></label>
      <label className="text-sm font-semibold">교육장소<input className={inputClass} name="location" required maxLength={160} defaultValue={course.location} /></label>
      <label className="text-sm font-semibold">관련 자격증<input className={inputClass} name="certificate" maxLength={160} defaultValue={course.certificate ?? ""} /></label>
    </div>
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
