const AUTH_DEBUG = typeof process !== "undefined" && process.env.NODE_ENV !== "production";

function readStoredUserIdFromBrowser(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const rawPrimary = localStorage.getItem("userData");
    const raw = rawPrimary || localStorage.getItem("user");
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

  const token = localStorage.getItem("authToken") || localStorage.getItem("auth_token");
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

  const token = localStorage.getItem("authToken") || localStorage.getItem("auth_token");
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
