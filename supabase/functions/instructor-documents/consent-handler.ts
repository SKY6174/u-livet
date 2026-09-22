import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";
import {
  CONSENT_TITLES,
  TEMPLATE_VERSION,
  emptyConsent,
  isConsentType,
  normalizeConsent,
  renderConsentPdf,
  consentStatus,
} from "../_shared/instructor-consent.ts";
import type { ConsentAssets } from "../_shared/instructor-consent.ts";
let assets: Promise<ConsentAssets> | undefined;
const loadAssets = () =>
  (assets ??= Promise.all(
    [
      "KoPubDotum-Medium.ttf",
      "KoPubDotum-Bold.ttf",
      "criminal-consent.pdf",
    ].map((name) =>
      Deno.readFile(new URL(`./assets/${name}`, import.meta.url)),
    ),
  )
    .then(([regular, bold, criminal]) => ({ regular, bold, criminal }))
    .catch((e) => {
      assets = undefined;
      throw e;
    }));
export const CONSENT_ACTIONS = [
  "consent-context",
  "consent-save-draft",
  "consent-submit",
  "consent-download",
];
type Dependencies = {
  service: SupabaseClient;
  encrypt: (value: unknown) => Promise<{ ciphertext: string; iv: string }>;
  decrypt: (ciphertext: string, iv: string) => Promise<unknown>;
  sha256: (value: string | Uint8Array) => Promise<string>;
  fail: (
    code:
      | "INVALID_DOCUMENT"
      | "CONFLICT"
      | "NOT_FOUND"
      | "SERVER_ERROR"
      | "STORAGE_UPLOAD_FAILED",
    message: string,
    status?: number,
  ) => Error;
};
export async function handleConsentAction(
  action: string,
  body: Record<string, unknown>,
  access: { id: string; org_id: string; [key: string]: unknown },
  actorUserId: string | null,
  deps: Dependencies,
) {
  const { service, encrypt, decrypt, sha256, fail } = deps,
    type = body.document_type;
  if (!isConsentType(type))
    throw fail("INVALID_DOCUMENT", "서류 종류를 확인해 주세요.");
  const scope = {
    org_id: access.org_id,
    person_id: access.id,
    document_type: type,
  };
  const table = "life_instructor_consent_forms",
    draftTable = "life_instructor_consent_drafts",
    bucket = service.storage.from("instructor-private-documents");
  const check = (error: unknown) => {
    if (error)
      throw fail(
        "SERVER_ERROR",
        "서류 처리에 실패했습니다. 다시 시도해 주세요.",
        500,
      );
  };
  const metadata = "id,document_type,status,submitted_at,template_version";
  if (action === "consent-context") {
    const [draft, latest, history] = await Promise.all([
      service
        .from(draftTable)
        .select("encrypted_payload,payload_iv")
        .match(scope)
        .maybeSingle(),
      service
        .from(table)
        .select("encrypted_payload,payload_iv")
        .match(scope)
        .order("submitted_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle(),
      service
        .from(table)
        .select(metadata)
        .match(scope)
        .order("submitted_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(20),
    ]);
    for (const result of [draft, latest, history]) check(result.error);
    const stored = draft.data ?? latest.data;
    const form = stored
      ? await decrypt(stored.encrypted_payload, stored.payload_iv)
      : emptyConsent(
          String(access.name ?? ""),
          String(access.organization ?? ""),
        );
    // Reusing a submitted form never reuses the prior signature or consent choices.
    if (!draft.data && latest.data && form && typeof form === "object")
      Object.assign(form, {
        signature: "",
        privacy_consent: "",
        unique_id_consent: "",
        criminal_consent: false,
        integrity_confirm: false,
        relations: ["", "", ""],
        date: emptyConsent("").date,
      });
    return { form, history: history.data ?? [], has_draft: !!draft.data };
  }
  if (action === "consent-download") {
    if (!/^[0-9a-f-]{36}$/i.test(String(body.id ?? "")))
      throw fail("INVALID_DOCUMENT", "문서 번호를 확인해 주세요.");
    const { data, error } = await service
      .from(table)
      .select("object_path")
      .match(scope)
      .eq("id", String(body.id ?? ""))
      .maybeSingle();
    check(error);
    if (!data)
      throw fail("NOT_FOUND", "이 서류함에서 확인할 수 없는 문서입니다.", 404);
    const signed = await bucket.createSignedUrl(data.object_path, 300, {
      download: `${CONSENT_TITLES[type]}.pdf`,
    });
    check(signed.error);
    return { signed_url: signed.data!.signedUrl };
  }
  const final = action === "consent-submit";
  let form;
  try {
    form = normalizeConsent(type, body.form, String(access.name ?? ""), final);
  } catch (e) {
    throw fail(
      "INVALID_DOCUMENT",
      e instanceof Error ? e.message : "입력 내용을 확인해 주세요.",
    );
  }
  const encrypted = await encrypt(form);
  if (!final) {
    const { error } = await service
      .from(draftTable)
      .upsert(
        {
          ...scope,
          encrypted_payload: encrypted.ciphertext,
          payload_iv: encrypted.iv,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,person_id,document_type" },
      );
    check(error);
    return { saved: true };
  }
  const id = String(body.request_id ?? "");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    throw fail("INVALID_DOCUMENT", "제출 요청을 새로 시작해 주세요.");
  const payloadHash = await sha256(JSON.stringify(form));
  const previous = await service
    .from(table)
    .select(`${metadata},payload_hash,org_id,person_id`)
    .eq("id", id)
    .maybeSingle();
  check(previous.error);
  if (previous.data) {
    if (
      previous.data.payload_hash !== payloadHash ||
      previous.data.org_id !== access.org_id ||
      previous.data.person_id !== access.id ||
      previous.data.document_type !== type
    )
      throw fail("CONFLICT", "이미 사용된 제출 요청입니다.");
    return { saved: true, id };
  }
  let bytes: Uint8Array;
  try {
    bytes = await renderConsentPdf(type, form, await loadAssets(), false);
  } catch (e) {
    if (e instanceof Error && e.message.includes("서명"))
      throw fail("INVALID_DOCUMENT", e.message);
    throw fail(
      "SERVER_ERROR",
      "PDF 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      500,
    );
  }
  const startedAt = new Date().toISOString(),
    path = `${access.org_id}/${access.id}/consents/${type}/${id}.pdf`;
  const upload = await bucket.upload(path, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upload.error)
    throw fail(
      "STORAGE_UPLOAD_FAILED",
      "PDF 저장에 실패했습니다. 같은 요청으로 다시 시도해 주세요.",
      503,
    );
  const saved = await service
    .from(table)
    .insert({
      ...scope,
      id,
      template_version: TEMPLATE_VERSION,
      encrypted_payload: encrypted.ciphertext,
      payload_iv: encrypted.iv,
      payload_hash: payloadHash,
      status: consentStatus(type, form),
      actor_user_id: actorUserId,
      actor_kind: actorUserId ? "LOGIN" : "PIN",
      object_path: path,
      sha256: await sha256(bytes),
      size_bytes: bytes.length,
    });
  if (saved.error) {
    await bucket.remove([path]);
    check(saved.error);
  }
  // Do not remove a newer draft saved from a second window.
  await service
    .from(draftTable)
    .delete()
    .match(scope)
    .lte("updated_at", startedAt);
  return { saved: true, id, status: consentStatus(type, form) };
}
