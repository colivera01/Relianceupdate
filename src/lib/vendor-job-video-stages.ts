export const VENDOR_JOB_VIDEO_STAGES = ["INTRO", "IN_PROGRESS", "COMPLETED"] as const;

export type VendorJobVideoStage = (typeof VENDOR_JOB_VIDEO_STAGES)[number];

export const VENDOR_JOB_VIDEO_STAGE_LABELS: Record<VendorJobVideoStage, string> = {
  INTRO: "Starting Condition",
  IN_PROGRESS: "Work in Progress",
  COMPLETED: "Final Result",
};

export type CustomerProofStage = "before" | "during" | "after";

export const CUSTOMER_PROOF_STAGE_LABELS: Record<CustomerProofStage, string> = {
  before: VENDOR_JOB_VIDEO_STAGE_LABELS.INTRO,
  during: VENDOR_JOB_VIDEO_STAGE_LABELS.IN_PROGRESS,
  after: VENDOR_JOB_VIDEO_STAGE_LABELS.COMPLETED,
};

export function getCustomerProofStageLabel(stage: CustomerProofStage | null | undefined): string {
  return stage ? CUSTOMER_PROOF_STAGE_LABELS[stage] ?? "Service Video" : "Service Video";
}

export function isVendorJobVideoStage(value: string | null | undefined): value is VendorJobVideoStage {
  return Boolean(value && (VENDOR_JOB_VIDEO_STAGES as readonly string[]).includes(String(value).trim().toUpperCase()));
}

export function normalizeVendorJobVideoStage(value: string | null | undefined): VendorJobVideoStage | null {
  const upper = String(value || "").trim().toUpperCase();
  return isVendorJobVideoStage(upper) ? upper : null;
}

/**
 * Resolve UI bucket for a media session (explicit stage wins; then legacy sessionType).
 */
export function resolveVendorJobVideoStageFromSession(session: {
  vendorJobVideoStage?: string | null;
  sessionType?: string | null;
}): VendorJobVideoStage | "LEGACY_OTHER" {
  const direct = normalizeVendorJobVideoStage(session?.vendorJobVideoStage);
  if (direct) return direct;
  const st = String(session?.sessionType || "").trim().toUpperCase();
  if (st.includes("COMPLETION")) return "COMPLETED";
  if (st.includes("PROGRESS")) return "IN_PROGRESS";
  if (st === "JOB_SERVICE_VIDEO") return "LEGACY_OTHER";
  return "LEGACY_OTHER";
}
