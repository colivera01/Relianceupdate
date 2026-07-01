import type { VendorOnboardingState } from "@/lib/vendor-onboarding-state";

export type TutorialGuideStep = {
  title: string;
  detail: string;
};

export type TutorialGuideLink = {
  label: string;
  href: string;
};

export type TutorialGuide = {
  badge: string;
  title: string;
  summary: string;
  video?: {
    src: string;
    title: string;
    captionsSrc?: string;
    captionsLabel?: string;
  };
  steps: TutorialGuideStep[];
  reminders?: string[];
  relatedLinks?: TutorialGuideLink[];
  futureVideoNote?: string;
};

const APPROVED_TUTORIAL_VERSION = "20260701-approved-audio";

const SERVICE_VIDEOS_AND_REVIEWS_TUTORIAL: TutorialGuide["video"] = {
  src: `/tutorials/service-videos-and-reviews.mp4?v=${APPROVED_TUTORIAL_VERSION}`,
  title: "How Service Videos and Reviews Work on Reliance",
};

const BROWSE_AND_CHOOSE_SERVICES_TUTORIAL: TutorialGuide["video"] = {
  src: `/tutorials/browse-and-choose-services.mp4?v=${APPROVED_TUTORIAL_VERSION}`,
  title: "How To Browse and Choose Services on Reliance",
};

const LAUNCH_VENDOR_PROFILE_TUTORIAL: TutorialGuide["video"] = {
  src: `/tutorials/launch-vendor-profile.mp4?v=${APPROVED_TUTORIAL_VERSION}`,
  title: "How To Launch Your Vendor Profile on Reliance",
};

const EMPLOYEE_SERVICE_ORDER_TUTORIAL: TutorialGuide["video"] = {
  src: `/tutorials/employee-service-order-recording.mp4?v=${APPROVED_TUTORIAL_VERSION}`,
  title: "How To Record an Employee Service Order",
};

const ADMIN_PROMOTED_LISTINGS_TUTORIAL: TutorialGuide["video"] = {
  src: `/tutorials/admin-promoted-listings.mp4?v=${APPROVED_TUTORIAL_VERSION}`,
  title: "How Admin Promoted Listings Work",
};

export const tutorialGuides = {
  customerRegistration: {
    badge: "New customer",
    title: "How customer signup works",
    summary:
      "Create your account first, then sign in and continue browsing vendor services, contacting vendors, and tracking service records from your customer dashboard.",
    video: BROWSE_AND_CHOOSE_SERVICES_TUTORIAL,

    steps: [
      {
        title: "Create the account",
        detail: "Enter your name, email, phone number, and password to create the customer account.",
      },
      {
        title: "Verify and sign in",
        detail: "Reliance sends you to sign in after registration so the next protected step uses a real session.",
      },
      {
        title: "Complete profile later if needed",
        detail: "You can start browsing right away and update profile preferences later from customer settings.",
      },
    ],
    reminders: [
      "Customer Reviews, Verified Service Videos, and the Reliance Trust Score stay separate.",
      "Service-request pages only unlock protected actions after you sign in.",
    ],
    relatedLinks: [
      { label: "Open Help Center", href: "/help?role=customer" },
    ],
    futureVideoNote: "Tutorial video placeholder: Customer signup and first service record",
  },
  vendorRegistration: {
    badge: "New vendor",
    title: "How vendor signup works",
    summary:
      "Create the vendor account, sign in, finish the business profile, add services offered, and wait for admin approval before public visibility.",
    video: LAUNCH_VENDOR_PROFILE_TUTORIAL,

    steps: [
      {
        title: "Create the vendor account",
        detail: "Use this signup flow when you are brand new to Reliance and need vendor access from scratch.",
      },
      {
        title: "Sign in and finish business setup",
        detail: "After registration, sign in and continue through the vendor dashboard, profile, and Services Offered pages.",
      },
      {
        title: "Wait for admin approval and publishing",
        detail: "A vendor can save profile details and services offered before approval, but public visibility happens only after admin review and publishing.",
      },
    ],
    reminders: [
      "Admin approval, public vendor profile, and published services offered are three separate states.",
      "Saved services offered stay internal until Reliance publishes them.",
    ],
    relatedLinks: [
      { label: "Vendor support", href: "/vendor/support" },
    ],
    futureVideoNote: "Tutorial video placeholder: Vendor registration and launch checklist",
  },
  browseMarketplace: {
    badge: "Browse services",
    title: "How to compare providers on Reliance",
    summary:
      "Browse Services shows public service cards, public vendor pages, customer ratings, service videos, and the Reliance Trust Score side by side so customers can compare trust signals before choosing who to contact.",
    video: BROWSE_AND_CHOOSE_SERVICES_TUTORIAL,

    steps: [
      {
        title: "Search or filter first",
        detail: "Use category filters, search, and location-aware sorting to narrow down service examples and services offered.",
      },
      {
        title: "Compare two separate trust signals",
        detail: "Customer Rating reflects public feedback. Reliance Trust Score reflects platform-measured reliability from finalized activity.",
      },
      {
        title: "Open service or vendor detail",
        detail: "Open the service page for service context or the vendor page for the broader business profile.",
      },
    ],
    reminders: [
      "Promoted listings are clearly labeled and can still be suppressed when browse inventory is too thin.",
      "Public videos are visible here only when approved for public viewing.",
    ],
    futureVideoNote: "Tutorial video placeholder: How to compare providers on browse",
  },
  serviceDetail: {
    badge: "Public service page",
    title: "How service detail works",
    summary:
      "This page explains the service offered, the vendor, public review signals, and approved media before you contact or request service.",
    video: SERVICE_VIDEOS_AND_REVIEWS_TUTORIAL,

    steps: [
      {
        title: "Review the service basics",
        detail: "Check pricing, duration, description, and public vendor details first.",
      },
      {
        title: "Use the trust section",
        detail: "Customer Rating and Reliance Trust Score stay separate so you can compare opinion with platform reliability.",
      },
      {
        title: "Request service only when ready",
        detail: "Watching a public video does not replace the private customer video lifecycle you may see later in My Service Records.",
      },
    ],
    reminders: [
      "Public service media is not the same as customer-only service-record video access.",
    ],
    futureVideoNote: "Tutorial video placeholder: Understanding a Reliance service page",
  },
  bookingDetail: {
    badge: "Customer lifecycle",
    title: "How My Service Records update over time",
    summary:
      "A service record can be completed before its customer-visible service video is approved. Reliance tracks work completion, video approval, customer access, and review eligibility as separate steps.",
    video: SERVICE_VIDEOS_AND_REVIEWS_TUTORIAL,

    steps: [
      {
        title: "Check the service-record state row",
        detail: "Use the lifecycle panel to see whether work is complete, whether a final-result video was submitted, and whether customer access is open yet.",
      },
      {
        title: "Wait for approved customer access",
        detail: "Customers cannot watch service videos or leave a review until an approved final-result customer-visible video is available.",
      },
      {
        title: "Use Help when the state looks unexpected",
        detail: "If the service record is completed but no customer-visible service video is available, the detail page explains why before asking you to contact support.",
      },
    ],
    reminders: [
      "Completed work does not automatically mean video is available.",
      "Submitted reviews remain separate from the Reliance Trust Score.",
    ],
    relatedLinks: [
      { label: "Customer help", href: "/help?role=customer" },
    ],
    futureVideoNote: "Tutorial video placeholder: My Services, video access, and review timing",
  },
  reviewHub: {
    badge: "Customer reviews",
    title: "How review eligibility works",
    summary:
      "Reliance opens the review flow only after an approved final-result customer-visible video is available for the service record.",
    video: SERVICE_VIDEOS_AND_REVIEWS_TUTORIAL,

    steps: [
      {
        title: "Use Ready to Review first",
        detail: "These service records have the approved customer-facing video state needed for the review workflow.",
      },
      {
        title: "Open Review Not Open Yet for the why",
        detail: "Completed jobs can still be waiting on moderation, customer visibility, or final-result media availability.",
      },
      {
        title: "Track submitted reviews here",
        detail: "Submitted feedback stays linked to the service record and can wait on moderation before it appears publicly.",
      },
    ],
    reminders: [
      "A submitted review does not automatically become public.",
      "Customer reviews do not change the Reliance Trust Score.",
    ],
    futureVideoNote: "Tutorial video placeholder: Reviews, moderation, and public visibility",
  },
  vendorProfileSetup: {
    badge: "Existing account adding vendor access",
    title: "How vendor profile setup works",
    summary:
      "This page is for signed-in users who are adding a vendor profile to an existing Reliance account, not for brand-new vendor account creation.",
    video: LAUNCH_VENDOR_PROFILE_TUTORIAL,

    steps: [
      {
        title: "Confirm this is the right entry point",
        detail: "Use brand-new vendor signup if you do not already have a Reliance account.",
      },
      {
        title: "Save the business profile",
        detail: "Fill in the business identity, location, and service details so admin review can begin.",
      },
      {
        title: "Add services next",
        detail: "After the profile is saved, keep moving by adding priced services in your service menu.",
      },
    ],
    reminders: [
      "This page saves vendor setup but does not make the business public yet.",
    ],
    futureVideoNote: "Tutorial video placeholder: Adding vendor access to an existing account",
  },
  vendorDashboard: {
    badge: "Vendor onboarding",
    title: "How vendor launch status works",
    summary:
      "The vendor dashboard keeps profile completion, saved services, admin approval, public listing, and published services separate so you always know the next step.",
    video: LAUNCH_VENDOR_PROFILE_TUTORIAL,

    steps: [
      {
        title: "Read the onboarding status first",
        detail: "The dashboard names what is complete, what still needs action, and whether the business is public yet.",
      },
      {
        title: "Use the next recommended action",
        detail: "Reliance points you to the one thing most likely to move the account forward right now.",
      },
      {
        title: "Treat promotions and Trust Score as later-stage tools",
        detail: "Profile completion and service visibility come before growth tools like promotions and coaching.",
      },
    ],
    reminders: [
      "Vendor approval and public listing are separate from service publishing.",
    ],
    futureVideoNote: "Tutorial video placeholder: Vendor dashboard and launch checklist",
  },
  vendorServices: {
    badge: "Services offered",
    title: "How your Services Offered menu and publishing work",
    summary:
      "Vendors manage customer-facing services offered, pricing, and service details here, while public publishing stays coordinated through admin review.",
    video: LAUNCH_VENDOR_PROFILE_TUTORIAL,

    steps: [
      {
        title: "Create the service with pricing",
        detail: "Each service should include a clear name, description, estimated duration, and customer-facing reference price.",
      },
      {
        title: "Keep the service accurate",
        detail: "Customers will eventually see these details once the vendor listing and service are published.",
      },
      {
        title: "Wait for admin-managed publishing",
        detail: "Saving a service prepares it for review, but public visibility still depends on admin publication.",
      },
    ],
    reminders: [
      "A saved service offered is not automatically public or request-ready.",
    ],
    futureVideoNote: "Tutorial video placeholder: Service creation, pricing, and publishing status",
  },
  vendorJobs: {
    badge: "Manager workflow",
    title: "How vendor jobs progress",
    summary:
      "Managers assign jobs, handle consent and location requirements, track stage videos, and move complete packages into review without changing the underlying lifecycle.",
    video: SERVICE_VIDEOS_AND_REVIEWS_TUTORIAL,

    steps: [
      {
        title: "Assign first",
        detail: "Jobs need an assignee before consent and stage-video work can move forward cleanly.",
      },
      {
        title: "Follow the next required stage",
        detail: "Recording location, consent, and stage uploads can unlock in different orders depending on the job.",
      },
      {
        title: "Move completed packages to review",
        detail: "Once all required stages are uploaded, send the package into review so manager and admin actions can continue.",
      },
    ],
    reminders: [
      "Approved internal job completion is still separate from public or customer-visible media approval.",
    ],
    futureVideoNote: "Tutorial video placeholder: Manager jobs, assignments, and review queue",
  },
  employeeJobs: {
    badge: "Employee workflow",
    title: "How employee stage capture works",
    summary:
      "Employees capture Starting Condition, Work in Progress, and Final Result stage videos in order, then submit the full package for manager review.",
    video: EMPLOYEE_SERVICE_ORDER_TUTORIAL,

    steps: [
      {
        title: "Start with the Starting Condition video",
        detail: "Show the starting condition clearly before work begins.",
      },
      {
        title: "Capture progress and completion",
        detail: "Use Work in Progress to show active work and Final Result to show the finished outcome customers will later understand.",
      },
      {
        title: "Submit for manager review",
        detail: "Uploads alone do not finish the lifecycle. The package still needs manager and admin handling after capture.",
      },
    ],
    reminders: [
      "Rejected packages should be corrected and resubmitted, not ignored.",
    ],
    futureVideoNote: "Tutorial video placeholder: Employee capture and submission",
  },
  adminVendorApproval: {
    badge: "Admin vendors",
    title: "How vendor approval affects launch state",
    summary:
      "Approving the vendor account enables vendor access, but it does not automatically publish the vendor listing or any saved services.",
    video: LAUNCH_VENDOR_PROFILE_TUTORIAL,

    steps: [
      {
        title: "Review the business details",
        detail: "Use the approval queue to validate the vendor application and decide whether access should be granted.",
      },
      {
        title: "Approve or reject clearly",
        detail: "Approving removes the queue blocker, while rejection should include notes the vendor can act on later.",
      },
      {
        title: "Hand off to publish management",
        detail: "Vendor approval is one step. Public vendor listing and service publication are separate admin actions.",
      },
    ],
    reminders: [
      "A vendor can be approved internally and still remain invisible to the public.",
    ],
    futureVideoNote: "Tutorial video placeholder: Vendor approval queue and launch state",
  },
  adminMediaModeration: {
    badge: "Admin moderation",
    title: "How service video moderation works",
    summary:
      "This queue only shows complete job packages so admins can evaluate Starting Condition, Work in Progress, and Final Result stages together before changing customer or public visibility.",
    video: SERVICE_VIDEOS_AND_REVIEWS_TUTORIAL,

    steps: [
      {
        title: "Review the full package first",
        detail: "Confirm all three stages belong to the same finished job and that the package tells a coherent service story.",
      },
      {
        title: "Choose the right visibility tier",
        detail: "Approved does not always mean public. Customer-only and private states can still be correct.",
      },
      {
        title: "Use AI as advisory only",
        detail: "AI recommendations are metadata-only in this version and do not replace the admin moderation decision.",
      },
    ],
    reminders: [
      "Package approval changes customer-facing availability and can affect later lifecycle states.",
    ],
    futureVideoNote: "Tutorial video placeholder: Media moderation and visibility tiers",
  },
  adminPromotedListings: {
    badge: "Admin promotions",
    title: "How promoted listings go live",
    summary:
      "Promotions need vendor eligibility, service eligibility, payment readiness, and enough organic browse inventory before they can render publicly.",
    video: ADMIN_PROMOTED_LISTINGS_TUTORIAL,
    steps: [
      {
        title: "Create the campaign carefully",
        detail: "Tie each promotion to an eligible vendor, an eligible published service, and the correct package.",
      },
      {
        title: "Track payment and approval separately",
        detail: "A campaign can be reserved or approved without being live yet if payment is still pending.",
      },
      {
        title: "Check browse render readiness",
        detail: "Even valid campaigns can stay suppressed when the public browse surface does not meet the organic listing floor.",
      },
    ],
    reminders: [
      "Suppressed browse rendering does not always mean the campaign is invalid.",
    ],
    futureVideoNote: "Tutorial video placeholder: Promoted listings readiness and activation",
  },
} satisfies Record<string, TutorialGuide>;

export function getVendorNextRecommendedAction(
  onboarding: VendorOnboardingState | null | undefined
): { label: string; detail: string; href: string } | null {
  if (!onboarding) return null;

  if (!onboarding.hasRequiredProfileFields) {
    if (onboarding.membershipStatus === "ACTIVE") {
      return {
        label: "Complete business profile",
        detail: onboarding.vendorVisibleToPublic
          ? "Your listing is already live, so fill in the missing core business details to strengthen what customers see."
          : "Vendor access is already approved, but the missing core business details still need to be completed.",
        href: "/vendor/profile",
      };
    }

    return {
      label: "Complete business profile",
      detail: "Admin review cannot start until the missing core business details are saved.",
      href: "/vendor/profile",
    };
  }

  if (onboarding.serviceDraftCount === 0) {
    return {
      label: "Create your first service",
      detail: "Add a priced service so Reliance has something concrete to review and publish later.",
      href: "/vendor/services",
    };
  }

  if (onboarding.membershipStatus === "PENDING") {
    return {
      label: "Await admin approval",
      detail: "Your vendor account is saved for review. Keep details accurate while Reliance reviews the application.",
      href: "/vendor/dashboard",
    };
  }

  if (onboarding.membershipStatus === "ACTIVE" && !onboarding.isPubliclyListed) {
    return {
      label: "Await public vendor listing",
      detail: "Vendor access is approved, but the business listing still has to be made public before customers can find it.",
      href: "/vendor/dashboard",
    };
  }

  if (onboarding.membershipStatus === "ACTIVE" && onboarding.isPubliclyListed && onboarding.publishedServiceCount === 0) {
    return {
      label: "Wait for service publishing",
      detail: "Your public vendor listing exists, but customers still need at least one published service to book from.",
      href: "/vendor/services",
    };
  }

  if (onboarding.vendorVisibleToPublic) {
    return {
      label: "Review your live public listing",
      detail: "Your account is live. Double-check service copy, pricing, and customer-facing trust signals.",
      href: "/browse",
    };
  }

  return {
    label: "Review vendor status",
    detail: onboarding.nextStep,
    href: "/vendor/dashboard",
  };
}
