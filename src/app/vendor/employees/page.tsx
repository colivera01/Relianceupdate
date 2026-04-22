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

export default function EmployeesPage() {
  const { user } = useAuth();
  const authUserId = user?.id || null;
  const { data: vendorProfile, loading: profileLoading, error: profileError } = useVendorProfile();
  const vendorId = vendorProfile?.id || "";

  const [teamMembers, setTeamMembers] = useState<VendorTeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const run = async () => {
      if (!vendorId || !authUserId) {
        setTeamMembers([]);
        setLoadError("");
        return;
      }
      setLoading(true);
      setLoadError("");
      try {
        const members = await fetchVendorTeamMembers(vendorId, () => ({
          "Content-Type": "application/json",
          ...getClientSessionHeaders(authUserId),
        }));
        setTeamMembers(members);
      } catch (e) {
        setTeamMembers([]);
        setLoadError(e instanceof Error ? e.message : "Could not load team.");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [vendorId, authUserId]);

  const managers = teamMembers.filter((m) => String(m.role).toUpperCase() === "MANAGER");
  const others = teamMembers.filter((m) => String(m.role).toUpperCase() !== "MANAGER");

  return (
    <div className="px-4 md:px-8 py-8">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg border">
          <div className="text-2xl font-bold text-blue-600">
            {profileLoading || loading ? "—" : teamMembers.length}
          </div>
          <div className="text-sm text-blue-600">Active team members</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border">
          <div className="text-2xl font-bold text-green-600">
            {profileLoading || loading ? "—" : managers.length}
          </div>
          <div className="text-sm text-green-600">Managers</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border">
          <div className="text-2xl font-bold text-purple-600">
            {profileLoading || loading ? "—" : others.length}
          </div>
          <div className="text-sm text-purple-600">Other roles</div>
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
                </div>
                <Badge variant={String(emp.role).toUpperCase() === "MANAGER" ? "default" : "secondary"}>
                  {roleLabel(emp.role)}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
