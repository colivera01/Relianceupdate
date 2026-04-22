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

  if (preferredUserId) {
    headers["x-user-id"] = String(preferredUserId);
  } else {
    const id = readStoredUserIdFromBrowser();
    if (id) {
      headers["x-user-id"] = id;
    }
  }

  const token = localStorage.getItem("authToken") || localStorage.getItem("auth_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (AUTH_DEBUG) {
    console.info("[getClientSessionHeaders]", {
      "x-user-id": headers["x-user-id"] ?? null,
      authorizationPreview: token ? `Bearer ${String(token).slice(0, 12)}…` : null,
    });
  }

  return headers;
}

