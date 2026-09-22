"use client";
import { useState } from "react";
import { ActionForm } from "@/components/portal/action-form";
import { signTeaching } from "@/app/certificate-actions";
import { AdvisorySignaturePad } from "@/features/instructor-documents/components/advisory/advisory-signature-pad";

export function TeachingSignatureForm({ log, revision, existing }: {
  log: string; revision: number; existing: string | null;
}) {
  const [image, setImage] = useState("");
  return <ActionForm action={signTeaching} label={existing ? "서명 다시 등록" : "강의날인부 서명 등록"} disabled={!image} resetOnSuccess={false}>
    <p className="text-sm text-slate-600">실적 구간을 확인한 뒤 본인이 서명해 주세요. 운영진 승인 후 강의날인부에 자동 반영됩니다.</p>
    <AdvisorySignaturePad signatureUrl={existing ?? undefined} onChange={(next) => setImage(next)} />
    <input type="hidden" name="log" value={log} />
    <input type="hidden" name="revision" value={revision} />
    <input type="hidden" name="image" value={image} />
  </ActionForm>;
}
