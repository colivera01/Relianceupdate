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

type PendingInvite = {
  id: string;
  token?: string;
  inviteUrl: string;
  sentAt?: string | null;
  expiresAt: string;
  status: string;
  canCancel?: boolean;
  recipient?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
  } | null;
};

function roleLabel(role: string) {
  const r = String(role || "").toUpperCase();
  if (r === "MANAGER") return "Manager";
  if (r === "EMPLOYEE") return "Team member";
  return role || "Member";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteCancellingId, setInviteCancellingId] = useState<string | null>(null);
  const [removingMembershipId, setRemovingMembershipId] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState("");
  const [expandedInviteIds, setExpandedInviteIds] = useState<Record<string, boolean>>({});
  const [invites, setInvites] = useState<PendingInvite[]>([]);

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
    const trimmedName = inviteName.trim();
    const trimmedEmail = inviteEmail.trim();
    const trimmedPhone = invitePhone.trim();
    if (!trimmedName || (!trimmedEmail && !trimmedPhone)) {
      setInviteMessage("Enter the team member's name and at least one contact method.");
      return;
    }
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
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          role: inviteRole || "EMPLOYEE",
          origin: window.location.origin,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.invite?.inviteUrl) {
        const backendError = String(json?.error || "Failed to create invite.");
        const backendCode = String(json?.code || "none");
        if (res.status === 409 && backendCode === "ALREADY_ACTIVE_MANAGER") {
          throw new Error(
            "This person already has manager access for this business. Use a different team member contact."
          );
        }
        if (res.status === 422) {
          throw new Error("Enter the team member's name and at least one contact method.");
        }
        throw new Error(backendError || "Could not create the invite. Check the details and try again.");
      }
      const emailChannel = Array.isArray(json?.notification?.channels)
        ? json.notification.channels.find((c: any) => c?.channel === "email")
        : null;
      const smsChannel = Array.isArray(json?.notification?.channels)
        ? json.notification.channels.find((c: any) => c?.channel === "sms")
        : null;
      const fallbackMessage = "Invite created. Open the pending invite below if you need to copy or share the link.";
      if (emailChannel?.success && smsChannel?.attempted && !smsChannel?.success) {
        setInviteMessage(
          "Email sent. SMS could not be delivered. Open the pending invite below if you need to share the link."
        );
      } else {
        setInviteMessage(json?.delivery ? `${json.delivery} Open the pending invite below if you need the link.` : fallbackMessage);
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
        throw new Error(backendError);
      }
      await loadRosterAndInvites();
      setInviteMessage("Team member removed.");
    } catch (e) {
      setInviteMessage(e instanceof Error ? e.message : "Failed to remove team member");
    } finally {
      setRemovingMembershipId(null);
    }
  };

  const toggleInviteDetails = (inviteId: string) => {
    setExpandedInviteIds((prev) => ({
      ...prev,
      [inviteId]: !prev[inviteId],
    }));
  };

  return (
    <div className="w-full text-slate-100">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Team Access</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
            Invite employees and managers who help complete scheduled work. Accepting an invite gives
            them team access; recording service videos happens later from Employee Jobs after work is assigned.
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
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
          <div className="text-2xl font-bold text-emerald-100">
            {profileLoading || loading ? "—" : managers.length}
          </div>
          <div className="text-sm text-emerald-200">Managers</div>
        </div>
        <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4">
          <div className="text-2xl font-bold text-blue-100">
            {profileLoading || loading ? "—" : employees.length}
          </div>
          <div className="text-sm text-blue-200">Employees</div>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-blue-400/20 bg-blue-950/30 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">How employee access works</p>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          {[
            "Send an invite with the team member's contact details.",
            "They accept the invite and sign in with the same email or phone.",
            "A manager assigns scheduled work from Manage Scheduled Work.",
            "The employee opens Employee Jobs to record Starting Condition, Work in Progress, and Final Result clips.",
          ].map((step, index) => (
            <div key={step} className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm leading-6 text-slate-200">
              <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {index + 1}
              </span>
              <p>{step}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-950/75 p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-white">Invite Employee</h3>
        <p className="mt-1 text-sm leading-6 text-slate-300">
          Add the person who will help with scheduled work. The invite does not create a job by itself.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            placeholder="Full name"
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
          />
          <input
            value={invitePhone}
            onChange={(e) => setInvitePhone(e.target.value)}
            placeholder="Phone"
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
          />
          <input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email"
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
            style={{ colorScheme: "dark" }}
          >
            <option value="EMPLOYEE">Employee</option>
            <option value="MANAGER">Manager</option>
          </select>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleCreateInvite()}
            disabled={inviteSubmitting}
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {inviteSubmitting ? "Creating..." : "Create Invite"}
          </button>
          {inviteMessage ? <p className="text-xs text-slate-300">{inviteMessage}</p> : null}
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-950/75 p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-white">Pending employee invites</h3>
        <p className="mt-1 text-sm text-slate-300">
          Click an invite to view contact details and copy the invite link.
        </p>
        <div className="mt-3 space-y-3">
          {invites.length === 0 ? (
            <p className="text-sm text-slate-300">No active invites.</p>
          ) : (
            invites.map((invite) => {
              const computedInviteUrl =
                !isProduction && invite.token
                  ? `${window.location.origin}/vendor/invite/${invite.token}`
                  : invite.inviteUrl;
              const isExpanded = Boolean(expandedInviteIds[invite.id]);
              const recipientName = invite.recipient?.name || "Pending team invite";
              const recipientRole = roleLabel(invite.recipient?.role || "EMPLOYEE");
              return (
                <div key={invite.id} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-300">
                  <button
                    type="button"
                    onClick={() => toggleInviteDetails(invite.id)}
                    className="flex w-full flex-col gap-3 text-left md:flex-row md:items-center md:justify-between"
                    aria-expanded={isExpanded}
                  >
                    <div>
                      <p className="font-semibold text-white">{recipientName}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Sent {formatDateTime(invite.sentAt)} · {recipientRole}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                        Invite pending
                      </span>
                      <span className="text-xs font-medium text-blue-600">
                        {isExpanded ? "Hide details" : "View details"}
                      </span>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300">
                      <div className="grid gap-2 md:grid-cols-2">
                        <p>
                          <span className="font-semibold text-white">Email:</span>{" "}
                          {invite.recipient?.email || "Not provided"}
                        </p>
                        <p>
                          <span className="font-semibold text-white">Phone:</span>{" "}
                          {invite.recipient?.phone || "Not provided"}
                        </p>
                        <p>
                          <span className="font-semibold text-white">Status:</span>{" "}
                          {invite.status}
                        </p>
                        <p>
                          <span className="font-semibold text-white">Expires:</span>{" "}
                          {formatDateTime(invite.expiresAt)}
                        </p>
                      </div>
                      <p className="mt-3 break-all">
                        <span className="font-semibold text-white">Invite link:</span>{" "}
                        {computedInviteUrl}
                      </p>
                      {invite.canCancel !== false ? (
                        <button
                          type="button"
                          onClick={() => void handleCancelInvite(invite.id)}
                          disabled={inviteCancellingId === invite.id}
                          className="mt-3 rounded border border-red-300 px-3 py-1.5 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          {inviteCancellingId === invite.id ? "Cancelling..." : "Cancel Invite"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Employee List */}
      <div className="rounded-2xl border border-slate-700 bg-slate-950/75 shadow-sm">
        <div className="border-b border-slate-800 p-4">
          <h3 className="text-lg font-semibold text-white">Team roster</h3>
          <p className="mt-1 text-sm text-slate-400">
            Active team members who can be assigned to scheduled work.
          </p>
        </div>
        <div className="divide-y divide-slate-800">
          {profileLoading || loading ? (
            <div className="p-6 text-sm text-slate-300">Loading team…</div>
          ) : !vendorId ? (
            <div className="p-6 text-sm text-slate-300">Sign in as a vendor to view your team.</div>
          ) : teamMembers.length === 0 ? (
            <div className="p-6 text-sm text-slate-300">No active team members yet.</div>
          ) : (
            teamMembers.map((emp) => (
              <div
                key={emp.membershipId}
                className="flex items-center gap-4 p-4 hover:bg-slate-900/80"
              >
                <img
                  src={avatarUrlForName(emp.name)}
                  alt=""
                  className="w-12 h-12 rounded-full border"
                />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-semibold text-white">{emp.name}</div>
                  <div className="truncate text-sm text-slate-400">
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
                            <span className="text-xs font-medium text-slate-200">⭐ {row.averageRating.toFixed(1)}</span>
                            <span className="text-xs text-slate-400">
                              {row.reviewCount} review{row.reviewCount === 1 ? "" : "s"}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">No reviews yet</span>
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
