"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import QRCode from "qrcode";
import { Maximize2, QrCode } from "lucide-react";
import { issueAttendanceQr, stopAttendanceQr, rescheduleQrTestClass } from "@/app/qr-attendance-actions";
import type { AttendanceBook } from "@/lib/attendance/model";
import type { ClassSession } from "@/lib/portal/evaluation";
import { koreanDateTimeInput, type QrChallenge } from "@/lib/attendance/qr";
const koreanTime = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
export function QrPresenter({ offering, sessions, activeSession: initialSession, enrolledCount, canEditTestTime = false }: {
  offering: AttendanceBook["offering"]; sessions: ClassSession[]; activeSession: ClassSession; enrolledCount: number; canEditTestTime?: boolean;
}) {
  const router = useRouter(), pathname = usePathname();
  const container = useRef<HTMLDivElement>(null);
  const generation = useRef(0), inFlight = useRef(false), mounted = useRef(true);
  const [challenge, setChallenge] = useState<QrChallenge | null>(null);
  const [image, setImage] = useState(""), [url, setUrl] = useState("");
  const [running, setRunning] = useState(false), [pending, setPending] = useState(false);
  const [message, setMessage] = useState(""), [now, setNow] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [activeSession, setActiveSession] = useState(initialSession);
  const [startsAt, setStartsAt] = useState(() => koreanDateTimeInput(initialSession.starts_at));
  const [endsAt, setEndsAt] = useState(() => koreanDateTimeInput(initialSession.ends_at));
  const [savingTime, setSavingTime] = useState(false), [timeMessage, setTimeMessage] = useState("");
  useEffect(() => {
    setActiveSession(current => ({ ...current, starts_at: initialSession.starts_at, ends_at: initialSession.ends_at }));
    setStartsAt(koreanDateTimeInput(initialSession.starts_at));
    setEndsAt(koreanDateTimeInput(initialSession.ends_at));
  }, [initialSession.starts_at, initialSession.ends_at]);
  useEffect(() => {
    mounted.current = true;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const change = () => setFullscreen(document.fullscreenElement === container.current);
    document.addEventListener("fullscreenchange", change);
    return () => { mounted.current = false; clearInterval(timer); document.removeEventListener("fullscreenchange", change); };
  }, []);
  const generate = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const request = ++generation.current;
    setPending(true); setMessage("");
    try {
      const result = await issueAttendanceQr(offering.id, activeSession.id);
      if (!mounted.current || request !== generation.current) return;
      if (!result.challenge) throw new Error(result.message ?? "QR을 발급하지 못했습니다.");
      const nextUrl = `${window.location.origin}/learning/${offering.id}/attendance/checkin?${new URLSearchParams({ session: activeSession.id, t: result.challenge.token })}`;
      const nextImage = await QRCode.toDataURL(nextUrl, { width: 400, margin: 2, color: { dark: "#0f3d38", light: "#ffffff" } });
      if (!mounted.current || request !== generation.current) return;
      setChallenge(result.challenge); setImage(nextImage); setUrl(nextUrl); setRunning(true); setNow(Date.now());
    } catch (error) {
      if (mounted.current && request === generation.current) {
        setChallenge(null); setImage(""); setUrl(""); setRunning(false);
        setMessage(error instanceof Error ? error.message : "QR 생성에 실패했습니다. 다시 시도해 주세요.");
      }
    } finally { inFlight.current = false; if (mounted.current) setPending(false); }
  }, [offering.id, activeSession.id]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => { void generate(); }, 60000);
    return () => clearInterval(timer);
  }, [running, generate]);
  const valid = challenge && Date.parse(challenge.expires_at) > now && image;
  const open = now >= Date.parse(activeSession.starts_at) && now < Date.parse(activeSession.ends_at) && activeSession.status === "SCHEDULED";
  async function stop() {
    generation.current++; setRunning(false); setChallenge(null); setImage(""); setUrl(""); setPending(true);
    try { const result = await stopAttendanceQr(offering.id, activeSession.id); setMessage(result.ok ? "QR 입실 확인을 중지했습니다." : result.message ?? "중지를 확인하지 못했습니다."); }
    catch { setMessage("중지 요청에 실패했습니다. 기존 QR은 최대 2분 후 만료됩니다."); }
    finally { setPending(false); }
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (container.current?.requestFullscreen) await container.current.requestFullscreen();
      else setMessage("이 브라우저는 전체화면을 지원하지 않습니다.");
    } catch { setMessage("전체화면을 열지 못했습니다. 브라우저 창을 확대해 주세요."); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setMessage("출석 링크를 복사했습니다. 수업 현장에서만 공유해 주세요."); }
    catch { setMessage("링크를 복사하지 못했습니다. QR을 스캔해 주세요."); }
  }
  async function saveTime(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || savingTime) return;
    inFlight.current = true; generation.current++;
    setRunning(false); setChallenge(null); setImage(""); setUrl(""); setMessage("");
    setSavingTime(true); setTimeMessage("");
    try {
      const result = await rescheduleQrTestClass(offering.id, activeSession, startsAt, endsAt);
      if (!mounted.current) return;
      if (result.session) {
        setActiveSession({ ...activeSession, ...result.session });
        setNow(Date.now());
      }
      setTimeMessage(result.message);
    } catch { if (mounted.current) setTimeMessage("시간을 저장하지 못했습니다. 다시 시도해 주세요."); }
    finally { inFlight.current = false; if (mounted.current) setSavingTime(false); }
  }
  function useNextTwoHours() {
    const start = Math.floor(Date.now() / 60000) * 60000;
    setStartsAt(koreanDateTimeInput(new Date(start).toISOString()));
    setEndsAt(koreanDateTimeInput(new Date(start + 2 * 3600000).toISOString()));
    setTimeMessage("시간 저장을 누르면 지금부터 테스트할 수 있습니다.");
  }
  return <section ref={container} className={`panel bg-white ${fullscreen ? "h-screen overflow-auto p-8" : ""}`} aria-label="QR 출석 화면">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
      <label className="field min-w-0 flex-1">수업 차시
        <select value={activeSession.id} disabled={pending || running || savingTime} onChange={e => router.push(`${pathname}?session=${e.target.value}`)}>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.title} · {koreanTime(s.id === activeSession.id ? activeSession.starts_at : s.starts_at)}{s.status === "CANCELLED" ? " · 휴강" : ""}</option>)}
        </select>
      </label>
      <button type="button" className="btn-secondary" onClick={toggleFullscreen}><Maximize2 className="mr-2 inline h-4 w-4" />{fullscreen ? "전체화면 종료" : "전체화면"}</button>
    </div>
    {canEditTestTime && <form onSubmit={saveTime} className="mt-5 rounded-xl border border-teal-200 bg-teal-50/50 p-4" aria-label="테스트 수업 시간 수정">
      <h2 className="font-semibold text-teal-900">테스트 수업 시간 수정</h2>
      <p className="mt-2 text-sm text-slate-600">한국시간으로 입력해 주세요. 저장하면 기존 QR은 만료되고, 입실 기록은 유지됩니다.</p>
      <fieldset disabled={pending || savingTime || activeSession.status !== "SCHEDULED"} className="mt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field min-w-0">시작 (한국시간)<input type="datetime-local" required value={startsAt} onChange={e => setStartsAt(e.target.value)} /></label>
          <label className="field min-w-0">종료 (한국시간)<input type="datetime-local" required value={endsAt} onChange={e => setEndsAt(e.target.value)} /></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className="btn-secondary" onClick={useNextTwoHours}>지금부터 2시간</button>
          <button type="submit" className="btn-primary">{savingTime ? "시간 저장 중…" : "시간 저장"}</button>
        </div>
      </fieldset>
      {timeMessage && <p role="status" className="mt-3 text-sm text-teal-900">{timeMessage}</p>}
    </form>}
    <div className="grid items-center gap-8 py-8 md:grid-cols-2">
      <div className="min-w-0 text-center">
        <div className="mx-auto flex aspect-square w-full max-w-sm items-center justify-center rounded-2xl border-4 border-teal-800 bg-white p-3">
          {valid && open ? <Image src={image} alt="수강생 입실 확인 QR" width={400} height={400} unoptimized className="h-auto w-full" />
            : <p className="p-6 text-slate-600">{savingTime ? "수업 시간을 저장하고 있습니다…" : pending ? "QR을 발급하고 있습니다…" : running ? "QR이 만료되었습니다. 새로 발급해 주세요." : "수업 시작 후 QR 입실 확인을 시작해 주세요."}</p>}
        </div>
        {valid && open && <p className="mt-3 text-sm text-teal-800">유효시간 {Math.max(0, Math.ceil((Date.parse(challenge!.expires_at) - now) / 1000))}초 · 60초마다 갱신</p>}
      </div>
      <div>
        <span className="badge">수강 확정 {enrolledCount}명</span>
        <h2 className="mt-4 text-2xl font-bold">{activeSession.title}</h2>
        <p className="mt-2">{offering.name}</p>
        <p className="my-3 text-sm text-slate-600">{koreanTime(activeSession.starts_at)} ~ {koreanTime(activeSession.ends_at)} (한국시간)</p>
        <ol className="my-6 list-inside list-decimal space-y-3 text-sm text-slate-600">
          <li>수강생이 휴대전화 카메라로 QR을 스캔합니다.</li>
          <li>수강 확정 계정으로 로그인하고 ‘내 입실 확인하기’를 누릅니다.</li>
          <li>강사는 출석부의 입실 시각을 확인하고 수업 종료 후 실제 출석시간을 확정합니다.</li>
        </ol>
        <p className="notice mb-5">입실 확인만으로 전체 수업시간이나 수료가 자동 인정되지는 않습니다. 카메라를 사용할 수 없는 수강생은 강사에게 확인을 요청하세요.</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-primary" disabled={pending || savingTime || !open} onClick={generate}><QrCode className="mr-2 inline h-4 w-4" />{running ? "QR 새로 발급" : "QR 입실 확인 시작"}</button>
          <button type="button" className="btn-secondary" disabled={pending || savingTime} onClick={stop}>QR 중지</button>
          <button type="button" className="btn-secondary" disabled={!valid || !open || pending || savingTime} onClick={copy}>링크 복사</button>
        </div>
        {!open && now > 0 && <p className="mt-4 text-sm text-slate-600">현재 진행 중인 정상 수업에서만 시작할 수 있습니다.</p>}
        {message && <p role="status" className="mt-4 text-sm text-teal-900">{message}</p>}
      </div>
    </div>
  </section>;
}
