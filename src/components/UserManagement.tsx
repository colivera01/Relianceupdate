'use client';

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import SimpleTooltip from "@/components/ui/tooltip";
import { Info } from "lucide-react";

const PAGE_SIZE = 6;
const STATUSES = ["active", "inactive", "suspended", "pending_approval"];
const TIERS = ["Basic", "Premium"];
const USER_TYPES = ["service_provider", "customer", "admin"];
const VERIFICATION_STATUSES = ["pending", "verified", "rejected"];
const APPROVAL_STATUSES = ["pending", "approved", "rejected"];
const CONTENT_STATUSES = ["flagged", "pending_review", "approved"];
const DEPARTMENTS = ["User Verification", "Content Moderation", "Support Management", "Analytics & Reporting"];

// Types
type Billing = { status: string; lastPayment: string; renewalDate: string };
type Review = { id: number; rating: number; date: string; content: string };
type AdminPrivileges = {
  accessLevel: 'full' | 'limited' | 'read-only';
  departmentAccess: string[];
  canReviewContent: boolean;
  canDeleteContent: boolean;
  canFlagUsers: boolean;
  canSuspendAccounts: boolean;
  canApproveUsers: boolean;
};
type AdminActivity = {
  lastLogin: string;
  actionsToday: number;
  contentReviews: number;
  userVerifications: number;
  userApprovals: number;
  recentActions: string[];
};

interface User {
  id: number;
  name: string;
  email: string;
  status: string;
  tier: string;
  image: string;
  userType: string;
  verificationStatus: string;
  approvalStatus: string;
  contentStatus: string;
  adminPrivileges?: AdminPrivileges;
  adminActivity?: AdminActivity;
  billing: Billing;
  canReview: boolean;
  notes: string;
  activity: string[];
  reviews: Review[];
  registrationDate: string;
  approvalDate?: string;
  approvedBy?: string;
}

// seed data
const seedUsers: User[] = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  email: `user${i + 1}@mail.com`,
  status: STATUSES[i % 4],
  tier: TIERS[i % 2],
  userType: USER_TYPES[i % 3],
  verificationStatus: VERIFICATION_STATUSES[i % 3],
  approvalStatus: APPROVAL_STATUSES[i % 3],
  contentStatus: CONTENT_STATUSES[i % 3],
  image: `https://randomuser.me/api/portraits/${i % 2 ? "women" : "men"}/${i + 10}.jpg`,
  registrationDate: `2024-03-${String(i + 1).padStart(2, "0")}`,
  approvalDate: i % 3 === 1 ? `2024-03-${String(i + 2).padStart(2, "0")}` : undefined,
  approvedBy: i % 3 === 1 ? "Admin User" : undefined,
  billing: {
    status: "Active",
    lastPayment: `2024-05-${String(i + 1).padStart(2, "0")}`,
    renewalDate: `2024-06-${String(i + 1).padStart(2, "0")}`,
  },
  adminPrivileges: i % 3 === 2 ? {
    accessLevel: 'full',
    departmentAccess: DEPARTMENTS,
    canReviewContent: true,
    canDeleteContent: true,
    canFlagUsers: true,
    canSuspendAccounts: true,
    canApproveUsers: true,
  } : undefined,
  adminActivity: i % 3 === 2 ? {
    lastLogin: "2024-03-20 09:15 AM",
    actionsToday: 23,
    contentReviews: 15,
    userVerifications: 8,
    userApprovals: 12,
    recentActions: [
      "Verified business license for Vendor #1234",
      "Suspended account #5678 for policy violation",
      "Approved 5 content uploads",
      "Approved 3 new user registrations"
    ]
  } : undefined,
  canReview: true,
  notes: "",
  activity: ["2024-05-12 – Account created"],
  reviews: [],
}));

// Helper for info cue
const InfoCue = ({ text }: { text: string }) => (
  <SimpleTooltip content={text}>
    <Info className="inline w-4 h-4 ml-1 text-gray-400 cursor-pointer align-text-bottom" />
  </SimpleTooltip>
);

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>(seedUsers);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [userTypeFilter, setUserTypeFilter] = useState<string>("all");
  const [verificationFilter, setVerificationFilter] = useState<string>("all");
  const [approvalFilter, setApprovalFilter] = useState<string>("all");
  const [contentStatusFilter, setContentStatusFilter] = useState<string>("all");
  const [page, setPage] = useState<number>(1);
  const [editing, setEditing] = useState<User | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [showApprovalQueue, setShowApprovalQueue] = useState(false);
  
  // Auto-approval settings (would come from settings page)
  const [autoApproveUsers, setAutoApproveUsers] = useState<boolean>(false);
  const [autoApproveVendors, setAutoApproveVendors] = useState<boolean>(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.toLowerCase()), 200);
    return () => clearTimeout(timer);
  }, [search]);

  const filtered = users.filter((u) => {
    const q = debounced;
    return (
      (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
      (statusFilter === "all" || u.status === statusFilter) &&
      (tierFilter === "all" || u.tier === tierFilter) &&
      (userTypeFilter === "all" || u.userType === userTypeFilter) &&
      (verificationFilter === "all" || u.verificationStatus === verificationFilter) &&
      (approvalFilter === "all" || u.approvalStatus === approvalFilter) &&
      (contentStatusFilter === "all" || u.contentStatus === contentStatusFilter)
    );
  });

  const pendingApprovalUsers = users.filter(u => u.approvalStatus === 'pending');
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageUsers = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const saveUser = (upd: User) =>
    setUsers((prev) => prev.map((u) => (u.id === upd.id ? upd : u)));

  const approveUser = (userId: number) => {
    setUsers(prev => prev.map(u => 
      u.id === userId 
        ? { 
            ...u, 
            approvalStatus: 'approved', 
            status: 'active',
            approvalDate: new Date().toISOString().split('T')[0],
            approvedBy: 'Current Admin',
            activity: [...u.activity, `${new Date().toLocaleDateString()} – Account approved by admin`]
          }
        : u
    ));
  };

  const rejectUser = (userId: number) => {
    setUsers(prev => prev.map(u => 
      u.id === userId 
        ? { 
            ...u, 
            approvalStatus: 'rejected', 
            status: 'inactive',
            activity: [...u.activity, `${new Date().toLocaleDateString()} – Account rejected by admin`]
          }
        : u
    ));
  };

  const bulkApprove = () => {
    setUsers(prev => prev.map(u => 
      selectedUsers.includes(u.id) && u.approvalStatus === 'pending'
        ? { 
            ...u, 
            approvalStatus: 'approved', 
            status: 'active',
            approvalDate: new Date().toISOString().split('T')[0],
            approvedBy: 'Current Admin',
            activity: [...u.activity, `${new Date().toLocaleDateString()} – Account approved by admin (bulk)`]
          }
        : u
    ));
    setSelectedUsers([]);
  };

  const bulkReject = () => {
    setUsers(prev => prev.map(u => 
      selectedUsers.includes(u.id) && u.approvalStatus === 'pending'
        ? { 
            ...u, 
            approvalStatus: 'rejected', 
            status: 'inactive',
            activity: [...u.activity, `${new Date().toLocaleDateString()} – Account rejected by admin (bulk)`]
          }
        : u
    ));
    setSelectedUsers([]);
  };

  const toggleUserSelection = (userId: number) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Approval Queue Banner */}
      {pendingApprovalUsers.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="warning" className="text-sm">
                  {pendingApprovalUsers.length} Pending Approval
                </Badge>
                <span className="text-sm text-orange-700">
                  {pendingApprovalUsers.filter(u => u.userType === 'service_provider').length} vendors, 
                  {pendingApprovalUsers.filter(u => u.userType === 'customer').length} users
                </span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowApprovalQueue(!showApprovalQueue)}
              >
                {showApprovalQueue ? 'Hide' : 'Show'} Approval Queue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto-Approval Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Auto-Approval Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="autoApproveUsers" 
              checked={autoApproveUsers} 
              onCheckedChange={(v) => setAutoApproveUsers(!!v)} 
            />
            <label htmlFor="autoApproveUsers" className="text-sm font-medium">
              Automatically approve new customer registrations
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="autoApproveVendors" 
              checked={autoApproveVendors} 
              onCheckedChange={(v) => setAutoApproveVendors(!!v)} 
            />
            <label htmlFor="autoApproveVendors" className="text-sm font-medium">
              Automatically approve new vendor registrations
            </label>
          </div>
          <p className="text-xs text-gray-500">
            When enabled, new users will be automatically approved and can access the platform immediately.
          </p>
        </CardContent>
      </Card>

      {/* Enhanced Admin Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Input
          placeholder="Search users"
          className="max-w-xs"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="border rounded px-2 py-1 text-sm pr-6"
          value={userTypeFilter}
          onChange={(e) => { setUserTypeFilter(e.target.value); setPage(1); }}
        >
          <option value="all">All User Types</option>
          {USER_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </option>
          ))}
        </select>
        <select
          className="border rounded px-2 py-1 text-sm pr-6"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="all">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          className="border rounded px-2 py-1 text-sm pr-6"
          value={approvalFilter}
          onChange={(e) => { setApprovalFilter(e.target.value); setPage(1); }}
        >
          <option value="all">All Approval Status</option>
          {APPROVAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <select
          className="border rounded px-2 py-1 text-sm pr-6"
          value={verificationFilter}
          onChange={(e) => { setVerificationFilter(e.target.value); setPage(1); }}
        >
          <option value="all">All Verification Status</option>
          {VERIFICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <select
          className="border rounded px-2 py-1 text-sm pr-6"
          value={contentStatusFilter}
          onChange={(e) => { setContentStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="all">All Content Status</option>
          {CONTENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </option>
          ))}
        </select>
        <select
          className="border rounded px-2 py-1 text-sm pr-6"
          value={tierFilter}
          onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
        >
          <option value="all">All Tiers</option>
          {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedUsers.length} user(s) selected
              </span>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={bulkApprove}
                  disabled={!selectedUsers.some(id => 
                    users.find(u => u.id === id)?.approvalStatus === 'pending'
                  )}
                >
                  Approve Selected
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={bulkReject}
                  disabled={!selectedUsers.some(id => 
                    users.find(u => u.id === id)?.approvalStatus === 'pending'
                  )}
                >
                  Reject Selected
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedUsers([])}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(showApprovalQueue ? pendingApprovalUsers : pageUsers).map((u) => (
          <Card
            key={u.id}
            onClick={() => setSelectedUserId(u.id)}
            className={`cursor-pointer transition-shadow ${selectedUserId === u.id ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}
          >
            <CardHeader className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedUsers.includes(u.id)}
                  onCheckedChange={() => toggleUserSelection(u.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <img src={u.image} alt={u.name} className="w-10 h-10 rounded-md object-cover border" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <CardTitle>{u.name}</CardTitle>
                  {u.userType === 'admin' && (
                    <Badge className="ml-2" variant="secondary">Admin</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600">{u.email}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge variant={u.status === 'active' ? 'success' : u.status === 'suspended' ? 'destructive' : 'secondary'} className="capitalize text-xs">
                    {u.status}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {u.userType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Approval:</span>
                  <Badge variant={
                    u.approvalStatus === 'approved' ? 'success' : 
                    u.approvalStatus === 'rejected' ? 'destructive' : 
                    'warning'
                  } className="capitalize">
                    {u.approvalStatus}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Verification:</span>
                  <Badge variant={
                    u.verificationStatus === 'verified' ? 'success' : 
                    u.verificationStatus === 'rejected' ? 'destructive' : 
                    'warning'
                  } className="capitalize">
                    {u.verificationStatus}
                  </Badge>
                </div>
                {u.contentStatus !== 'approved' && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Content:</span>
                    <Badge variant={u.contentStatus === 'flagged' ? 'destructive' : 'warning'} className="capitalize">
                      {u.contentStatus.split('_').join(' ')}
                    </Badge>
                  </div>
                )}
                {u.approvalStatus === 'pending' && (
                  <div className="flex gap-1 mt-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-xs"
                      onClick={(e) => { e.stopPropagation(); approveUser(u.id); }}
                    >
                      Approve
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-xs"
                      onClick={(e) => { e.stopPropagation(); rejectUser(u.id); }}
                    >
                      Reject
                    </Button>
                  </div>
                )}
                {u.adminPrivileges && (
                  <div className="text-xs text-gray-500 mt-2">
                    <p>Access: {u.adminPrivileges.accessLevel}</p>
                    <p>Departments: {u.adminPrivileges.departmentAccess.length}</p>
                  </div>
                )}
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={(e) => { e.stopPropagation(); setEditing(u); }}>Manage</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between mt-4 text-sm">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</Button>
          <span>Page {page} / {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}

      {/* Modal */}
      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto space-y-6">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              Profile – {editing.name}
              {editing.userType === 'admin' && <Badge variant="secondary">Admin</Badge>}
            </DialogTitle>

            {/* Basic Info */}
            <section className="bg-gray-50 border rounded p-4 text-sm space-y-4">
              <div className="flex items-center gap-4">
                <img src={editing.image} alt={editing.name} className="w-24 h-24 rounded-md border object-cover" />
                <div className="flex-1 space-y-2">
                  <label className="font-semibold block">Name</label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  <label className="font-semibold block">Email</label>
                  <Input value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
                </div>
              </div>
            </section>

            {/* Account Type & Status */}
            <section className="bg-gray-50 border rounded p-4 text-sm space-y-3">
              <label className="font-semibold block">User Type</label>
              <select 
                className="w-full border rounded px-2 py-1" 
                value={editing.userType}
                onChange={(e) => setEditing({ ...editing, userType: e.target.value })}
              >
                {USER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                  </option>
                ))}
              </select>

              <label className="font-semibold block">Account Status</label>
              <select 
                className="w-full border rounded px-2 py-1" 
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value })}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              <label className="font-semibold block">Verification Status</label>
              <select 
                className="w-full border rounded px-2 py-1"
                value={editing.verificationStatus}
                onChange={(e) => setEditing({ ...editing, verificationStatus: e.target.value })}
              >
                {VERIFICATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </section>

            {/* Admin Privileges - Only shown for admin users */}
            {editing.userType === 'admin' && (
              <section className="bg-gray-50 border rounded p-4 text-sm space-y-3">
                <h3 className="font-semibold">Administrative Controls</h3>
                <div className="space-y-2">
                  <label className="font-semibold block">Access Level</label>
                  <select
                    className="w-full border rounded px-2 py-1"
                    value={editing.adminPrivileges?.accessLevel || 'read-only'}
                    onChange={(e) => setEditing({
                      ...editing,
                      adminPrivileges: {
                        ...editing.adminPrivileges!,
                        accessLevel: e.target.value as 'full' | 'limited' | 'read-only'
                      }
                    })}
                  >
                    <option value="full">Full Access</option>
                    <option value="limited">Limited Access</option>
                    <option value="read-only">Read Only</option>
                  </select>

                  <div className="mt-3">
                    <label className="font-semibold block mb-2">Department Access</label>
                    <div className="space-y-2">
                      {DEPARTMENTS.map((dept) => (
                        <label key={dept} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editing.adminPrivileges?.departmentAccess.includes(dept)}
                            onChange={(e) => {
                              const current = editing.adminPrivileges?.departmentAccess ?? [];
                              const newDepts = e.target.checked
                                ? [...current, dept]
                                : current.filter(d => d !== dept);
                              setEditing({
                                ...editing,
                                adminPrivileges: {
                                  ...editing.adminPrivileges!,
                                  departmentAccess: newDepts
                                }
                              });
                            }}
                          />
                          {dept}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="font-semibold block mb-2">Moderation Privileges</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editing.adminPrivileges?.canReviewContent}
                          onChange={(e) => setEditing({
                            ...editing,
                            adminPrivileges: {
                              ...editing.adminPrivileges!,
                              canReviewContent: e.target.checked
                            }
                          })}
                        />
                        Can Review Content
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editing.adminPrivileges?.canDeleteContent}
                          onChange={(e) => setEditing({
                            ...editing,
                            adminPrivileges: {
                              ...editing.adminPrivileges!,
                              canDeleteContent: e.target.checked
                            }
                          })}
                        />
                        Can Delete Content
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editing.adminPrivileges?.canFlagUsers}
                          onChange={(e) => setEditing({
                            ...editing,
                            adminPrivileges: {
                              ...editing.adminPrivileges!,
                              canFlagUsers: e.target.checked
                            }
                          })}
                        />
                        Can Flag Users
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editing.adminPrivileges?.canSuspendAccounts}
                          onChange={(e) => setEditing({
                            ...editing,
                            adminPrivileges: {
                              ...editing.adminPrivileges!,
                              canSuspendAccounts: e.target.checked
                            }
                          })}
                        />
                        Can Suspend Accounts
                      </label>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Activity Monitoring - Only shown for admin users */}
            {editing.userType === 'admin' && editing.adminActivity && (
              <section className="bg-gray-50 border rounded p-4 text-sm space-y-3">
                <h3 className="font-semibold">Admin Activity Log</h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-gray-500">Last Login</p>
                    <p>{editing.adminActivity.lastLogin}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Actions Today</p>
                    <p>{editing.adminActivity.actionsToday}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Content Reviews</p>
                    <p>{editing.adminActivity.contentReviews}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">User Verifications</p>
                    <p>{editing.adminActivity.userVerifications}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <h4 className="font-medium mb-1">Recent Actions</h4>
                  <ul className="text-xs space-y-1">
                    {editing.adminActivity.recentActions.map((action, idx) => (
                      <li key={idx} className="text-gray-600">{action}</li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {/* Quick Actions */}
            <section className="bg-gray-50 border rounded p-4 text-sm space-y-3">
              <h3 className="font-semibold">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm">
                  Verify Documents
                </Button>
                <Button variant="outline" size="sm">
                  Review Content
                </Button>
                <Button variant="outline" size="sm">
                  Send Warning
                </Button>
                <Button variant="destructive" size="sm">
                  Suspend Account
                </Button>
              </div>
            </section>

            {/* Notes */}
            <section className="bg-gray-50 border rounded p-4 text-sm space-y-2">
              <label className="font-semibold block">Admin Notes</label>
              <textarea
                className="w-full border rounded px-2 py-1 h-24"
                value={editing.notes}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              />
            </section>

            {/* Activity Log */}
            <details className="bg-gray-50 border rounded p-4 text-sm" open>
              <summary className="font-semibold cursor-pointer">Activity Log</summary>
              <ul className="list-disc list-inside mt-2 text-xs text-gray-700 space-y-1">
                {editing.activity.length === 0 ? <li>No activity yet.</li> : editing.activity.map((a, idx) => <li key={idx}>{a}</li>)}
              </ul>
            </details>

            {/* Reviews */}
            <details className="bg-gray-50 border rounded p-4 text-sm">
              <summary className="font-semibold cursor-pointer">User Reviews ({editing.reviews.length})</summary>
              {editing.reviews.length === 0 ? (
                <p className="text-xs text-gray-500 mt-2">No reviews.</p>
              ) : (
                <ul className="space-y-2 mt-2">
                  {editing.reviews.map((rev) => (
                    <li key={rev.id} className="border p-2 rounded bg-white">
                      <p className="text-sm font-medium">{rev.rating}★ – {rev.date}</p>
                      <p className="text-xs text-gray-700 mt-1">{rev.content}</p>
                    </li>
                  ))}
                </ul>
              )}
            </details>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={() => { saveUser(editing); setEditing(null); }}>Save Changes</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Backend Developer Notes */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">📋 Backend Developer Notes</h3>
        <div className="text-sm text-blue-700 space-y-2">
          <p><strong>Endpoints Needed:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><code>GET /api/users</code> – List users (with filters, search, pagination)</li>
            <li><code>PATCH /api/users/:id</code> – Update user details, status, approval, notes</li>
            <li><code>POST /api/users/bulk-approve</code> – Bulk approve users/vendors</li>
            <li><code>POST /api/users/bulk-reject</code> – Bulk reject users/vendors</li>
            <li><code>POST /api/users/:id/quick-action</code> – Quick actions (suspend, verify, etc.)</li>
            <li><code>GET /api/users/:id/activity</code> – Fetch user activity log</li>
            <li><code>GET /api/users/:id/reviews</code> – Fetch user reviews</li>
          </ul>
          <p><strong>User Data Format:</strong></p>
          <pre className="bg-gray-100 p-2 rounded text-xs mt-2 overflow-x-auto">{`
{
  id: number,
  name: string,
  email: string,
  status: 'active' | 'inactive' | 'suspended' | 'pending_approval',
  userType: 'customer' | 'service_provider' | 'admin',
  approvalStatus: 'pending' | 'approved' | 'rejected',
  verificationStatus: 'pending' | 'verified' | 'rejected',
  contentStatus: string,
  tier: string,
  image: string,
  billing: { status: string, lastPayment: string, renewalDate: string },
  adminPrivileges?: { ... },
  adminActivity?: { ... },
  canReview: boolean,
  notes: string,
  activity: string[],
  reviews: Review[],
  registrationDate: string,
  approvalDate?: string,
  approvedBy?: string
}
`}</pre>
          <p><strong>Integration Notes:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>All user actions (approve, reject, suspend, edit, etc.) should call the appropriate endpoint and update the UI on success.</li>
            <li>Bulk actions should accept an array of user IDs and an action type.</li>
            <li>Quick actions should be POSTs with an action type (e.g., 'suspend', 'verify').</li>
            <li>Activity log and reviews should be fetched on demand when the modal is opened.</li>
            <li>Show loading and error states for all async actions.</li>
            <li>Paginate user lists on the backend for large datasets.</li>
          </ul>
          <p className="mt-2"><strong>Validation & Security:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Only admins can approve/reject users and perform quick actions.</li>
            <li>All endpoints should validate user permissions and input data.</li>
            <li>Return clear error messages for failed actions.</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 