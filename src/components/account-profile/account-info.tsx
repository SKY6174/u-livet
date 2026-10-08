import { ActionForm } from "@/components/portal/action-form";
import { saveAccountProfile } from "@/app/mypage/account-actions";
import { displayPhone } from "@/lib/members/model";
import type { AccountProfile } from "@/lib/account-profile/model";

const FIELDS = [
  { name: "mobile_phone", label: "핸드폰 번호", type: "tel", placeholder: "010-1234-5678", maxLength: 30, autoComplete: "mobile tel" },
  { name: "office_phone", label: "사무실 번호", type: "tel", placeholder: "052-230-0000", maxLength: 30, autoComplete: "work tel" },
  { name: "school_email", label: "이메일(학교)", type: "email", placeholder: "name@uc.ac.kr", maxLength: 254, autoComplete: "work email" },
  { name: "personal_email", label: "이메일(개인)", type: "email", placeholder: "개인 이메일 주소", maxLength: 254, autoComplete: "home email" },
  { name: "affiliation", label: "소속(학과/부서)", type: "text", placeholder: "학과 또는 부서명", maxLength: 100, autoComplete: "organization" },
  { name: "job_title", label: "직책", type: "text", placeholder: "직책을 입력해 주세요", maxLength: 100, autoComplete: "organization-title" },
] as const;

export function AccountInfo({ profile }: { profile: AccountProfile | null }) {
  if (!profile) return <p role="alert" className="notice mt-6">내 정보를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>;
  const value = (name: keyof AccountProfile) => name.endsWith("phone")
    ? profile[name] ? displayPhone(profile[name]) : "" : profile[name] ?? "";
  return <div className="mt-6">
    <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
      {FIELDS.map(field => <div key={field.name} className="min-w-0">
        <dt className="text-sm font-semibold text-slate-500">{field.label}</dt>
        <dd className="mt-1 break-words text-base text-slate-900">{value(field.name) || "미등록"}</dd>
      </div>)}
    </dl>
    <details className="group mt-6 border-t border-slate-200 pt-5">
      <summary className="btn-secondary inline-flex cursor-pointer list-none [&::-webkit-details-marker]:hidden">내 정보 수정</summary>
      <div className="mt-5">
        <p className="mb-4 text-sm text-slate-600">연락처와 소속 정보를 입력하세요. 학교·개인 이메일은 연락용이며 로그인 이메일은 유지됩니다.</p>
        <ActionForm action={saveAccountProfile} label="변경사항 저장" resetOnSuccess={false}>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map(field => <label key={field.name} className="field min-w-0">{field.label}
              <input name={field.name} type={field.type} defaultValue={value(field.name)} maxLength={field.maxLength}
                autoComplete={field.autoComplete} placeholder={field.placeholder} className="min-w-0 w-full" />
            </label>)}
          </div>
        </ActionForm>
      </div>
    </details>
  </div>;
}
