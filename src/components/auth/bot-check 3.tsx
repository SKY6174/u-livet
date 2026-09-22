"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

export type BotProtection = { siteKey: string | null; unavailable: boolean };
type Turnstile = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

export function BotCheck({
  siteKey,
  resetKey,
  onReady,
}: {
  siteKey: string;
  resetKey: object;
  onReady: (ready: boolean) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [retry, setRetry] = useState(0);
  const [scriptRetry, setScriptRetry] = useState(0);
  const [message, setMessage] = useState("보안 확인을 준비하고 있습니다.");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    onReady(false);
    setFailed(false);
    setMessage("보안 확인을 준비하고 있습니다.");
    if (!loaded || !container.current || !window.turnstile) return;
    let active = true;
    const fail = () => {
      if (!active) return;
      onReady(false);
      setFailed(true);
      setMessage(
        "보안 확인이 끝나지 않았습니다. ‘보안 확인 다시 하기’를 눌러 주세요. 계속 안 되면 사업단에 도움을 요청해 주세요.",
      );
    };
    let widget: string | undefined;
    try {
      widget = window.turnstile.render(container.current, {
        sitekey: siteKey,
        theme: "light",
        size: "compact",
        language: "ko",
        callback: () => {
          if (active) {
            onReady(true);
            setFailed(false);
            setMessage("보안 확인을 마쳤습니다.");
          }
        },
        "error-callback": fail,
        "expired-callback": fail,
        "timeout-callback": fail,
      });
    } catch {
      fail();
    }
    return () => {
      active = false;
      if (widget) window.turnstile?.remove(widget);
      onReady(false);
    };
  }, [loaded, siteKey, retry, resetKey, onReady]);
  // Give stalled script loads a usable explanation as well as an explicit retry.
  useEffect(() => {
    if (loaded) return;
    const timer = setTimeout(() => {
      setFailed(true);
      setMessage(
        "보안 확인을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
      );
    }, 15000);
    return () => clearTimeout(timer);
  }, [loaded, retry]);
  return (
    <div className="space-y-3 rounded-xl bg-slate-50 p-3 text-base">
      <Script
        key={scriptRetry}
        id={`auth-turnstile-${scriptRetry}`}
        src={`https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit${scriptRetry ? `&retry=${scriptRetry}` : ""}`}
        strategy="afterInteractive"
        onReady={() => setLoaded(true)}
        onError={() => {
          onReady(false);
          setFailed(true);
          setMessage(
            "보안 확인을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.",
          );
        }}
      />
      <p className="font-semibold">안전한 이용을 위한 확인</p>
      <div ref={container} />
      <p role="status">{message}</p>
      {failed && (
        <button
          type="button"
          className="btn-secondary min-h-11"
          onClick={() => {
            setRetry((value) => value + 1);
            if (!loaded) setScriptRetry((value) => value + 1);
          }}
        >
          보안 확인 다시 하기
        </button>
      )}
    </div>
  );
}
