/**
 * Client-side customer id for booking/list APIs — same resolution order as `/my-bookings`.
 * Prefer `useAuth().user.id`; then this tab's `sessionStorage` identity.
 */
export function resolveCustomerUserId(authUserId: string | undefined): string | null {
  if (authUserId) return authUserId;
  try {
    const raw = sessionStorage.getItem('userData');
    if (raw) {
      const parsed = JSON.parse(raw) as { id?: string };
      if (parsed?.id) return String(parsed.id);
    }
    const legacy = sessionStorage.getItem('user');
    if (legacy) {
      const parsed = JSON.parse(legacy) as { id?: string };
      if (parsed?.id) return String(parsed.id);
    }
  } catch {
    return null;
  }
  return null;
}
