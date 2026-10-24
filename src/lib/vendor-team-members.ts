/**
 * Vendor team roster from VendorMembership (same source as job assignment).
 */

export type VendorTeamMember = {
  membershipId: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  publicMediaConsentStatus?: "ALLOWED" | "NOT_ALLOWED" | "NOT_DECIDED";
  publicMediaConsentDecidedAt?: string | null;
};

export function filterAssignableEmployeeMemberships(
  memberships: VendorTeamMember[],
): VendorTeamMember[] {
  return memberships.filter(
    (membership) =>
      String(membership.role || "").trim().toUpperCase() === "EMPLOYEE" &&
      String(membership.status || "").trim().toUpperCase() === "ACTIVE",
  );
}

export async function fetchVendorTeamMembers(
  vendorId: string,
  getHeaders: () => Record<string, string>,
  options?: { timeoutMs?: number; includePending?: boolean }
): Promise<VendorTeamMember[]> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutMs = typeof options?.timeoutMs === "number" ? options.timeoutMs : 0;
  const timeoutHandle =
    controller && timeoutMs > 0
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : null;

  let res: Response;
  try {
    const statusQuery = options?.includePending ? "" : "?status=ACTIVE";
    res = await fetch(
      `/api/vendors/${encodeURIComponent(vendorId)}/memberships${statusQuery}`,
      {
        method: "GET",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        cache: "no-store",
        signal: controller?.signal,
      }
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Employee roster took too long to load. Please retry.");
    }
    throw error;
  } finally {
    if (timeoutHandle !== null) {
      window.clearTimeout(timeoutHandle);
    }
  }

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (payload && (payload.error || payload.message)) || `Failed to load team (${res.status})`
    );
  }
  const memberships = Array.isArray(payload?.memberships) ? payload.memberships : [];
  const byId = new Map<string, VendorTeamMember>();
  for (const m of memberships) {
    const membershipId = String(m?.id || "").trim();
    if (!membershipId) continue;
    const name =
      String(m?.displayName || "").trim() ||
      String(m?.inviteeName || "").trim() ||
      String(m?.user?.name || "").trim() ||
      (m?.user?.email != null ? String(m.user.email).trim() : "");
    if (!name) continue;
    byId.set(membershipId, {
      membershipId,
      userId: String(m?.userId || ""),
      name,
      email: m?.user?.email != null ? String(m.user.email) : null,
      phone: m?.user?.phone != null ? String(m.user.phone) : null,
      role: String(m?.role || "").trim().toUpperCase(),
      status: String(m?.status || "").trim().toUpperCase(),
      publicMediaConsentStatus: m?.publicMediaConsent?.status,
      publicMediaConsentDecidedAt: m?.publicMediaConsent?.decidedAt || null,
    });
  }
  const allowedStatuses = options?.includePending ? new Set(["ACTIVE", "PENDING"]) : new Set(["ACTIVE"]);
  return Array.from(byId.values()).filter((member) => allowedStatuses.has(member.status));
}

export function avatarUrlForName(name: string): string {
  const initials = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .replace(/[^A-Z0-9]/g, "") || "TM";
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">',
    '<rect width="96" height="96" rx="48" fill="#16325c"/>',
    `<text x="48" y="51" dominant-baseline="middle" text-anchor="middle" fill="#f8fbff" font-family="Arial, sans-serif" font-size="30" font-weight="700">${initials}</text>`,
    '</svg>',
  ].join("");
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
