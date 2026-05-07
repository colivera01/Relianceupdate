"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useVendorProfile } from "@/hooks/useVendorProfile";
import { useAuth } from "@/contexts/AuthContext";
import { getClientSessionHeaders } from "@/lib/client-session";
import {
  fetchVendorTeamMembers,
  avatarUrlForName,
  type VendorTeamMember,
} from "@/lib/vendor-team-members";

function roleLabel(role: string) {
  const r = String(role || "").toUpperCase();
  if (r === "MANAGER") return "Manager";
  if (r === "EMPLOYEE") return "Team member";
  return role || "Member";
}

function getPerformanceBadge(rating: number, reviewCount: number): { label: string; className: string } {
  if (reviewCount <= 0) {
    return {
      label: "New / no rating",
      className: "bg-gray-100 text-gray-700 border-gray-200",
    };
  }
  if (rating >= 4.7) {
    return {
      label: "Top rated",
      className: "bg-emerald-100 text-emerald-800 border-emerald-200",
    };
  }
  if (rating >= 4.0) {
    return {
      label: "Strong",
      className: "bg-blue-100 text-blue-800 border-blue-200",
    };
  }
  return {
    label: "Needs attention",
    className: "bg-amber-100 text-amber-900 border-amber-200",
  };
}

export default function EmployeesPage() {
  const { user } = useAuth();
  const authUserId = user?.id || null;
  const { data: vendorProfile, loading: profileLoading, error: profileError } = useVendorProfile();
  const vendorId = vendorProfile?.id || "";

  const [teamMembers, setTeamMembers] = useState<VendorTeamMember[]>([]);
  const [employeeRatingsByMembershipId, setEmployeeRatingsByMembershipId] = useState<
    Record<string, { averageRating: number; reviewCount: number }>
  >({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState("EMPLOYEE");
  const [allowSelfInvite, setAllowSelfInvite] = useState(false);
  const [allowSelfInviteTestMode, setAllowSelfInviteTestMode] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteCancellingId, setInviteCancellingId] = useState<string | null>(null);
  const [removingMembershipId, setRemovingMembershipId] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState("");
  const [invites, setInvites] = useState<
    Array<{
      id: string;
      token?: string;
      inviteUrl: string;
      expiresAt: string;
      status: string;
      canCancel?: boolean;
    }>
  >([]);

  const isProduction = process.env.NODE_ENV === "production";

  const loadRosterAndInvites = async () => {
    if (!vendorId || !authUserId) {
      setTeamMembers([]);
      setLoadError("");
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const headers = () => ({
        "Content-Type": "application/json",
        ...getClientSessionHeaders(authUserId),
      });
      const members = await fetchVendorTeamMembers(vendorId, () => ({
        ...headers(),
      }));
      const invitesRes = await fetch(`/api/vendors/${vendorId}/employee-invites`, {
        headers: headers(),
        cache: "no-store",
      });
      const invitesJson = await invitesRes.json().catch(() => ({}));
      const dashboardRes = await fetch(`/api/vendors/${vendorId}/dashboard`, {
        headers: headers(),
        cache: "no-store",
      });
      const dashboardJson = await dashboardRes.json().catch(() => ({}));
      setTeamMembers(members);
      setInvites(Array.isArray(invitesJson?.invites) ? invitesJson.invites : []);
      setAllowSelfInviteTestMode(Boolean(invitesJson?.allowSelfEmployeeInviteTestMode));
      const employeePerformance = Array.isArray(dashboardJson?.employeePerformance)
        ? dashboardJson.employeePerformance
        : [];
      const ratingsMap: Record<string, { averageRating: number; reviewCount: number }> = {};
      for (const row of employeePerformance) {
        const membershipId = String(row?.membershipId || "").trim();
        if (!membershipId) continue;
        ratingsMap[membershipId] = {
          averageRating: Number(row?.averageRating || 0),
          reviewCount: Number(row?.reviewCount || 0),
        };
      }
      setEmployeeRatingsByMembershipId(ratingsMap);
    } catch (e) {
      setTeamMembers([]);
      setEmployeeRatingsByMembershipId({});
      setLoadError(e instanceof Error ? e.message : "Could not load team.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRosterAndInvites();
  }, [vendorId, authUserId]);

  const managers = teamMembers.filter((m) => String(m.role).toUpperCase() === "MANAGER");
  const employees = teamMembers.filter((m) => String(m.role).toUpperCase() === "EMPLOYEE");

  const handleCreateInvite = async () => {
    if (!vendorId || !authUserId) return;
    setInviteSubmitting(true);
    setInviteMessage("");
    try {
      const res = await fetch(`/api/vendors/${vendorId}/employee-invites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getClientSessionHeaders(authUserId),
        },
        body: JSON.stringify({
          name: inviteName,
          email: inviteEmail,
          phone: invitePhone,
          role: inviteRole || "EMPLOYEE",
          allowSelfInvite: allowSelfInvite === true,
          origin: window.location.origin,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.invite?.inviteUrl) {
        const backendError = String(json?.error || "Failed to create invite.");
        const backendCode = String(json?.code || "none");
        const backendMessage = String(json?.message || "");
        const backendStep = String(json?.step || json?.details?.step || "unknown_step");
        const backendDetails = json?.details ?? null;
        if (res.status === 409 && backendCode === "ALREADY_ACTIVE_MANAGER") {
          throw new Error(
            "This person is already an active manager for this vendor. Use a different employee email/phone, or enable dev test mode locally."
          );
        }
        throw new Error(
          `Create Invite failed (${res.status}) | error="${backendError}" code=${backendCode} message="${backendMessage}" step=${backendStep} details=${JSON.stringify(
            backendDetails
          )}`
        );
      }
      const emailChannel = Array.isArray(json?.notification?.channels)
        ? json.notification.channels.find((c: any) => c?.channel === "email")
        : null;
      const smsChannel = Array.isArray(json?.notification?.channels)
        ? json.notification.channels.find((c: any) => c?.channel === "sms")
        : null;
      const fallbackMessage = `Invite created. Share this link: ${json.invite.inviteUrl}`;
      if (emailChannel?.success && smsChannel?.attempted && !smsChannel?.success) {
        setInviteMessage(
          `Email sent. SMS failed: ${String(smsChannel?.errorMessage || "unknown_error")} (${String(
            smsChannel?.errorCode || "no_code"
          )}). Invite link: ${json.invite.inviteUrl}`
        );
      } else {
        setInviteMessage(json?.delivery ? `${json.delivery} ${json.invite.inviteUrl}` : fallbackMessage);
      }
      setInviteName("");
      setInviteEmail("");
      setInvitePhone("");
      await loadRosterAndInvites();
    } catch (e) {
      setInviteMessage(e instanceof Error ? e.message : "Failed to create invite");
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!vendorId || !authUserId || !inviteId) return;
    setInviteCancellingId(inviteId);
    setInviteMessage("");
    try {
      const res = await fetch(`/api/vendors/${vendorId}/employee-invites/${inviteId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...getClientSessionHeaders(authUserId),
        },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(json?.error || `Failed to cancel invite (${res.status})`));
      }
      setInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
      setInviteMessage("Invite cancelled.");
    } catch (e) {
      setInviteMessage(e instanceof Error ? e.message : "Failed to cancel invite");
    } finally {
      setInviteCancellingId(null);
    }
  };

  const handleRemoveMember = async (membershipId: string) => {
    if (!vendorId || !authUserId || !membershipId) return;
    setRemovingMembershipId(membershipId);
    setInviteMessage("");
    try {
      const res = await fetch(`/api/vendors/${vendorId}/memberships/${membershipId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...getClientSessionHeaders(authUserId),
        },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const backendError = String(json?.error || `Failed to remove member (${res.status})`);
        const backendCode = String(json?.code || "none");
        const backendStep = String(json?.step || "unknown_step");
        const backendDetails = json?.details || json?.debug || null;
        throw new Error(
          process.env.NODE_ENV !== "production"
            ? `${backendError} (status=${res.status} code=${backendCode} step=${backendStep} details=${JSON.stringify(
                backendDetails
              )})`
            : backendError
        );
      }
      await loadRosterAndInvites();
      setInviteMessage("Team member removed.");
    } catch (e) {
      setInviteMessage(e instanceof Error ? e.message : "Failed to remove team member");
    } finally {
      setRemovingMembershipId(null);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Team Management</h2>
          <p className="text-gray-600 mt-1">
            Active team members for this vendor (same roster as job assignments). Pending invites and
            approvals are managed through your membership workflow.
          </p>
        </div>
      </div>

      {(profileError || loadError) && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {profileError || loadError}
        </div>
      )}

      {/* Team Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-green-50 p-4 rounded-lg border">
          <div className="text-2xl font-bold text-green-600">
            {profileLoading || loading ? "—" : managers.length}
          </div>
          <div className="text-sm text-green-600">Managers</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border">
          <div className="text-2xl font-bold text-purple-600">
            {profileLoading || loading ? "—" : employees.length}
          </div>
          <div className="text-sm text-purple-600">Employees</div>
        </div>
      </div>

      <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">Invite Employee</h3>
        <p className="mt-1 text-sm text-gray-600">
          Add an employee invite with name, phone, email, and role. Default role is employee.
        </p>
        {allowSelfInviteTestMode ? (
          <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
            Dev test mode is enabled: same-email/phone self-invite tests are allowed without changing your active manager membership.
          </p>
        ) : null}
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            placeholder="Full name"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            value={invitePhone}
            onChange={(e) => setInvitePhone(e.target.value)}
            placeholder="Phone"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email"
            className="rounded border px-3 py-2 text-sm"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
          >
            <option value="EMPLOYEE">Employee</option>
            <option value="MANAGER">Manager</option>
          </select>
        </div>
        {process.env.NODE_ENV !== "production" ? (
          <label className="mt-3 flex items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={allowSelfInvite}
              onChange={(e) => setAllowSelfInvite(e.target.checked)}
            />
            Dev Mode: Allow self-invite
          </label>
        ) : null}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleCreateInvite()}
            disabled={inviteSubmitting}
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {inviteSubmitting ? "Creating..." : "Create Invite"}
          </button>
          {inviteMessage ? <p className="text-xs text-gray-700">{inviteMessage}</p> : null}
        </div>
      </div>

      <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">Pending/Invited Links</h3>
        <div className="mt-2 space-y-2">
          {invites.length === 0 ? (
            <p className="text-sm text-gray-600">No active invites.</p>
          ) : (
            invites.map((invite) => (
              <div key={invite.id} className="rounded border bg-gray-50 p-2 text-xs text-gray-700">
                {(() => {
                  const computedInviteUrl =
                    !isProduction && invite.token
                      ? `${window.location.origin}/vendor/invite/${invite.token}`
                      : invite.inviteUrl;
                  return (
                    <>
                <p>Status: {invite.status}</p>
                <p>Expires: {new Date(invite.expiresAt).toLocaleString()}</p>
                <p className="break-all">Invite link: {computedInviteUrl}</p>
                {invite.canCancel !== false ? (
                  <button
                    type="button"
                    onClick={() => void handleCancelInvite(invite.id)}
                    disabled={inviteCancellingId === invite.id}
                    className="mt-2 rounded border border-red-300 px-2 py-1 text-[11px] text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    {inviteCancellingId === invite.id ? "Cancelling..." : "Cancel Invite"}
                  </button>
                ) : null}
                    </>
                  );
                })()}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Employee List */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Team roster</h3>
          <p className="text-sm text-gray-500 mt-1">
            Data from active vendor memberships (same API as Manage Jobs assignments).
          </p>
        </div>
        <div className="divide-y">
          {profileLoading || loading ? (
            <div className="p-6 text-gray-600 text-sm">Loading team…</div>
          ) : !vendorId ? (
            <div className="p-6 text-gray-600 text-sm">Sign in as a vendor to view your team.</div>
          ) : teamMembers.length === 0 ? (
            <div className="p-6 text-gray-600 text-sm">No active team members yet.</div>
          ) : (
            teamMembers.map((emp) => (
              <div
                key={emp.membershipId}
                className="flex items-center gap-4 p-4 hover:bg-gray-50"
              >
                <img
                  src={avatarUrlForName(emp.name)}
                  alt=""
                  className="w-12 h-12 rounded-full border"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{emp.name}</div>
                  <div className="text-sm text-gray-500 truncate">
                    {emp.email || "—"}
                  </div>
                  {(() => {
                    const row = employeeRatingsByMembershipId[String(emp.membershipId)] || {
                      averageRating: 0,
                      reviewCount: 0,
                    };
                    const badge = getPerformanceBadge(row.averageRating, row.reviewCount);
                    return (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {row.reviewCount > 0 ? (
                          <>
                            <span className="text-xs font-medium text-gray-700">⭐ {row.averageRating.toFixed(1)}</span>
                            <span className="text-xs text-gray-500">
                              {row.reviewCount} review{row.reviewCount === 1 ? "" : "s"}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-gray-500">No reviews yet</span>
                        )}
                        <Badge variant="outline" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </div>
                    );
                  })()}
                </div>
                <Badge variant={String(emp.role).toUpperCase() === "MANAGER" ? "default" : "secondary"}>
                  {roleLabel(emp.role)}
                </Badge>
                {emp.userId !== authUserId ? (
                  <button
                    type="button"
                    onClick={() => void handleRemoveMember(emp.membershipId)}
                    disabled={removingMembershipId === emp.membershipId}
                    className="rounded border border-red-300 px-2 py-1 text-[11px] text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    {removingMembershipId === emp.membershipId ? "Removing..." : "Remove from team"}
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
