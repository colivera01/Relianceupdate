import { runStructuredAiTask } from "./client";
import { assertVendorApprovalAssistantOutputSafe } from "./output-guards";
import { VENDOR_APPROVAL_ASSISTANT_PROMPT_VERSION } from "./prompt-registry";
import {
  type VendorApprovalAssistantResult,
  vendorApprovalAssistantResultSchema,
} from "./schemas";

export type VendorApprovalAssistantContext = {
  vendorId: string;
  businessName: string;
  ownerName: string | null;
  category: string | null;
  businessType: string | null;
  submittedAt: string | null;
  createdAt: string | null;
  foundedYear: number | null;
  yearsInBusiness: number | null;
  vendorEmail: string | null;
  managerEmail: string | null;
  vendorPhone: string | null;
  managerPhone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  hasBusinessBio: boolean;
  hasWebsite: boolean;
  hasLicenseNumber: boolean;
  insuranceStatus: boolean;
  bondingStatus: boolean;
  hasServiceTypes: boolean;
  hasSpecializations: boolean;
  hasServiceAreas: boolean;
  geocoded: boolean;
  emailVerified: boolean;
  authCredentialCreatedAt: string | null;
  membershipStatus: string;
  serviceDraftCount: number;
  publishedServiceCount: number;
};

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

function optionalText(value: string | null): string {
  return value && value.trim() ? value.trim() : "Not provided";
}

export function buildVendorApprovalAssistantInput(
  context: VendorApprovalAssistantContext
): string {
  return [
    "Reliance admin vendor approval request.",
    "Important scope: this is an internal recommendation for vendor access approval only.",
    "Do not treat public listing readiness, published services, or marketing readiness as the same thing as access approval.",
    "You only know the application data supplied below.",
    "Do not claim to have checked external websites, licenses, insurance carriers, state registrations, or identity documents unless that proof is explicitly included in the data.",
    "Do not claim interviews, phone calls, or manual verification work.",
    "Be conservative when application data is incomplete or internally inconsistent.",
    "",
    `Vendor ID: ${context.vendorId}`,
    `Business name: ${context.businessName}`,
    `Owner/manager name: ${optionalText(context.ownerName)}`,
    `Category: ${optionalText(context.category)}`,
    `Business type: ${optionalText(context.businessType)}`,
    `Submitted at: ${optionalText(context.submittedAt)}`,
    `Vendor profile created at: ${optionalText(context.createdAt)}`,
    `Founded year: ${context.foundedYear ?? "Not provided"}`,
    `Years in business: ${context.yearsInBusiness ?? "Unknown"}`,
    "",
    "Contact and sign-in state:",
    `Vendor email: ${optionalText(context.vendorEmail)}`,
    `Manager email: ${optionalText(context.managerEmail)}`,
    `Vendor phone: ${optionalText(context.vendorPhone)}`,
    `Manager phone: ${optionalText(context.managerPhone)}`,
    `Email verified: ${yesNo(context.emailVerified)}`,
    `Credential created at: ${optionalText(context.authCredentialCreatedAt)}`,
    `Pending membership status: ${context.membershipStatus}`,
    "",
    "Business profile completeness:",
    `Street address: ${optionalText(context.address)}`,
    `City: ${optionalText(context.city)}`,
    `State: ${optionalText(context.state)}`,
    `ZIP code: ${optionalText(context.zipCode)}`,
    `Geocoded: ${yesNo(context.geocoded)}`,
    `Business bio present: ${yesNo(context.hasBusinessBio)}`,
    `Website present: ${yesNo(context.hasWebsite)}`,
    `License number present: ${yesNo(context.hasLicenseNumber)}`,
    `Insurance flagged on profile: ${yesNo(context.insuranceStatus)}`,
    `Bonding flagged on profile: ${yesNo(context.bondingStatus)}`,
    `Service types present: ${yesNo(context.hasServiceTypes)}`,
    `Specializations present: ${yesNo(context.hasSpecializations)}`,
    `Service areas present: ${yesNo(context.hasServiceAreas)}`,
    "",
    "Service setup context:",
    `Services offered saved: ${context.serviceDraftCount}`,
    `Published services: ${context.publishedServiceCount}`,
    "Reminder: lack of published services does NOT block access approval by itself. It only affects public visibility later.",
  ].join("\n");
}

export const VENDOR_APPROVAL_ASSISTANT_INSTRUCTIONS = `
You are the Reliance AI Vendor Approval Assistant.

Your job is to help an admin reviewer decide whether a vendor application looks ready for account-access approval, needs manual follow-up, or should be rejected in its current state.

Constraints:
- You are recommendation-only. The admin makes the final decision.
- This is about vendor access approval, not public marketplace publishing.
- Do not treat lack of published services as a reason to reject vendor access.
- Do not invent external verification. You only know the application data supplied to you.
- Be cautious with unverified email, missing core contact details, inconsistent contact records, or unusually thin applications.
- Use "recommend_approve" when the application looks internally consistent and complete enough for access review.
- Use "needs_manual_review" when the application may still be approvable but an admin should pause because something important is missing, unverified, or inconsistent.
- Use "recommend_reject" when the application is materially incomplete or clearly inconsistent in its current form.
- Keep language short, factual, and admin-friendly.

Output requirements:
- Return valid JSON only.
- Findings should point to the strongest approval signals or concerns.
- Blocking issues should list only the things that could reasonably stop or delay approval.
- Recommended actions should be concrete next steps for the admin.
- Scope notes should clarify what this recommendation does not decide, especially public listing or service publishing.
`.trim();

export function normalizeVendorApprovalAssistantResult(
  context: VendorApprovalAssistantContext,
  result: VendorApprovalAssistantResult
): VendorApprovalAssistantResult {
  const missingCoreContact =
    !context.vendorEmail ||
    !context.managerEmail ||
    !context.vendorPhone ||
    !context.address ||
    !context.city ||
    !context.state ||
    !context.zipCode;

  const blockingIssues = [...result.blockingIssues];
  const recommendedActions = [...result.recommendedActions];
  const scopeNotes = [...result.scopeNotes];
  let decision = result.decision;
  let confidence = result.confidence;

  if (!context.emailVerified) {
    decision = "needs_manual_review";
    confidence = confidence === "high" ? "medium" : confidence;
    if (
      !blockingIssues.includes(
        "Email is not verified yet, so the vendor still cannot sign in even if admin approval is granted."
      )
    ) {
      blockingIssues.unshift(
        "Email is not verified yet, so the vendor still cannot sign in even if admin approval is granted."
      );
    }
    if (
      !recommendedActions.includes(
        "Wait for email verification or confirm the account holder can complete verification before final approval."
      )
    ) {
      recommendedActions.unshift(
        "Wait for email verification or confirm the account holder can complete verification before final approval."
      );
    }
  }

  if (missingCoreContact && decision === "recommend_approve") {
    decision = "needs_manual_review";
    confidence = "medium";
    if (!blockingIssues.includes("Core contact or address details are incomplete in the saved application.")) {
      blockingIssues.unshift("Core contact or address details are incomplete in the saved application.");
    }
  }

  if (
    !scopeNotes.includes(
      "Vendor access approval does not publish the business publicly. Public listing still depends on vendor approval status, vendor listing controls, and service publishing."
    )
  ) {
    scopeNotes.unshift(
      "Vendor access approval does not publish the business publicly. Public listing still depends on vendor approval status, vendor listing controls, and service publishing."
    );
  }

  return {
    ...result,
    decision,
    confidence,
    blockingIssues: blockingIssues.slice(0, 6),
    recommendedActions: recommendedActions.slice(0, 6),
    scopeNotes: scopeNotes.slice(0, 4),
  };
}

export async function getVendorApprovalAssistantSuggestion(
  context: VendorApprovalAssistantContext,
  actorUserId: string
) {
  const result = await runStructuredAiTask({
    feature: "vendor_approval_assistant",
    operation: "review_vendor_application",
    schema: vendorApprovalAssistantResultSchema,
    instructions: VENDOR_APPROVAL_ASSISTANT_INSTRUCTIONS,
    input: buildVendorApprovalAssistantInput(context),
    promptVersion: VENDOR_APPROVAL_ASSISTANT_PROMPT_VERSION,
    actorUserId,
    entityId: context.vendorId,
    metadata: {
      analysisScope: "vendor_access_approval",
      vendorId: context.vendorId,
      emailVerified: context.emailVerified,
      membershipStatus: context.membershipStatus,
      serviceDraftCount: context.serviceDraftCount,
      publishedServiceCount: context.publishedServiceCount,
    },
    maxOutputTokens: 700,
    reasoningEffort: "low",
    validateData: assertVendorApprovalAssistantOutputSafe,
  });

  return {
    ...result,
    data: normalizeVendorApprovalAssistantResult(context, result.data),
  };
}
