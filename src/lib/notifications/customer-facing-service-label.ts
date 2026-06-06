import { cleanPublicServiceName } from "@/lib/launch-content-cleanup";

const INTERNAL_OR_GENERATED_LABEL_PATTERNS = [
  /\bfresh recount validation\b/i,
  /\btrust-loop\b/i,
  /\brecount validation\b/i,
  /\bvalidation\b/i,
  /\be2e\b/i,
  /\bdemo\b/i,
  /\btest\b/i,
  /\bauto-created default service\b/i,
];

function looksInternalOrGeneratedLabel(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return INTERNAL_OR_GENERATED_LABEL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function resolveCustomerFacingServiceLabel(input: {
  serviceName?: string | null;
  bookingTitle?: string | null;
  vendorName?: string | null;
  fallback?: string;
}): string {
  const bookingTitle = String(input.bookingTitle || "").trim();
  if (bookingTitle && !looksInternalOrGeneratedLabel(bookingTitle)) {
    return bookingTitle;
  }

  const vendorName = String(input.vendorName || "").trim();
  const cleanedServiceName = cleanPublicServiceName(input.serviceName, vendorName).trim();
  if (cleanedServiceName && !looksInternalOrGeneratedLabel(cleanedServiceName)) {
    return cleanedServiceName;
  }

  if (/sparkle/i.test(vendorName)) {
    return "Sparkle Home Cleaning Visit";
  }

  return String(input.fallback || "Recent service visit").trim() || "Recent service visit";
}
