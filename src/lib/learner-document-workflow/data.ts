import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  LearnerDocumentAdminContext,
  LearnerDocumentEligibility,
  LearnerDocumentKind,
  LearnerDocumentRequest,
  LearnerDocumentStatus,
} from "./types";

export async function getLearnerDocumentEligibility(): Promise<
  LearnerDocumentEligibility[]
> {
  try {
    const { data, error } = await (
      await createServerSupabaseClient()
    ).rpc("life_learner_document_eligibility");
    return error || !Array.isArray(data)
      ? []
      : (data as LearnerDocumentEligibility[]);
  } catch {
    return [];
  }
}

export async function getMyLearnerDocuments(): Promise<
  LearnerDocumentRequest[]
> {
  try {
    const { data, error } = await (
      await createServerSupabaseClient()
    ).rpc("life_my_learner_documents");
    return error || !Array.isArray(data)
      ? []
      : (data as LearnerDocumentRequest[]);
  } catch {
    return [];
  }
}

export async function getAdminLearnerDocuments(filters: {
  kind: LearnerDocumentKind | null;
  status: LearnerDocumentStatus | null;
  query: string;
}): Promise<LearnerDocumentAdminContext | null> {
  try {
    const { data, error } = await (
      await createServerSupabaseClient()
    ).rpc("life_admin_learner_documents", {
      k: filters.kind,
      s: filters.status,
      q: filters.query || null,
    });
    return error || !data ? null : (data as LearnerDocumentAdminContext);
  } catch {
    return null;
  }
}
