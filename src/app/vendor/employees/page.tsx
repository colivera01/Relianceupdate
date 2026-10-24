"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useVendorProfile } from "@/hooks/useVendorProfile";
import { useAuth } from "@/contexts/AuthContext";
import { getClientSessionHeaders } from "@/lib/client-session";
import { formatRelianceDate, formatRelianceDateTime } from "@/lib/reliance-date-time";
import { AlertTriangle, X } from "lucide-react";
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
  if (r === "EMPLOYEE") return "Employee";
  return role || "Member";
}

const employeeAccessSteps = [
  "Send an invite with the team member's contact details.",
  "They accept the invite and receive the selected Employee or Manager role. A password is not required.",
  "Managers manage the workspace; Employees can be assigned scheduled work from Manage Jobs.",
  "An assigned Employee opens the secure Service Order link to complete the work.",
];

export default function EmployeesPage() {
  const { user } = useAuth();
  const authUserId = user?.id || null;
  const { data: vendorProfile, loading: profileLoading, error: profileError, refetch: refetchProfile } = useVendorProfile();
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
  const [inviteMessageTone, setInviteMessageTone] = useState<"success" | "error" | null>(null);
  const [expandedInviteIds, setExpandedInviteIds] = useState<Record<string, boolean>>({});
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [editingMember, setEditingMember] = useState<VendorTeamMember | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [savingMembershipId, setSavingMembershipId] = useState<string | null>(null);
  const [sendingParticipationMembershipId, setSendingParticipationMembershipId] = useState<string | null>(null);
  const [memberPendingRemoval, setMemberPendingRemoval] = useState<VendorTeamMember | null>(null);
  const [removeError, setRemoveError] = useState("");

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
      if (!invitesRes.ok) {
        throw new Error(String(invitesJson?.error || `Could not load pending team invites (${invitesRes.status}).`));
      }
      if (!dashboardRes.ok) {
        throw new Error(String(dashboardJson?.error || `Could not load verified customer ratings (${dashboardRes.status}).`));
      }
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
      setInvites([]);
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
      setInviteMessageTone("error");
      return;
    }
    setInviteSubmitting(true);
    setInviteMessage("");
    setInviteMessageTone(null);
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
      setInviteMessageTone("success");
      setInviteName("");
      setInviteEmail("");
      setInvitePhone("");
      await loadRosterAndInvites();
    } catch (e) {
      setInviteMessage(e instanceof Error ? e.message : "Failed to create invite");
      setInviteMessageTone("error");
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!vendorId || !authUserId || !inviteId) return;
    setInviteCancellingId(inviteId);
    setInviteMessage("");
    setInviteMessageTone(null);
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
      setInviteMessageTone("success");
    } catch (e) {
      setInviteMessage(e instanceof Error ? e.message : "Failed to cancel invite");
      setInviteMessageTone("error");
    } finally {
      setInviteCancellingId(null);
    }
  };

  const handleRemoveMember = async (membershipId: string) => {
    if (!vendorId || !authUserId || !membershipId) return;
    setRemovingMembershipId(membershipId);
    setInviteMessage("");
    setInviteMessageTone(null);
    setRemoveError("");
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
      setInviteMessageTone("success");
      setMemberPendingRemoval(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to remove team member";
      setInviteMessage(message);
      setInviteMessageTone("error");
      setRemoveError(message);
    } finally {
      setRemovingMembershipId(null);
    }
  };

  const openEditMember = (member: VendorTeamMember) => {
    setEditingMember(member);
    setEditName(member.name || "");
    setEditEmail(member.email || "");
    setEditPhone(member.phone || "");
    setEditMessage("");
  };

  const closeEditMember = () => {
    if (savingMembershipId) return;
    setEditingMember(null);
    setEditName("");
    setEditEmail("");
    setEditPhone("");
    setEditMessage("");
  };

  const handleSaveMember = async () => {
    if (!vendorId || !authUserId || !editingMember) return;
    const trimmedName = editName.trim();
    const trimmedEmail = editEmail.trim();
    const trimmedPhone = editPhone.trim();
    if (!trimmedName) {
      setEditMessage("Enter the team member's name.");
      return;
    }
    if (!trimmedEmail && !trimmedPhone) {
      setEditMessage("Enter at least one contact method.");
      return;
    }
    setSavingMembershipId(editingMember.membershipId);
    setEditMessage("");
    try {
      const res = await fetch(`/api/vendors/${vendorId}/memberships/${editingMember.membershipId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getClientSessionHeaders(authUserId),
        },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(json?.error || `Failed to update member (${res.status})`));
      }
      await loadRosterAndInvites();
      setInviteMessage("Team member contact details updated.");
      setInviteMessageTone("success");
      setSavingMembershipId(null);
      closeEditMember();
    } catch (e) {
      setEditMessage(e instanceof Error ? e.message : "Failed to update team member.");
      setSavingMembershipId(null);
    }
  };

  const toggleInviteDetails = (inviteId: string) => {
    setExpandedInviteIds((prev) => ({
      ...prev,
      [inviteId]: !prev[inviteId],
    }));
  };

  const handleSendParticipationLink = async (membershipId: string) => {
    if (!vendorId || !authUserId || !membershipId) return;
    setSendingParticipationMembershipId(membershipId);
    setInviteMessage("");
    setInviteMessageTone(null);
    try {
      const response = await fetch(
        `/api/vendors/${vendorId}/memberships/${membershipId}/public-media-consent-link`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getClientSessionHeaders(authUserId),
          },
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) {
        throw new Error(String(body?.error || "The participation link could not be sent."));
      }
      setInviteMessage("Secure participation link sent. The Employee must make their own choice within one hour.");
      setInviteMessageTone("success");
    } catch (error) {
      setInviteMessage(error instanceof Error ? error.message : "The participation link could not be sent.");
      setInviteMessageTone("error");
    } finally {
      setSendingParticipationMembershipId(null);
    }
  };

  return (
    <div className="w-full text-slate-100">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Team Access</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
            Invite employees and managers who help complete scheduled work. Accepting an invite gives
            them team access; recording service videos happens later from Employee Jobs after work is assigned.
          </p>
        </div>
      </div>

      {(profileError || loadError) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300/40 bg-red-950/55 p-4 text-sm text-red-100" role="alert">
          <span>{profileError || loadError}</span>
          <button
            type="button"
            className="rounded-lg border border-red-200/40 px-3 py-2 font-semibold text-white hover:bg-red-500/10"
            onClick={() => {
              if (profileError) {
                void refetchProfile();
                return;
              }
              void loadRosterAndInvites();
            }}
          >
            Retry
          </button>
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

      <details className="mb-4 rounded-xl border border-blue-400/20 bg-blue-950/30 p-4 shadow-sm md:hidden">
        <summary className="cursor-pointer text-sm font-semibold text-blue-100">How team access works</summary>
        <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
          {employeeAccessSteps.map((step, index) => (
            <li key={step}><span className="font-semibold text-blue-200">{index + 1}.</span> {step}</li>
          ))}
        </ol>
      </details>

      <div className="mb-6 hidden rounded-2xl border border-blue-400/20 bg-blue-950/30 p-5 shadow-sm md:block">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">How team access works</p>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          {employeeAccessSteps.map((step, index) => (
            <div key={step} className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm leading-6 text-slate-200">
              <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {index + 1}
              </span>
              <p>{step}</p>
            </div>
          ))}
        </div>
      </div>

      <form
        className="mb-6 rounded-2xl border border-slate-700 bg-slate-950/75 p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreateInvite();
        }}
      >
        <h3 className="text-lg font-semibold text-white">Invite team member</h3>
        <p className="mt-1 text-sm leading-6 text-slate-300">
          Add the person who will help with scheduled work. The invite does not create a job by itself.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-200">
            Full name
            <input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              autoComplete="name"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
            />
          </label>
          <label className="text-sm font-medium text-slate-200">
            Phone
            <input
              value={invitePhone}
              onChange={(e) => setInvitePhone(e.target.value)}
              type="tel"
              autoComplete="tel"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
            />
          </label>
          <label className="text-sm font-medium text-slate-200">
            Email
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
            />
          </label>
          <label className="text-sm font-medium text-slate-200">
            Team role
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              style={{ colorScheme: "dark" }}
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="MANAGER">Manager</option>
            </select>
            {inviteRole === "MANAGER" ? (
              <span className="mt-2 block text-xs leading-5 text-amber-100">
                Managers can manage the business profile, team, and Work Records. They must complete any
                applicable current Vendor assent before using locked vendor operations.
              </span>
            ) : null}
          </label>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={inviteSubmitting}
            className="w-full rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
          >
            {inviteSubmitting ? "Creating..." : "Create Invite"}
          </button>
          {inviteMessage ? (
            <p
              className={`text-xs ${inviteMessageTone === "error" ? "text-red-200" : "text-emerald-200"}`}
              role={inviteMessageTone === "error" ? "alert" : "status"}
              aria-live="polite"
            >
              {inviteMessage}
            </p>
          ) : null}
        </div>
      </form>

      <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-950/75 p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-white">Pending team invites</h3>
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
              const recipientEmail = invite.recipient?.email || "Not provided";
              const recipientPhone = invite.recipient?.phone || "Not provided";
              return (
                <div key={invite.id} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-300">
                  <button
                    type="button"
                    onClick={() => toggleInviteDetails(invite.id)}
                    className="flex w-full flex-col gap-3 text-left md:flex-row md:items-center md:justify-between"
                    aria-expanded={isExpanded}
                    aria-controls={`pending-invite-${invite.id}`}
                  >
                    <div>
                      <p className="font-semibold text-white">{recipientName}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Sent {formatRelianceDateTime(invite.sentAt)} · {recipientRole}
                      </p>
                      <p className="mt-1 text-xs text-slate-300">
                        Email: <span className="text-slate-100">{recipientEmail}</span>
                        <span className="mx-2 text-slate-600">|</span>
                        Phone: <span className="text-slate-100">{recipientPhone}</span>
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
                    <div id={`pending-invite-${invite.id}`} className="mt-3 rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300">
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
                          {formatRelianceDateTime(invite.expiresAt)}
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
                          className="mt-3 rounded border border-red-300/60 px-3 py-1.5 text-[11px] font-medium text-red-100 hover:bg-red-500/10 disabled:opacity-60"
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
            Active Employees and Managers. Only Employees can be assigned to scheduled work.
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
                className="flex flex-col gap-4 p-4 hover:bg-slate-900/80 sm:flex-row sm:items-center"
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
                  <div className="truncate text-sm text-slate-400">
                    Phone: {emp.phone || "Not provided"}
                  </div>
                  {String(emp.role).toUpperCase() === "EMPLOYEE" ? (
                    <div className="mt-2 text-xs text-slate-300">
                      Public Service Video participation:{" "}
                      <span className="font-semibold text-white">
                        {emp.publicMediaConsentStatus === "ALLOWED"
                          ? "Allowed"
                          : emp.publicMediaConsentStatus === "NOT_ALLOWED"
                            ? "Not allowed"
                            : "No choice recorded"}
                      </span>
                      {emp.publicMediaConsentDecidedAt ? ` · ${formatRelianceDate(emp.publicMediaConsentDecidedAt)}` : ""}
                    </div>
                  ) : null}
                  {String(emp.role).toUpperCase() === "EMPLOYEE" ? (() => {
                    const row = employeeRatingsByMembershipId[String(emp.membershipId)] || {
                      averageRating: 0,
                      reviewCount: 0,
                    };
                    return (
                      <div className="mt-1 text-xs text-slate-300">
                        {row.reviewCount > 0 ? (
                          <span>
                            Verified customer rating: <span className="font-semibold text-white">{row.averageRating.toFixed(1)}</span>
                            {" "}from {row.reviewCount} review{row.reviewCount === 1 ? "" : "s"}
                          </span>
                        ) : (
                          <span className="text-slate-400">No verified customer ratings yet.</span>
                        )}
                      </div>
                    );
                  })() : null}
                </div>
                <Badge variant={String(emp.role).toUpperCase() === "MANAGER" ? "default" : "secondary"}>
                  {roleLabel(emp.role)}
                </Badge>
                {String(emp.role).toUpperCase() === "EMPLOYEE" ? (
                  <button
                    type="button"
                    onClick={() => void handleSendParticipationLink(emp.membershipId)}
                    disabled={sendingParticipationMembershipId === emp.membershipId}
                    aria-label={`Send Public Service Video participation link to ${emp.name}`}
                    className="rounded border border-emerald-300 px-2 py-1 text-[11px] font-medium text-emerald-100 hover:bg-emerald-500/10 disabled:opacity-60"
                  >
                    {sendingParticipationMembershipId === emp.membershipId
                      ? "Sending…"
                      : "Send participation link"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => openEditMember(emp)}
                  aria-label={`Edit contact for ${emp.name}`}
                  className="rounded border border-blue-300 px-2 py-1 text-[11px] font-medium text-blue-100 hover:bg-blue-500/10"
                >
                  Edit contact
                </button>
                {emp.userId !== authUserId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRemoveError("");
                      setMemberPendingRemoval(emp);
                    }}
                    disabled={removingMembershipId === emp.membershipId}
                    aria-label={`Remove ${emp.name} from the team`}
                    className="rounded border border-red-300/60 px-2 py-1 text-[11px] text-red-100 hover:bg-red-500/10 disabled:opacity-60"
                  >
                    {removingMembershipId === emp.membershipId ? "Removing..." : "Remove from team"}
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
      {editingMember ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-3 py-6 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-team-member-title"
            aria-describedby="edit-team-member-description"
            className="max-h-[calc(100dvh-3rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="edit-team-member-title" className="text-lg font-semibold text-white">Edit team member contact</h3>
                <p id="edit-team-member-description" className="mt-1 text-sm leading-6 text-slate-300">
                  Update the active roster details used for job assignments and team communication.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditMember}
                className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-900"
                aria-label="Close edit member"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form
              className="mt-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveMember();
              }}
            >
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-200">
                Name
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
                  placeholder="Team member name"
                />
              </label>
              <label className="block text-sm font-medium text-slate-200">
                Email
                <input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
                  placeholder="email@example.com"
                />
              </label>
              <label className="block text-sm font-medium text-slate-200">
                Phone
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  type="tel"
                  autoComplete="tel"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
                  placeholder="(407) 555-1234"
                />
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-blue-400/20 bg-blue-950/30 p-3 text-xs leading-5 text-blue-100">
              This updates the team contact email only when it is not also the person's Reliance sign-in email.
              A sign-in email can be changed only by the account owner through a verified email-change flow.
            </div>

            {editMessage ? <p className="mt-3 text-sm text-red-200" role="alert">{editMessage}</p> : null}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeEditMember}
                disabled={Boolean(savingMembershipId)}
                className="w-full rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-900 disabled:opacity-60 sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingMembershipId === editingMember.membershipId}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60 sm:w-auto"
              >
                {savingMembershipId === editingMember.membershipId ? "Saving..." : "Save changes"}
              </button>
            </div>
            </form>
          </div>
        </div>
      ) : null}
      {memberPendingRemoval ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-team-member-title"
            aria-describedby="remove-team-member-description"
            className="w-full max-w-md rounded-xl border border-red-300/30 bg-slate-950 p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
              <div>
                <h3 id="remove-team-member-title" className="text-lg font-semibold text-white">
                  Remove {memberPendingRemoval.name} from the team?
                </h3>
                <p id="remove-team-member-description" className="mt-2 text-sm leading-6 text-slate-300">
                  Their team access will be revoked. Existing Work Records, assignments, consent evidence,
                  Service Orders, and saved media remain unchanged.
                </p>
                {removeError ? <p className="mt-3 text-sm text-red-200" role="alert">{removeError}</p> : null}
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                onClick={() => {
                  setMemberPendingRemoval(null);
                  setRemoveError("");
                }}
                disabled={Boolean(removingMembershipId)}
              >
                Keep team member
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                onClick={() => void handleRemoveMember(memberPendingRemoval.membershipId)}
                disabled={Boolean(removingMembershipId)}
              >
                {removingMembershipId ? "Removing..." : "Remove team member"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
