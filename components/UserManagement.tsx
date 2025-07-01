'use client';
// User Management – fully closed JSX with complete modal (ready for backend)
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
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Input
          placeholder="Search users"
          className="max-w-xs"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="border rounded px-2 py-1 pr-6 text-sm"
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
          className="border rounded px-2 py-1 pr-6 text-sm"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="all">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          className="border rounded px-2 py-1 pr-6 text-sm"
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
          className="border rounded px-2 py-1 pr-6 text-sm"
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
          className="border rounded px-2 py-1 pr-6 text-sm"
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
          <Card key={u.id}>
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

      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto space-y-6">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              Manage User: {editing.name}
              {editing.userType === 'admin' && <Badge variant="secondary">Admin</Badge>}
            </DialogTitle>
            <div className="flex gap-4 items-center">
              <img src={editing.image} alt={editing.name} className="w-16 h-16 rounded-md object-cover border" />
              <div>
                <div className="font-semibold">{editing.email}</div>
                <div className="flex gap-2 mt-1">
                  <Badge variant={editing.status === 'active' ? 'success' : editing.status === 'suspended' ? 'destructive' : 'secondary'} className="capitalize text-xs">{editing.status}</Badge>
                  <Badge variant="outline" className="text-xs">{editing.userType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</Badge>
                  <Badge variant={editing.verificationStatus === 'verified' ? 'success' : editing.verificationStatus === 'rejected' ? 'destructive' : 'warning'} className="capitalize text-xs">{editing.verificationStatus}</Badge>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">Name</label>
              <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              <label className="block text-sm font-medium mt-2">Tier</label>
              <select className="border rounded px-2 py-1 text-sm w-full" value={editing.tier} onChange={e => setEditing({ ...editing, tier: e.target.value })}>
                {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <label className="block text-sm font-medium mt-2">Status</label>
              <select className="border rounded px-2 py-1 text-sm w-full" value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <label className="block text-sm font-medium mt-2">Verification Status</label>
              <select className="border rounded px-2 py-1 text-sm w-full" value={editing.verificationStatus} onChange={e => setEditing({ ...editing, verificationStatus: e.target.value })}>
                {VERIFICATION_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
              <label className="block text-sm font-medium mt-2">Content Status</label>
              <select className="border rounded px-2 py-1 text-sm w-full" value={editing.contentStatus} onChange={e => setEditing({ ...editing, contentStatus: e.target.value })}>
                {CONTENT_STATUSES.map(s => <option key={s} value={s}>{s.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</option>)}
              </select>
              <label className="block text-sm font-medium mt-2">Notes</label>
              <textarea className="border rounded px-2 py-1 text-sm w-full" rows={2} value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })} />
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={() => { saveUser(editing); setEditing(null); }}>Save Changes</Button>
            </div>
            <div className="mt-6 border-t pt-4 space-y-2">
              <div className="font-semibold mb-2">Account Actions</div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="destructive" onClick={() => { setEditing({ ...editing, status: 'suspended' }); }}>Suspend</Button>
                <Button size="sm" variant="success" onClick={() => { setEditing({ ...editing, status: 'active' }); }}>Activate</Button>
                <Button size="sm" variant="outline" onClick={() => { setEditing({ ...editing, verificationStatus: 'verified' }); }}>Verify</Button>
                <Button size="sm" variant="outline" onClick={() => { setEditing({ ...editing, verificationStatus: 'pending' }); }}>Set Pending Verification</Button>
              </div>
            </div>
            <div className="mt-6 border-t pt-4 space-y-2">
              <div className="font-semibold mb-2">Activity Log</div>
              <ul className="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
                {editing.activity.map((a, i) => <li key={i}>• {a}</li>)}
              </ul>
            </div>
            {editing.adminPrivileges && (
              <div className="mt-6 border-t pt-4 space-y-2">
                <div className="font-semibold mb-2">Admin Privileges</div>
                <div className="text-xs text-gray-700">
                  <div>Access Level: {editing.adminPrivileges.accessLevel}</div>
                  <div>Departments: {editing.adminPrivileges.departmentAccess.join(', ')}</div>
                  <div>Can Review Content: {editing.adminPrivileges.canReviewContent ? 'Yes' : 'No'}</div>
                  <div>Can Delete Content: {editing.adminPrivileges.canDeleteContent ? 'Yes' : 'No'}</div>
                  <div>Can Flag Users: {editing.adminPrivileges.canFlagUsers ? 'Yes' : 'No'}</div>
                  <div>Can Suspend Accounts: {editing.adminPrivileges.canSuspendAccounts ? 'Yes' : 'No'}</div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 