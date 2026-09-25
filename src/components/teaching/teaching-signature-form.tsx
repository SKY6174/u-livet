"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { ActionForm } from "@/components/portal/action-form";
import { signTeaching } from "@/app/certificate-actions";
import { AdvisorySignaturePad } from "@/features/instructor-documents/components/advisory/advisory-signature-pad";

// The teaching-signature RPC accepts image data URLs up to 200,000 characters.
// Normalize both drawn and uploaded signatures before placing them in FormData.
async function fitTeachingSignature(dataUrl: string): Promise<string> {
  const source = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("SIGNATURE_IMAGE_INVALID"));
    image.src = dataUrl;
  });
  if (!source.naturalWidth || !source.naturalHeight)
    throw new Error("SIGNATURE_IMAGE_INVALID");
  const ratio = Math.min(1, 640 / source.naturalWidth, 260 / source.naturalHeight);
  for (const shrink of [1, 0.75, 0.55]) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.naturalWidth * ratio * shrink));
    canvas.height = Math.max(1, Math.round(source.naturalHeight * ratio * shrink));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("SIGNATURE_CANVAS_UNAVAILABLE");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL("image/png");
    if (png.length < 200_000) return png;
    for (const quality of [0.85, 0.65, 0.45]) {
      const jpeg = canvas.toDataURL("image/jpeg", quality);
      if (jpeg.length < 200_000) return jpeg;
    }
  }
  throw new Error("SIGNATURE_IMAGE_TOO_LARGE");
}

export function TeachingSignatureForm({ log, revision, existing }: {
  log: string; revision: number; existing: string | null;
}) {
  const [image, setImage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const latestChange = useRef(0);
  const updateSignature = async (next: string) => {
    const change = ++latestChange.current;
    setImage("");
    setError("");
    if (!next) {
      setProcessing(false);
      return;
    }
    setProcessing(true);
    try {
      const fitted = await fitTeachingSignature(next);
      if (change === latestChange.current) setImage(fitted);
    } catch {
      if (change === latestChange.current)
        setError("서명 이미지를 처리하지 못했습니다. 다시 서명하거나 다른 PNG/JPG 파일을 선택해 주세요.");
    } finally {
      if (change === latestChange.current) setProcessing(false);
    }
  };
  return <ActionForm action={signTeaching} label={existing ? "서명 다시 등록" : "강의날인부 서명 등록"} disabled={!image || processing} resetOnSuccess={false}>
    <p className="text-sm text-slate-600">
      매회차 강의가 끝난 당일 본인 서명을 등록해 주세요. 스마트폰 터치·전자펜·트랙패드로 직접 서명하거나 PNG/JPG 이미지를 올릴 수 있습니다. 운영진 승인 후 강의날인부에 반영됩니다.
    </p>
    <AdvisorySignaturePad signatureUrl={existing ?? undefined} onChange={updateSignature} />
    {processing && <p role="status" className="text-sm text-slate-600">서명 이미지를 처리하고 있습니다.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {image && <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="mb-2 text-sm font-semibold">제출할 서명 미리보기</p>
      <Image src={image} width={200} height={90} unoptimized alt="이번 회차에 제출할 본인 서명" className="max-h-24 w-auto object-contain" />
    </div>}
    <input type="hidden" name="log" value={log} />
    <input type="hidden" name="revision" value={revision} />
    <input type="hidden" name="image" value={image} />
  </ActionForm>;
}
