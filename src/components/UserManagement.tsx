'use client';

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const PAGE_SIZE = 6;
const STATUSES = ["active", "inactive", "suspended"];
const TIERS = ["Basic", "Premium"];
const USER_TYPES = ["service_provider", "customer", "admin"];
const VERIFICATION_STATUSES = ["pending", "verified", "rejected"];
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
};
type AdminActivity = {
  lastLogin: string;
  actionsToday: number;
  contentReviews: number;
  userVerifications: number;
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
  contentStatus: string;
  adminPrivileges?: AdminPrivileges;
  adminActivity?: AdminActivity;
  billing: Billing;
  canReview: boolean;
  notes: string;
  activity: string[];
  reviews: Review[];
}

// seed data
const seedUsers: User[] = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  email: `user${i + 1}@mail.com`,
  status: STATUSES[i % 3],
  tier: TIERS[i % 2],
  userType: USER_TYPES[i % 3],
  verificationStatus: VERIFICATION_STATUSES[i % 3],
  contentStatus: CONTENT_STATUSES[i % 3],
  image: `https://randomuser.me/api/portraits/${i % 2 ? "women" : "men"}/${i + 10}.jpg`,
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
  } : undefined,
  adminActivity: i % 3 === 2 ? {
    lastLogin: "2024-03-20 09:15 AM",
    actionsToday: 23,
    contentReviews: 15,
    userVerifications: 8,
    recentActions: [
      "Verified business license for Vendor #1234",
      "Suspended account #5678 for policy violation",
      "Approved 5 content uploads"
    ]
  } : undefined,
  canReview: true,
  notes: "",
  activity: ["2024-05-12 – Account created"],
  reviews: [],
}));

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>(seedUsers);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [userTypeFilter, setUserTypeFilter] = useState<string>("all");
  const [verificationFilter, setVerificationFilter] = useState<string>("all");
  const [contentStatusFilter, setContentStatusFilter] = useState<string>("all");
  const [page, setPage] = useState<number>(1);
  const [editing, setEditing] = useState<User | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

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
      (contentStatusFilter === "all" || u.contentStatus === contentStatusFilter)
    );
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageUsers = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const saveUser = (upd: User) =>
    setUsers((prev) => prev.map((u) => (u.id === upd.id ? upd : u)));

  return (
    <div className="p-6 space-y-6">
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

      {/* User Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pageUsers.map((u) => (
          <Card
            key={u.id}
            onClick={() => setSelectedUserId(u.id)}
            className={`cursor-pointer transition-shadow ${selectedUserId === u.id ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}
          >
            <CardHeader className="flex items-center gap-3">
              <img src={u.image} alt={u.name} className="w-10 h-10 rounded-md object-cover border" />
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
                {u.adminPrivileges && (
                  <div className="text-xs text-gray-500 mt-2">
                    <p>Access: {u.adminPrivileges.accessLevel}</p>
                    <p>Departments: {u.adminPrivileges.departmentAccess.length}</p>
                  </div>
                )}
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={() => setEditing(u)}>Manage</Button>
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
                              const newDepts = e.target.checked
                                ? [...(editing.adminPrivileges?.departmentAccess || []), dept]
                                : editing.adminPrivileges?.departmentAccess.filter(d => d !== dept);
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
    </div>
  );
} 