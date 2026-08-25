export type VendorJobLifecycleTone = "green" | "blue" | "amber" | "red";

export type VendorJobLifecyclePresentation = {
  label: string;
  detail: string;
  actionLabel: string;
  tone: VendorJobLifecycleTone;
  why: string;
  responsibleParticipant: string;
  resolution: string;
};

export type VendorJobLifecycleInput = {
  status?: string | null;
  operationalPhase?: string | null;
  rejectedMedia?: boolean;
  rejectionReason?: string | null;
  adminAuditDecision?: string | null;
  adminAuditRejectionCategory?: string | null;
  adminAuditRejectionReason?: string | null;
  adminAuditDecidedAt?: string | Date | null;
  correctionPending?: boolean;
  locationSelected?: boolean;
  permissionRequired?: boolean;
  permissionState?: string | null;
  hasCustomerContact?: boolean;
  assigned?: boolean;
  allVideosPresent?: boolean;
  nextStageLabel?: string | null;
  serviceOrderSent?: boolean;
  consentRecipientLabel?: string | null;
};

export type PermissionRefreshFeedback = {
  tone: "info" | "success" | "warning" | "error";
  message: string;
};

function normalized(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

export function getPermissionRefreshFeedback(value: unknown): PermissionRefreshFeedback {
  const state = normalized(value);
  if (["ACCEPTED", "ALLOWED"].includes(state)) return { tone: "success", message: "Customer permission approved." };
  if (state === "DECLINED") return { tone: "warning", message: "Customer declined recording." };
  if (["WRONG_RECIPIENT", "RECIPIENT_MISMATCH"].includes(state)) {
    return { tone: "warning", message: "Recording request reported as wrong recipient." };
  }
  if (state) return { tone: "info", message: "Still waiting for customer permission." };
  return { tone: "error", message: "Permission status could not be refreshed. Try again." };
}

function result(
  label: string,
  detail: string,
  actionLabel: string,
  tone: VendorJobLifecycleTone,
  responsibleParticipant: string,
  resolution: string,
): VendorJobLifecyclePresentation {
  return { label, detail, actionLabel, tone, why: detail, responsibleParticipant, resolution };
}

export function resolveVendorJobLifecyclePresentation(
  input: VendorJobLifecycleInput,
): VendorJobLifecyclePresentation {
  const status = normalized(input.status);
  const phase = normalized(input.operationalPhase);
  const permissionState = normalized(input.permissionState);
  const nextStage = String(input.nextStageLabel || "next stage").trim() || "next stage";
  const recipient = String(input.consentRecipientLabel || "the customer").trim() || "the customer";
  const auditDecision = normalized(input.adminAuditDecision);
  const auditDate = input.adminAuditDecidedAt
    ? new Date(input.adminAuditDecidedAt).toLocaleString()
    : "";

  if (status === "CANCELED" || status === "CANCELLED") {
    if (permissionState === "DECLINED") {
      return result(
        "Recording Declined - Reliance Work Record Canceled",
        "The customer declined Reliance recording permission. This Reliance work record is permanently closed; the underlying service arrangement is separate.",
        "View Job",
        "red",
        "No participant needs to act in Reliance",
        "Keep this read-only record and its permission evidence as history.",
      );
    }
    return result(
      "Service Order canceled",
      "Recording and further work are permanently closed for this Service Order.",
      "View Job",
      "red",
      "No participant needs to act",
      "Keep this read-only record as historical evidence.",
    );
  }
  if (auditDecision === "PASS") {
    return result(
      "Reliance Audit Passed",
      `Reliance approved the exact submitted Service Video package and released the Private Proof to the customer.${auditDate ? ` Audit completed ${auditDate}.` : ""} This does not make any video Public.`,
      "View Job",
      "green",
      "No participant needs to act",
      "Keep the approved package and audit decision as read-only evidence. Public Proof remains a separate workflow.",
    );
  }
  if (auditDecision === "REJECT") {
    const category = String(input.adminAuditRejectionCategory || "").trim();
    const reason = String(input.adminAuditRejectionReason || input.rejectionReason || "").trim();
    const evidenceDetail = [category ? `Category: ${category}.` : "", reason ? `Reason: ${reason}` : ""]
      .filter(Boolean)
      .join(" ");
    return result(
      "Reliance Audit Failed",
      `Reliance reviewed this Service Video package and it did not meet the required audit standards. This Reliance work record is permanently closed and cannot be rerecorded; correction, retry, and resubmission are not available. This does not mean the underlying real-world service failed.${evidenceDetail ? ` ${evidenceDetail}` : ""}${auditDate ? ` Audit completed ${auditDate}.` : ""}`,
      "View Job",
      "red",
      "No participant needs to act",
      "Keep the package, stage versions, and audit decision as read-only historical evidence.",
    );
  }
  if (phase === "REJECTED" || status === "REJECTED" || input.rejectedMedia) {
    const detail = input.rejectionReason
      ? `Reason: ${String(input.rejectionReason).trim()}`
      : "One or more Service Video stages were rejected. This work record is closed unless a new Service Order is created.";
    return result("Rejected / closed", detail, "View Job", "red", "Vendor manager", "Review the preserved record and create a new Service Order if work must continue.");
  }
  if (phase === "AWAITING_ADMIN_REVIEW") {
    return result(
      "Reliance Audit pending",
      "The vendor manager submitted the exact Service Video package for final Reliance Admin Audit. Customer Private Proof remains locked until PASS.",
      "View Job",
      "blue",
      "Reliance admin",
      "Wait for Admin PASS or terminal Admin REJECT. Public eligibility remains a separate later decision.",
    );
  }
  if (phase === "AWAITING_VENDOR_REVIEW" || status === "AWAITING_REVIEW" || status === "AWAITING_MANAGER_REVIEW") {
    return result(
      "Awaiting Manager Review",
      "The completed Service Videos were submitted. Employee recording remains locked during review.",
      "Review Submitted Videos",
      "blue",
      "Vendor manager",
      "Review the three submitted stages and approve them or request a correction for an exact stage.",
    );
  }
  if (input.correctionPending) {
    const detail = input.rejectionReason
      ? `Changes requested: ${String(input.rejectionReason).trim()}`
      : "The manager requested a correction. Only the requested stage may be replaced.";
    return result("Correction requested", detail, "View Job", "amber", "Assigned employee", "Replace the requested stage and resubmit the package for manager review.");
  }
  if (!input.locationSelected) {
    return result(
      "Choose recording location",
      `Select the recording location before ${nextStage}.`,
      "Choose Location",
      "amber",
      "Vendor manager",
      "Choose the truthful service location and complete the recording assessment.",
    );
  }
  if (input.permissionRequired && !input.hasCustomerContact) {
    return result(
      "Missing customer contact",
      "Add the customer contact required for the account-linked Service Video journey.",
      "Open Consent Step",
      "red",
      "Vendor manager",
      "Add a valid customer email before requesting recording permission.",
    );
  }
  if (input.permissionRequired && (permissionState === "ACCEPTED" || permissionState === "ALLOWED")) {
    if (!input.assigned) {
      return result(
        "Recording permission verified - assign employee",
        `Recording permission is verified for ${recipient}.`,
        "Assign Employee",
        "green",
        "Vendor manager",
        "Assign the employee who will receive the Service Order.",
      );
    }
    if (input.allVideosPresent) {
      return result("All videos uploaded", "All three required Service Video stages are present.", "View Job", "green", "Vendor manager", "Open the package and continue the current review workflow.");
    }
    if (input.serviceOrderSent) {
      return result(
        "Service Order Sent",
        "The assigned employee received the Service Order and can complete the authorized recording stages.",
        "Service Order Sent",
        "green",
        "Assigned employee",
        `Complete ${nextStage} from the secure employee Service Order.`,
      );
    }
    return result(
      "Ready to send Service Order",
      `Recording permission is verified for ${recipient}.`,
      "Send Service Order",
      "blue",
      "Vendor manager",
      "Send the secure Service Order to the assigned employee.",
    );
  }
  if (input.permissionRequired && ["REQUESTED", "PENDING", "DELIVERED", "SENDING"].includes(permissionState)) {
    return result(
      "Waiting for customer permission",
      `The recording request was sent to ${recipient}. No decision has been recorded yet.`,
      "Refresh Permission Status",
      "blue",
      "Verified customer contact",
      "Wait for a verified decision. The Service Order remains locked for recording.",
    );
  }
  if (input.permissionRequired && ["WRONG_RECIPIENT", "RECIPIENT_MISMATCH"].includes(permissionState)) {
    return result("Recording request reported as wrong recipient", "Recording remains locked because the request reached the wrong person or contact.", "Correct Customer Contact", "red", "Vendor manager", "Correct the customer contact and send a new permission request.");
  }
  if (input.permissionRequired && permissionState === "DECLINED") {
    return result("Customer declined recording", "The customer declined recording. The service may continue only according to the saved service terms.", "View Consent Step", "red", "Vendor manager", "Proceed without recording or create a new Service Order only when legitimately required.");
  }
  if (input.permissionRequired && ["EXPIRED", "EXPIRED_OR_UNAVAILABLE", "DELIVERY_FAILED", "NO_DIGITAL_CHANNEL"].includes(permissionState)) {
    return result("Permission needs attention", `A current verified decision is not available for ${recipient}.`, "Resend Consent", "amber", "Vendor manager", "Correct delivery details if needed and send a current permission request.");
  }
  if (input.permissionRequired) {
    return result("Verified customer recording permission required", "You may assign an employee for scheduling. Service Order release and recording remain locked until the intended customer makes a verified decision.", "Send Consent", "amber", "Vendor manager", "Send the secure recording-permission request.");
  }
  if (!input.assigned) {
    return result("Assign employee", "This Service Order is ready for assignment.", "Assign Employee", "amber", "Vendor manager", "Assign the employee who will perform the work.");
  }
  if (input.allVideosPresent) {
    return result("All videos uploaded", "All three required Service Video stages are present.", "View Job", "green", "Vendor manager", "Open the package and continue the current review workflow.");
  }
  if (input.serviceOrderSent) {
    return result("Service Order Sent", "The assigned employee received the Service Order.", "Service Order Sent", "green", "Assigned employee", `Complete ${nextStage} from the secure employee Service Order.`);
  }
  return result("Ready to send Service Order", "The employee will verify the saved location before recording begins.", "Send Service Order", "blue", "Vendor manager", "Send the secure Service Order to the assigned employee.");
}
