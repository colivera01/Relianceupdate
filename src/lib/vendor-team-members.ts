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
};

export async function fetchVendorTeamMembers(
  vendorId: string,
  getHeaders: () => Record<string, string>,
  options?: { timeoutMs?: number }
): Promise<VendorTeamMember[]> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutMs = typeof options?.timeoutMs === "number" ? options.timeoutMs : 0;
  const timeoutHandle =
    controller && timeoutMs > 0
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : null;

  let res: Response;
  try {
    res = await fetch(
      `/api/vendors/${encodeURIComponent(vendorId)}/memberships?status=ACTIVE`,
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
    });
  }
  return Array.from(byId.values());
}

export function avatarUrlForName(name: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e5e7eb&color=374151`;
}
