"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  enrollMfa,
  verifyMfa,
  removeMfa,
  type MfaResult,
} from "@/app/auth/mfa-actions";
import type { SecurityStatus } from "@/lib/auth/mfa";
import { MfaCodeInput } from "@/components/auth/mfa-code-input";
type Factor = { id: string; name: string; verified: boolean };
export function MfaPanel({
  status,
  factors,
  next,
  returnToWork = false,
}: {
  status: SecurityStatus;
  factors: Factor[];
  next: string;
  returnToWork?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<MfaResult>({ message: "" });
  const [enrollment, setEnrollment] = useState<MfaResult["enrollment"]>();
  const [selected, setSelected] = useState("");
  const [code, setCode] = useState("");
  const [showKey, setShowKey] = useState(false);
  const verified = factors.filter((f) => f.verified);
  const factorId =
    enrollment?.id ??
    (verified.some((f) => f.id === selected)
      ? selected
      : (verified[0]?.id ?? ""));
  const run = (
    operation: () => Promise<MfaResult>,
    kind: "enroll" | "verify" | "remove",
  ) => {
    if (pending) return;
    startTransition(async () => {
      try {
        const response = await operation();
        setResult(response);
        if (response.enrollment) {
          setEnrollment(response.enrollment);
          setCode("");
          setShowKey(false);
        }
        if (response.ok) {
          setCode("");
          setEnrollment(undefined);
          setShowKey(false);
          if (kind === "verify" && returnToWork) router.replace(next);
          else router.refresh();
        }
        if (kind === "remove" && response.ok) setSelected("");
      } catch {
        setResult({
          message: "연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.",
        });
      }
    });
  };
  return (
    <section className="panel space-y-6 text-base">
      <div className="rounded-xl bg-teal-50 p-4 leading-7">
        <p className="font-semibold">
          {status.mfa_verified
            ? "추가 인증된 로그인입니다."
            : status.mfa_required
              ? "계속하려면 추가 인증이 필요합니다."
              : "추가 인증은 선택 사항입니다."}
        </p>
        {status.staff_required && (
          <p>
            관리자 계정의 저장·승인은 최근 {status.fresh_minutes}분 안에 추가
            인증한 경우만 가능합니다.
          </p>
        )}
        {status.mfa_verified && !status.recent && (
          <p>저장하기 전에 아래 코드로 다시 확인해 주세요.</p>
        )}
      </div>
      {!enrollment && verified.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="shrink-0 text-lg font-bold" htmlFor="mfa-factor">
            확인할 인증 앱
          </label>
          <select
            id="mfa-factor"
            className="min-h-11 min-w-0 flex-1 basis-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            value={factorId}
            disabled={pending}
            onChange={(e) => {
              setSelected(e.target.value);
              setCode("");
            }}
          >
            {verified.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button
            className="btn-secondary ml-auto shrink-0"
            disabled={pending || !status.recent}
            type="button"
            onClick={() => run(enrollMfa, "enroll")}
          >
            다른 인증 앱 추가
          </button>
        </div>
      )}
      {enrollment && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">인증 앱 연결 순서</h2>
          <ol className="list-decimal space-y-2 pl-6 leading-7">
            <li>휴대전화에서 사용 중인 인증 앱을 엽니다.</li>
            <li>계정 추가에서 아래 QR을 스캔하거나 설정 키를 입력합니다.</li>
            <li>앱에 표시되는 6자리 코드를 아래에 입력합니다.</li>
          </ol>
          <Image
            unoptimized
            src={enrollment.qr}
            alt="인증 앱 등록용 QR 코드"
            width={210}
            height={210}
            className="max-w-full"
          />
          <button
            type="button"
            className="btn-secondary"
            aria-expanded={showKey}
            onClick={() => setShowKey(!showKey)}
          >
            설정 키 {showKey ? "숨기기" : "보기"}
          </button>
          {showKey && (
            <div className="space-y-3">
              <code
                className="block break-all rounded bg-slate-100 p-4"
                aria-label="인증 앱 설정 키"
              >
                {enrollment.secret}
              </code>
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(enrollment.secret);
                    setResult({
                      ok: true,
                      message:
                        "설정 키를 복사했습니다. 인증 앱에 붙여 넣어 주세요.",
                    });
                  } catch {
                    setResult({
                      message:
                        "복사하지 못했습니다. 표시된 키를 직접 입력해 주세요.",
                    });
                  }
                }}
              >
                설정 키 복사
              </button>
            </div>
          )}
          <p className="leading-7 text-slate-600">
            QR과 설정 키는 비밀번호처럼 보관하고 다른 사람에게 보내지 마세요. 이
            화면을 닫으면 키를 다시 보여드릴 수 없습니다.
          </p>
        </div>
      )}
      {factorId && (enrollment || !status.mfa_verified || !status.recent) && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => verifyMfa(factorId, code), "verify");
          }}
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <label className="shrink-0 text-lg font-bold" htmlFor="mfa-code">
              인증 앱의 6자리 코드
            </label>
            <p
              id="mfa-code-help"
              className="text-sm leading-6 text-slate-600 sm:text-right"
            >
              인증 앱의 숫자는 일정 시간마다 바뀝니다. 현재 보이는 숫자를 입력해
              주세요.
            </p>
          </div>
          <MfaCodeInput
            id="mfa-code"
            value={code}
            onChange={setCode}
            describedBy="mfa-code-help"
            disabled={pending}
          />
          <button
            className="btn-primary w-full text-base"
            disabled={pending}
            type="submit"
          >
            {pending ? "확인 중…" : "6자리 코드 확인"}
          </button>
        </form>
      )}
      {result.message && (
        <p
          role={result.ok || result.enrollment ? "status" : "alert"}
          className={
            result.ok || result.enrollment ? "leading-7 text-emerald-800" : "leading-7 text-red-700"
          }
        >
          {result.message}
        </p>
      )}
      {!enrollment && verified.length === 0 && (
        <button
          className="btn-secondary w-full"
          disabled={pending}
          type="button"
          onClick={() => run(enrollMfa, "enroll")}
        >
          인증 앱 연결하기
        </button>
      )}
      {enrollment && (
        <button
          className="btn-secondary"
          disabled={pending}
          type="button"
          onClick={() => run(() => removeMfa(enrollment.id), "remove")}
        >
          연결 취소
        </button>
      )}
      {(status.mfa_verified || !status.mfa_required) && (
        <Link className="btn-primary block text-center" href={next}>
          작업 화면으로 이동
        </Link>
      )}
      {!enrollment && verified.length > 0 && (
        <details className="border-t pt-5">
          <summary className="min-h-11 cursor-pointer">
            연결된 인증 앱 관리
          </summary>
          <ul className="space-y-4">
            {verified.map((f) => (
              <li key={f.id} className="space-y-2">
                <p>{f.name}</p>
                <button
                  className="btn-secondary"
                  disabled={
                    pending ||
                    !status.recent ||
                    (status.staff_required && verified.length <= 1)
                  }
                  onClick={() => run(() => removeMfa(f.id), "remove")}
                >
                  이 인증 앱 연결 해제
                </button>
              </li>
            ))}
          </ul>
          {status.staff_required && (
            <p className="mt-4 leading-7">
              관리자는 마지막 인증 앱을 해제할 수 없습니다. 교체할 인증 앱을
              먼저 추가해 주세요.
            </p>
          )}
        </details>
      )}
    </section>
  );
}
