import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { resolveAuthPostLoginRedirect } from "@/lib/auth-next";
import {
  getAdminAuthSessionClaimsFromRequest,
  getAuthSessionClaimsFromRequest,
} from "@/lib/auth-session";

export default async function LegacyDashboardRedirectPage() {
  const requestHeaders = await headers();
  const request = new Request("http://reliance.local/dashboard", { headers: requestHeaders });
  const claims =
    getAuthSessionClaimsFromRequest(request) ||
    getAdminAuthSessionClaimsFromRequest(request);

  if (!claims) {
    redirect("/auth/login");
  }

  redirect(resolveAuthPostLoginRedirect(null, claims.userType));
}
