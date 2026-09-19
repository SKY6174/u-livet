"use client";
import { useActionState, useState, startTransition } from "react";
import { setBadgeShare, type BadgeShareState } from "@/app/badge-actions";
import type { BadgePolicy } from "@/lib/badges/types";
export function BadgeShare({
  id,
  current,
  policies,
  canShare,
}: {
  id: string;
  current: { enabled: boolean; revision: number; policy_valid: boolean };
  policies: BadgePolicy[];
  canShare: boolean;
}) {
  const [state, action, pending] = useActionState<BadgeShareState, FormData>(
    setBadgeShare,
    { message: "" },
  );
  const [copied, setCopied] = useState(false);
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setCopied(false);
    const form = new FormData(event.currentTarget);
    startTransition(() => action(form));
  };
  return (
    <section className="panel mt-6">
      <h2 className="section-title">공유 링크 관리</h2>
      <p className="notice mb-5">
        기본은 비공개입니다. 공유하면 링크를 가진 사람이 마스킹
        이름·과정·업적·발급기관·날짜·현재 상태를 확인할 수 있습니다. 철회 후에는
        조회할 수 없지만 이미 복사한 정보는 회수할 수 없습니다.
      </p>
      <p className="mb-5 text-sm">
        현재 설정:{" "}
        {current.enabled
          ? current.policy_valid
            ? "공유 활성"
            : "공유 정책 확인 필요 · 조회 제한"
          : "비공개"}
      </p>
      {canShare && policies.length > 0 ? (
        <form action={action} onSubmit={submit} className="space-y-4">
          <input type="hidden" name="i" value={id} />
          <input type="hidden" name="revision" value={current.revision} />
          <input type="hidden" name="enabled" value="true" />
          <label className="field">
            공유 안내문
            <select name="policy" required defaultValue="">
              <option value="" disabled>
                승인 안내문 선택
              </option>
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} · {p.version}
                </option>
              ))}
            </select>
          </label>
          {policies.map((p) => (
            <details key={p.id}>
              <summary className="cursor-pointer text-sm font-semibold">
                {p.title} 원문
              </summary>
              <p className="mt-3 whitespace-pre-wrap text-sm">{p.body}</p>
            </details>
          ))}
          <label className="flex items-start gap-3">
            <input type="checkbox" name="confirmed" className="mt-1" required />
            <span>
              선택한 공유 안내와 공개 항목을 확인하고 공유에 동의합니다.
            </span>
          </label>
          <button className="btn-primary" disabled={pending}>
            {pending
              ? "처리 중…"
              : current.enabled
                ? "새 링크로 교체"
                : "공유 링크 만들기"}
          </button>
          <p className="text-sm text-slate-500">
            교체하면 이전 링크는 즉시 사용할 수 없습니다. 생성한 코드는 이
            화면에서 한 번만 제공됩니다.
          </p>
        </form>
      ) : (
        <p className="text-sm text-slate-600">
          유효한 배지와 승인된 공유 안내문이 있어야 새 링크를 만들 수 있습니다.
        </p>
      )}
      {current.enabled && (
        <form action={action} onSubmit={submit} className="mt-5">
          <input type="hidden" name="i" value={id} />
          <input type="hidden" name="revision" value={current.revision} />
          <input type="hidden" name="enabled" value="false" />
          <button className="btn-secondary" disabled={pending}>
            공유 철회
          </button>
        </form>
      )}
      {state.message && (
        <p className="mt-4 text-sm" role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      )}
      {state.token &&
        current.enabled &&
        state.revision === current.revision && (
          <div className="mt-5 rounded-xl bg-teal-50 p-4">
            <label className="field">
              검증 코드 (링크 복사 가능)
              <input
                readOnly
                value={state.token}
                className="font-mono text-xs"
              />
            </label>
            <button
              type="button"
              className="btn-secondary mt-3"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    location.origin + "/badges/verify#" + state.token,
                  );
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "복사했습니다" : "공유 링크 복사"}
            </button>
            <a
              className="ml-4 text-teal-800 underline"
              href={"/badges/verify#" + state.token}
              target="_blank"
              rel="noopener noreferrer"
            >
              검증 화면 열기
            </a>
          </div>
        )}
    </section>
  );
}
