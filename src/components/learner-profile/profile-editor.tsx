"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { Camera, Check, Mail, Phone, Sparkles, Trash2 } from "lucide-react";
import { formatMobilePhone } from "@/lib/auth/registration";
import type { LearnerProfile } from "@/lib/learner-profile/data";
import { requestLearnerEmailChange, saveLearnerProfile } from "@/app/mypage/profile/actions";

const CHARACTERS = [
  { key: "", icon: "", label: "선택 안 함" },
  { key: "sprout", icon: "🌱", label: "새싹" },
  { key: "book", icon: "📚", label: "책" },
  { key: "star", icon: "⭐", label: "별" },
  { key: "flower", icon: "🌼", label: "꽃" },
];
const inputClass = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100";

export function ProfileEditor({ name, email, pendingEmail, profile, photoUrl }: {
  name: string; email: string; pendingEmail: string | null; profile: LearnerProfile; photoUrl: string | null;
}) {
  const router = useRouter();
  const [profileState, saveAction, saving] = useActionState(saveLearnerProfile, { message: "" });
  const [emailState, emailAction, emailSaving] = useActionState(requestLearnerEmailChange, { message: "" });
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMessage, setPhotoMessage] = useState("");
  const chosenCharacter = CHARACTERS.find(item => item.key === profile.character_key);

  async function changePhoto(file?: File) {
    if (!file) return;
    if (!(["image/jpeg", "image/png", "image/webp"].includes(file.type)) || file.size > 2 * 1024 * 1024) {
      setPhotoMessage("JPG, PNG, WebP 사진을 2MB 이하로 선택해 주세요.");
      return;
    }
    setPhotoBusy(true);
    setPhotoMessage("");
    try {
      const form = new FormData();
      form.set("photo", file);
      const response = await fetch("/api/mypage/profile/photo", { method: "POST", body: form });
      const result = await response.json();
      setPhotoMessage(result.message ?? (response.ok ? "사진을 저장했습니다." : "사진을 저장하지 못했습니다."));
      if (response.ok) router.refresh();
    } catch { setPhotoMessage("사진을 저장하지 못했습니다. 연결 상태를 확인해 주세요."); }
    finally { setPhotoBusy(false); }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    setPhotoMessage("");
    try {
      const response = await fetch("/api/mypage/profile/photo", { method: "DELETE" });
      const result = await response.json();
      setPhotoMessage(result.message ?? (response.ok ? "사진을 삭제했습니다." : "사진을 삭제하지 못했습니다."));
      if (response.ok) router.refresh();
    } catch { setPhotoMessage("사진을 삭제하지 못했습니다. 연결 상태를 확인해 주세요."); }
    finally { setPhotoBusy(false); }
  }

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)]">
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="contact-title">
        <div className="mb-6 flex items-center gap-3"><span className="rounded-xl bg-teal-50 p-3 text-teal-700"><Phone className="h-5 w-5" /></span>
          <div><h2 id="contact-title" className="text-xl font-bold text-slate-950">기본 정보</h2><p className="text-sm text-slate-600">수업 및 신청 안내에 사용합니다.</p></div></div>
        <form action={saveAction} className="space-y-6">
          <label className="block text-sm font-semibold text-slate-800">이름
            <input className={`${inputClass} bg-slate-50`} value={name} readOnly aria-describedby="name-help" />
          </label>
          <p id="name-help" className="-mt-4 text-xs text-slate-500">수강 신청에 사용하는 이름은 여기에서 변경할 수 없습니다.</p>
          <label className="block text-sm font-semibold text-slate-800">휴대전화 <span className="text-teal-700">(필수)</span>
            <input className={inputClass} name="phone" type="tel" autoComplete="tel" inputMode="tel" required maxLength={30}
              defaultValue={formatMobilePhone(profile.phone)} placeholder="010-1234-5678" />
          </label>
          <p className="-mt-4 text-xs text-slate-500">입력한 번호는 미인증 연락처로 저장됩니다.</p>
          <label className="block text-sm font-semibold text-slate-800">별명 <span className="font-normal text-slate-500">(선택)</span>
            <input className={inputClass} name="nickname" maxLength={24} defaultValue={profile.nickname ?? ""} placeholder="나를 표현할 별명" />
          </label>
          <fieldset><legend className="mb-3 text-sm font-semibold text-slate-800">캐릭터 <span className="font-normal text-slate-500">(선택)</span></legend>
            <div className="flex flex-wrap gap-2">{CHARACTERS.map(item => <label key={item.key} className="cursor-pointer">
              <input type="radio" name="character" value={item.key} defaultChecked={(profile.character_key ?? "") === item.key} className="peer sr-only" />
              <span className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition peer-checked:border-teal-700 peer-checked:bg-teal-50 peer-checked:text-teal-900 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-500">{item.icon && <span aria-hidden="true">{item.icon}</span>}{item.label}</span>
            </label>)}</div>
          </fieldset>
          <button className="btn-primary inline-flex items-center gap-2" disabled={saving} type="submit"><Check className="h-4 w-4" />{saving ? "저장 중…" : "변경사항 저장"}</button>
          {profileState.message && <p role="status" className={`text-sm ${profileState.ok ? "text-teal-800" : "text-rose-700"}`}>{profileState.message}</p>}
        </form>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="email-title">
        <div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-sky-50 p-3 text-sky-700"><Mail className="h-5 w-5" /></span>
          <div><h2 id="email-title" className="text-xl font-bold text-slate-950">이메일 <span className="text-sm font-semibold text-teal-700">(필수)</span></h2><p className="text-sm text-slate-600">인증 후 계정 이메일이 변경됩니다.</p></div></div>
        <p className="mb-4 break-all rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">현재 이메일 <strong className="ml-2 text-slate-950">{email || "등록된 주소 없음"}</strong></p>
        {pendingEmail && pendingEmail !== email && <p className="mb-4 break-all rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">인증 대기: {pendingEmail}</p>}
        <form action={emailAction} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-800">새 이메일
            <input className={inputClass} name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={pendingEmail ?? email} />
          </label>
          <button className="btn-secondary" disabled={emailSaving} type="submit">{emailSaving ? "요청 중…" : "이메일 변경 인증 요청"}</button>
          {emailState.message && <p role="status" className={`text-sm ${emailState.ok ? "text-teal-800" : "text-rose-700"}`}>{emailState.message}</p>}
        </form>
      </section>
    </div>
    <aside className="h-fit rounded-3xl border border-slate-200 bg-gradient-to-b from-teal-50 to-white p-6 shadow-sm sm:p-8" aria-labelledby="photo-title">
      <div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-white p-3 text-teal-700"><Sparkles className="h-5 w-5" /></span>
        <div><h2 id="photo-title" className="text-xl font-bold text-slate-950">나의 모습</h2><p className="text-sm text-slate-600">사진은 선택 사항입니다.</p></div></div>
      <div className="relative mx-auto mb-6 flex h-44 w-44 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-teal-100 text-7xl shadow-lg">
        {photoUrl ? <Image src={photoUrl} alt={`${name} 님의 프로필 사진`} fill sizes="176px" unoptimized className="object-cover" />
          : <span aria-label={chosenCharacter?.label ?? "기본 캐릭터"}>{chosenCharacter?.icon || "🌱"}</span>}
      </div>
      <label className="btn-secondary flex w-full cursor-pointer items-center justify-center gap-2"><Camera className="h-4 w-4" />{photoBusy ? "처리 중…" : "사진 올리기"}
        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy}
          onChange={event => { void changePhoto(event.target.files?.[0]); event.target.value = ""; }} />
      </label>
      {photoUrl && <button type="button" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-50" disabled={photoBusy} onClick={() => void removePhoto()}><Trash2 className="h-4 w-4" />사진 삭제</button>}
      <p className="mt-4 text-center text-xs leading-5 text-slate-500">JPG · PNG · WebP, 최대 2MB<br />사진은 본인에게만 표시됩니다.</p>
      {photoMessage && <p role="status" className="mt-4 rounded-xl bg-white px-3 py-2 text-sm text-slate-700">{photoMessage}</p>}
    </aside>
  </div>;
}
