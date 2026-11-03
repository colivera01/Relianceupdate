const AUTH_DEBUG = typeof process !== "undefined" && process.env.NODE_ENV !== "production";

type ClientActorIdentity = {
  id?: unknown;
  email?: unknown;
  userType?: unknown;
  availableProfiles?: unknown;
};

function sessionTokenMarker(): string {
  if (typeof window === "undefined") return "server";
  let token = "";
  try {
    token = sessionStorage.getItem("authToken") || sessionStorage.getItem("auth_token") || "";
  } catch {
    return "storage-unavailable";
  }
  if (!token) return "no-token";

  // This is an identity marker, not a security primitive. It lets client state
  // notice a replaced session without putting the credential itself into React state.
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${token.length}:${(hash >>> 0).toString(36)}`;
}

export function getClientActorSessionKey(user: ClientActorIdentity | null | undefined): string {
  const nestedId =
    user?.id && typeof user.id === "object"
      ? (user.id as { id?: unknown }).id
      : null;
  const id =
    typeof user?.id === "string"
      ? user.id.trim()
      : typeof user?.id === "number"
      ? String(user.id)
      : typeof nestedId === "string"
      ? nestedId.trim()
      : typeof nestedId === "number"
      ? String(nestedId)
      : "";
  if (!id) return "";
  const profiles = Array.isArray(user?.availableProfiles)
    ? [...user.availableProfiles].map(String).sort().join(",")
    : "";
  return [
    id,
    String(user?.email || "").trim().toLowerCase(),
    String(user?.userType || "").trim().toLowerCase(),
    profiles,
    sessionTokenMarker(),
  ].join("|");
}

function readStoredUserIdFromBrowser(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const rawPrimary = sessionStorage.getItem("userData");
    const raw = rawPrimary || sessionStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string };
    return parsed?.id ? String(parsed.id) : null;
  } catch {
    return null;
  }
}

export function getClientSessionHeaders(preferredUserId?: string | null): Record<string, string> {
  const headers: Record<string, string> = {};

  if (typeof window === "undefined") {
    return headers;
  }

  const token = sessionStorage.getItem("authToken") || sessionStorage.getItem("auth_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const normalizedPreferredUserId =
    typeof preferredUserId === "string"
      ? preferredUserId.trim()
      : typeof preferredUserId === "number"
      ? String(preferredUserId)
      : "";

  if (!token && AUTH_DEBUG) {
    if (normalizedPreferredUserId) {
      headers["x-user-id"] = normalizedPreferredUserId;
    } else {
      const id = readStoredUserIdFromBrowser();
      if (id) {
        headers["x-user-id"] = id;
      }
    }
  }

  if (AUTH_DEBUG) {
    console.info(
      `[getClientSessionHeaders] x-user-id=${headers["x-user-id"] ?? "null"} auth=${
        token ? `Bearer ${String(token).slice(0, 12)}...` : "null"
      }`
    );
  }

  return headers;
}

export function getClientAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  if (typeof window === "undefined") {
    return headers;
  }

  const token = sessionStorage.getItem("authToken") || sessionStorage.getItem("auth_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (AUTH_DEBUG) {
    console.info(
      `[getClientAuthHeaders] auth=${token ? `Bearer ${String(token).slice(0, 12)}...` : "null"}`
    );
  }

  return headers;
}
