export type VendorMembershipState = "NONE" | "PENDING" | "ACTIVE" | "RESTRICTED";

export type VendorOnboardingChecklistItem = {
  key: "profile" | "services" | "approval" | "public";
  label: string;
  complete: boolean;
  detail: string;
};

export type VendorOnboardingState = {
  membershipStatus: VendorMembershipState;
  isPubliclyListed: boolean;
  publiclyListedAt: string | null;
  serviceDraftCount: number;
  publishedServiceCount: number;
  missingProfileFields: string[];
  hasRequiredProfileFields: boolean;
  readyForAdminReview: boolean;
  readyForPublicVisibility: boolean;
  vendorVisibleToPublic: boolean;
  approvalLabel: string;
  publicVisibilityLabel: string;
  nextStep: string;
  checklist: VendorOnboardingChecklistItem[];
};

type BuildVendorOnboardingStateInput = {
  membershipStatus: VendorMembershipState | string | null | undefined;
  isPubliclyListed: boolean;
  publiclyListedAt?: string | null | undefined;
  serviceDraftCount: number;
  publishedServiceCount: number;
  businessName?: string | null | undefined;
  businessType?: string | null | undefined;
  category?: string | null | undefined;
  bio?: string | null | undefined;
  address?: string | null | undefined;
  city?: string | null | undefined;
  state?: string | null | undefined;
  zipCode?: string | null | undefined;
  phone?: string | null | undefined;
  email?: string | null | undefined;
};

function hasValue(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

function normalizeMembershipStatus(value: BuildVendorOnboardingStateInput["membershipStatus"]): VendorMembershipState {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "ACTIVE") return "ACTIVE";
  if (normalized === "PENDING") return "PENDING";
  if (normalized === "RESTRICTED") return "RESTRICTED";
  return "NONE";
}

export function buildVendorOnboardingState(
  input: BuildVendorOnboardingStateInput
): VendorOnboardingState {
  const membershipStatus = normalizeMembershipStatus(input.membershipStatus);
  const missingProfileFields: string[] = [];

  if (!hasValue(input.businessName)) missingProfileFields.push("business name");
  if (!hasValue(input.businessType)) missingProfileFields.push("business type");
  if (!hasValue(input.category)) missingProfileFields.push("primary service category");
  if (!hasValue(input.bio)) missingProfileFields.push("business description");
  if (!hasValue(input.address)) missingProfileFields.push("street address");
  if (!hasValue(input.city)) missingProfileFields.push("city");
  if (!hasValue(input.state)) missingProfileFields.push("state");
  if (!hasValue(input.zipCode)) missingProfileFields.push("ZIP code");
  if (!hasValue(input.phone)) missingProfileFields.push("phone number");
  if (!hasValue(input.email)) missingProfileFields.push("business email");

  const hasRequiredProfileFields = missingProfileFields.length === 0;
  const serviceDraftCount = Math.max(0, Number(input.serviceDraftCount || 0));
  const publishedServiceCount = Math.max(0, Number(input.publishedServiceCount || 0));
  const isPubliclyListed = Boolean(input.isPubliclyListed);
  const readyForAdminReview = hasRequiredProfileFields && serviceDraftCount > 0;
  const readyForPublicVisibility =
    membershipStatus === "ACTIVE" && isPubliclyListed && publishedServiceCount > 0;
  const vendorVisibleToPublic = readyForPublicVisibility;

  let approvalLabel = "Vendor setup not started";
  if (membershipStatus === "PENDING") approvalLabel = "Pending admin approval";
  if (membershipStatus === "ACTIVE") approvalLabel = "Approved for vendor access";
  if (membershipStatus === "RESTRICTED") approvalLabel = "Vendor access restricted";

  let publicVisibilityLabel = "Not publicly visible yet";
  if (membershipStatus === "PENDING") {
    publicVisibilityLabel = "Waiting for admin approval before public listing";
  } else if (membershipStatus === "ACTIVE" && !isPubliclyListed) {
    publicVisibilityLabel = "Approved, but not publicly listed yet";
  } else if (membershipStatus === "ACTIVE" && isPubliclyListed && publishedServiceCount === 0) {
    publicVisibilityLabel = "Listed internally, waiting for a published service";
  } else if (readyForPublicVisibility) {
    publicVisibilityLabel = "Publicly visible";
  }

  let nextStep = "Complete your vendor setup.";
  if (!hasRequiredProfileFields) {
    nextStep = `Finish your business profile. Missing: ${missingProfileFields.join(", ")}.`;
  } else if (serviceDraftCount === 0) {
    nextStep = "Add at least one service offering with a customer-facing price.";
  } else if (membershipStatus === "PENDING") {
    nextStep =
      "Your business profile and services are saved. Wait for admin approval while refining your details.";
  } else if (membershipStatus === "ACTIVE" && !isPubliclyListed) {
    nextStep = "Admin approval is complete. Wait for your vendor listing to be made public.";
  } else if (membershipStatus === "ACTIVE" && isPubliclyListed && publishedServiceCount === 0) {
    nextStep = "Your vendor listing is public, but at least one service still needs admin publishing.";
  } else if (readyForPublicVisibility) {
    nextStep = "Your vendor listing is publicly visible.";
  }

  const checklist: VendorOnboardingChecklistItem[] = [
    {
      key: "profile",
      label: "Business profile",
      complete: hasRequiredProfileFields,
      detail: hasRequiredProfileFields
        ? "Core business details are complete."
        : `Missing: ${missingProfileFields.join(", ")}.`,
    },
    {
      key: "services",
      label: "Service offerings",
      complete: serviceDraftCount > 0,
      detail:
        serviceDraftCount > 0
          ? `${serviceDraftCount} saved service${serviceDraftCount === 1 ? "" : "s"}.`
          : "Add at least one service offering with pricing before admin review.",
    },
    {
      key: "approval",
      label: "Admin approval",
      complete: membershipStatus === "ACTIVE",
      detail:
        membershipStatus === "ACTIVE"
          ? "Vendor access is approved."
          : membershipStatus === "PENDING"
            ? "Admin still needs to approve this vendor account."
            : "Vendor approval has not been completed yet.",
    },
    {
      key: "public",
      label: "Public visibility",
      complete: vendorVisibleToPublic,
      detail: vendorVisibleToPublic
        ? `${publishedServiceCount} published service${publishedServiceCount === 1 ? "" : "s"} can appear publicly.`
        : isPubliclyListed
          ? "The vendor listing is public, but customer-visible services are still unpublished."
          : "The vendor listing is not public yet.",
    },
  ];

  return {
    membershipStatus,
    isPubliclyListed,
    publiclyListedAt: input.publiclyListedAt ? String(input.publiclyListedAt) : null,
    serviceDraftCount,
    publishedServiceCount,
    missingProfileFields,
    hasRequiredProfileFields,
    readyForAdminReview,
    readyForPublicVisibility,
    vendorVisibleToPublic,
    approvalLabel,
    publicVisibilityLabel,
    nextStep,
    checklist,
  };
}
