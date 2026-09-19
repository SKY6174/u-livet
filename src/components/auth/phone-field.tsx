import { MOBILE_NOTICE } from "@/lib/auth/registration";
export function PhoneField() {
  return (
    <label className="field text-base">
      휴대폰 번호 (필수)
      <input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="010-1234-5678" maxLength={30} required aria-describedby="mobile-notice" />
      <span id="mobile-notice" className="text-sm font-normal leading-6 text-slate-600">{MOBILE_NOTICE}</span>
    </label>
  );
}
