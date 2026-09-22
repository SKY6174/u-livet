/* eslint-disable @next/next/no-img-element -- Private upload previews must remain canvas-readable. */
import React from "react";
import { Eraser, Upload } from "lucide-react";
import { normalizeAdvisorySignature } from "../../features/committee/utils/advisory-document-image";

interface AdvisorySignaturePadProps {
  signatureUrl?: string;
  onChange: (dataUrl: string, fileName: string) => void;
}

const SIGNATURE_WIDTH = 760;
const SIGNATURE_HEIGHT = 330;

const fileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ""));
  reader.onerror = () => reject(new Error("FILE_READ_FAILED"));
  reader.readAsDataURL(file);
});

export function AdvisorySignaturePad({ signatureUrl, onChange }: AdvisorySignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawingRef = React.useRef(false);

  const clear = React.useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    onChange("", "");
  }, [onChange]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(SIGNATURE_WIDTH * ratio);
    canvas.height = Math.round(SIGNATURE_HEIGHT * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.clearRect(0, 0, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
    context.strokeStyle = "#111827";
    context.lineWidth = 2.4;
    context.lineCap = "round";
    context.lineJoin = "round";
  }, []);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * SIGNATURE_WIDTH / rect.width,
      y: (event.clientY - rect.top) * SIGNATURE_HEIGHT / rect.height
    };
  };

  const finish = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onChange(event.currentTarget.toDataURL("image/png"), "signature-pad.png");
  };

  const uploadImage = async (file?: File) => {
    if (!file) return;
    const normalized = await normalizeAdvisorySignature(file);
    onChange(await fileToDataUrl(normalized), normalized.name);
  };

  return (
    <div className="advisory-signature-pad">
      <div className="advisory-signature-toolbar"><strong>서명창</strong><span>마우스나 손가락으로 서명하거나 이미지 파일을 올려 주세요.</span><button type="button" onClick={clear}><Eraser size={15} /> 지우기</button><label><Upload size={15} /> 이미지 업로드<input type="file" accept="image/png,image/jpeg" onChange={event => void uploadImage(event.target.files?.[0])} /></label></div>
      <canvas ref={canvasRef} onPointerDown={event => { const context = event.currentTarget.getContext("2d"); if (!context) return; const p = point(event); drawingRef.current = true; event.currentTarget.setPointerCapture(event.pointerId); context.beginPath(); context.moveTo(p.x, p.y); }} onPointerMove={event => { if (!drawingRef.current) return; const context = event.currentTarget.getContext("2d"); if (!context) return; const p = point(event); context.lineTo(p.x, p.y); context.stroke(); }} onPointerUp={finish} onPointerCancel={finish} />
      {signatureUrl && <div className="advisory-current-signature"><span>현재 적용 서명</span><img src={signatureUrl} alt="현재 적용 서명" /></div>}
    </div>
  );
}
