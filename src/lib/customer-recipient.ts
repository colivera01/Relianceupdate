import {
  hashPermissionContact,
  normalizePermissionEmail,
} from "@/lib/consent/recipient";

export type CustomerRecipientMetadata = Record<string, unknown>;

export type CanonicalCustomerRecipientSource =
  | "CURRENT_PERMISSION_RECIPIENT"
  | "CLIENT_EMAIL"
  | "CLAIM_CONTACT_EMAIL"
  | "LINKED_ACCOUNT_EMAIL"
  | "NONE";

export type CanonicalCustomerRecipient = {
  email: string | null;
  source: CanonicalCustomerRecipientSource;
  currentRecipientEmailHash: string | null;
  historicalEmails: string[];
};

export function parseCustomerRecipientMetadata(
  value: string | null | undefined | CustomerRecipientMetadata,
): CustomerRecipientMetadata {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (!value) return {};
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as CustomerRecipientMetadata)
      : {};
  } catch {
    return {};
  }
}

function usableEmail(value: unknown): string | null {
  const email = normalizePermissionEmail(value);
  return email && !email.endsWith("@reliance.local") ? email : null;
}

/**
 * Resolves the current customer without erasing older recipient evidence.
 * A current permission hash is authoritative and must match one of the
 * booking/account plaintext candidates; otherwise resolution fails closed.
 */
export function resolveCanonicalCustomerRecipient(input: {
  customerMetadata?: string | null | CustomerRecipientMetadata;
  linkedAccountEmail?: unknown;
  currentRecipientEmailHash?: unknown;
}): CanonicalCustomerRecipient {
  const metadata = parseCustomerRecipientMetadata(input.customerMetadata);
  const candidates = [
    { email: usableEmail(metadata.client_email), source: "CLIENT_EMAIL" as const },
    {
      email: usableEmail(metadata.claim_contact_email),
      source: "CLAIM_CONTACT_EMAIL" as const,
    },
    {
      email: usableEmail(input.linkedAccountEmail),
      source: "LINKED_ACCOUNT_EMAIL" as const,
    },
  ].filter((candidate): candidate is { email: string; source: Exclude<CanonicalCustomerRecipientSource, "CURRENT_PERMISSION_RECIPIENT" | "NONE"> } => Boolean(candidate.email));

  const uniqueCandidates = candidates.filter(
    (candidate, index) =>
      candidates.findIndex((other) => other.email === candidate.email) === index,
  );
  const currentRecipientEmailHash =
    String(input.currentRecipientEmailHash || "").trim() || null;

  let selected: (typeof uniqueCandidates)[number] | undefined;
  let source: CanonicalCustomerRecipientSource = "NONE";
  if (currentRecipientEmailHash) {
    selected = uniqueCandidates.find(
      (candidate) =>
        hashPermissionContact(candidate.email) === currentRecipientEmailHash,
    );
    if (selected) source = "CURRENT_PERMISSION_RECIPIENT";
  } else {
    selected = uniqueCandidates[0];
    if (selected) source = selected.source;
  }

  return {
    email: selected?.email || null,
    source,
    currentRecipientEmailHash,
    historicalEmails: uniqueCandidates
      .map((candidate) => candidate.email)
      .filter((email) => email !== selected?.email),
  };
}
