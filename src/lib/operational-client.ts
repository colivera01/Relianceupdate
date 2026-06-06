type ClientIdentityInput = {
  userId?: string | null;
  clientName?: string | null;
  userName?: string | null;
  email?: string | null;
  phone?: string | null;
  fallbackLabel?: string;
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function collapseRepeatedAdjacentLabel(value: string): string {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";

  const midpoint = normalized.length / 2;
  if (
    Number.isInteger(midpoint) &&
    normalized.slice(0, midpoint).toLowerCase() === normalized.slice(midpoint).toLowerCase()
  ) {
    return normalizeWhitespace(normalized.slice(0, midpoint));
  }

  const words = normalized.split(" ");
  const wordMidpoint = words.length / 2;
  if (
    Number.isInteger(wordMidpoint) &&
    words.slice(0, wordMidpoint).join(" ").toLowerCase() ===
      words.slice(wordMidpoint).join(" ").toLowerCase()
  ) {
    return words.slice(0, wordMidpoint).join(" ");
  }

  return normalized;
}

export function resolveOperationalClientLabel(input: ClientIdentityInput): string {
  const clientName = collapseRepeatedAdjacentLabel(String(input.clientName || ""));
  if (clientName) return clientName;

  const userName = collapseRepeatedAdjacentLabel(String(input.userName || ""));
  if (userName) return userName;

  return normalizeWhitespace(String(input.fallbackLabel || "Unknown Client")) || "Unknown Client";
}

export function resolveOperationalClientKey(input: ClientIdentityInput): string {
  const userId = normalizeWhitespace(String(input.userId || ""));
  if (userId) return `user:${userId}`;

  const email = normalizeWhitespace(String(input.email || "")).toLowerCase();
  if (email) return `email:${email}`;

  const phoneDigits = String(input.phone || "").replace(/\D+/g, "");
  if (phoneDigits) return `phone:${phoneDigits}`;

  const label = resolveOperationalClientLabel(input);
  if (label && label !== "Unknown Client") {
    return `label:${label.toLowerCase()}`;
  }

  return "";
}
