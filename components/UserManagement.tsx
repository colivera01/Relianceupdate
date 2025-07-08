'use client';
// User Management – fully closed JSX with complete modal (ready for backend)
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

// BACKEND DEVELOPER NOTES:
// - All endpoints require admin authentication/authorization.
// - All bulk actions should be logged in the audit trail (who performed, when, what action, which users).
// - For destructive actions (delete, suspend), consider requiring a reason and/or double confirmation.
// - For export, ensure data privacy compliance (GDPR, CCPA, etc.).
// - For notifications, support both email and in-app (if available).
//
// Bulk Actions Endpoints:
// 1. Bulk Status Update:
//    POST /api/admin/users/bulk-update-status
//    Payload: { userIds: number[], status: "active" | "inactive" | "suspended" }
//    Returns: Success/failure, updated user list
// 2. Bulk Delete:
//    POST /api/admin/users/bulk-delete
//    Payload: { userIds: number[] }
//    Returns: Success/failure
// 3. Bulk Role Assignment:
//    POST /api/admin/users/bulk-role
//    Payload: { userIds: number[], role: string }
//    Returns: Success/failure
// 4. Bulk Notification:
//    POST /api/admin/users/bulk-notify
//    Payload: { userIds: number[], message: string }
//    Returns: Success/failure
// 5. Bulk Export:
//    POST /api/admin/users/bulk-export
//    Payload: { userIds: number[] }
//    Returns: CSV or file download
// 6. Bulk Password Reset:
//    POST /api/admin/users/bulk-reset-password
//    Payload: { userIds: number[] }
//    Returns: Success/failure
//
// For all features, see also BACKEND_INTEGRATION_GUIDE.md for up-to-date requirements.
// - To support advanced filters, user object should include 'lastLogin' (ISO string) and 'contentStatus' (e.g., 'flagged').
// - Backend should support filtering by lastLogin (date range) and contentStatus (flagged, pending_review, approved).
// - Backend should support sorting by name, email, status, lastLogin, etc.
// - User object should include 'activity' (array of strings or objects with timestamp/action) for audit trail.
// - User object should include 'notes' (string or array) for admin notes/comments.
// - Backend should support fetching/updating notes and logging all admin actions for audit trail.
// - User object should include 'adminNotes': { id: string, text: string, author: string, date: string }[]
// - Backend should support CRUD for admin notes (add, edit, delete), and return notes with timestamp and author.
// - To support impersonation, backend should provide a secure endpoint (e.g., POST /api/admin/impersonate) that issues a temporary session/token for the selected user.
// - Log all impersonation actions for audit trail. Only super-admins should have this permission.
// - If column preferences should persist, backend should provide endpoints to save/load user grid preferences per admin.
// - For custom exports, backend should provide POST /api/admin/users/export with filters, format, and column selection.
// - Export history should be tracked in a separate table with admin ID, timestamp, filters used, format, and status.
// - Exports should be processed asynchronously with webhook/email notification when ready.
// - User avatars should be stored as URLs in the user profile. Backend should provide avatar upload/management endpoints.
// - Advanced filters require backend endpoints: GET /api/admin/users with query params for date ranges, last login, account creation, etc.
// - Sorting should be handled server-side for performance with large datasets. Support multiple sort fields.
// - Audit trail requires GET /api/admin/users/{id}/audit-trail endpoint with pagination and filtering options.
// - Admin notes should support rich text, attachments, and threaded conversations with timestamps and author info.
// - Admin notes API: POST /api/admin/users/{id}/notes, PUT /api/admin/users/{id}/notes/{noteId}, DELETE /api/admin/users/{id}/notes/{noteId}
// - Notes should support markdown/rich text, file attachments, and private/public visibility settings.
// - Impersonation requires POST /api/admin/impersonate/{userId} endpoint that issues temporary session/token.
// - All impersonation actions must be logged for audit trail. Only super-admins should have this permission.
// - Impersonation should have time limits and automatic logout mechanisms for security.
// - Analytics dashboard requires GET /api/admin/users/analytics endpoint with metrics like total users, growth rates, status breakdowns.
// - Summary stats should include real-time counts, trends, and actionable insights for admin decision-making.
// - Auto-approval setting should be persisted per admin (or globally) via GET/POST /api/admin/settings or similar endpoint.
// - When enabled, new users are automatically approved and can access the platform immediately.
// - On registration, set user status to 'pending' unless auto-approval is enabled.
// - Only users with status 'active' can log in.
// - Admin approval endpoints: POST /api/admin/users/:id/approve and /reject.
// - All approval/rejection actions must be logged in the audit trail.
// - Job history endpoint: GET /api/admin/users/{userId}/jobs returns all jobs for the user (with vendor, job type, date, status, feedback, etc.).
// - Job details endpoint: GET /api/admin/jobs/{jobId} for full job info.
// - Jobs must be linked to both user and vendor in the database. Support filtering and pagination.

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
  adminNotes?: { id: string; text: string; author: string; date: string; isPrivate: boolean }[];
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
  adminNotes: i % 2 === 0 ? [
    { id: "1", text: "Initial user creation.", author: "System", date: "2024-05-12 10:00 AM", isPrivate: false },
    { id: "2", text: "User marked as active.", author: "Admin", date: "2024-05-12 10:05 AM", isPrivate: false }
  ] : undefined,
}));

// Mock job data for demo
const mockJobs = [
  { id: 'job1', vendor: 'Vendor A', type: 'Cleaning', date: '2024-05-01', status: 'completed', feedback: 'Great job!', details: 'Deep cleaning of 3-bedroom apartment.' },
  { id: 'job2', vendor: 'Vendor B', type: 'Plumbing', date: '2024-04-15', status: 'completed', feedback: 'Quick and professional.', details: 'Fixed leaking sink.' },
  { id: 'job3', vendor: 'Vendor A', type: 'Painting', date: '2024-03-20', status: 'completed', feedback: 'Excellent finish.', details: 'Painted living room and hallway.' },
];

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
  const [selected, setSelected] = useState<number[]>([]);
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [roleToAssign, setRoleToAssign] = useState('customer');
  const [lastLoginFilter, setLastLoginFilter] = useState<string | undefined>(undefined);
  const [lastLoginFilterEnd, setLastLoginFilterEnd] = useState<string | undefined>(undefined);
  const [accountCreatedFilter, setAccountCreatedFilter] = useState<string | undefined>(undefined);
  const [accountCreatedFilterEnd, setAccountCreatedFilterEnd] = useState<string | undefined>(undefined);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const DEFAULT_COLUMNS = [
    { key: 'avatar', label: 'Avatar' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status' },
    { key: 'userType', label: 'Role' },
    { key: 'verificationStatus', label: 'Verification' },
    { key: 'contentStatus', label: 'Content' },
    { key: 'actions', label: 'Actions' },
  ];
  const [sortBy, setSortBy] = useState<string>("name");
  const [newAdminNote, setNewAdminNote] = useState('');
  const [exportHistory, setExportHistory] = useState<Array<{id: string, timestamp: string, format: string, status: string, filters: string}>>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportColumns, setExportColumns] = useState(DEFAULT_COLUMNS.map(c => c.key));
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS.map(c => c.key));
  const toggleColumn = (key: string) => setVisibleColumns(cols => cols.includes(key) ? cols.filter(c => c !== key) : [...cols, key]);
  const [quickViewUser, setQuickViewUser] = useState<User | null>(null);
  const [showQuickView, setShowQuickView] = useState(false);
  const [auditTrail, setAuditTrail] = useState<Array<{id: string, action: string, timestamp: string, admin: string, details: string}>>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [showImpersonateConfirm, setShowImpersonateConfirm] = useState(false);
  const [userToImpersonate, setUserToImpersonate] = useState<User | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [showApprovalQueue, setShowApprovalQueue] = useState(false);
  const [analyticsData, setAnalyticsData] = useState({
    totalUsers: 0,
    activeUsers: 0,
    pendingApproval: 0,
    suspendedUsers: 0,
    newUsersThisWeek: 0,
    newUsersThisMonth: 0,
    userGrowthRate: 0,
    topUserTypes: [] as Array<{type: string, count: number}>,
    recentActivity: [] as Array<{action: string, timestamp: string, user: string}>
  });
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);
  const [autoApproveUsers, setAutoApproveUsers] = useState(false);
  const [jobDetails, setJobDetails] = useState<any | null>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.toLowerCase()), 200);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    // Simulate loading analytics data
    const loadAnalytics = async () => {
      setIsLoadingAnalytics(true);
      setTimeout(() => {
        const totalUsers = users.length;
        const activeUsers = users.filter(u => u.status === 'active').length;
        const pendingApproval = users.filter(u => u.verificationStatus === 'pending').length;
        const suspendedUsers = users.filter(u => u.status === 'suspended').length;
        const newUsersThisWeek = Math.floor(Math.random() * 15) + 5;
        const newUsersThisMonth = Math.floor(Math.random() * 60) + 20;
        const userGrowthRate = ((newUsersThisMonth - 45) / 45 * 100).toFixed(1);
        
        const userTypeCounts = users.reduce((acc, user) => {
          acc[user.userType] = (acc[user.userType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const topUserTypes = Object.entries(userTypeCounts)
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);
        
        const recentActivity = [
          { action: 'New user registered', timestamp: '2 hours ago', user: 'john.doe@example.com' },
          { action: 'User account approved', timestamp: '4 hours ago', user: 'admin@reliance.com' },
          { action: 'User suspended', timestamp: '6 hours ago', user: 'admin@reliance.com' },
          { action: 'Profile updated', timestamp: '8 hours ago', user: 'jane.smith@example.com' },
        ];
        
        setAnalyticsData({
          totalUsers,
          activeUsers,
          pendingApproval,
          suspendedUsers,
          newUsersThisWeek,
          newUsersThisMonth,
          userGrowthRate: parseFloat(userGrowthRate),
          topUserTypes,
          recentActivity
        });
        setIsLoadingAnalytics(false);
      }, 1000);
    };
    
    loadAnalytics();
  }, [users]);

  const filtered = users.filter((u) => {
    const q = debounced;
    const matchesSearch = (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    const matchesStatus = (statusFilter === "all" || u.status === statusFilter);
    const matchesTier = (tierFilter === "all" || u.tier === tierFilter);
    const matchesUserType = (userTypeFilter === "all" || u.userType === userTypeFilter);
    const matchesVerification = (verificationFilter === "all" || u.verificationStatus === verificationFilter);
    const matchesContentStatus = (contentStatusFilter === "all" || u.contentStatus === contentStatusFilter);
    
    // Advanced date filters
    const matchesLastLogin = !lastLoginFilter || !u.adminActivity?.lastLogin || 
      new Date(u.adminActivity.lastLogin) >= new Date(lastLoginFilter);
    const matchesLastLoginEnd = !lastLoginFilterEnd || !u.adminActivity?.lastLogin || 
      new Date(u.adminActivity.lastLogin) <= new Date(lastLoginFilterEnd);
    
    return matchesSearch && matchesStatus && matchesTier && matchesUserType && 
           matchesVerification && matchesContentStatus && matchesLastLogin && matchesLastLoginEnd;
  });

  // Enhanced sorting
  const sortedUsers = [...filtered].sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortBy) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'email':
        aValue = a.email.toLowerCase();
        bValue = b.email.toLowerCase();
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'userType':
        aValue = a.userType;
        bValue = b.userType;
        break;
      case 'lastLogin':
        aValue = a.adminActivity?.lastLogin ? new Date(a.adminActivity.lastLogin) : new Date(0);
        bValue = b.adminActivity?.lastLogin ? new Date(b.adminActivity.lastLogin) : new Date(0);
        break;
      case 'accountCreated':
        // Mock account creation date for demo
        aValue = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28));
        bValue = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28));
        break;
      default:
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
    }
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedUsers.length / PAGE_SIZE);
  const pageUsers = sortedUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allVisibleIds = pageUsers.map(u => u.id);
  const allSelected = allVisibleIds.every(id => selected.includes(id)) && allVisibleIds.length > 0;
  const handleSelectAll = () => {
    if (allSelected) setSelected(selected.filter(id => !allVisibleIds.includes(id)));
    else setSelected([...new Set([...selected, ...allVisibleIds])]);
  };
  const handleSelect = (id: number) => {
    setSelected(selected => selected.includes(id) ? selected.filter(i => i !== id) : [...selected, id]);
  };

  const saveUser = (upd: User) =>
    setUsers((prev) => prev.map((u) => (u.id === upd.id ? upd : u)));

  const handleBulkActivate = () => {
    setUsers(users => users.map(u => selected.includes(u.id) ? { ...u, status: 'active' } : u));
    toast({ title: 'Users activated', description: `${selected.length} user(s) set to active.` });
  };
  const handleBulkDeactivate = () => {
    setUsers(users => users.map(u => selected.includes(u.id) ? { ...u, status: 'inactive' } : u));
    toast({ title: 'Users deactivated', description: `${selected.length} user(s) set to inactive.` });
  };
  const handleBulkSuspend = () => {
    setUsers(users => users.map(u => selected.includes(u.id) ? { ...u, status: 'suspended' } : u));
    toast({ title: 'Users suspended', description: `${selected.length} user(s) suspended.` });
  };
  const handleBulkDelete = () => {
    setUsers(users => users.filter(u => !selected.includes(u.id)));
    setSelected([]);
    setShowDeleteConfirm(false);
    toast({ title: 'Users deleted', description: 'Selected users have been deleted.' });
  };
  const handleBulkExport = () => {
    const exported = users.filter(u => selected.includes(u.id));
    const csv = [
      ['Name', 'Email', 'Status', 'Role'],
      ...exported.map(u => [u.name, u.email, u.status, u.userType])
    ].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users_export.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'Selected users exported to CSV.' });
  };
  const handleBulkRole = () => {
    setUsers(users => users.map(u => selected.includes(u.id) ? { ...u, userType: roleToAssign } : u));
    toast({ title: 'Role assigned', description: `Role '${roleToAssign}' assigned to selected users.` });
  };
  const handleBulkNotify = () => {
    toast({ title: 'Notification sent', description: `Notification sent to ${selected.length} user(s). (Mock)` });
  };
  const handleBulkResetPassword = () => {
    toast({ title: 'Password reset', description: `Password reset email sent to ${selected.length} user(s). (Mock)` });
  };

  const handleExport = async () => {
    setIsExporting(true);
    // Simulate export process
    setTimeout(() => {
      const newExport = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        format: exportFormat,
        status: 'completed',
        filters: `Status: ${statusFilter}, Type: ${userTypeFilter}, Search: ${search}`
      };
      setExportHistory(prev => [newExport, ...prev]);
      setIsExporting(false);
    }, 2000);
  };

  const handleQuickView = async (user: User) => {
    setQuickViewUser(user);
    setShowQuickView(true);
    setIsLoadingAudit(true);
    
    // Simulate loading audit trail
    setTimeout(() => {
      const mockAuditTrail = [
        { id: '1', action: 'Account Created', timestamp: '2024-01-15T10:30:00Z', admin: 'System', details: 'User account created via registration' },
        { id: '2', action: 'Email Verified', timestamp: '2024-01-15T11:45:00Z', admin: 'System', details: 'Email address verified successfully' },
        { id: '3', action: 'Status Changed', timestamp: '2024-01-20T14:20:00Z', admin: 'admin@reliance.com', details: 'Account status changed from pending to active' },
        { id: '4', action: 'Profile Updated', timestamp: '2024-01-25T09:15:00Z', admin: 'user@example.com', details: 'Profile information updated' },
        { id: '5', action: 'Admin Note Added', timestamp: '2024-01-28T16:30:00Z', admin: 'admin@reliance.com', details: 'Added note: Customer service inquiry resolved' },
      ];
      setAuditTrail(mockAuditTrail);
      setIsLoadingAudit(false);
    }, 1000);
  };

  const getRoleColor = (userType: string) => {
    switch (userType) {
      case 'admin': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'service_provider': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'customer': return 'bg-green-100 text-green-800 border-green-200';
      case 'moderator': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'suspended': return 'bg-red-100 text-red-800 border-red-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim() || !quickViewUser) return;
    
    setIsAddingNote(true);
    // Simulate API call
    setTimeout(() => {
      const newNote = {
        id: Date.now().toString(),
        text: newNoteText,
        author: 'Current Admin',
        date: new Date().toISOString(),
        isPrivate: true
      };
      
      setUsers(users => users.map(u => 
        u.id === quickViewUser.id 
          ? { ...u, adminNotes: [...(u.adminNotes || []), newNote] }
          : u
      ));
      
      setQuickViewUser({ ...quickViewUser, adminNotes: [...(quickViewUser.adminNotes || []), newNote] });
      setNewNoteText('');
      setShowAddNote(false);
      setIsAddingNote(false);
      toast({ title: 'Note added', description: 'Admin note has been added successfully.' });
    }, 500);
  };

  const handleEditNote = async (noteId: string) => {
    if (!editingNoteText.trim() || !quickViewUser) return;
    
    // Simulate API call
    setTimeout(() => {
      const updatedNotes = (quickViewUser.adminNotes || []).map(note =>
        note.id === noteId ? { ...note, text: editingNoteText } : note
      );
      
      setUsers(users => users.map(u => 
        u.id === quickViewUser.id ? { ...u, adminNotes: updatedNotes } : u
      ));
      
      setQuickViewUser({ ...quickViewUser, adminNotes: updatedNotes });
      setEditingNoteId(null);
      setEditingNoteText('');
      toast({ title: 'Note updated', description: 'Admin note has been updated successfully.' });
    }, 500);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!quickViewUser) return;
    
    // Simulate API call
    setTimeout(() => {
      const updatedNotes = (quickViewUser.adminNotes || []).filter(note => note.id !== noteId);
      
      setUsers(users => users.map(u => 
        u.id === quickViewUser.id ? { ...u, adminNotes: updatedNotes } : u
      ));
      
      setQuickViewUser({ ...quickViewUser, adminNotes: updatedNotes });
      toast({ title: 'Note deleted', description: 'Admin note has been deleted successfully.' });
    }, 500);
  };

  const startEditNote = (note: { id: string; text: string }) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.text);
  };

  const handleImpersonate = async (user: User) => {
    setUserToImpersonate(user);
    setShowImpersonateConfirm(true);
  };

  const confirmImpersonation = async () => {
    if (!userToImpersonate) return;
    
    setIsImpersonating(true);
    // Simulate API call for impersonation
    setTimeout(() => {
      // In a real implementation, this would redirect to the user's view with impersonation token
      toast({ 
        title: 'Impersonation Started', 
        description: `Now viewing as ${userToImpersonate.name}. You can exit impersonation from the user menu.`,
        duration: 5000
      });
      
      // Log the impersonation action
      const impersonationLog = {
        id: Date.now().toString(),
        action: 'User Impersonation Started',
        timestamp: new Date().toISOString(),
        admin: 'Current Admin',
        details: `Started impersonating user: ${userToImpersonate.name} (${userToImpersonate.email})`
      };
      
      setAuditTrail(prev => [impersonationLog, ...prev]);
      
      setShowImpersonateConfirm(false);
      setUserToImpersonate(null);
      setIsImpersonating(false);
      
      // In real implementation, redirect to user's dashboard
      // window.location.href = `/user/dashboard?impersonate=true&token=${impersonationToken}`;
    }, 1000);
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold mb-2">User Management</h2>
      {/* Auto-Approval Settings */}
      <Card className="mb-6">
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
          <p className="text-xs text-gray-500">
            When enabled, new users will be automatically approved and can access the platform immediately.
          </p>
        </CardContent>
      </Card>
      
      {/* Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Users */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Users</p>
                <p className="text-2xl font-bold text-blue-800">
                  {isLoadingAnalytics ? '...' : analyticsData.totalUsers.toLocaleString()}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  +{analyticsData.newUsersThisWeek} this week
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-200 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 text-xl">👥</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Users */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Active Users</p>
                <p className="text-2xl font-bold text-green-800">
                  {isLoadingAnalytics ? '...' : analyticsData.activeUsers.toLocaleString()}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  {analyticsData.totalUsers > 0 ? ((analyticsData.activeUsers / analyticsData.totalUsers) * 100).toFixed(1) : 0}% of total
                </p>
              </div>
              <div className="w-12 h-12 bg-green-200 rounded-lg flex items-center justify-center">
                <span className="text-green-600 text-xl">✅</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Approval */}
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Pending Approval</p>
                <p className="text-2xl font-bold text-yellow-800">
                  {isLoadingAnalytics ? '...' : analyticsData.pendingApproval.toLocaleString()}
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  Requires attention
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-200 rounded-lg flex items-center justify-center">
                <span className="text-yellow-600 text-xl">⏳</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Suspended Users */}
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Suspended Users</p>
                <p className="text-2xl font-bold text-red-800">
                  {isLoadingAnalytics ? '...' : analyticsData.suspendedUsers.toLocaleString()}
                </p>
                <p className="text-xs text-red-600 mt-1">
                  {analyticsData.totalUsers > 0 ? ((analyticsData.suspendedUsers / analyticsData.totalUsers) * 100).toFixed(1) : 0}% of total
                </p>
              </div>
              <div className="w-12 h-12 bg-red-200 rounded-lg flex items-center justify-center">
                <span className="text-red-600 text-xl">🚫</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Growth & Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Growth Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Growth Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Monthly Growth</span>
              <span className={`font-semibold ${analyticsData.userGrowthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {analyticsData.userGrowthRate >= 0 ? '+' : ''}{analyticsData.userGrowthRate}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">New Users (Month)</span>
              <span className="font-semibold text-blue-600">{analyticsData.newUsersThisMonth}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">New Users (Week)</span>
              <span className="font-semibold text-blue-600">{analyticsData.newUsersThisWeek}</span>
            </div>
          </CardContent>
        </Card>

        {/* User Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">User Types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {analyticsData.topUserTypes.map((type, index) => (
              <div key={type.type} className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  {type.type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${(type.count / analyticsData.totalUsers) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{type.count}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {analyticsData.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 truncate">{activity.action}</p>
                  <p className="text-xs text-gray-500">
                    {activity.user} • {activity.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button 
              variant="outline" 
              className="h-auto p-3 flex flex-col items-center gap-2"
              onClick={() => setShowApprovalQueue(true)}
            >
              <span className="text-lg">✅</span>
              <span className="text-xs">Review Pending</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto p-3 flex flex-col items-center gap-2"
              onClick={() => setShowAddNote(true)}
            >
              <span className="text-lg">📝</span>
              <span className="text-xs">Add Note</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto p-3 flex flex-col items-center gap-2"
              onClick={handleBulkExport}
            >
              <span className="text-lg">📊</span>
              <span className="text-xs">Export Data</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto p-3 flex flex-col items-center gap-2"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              <span className="text-lg">🔍</span>
              <span className="text-xs">Advanced Search</span>
            </Button>
          </div>
        </CardContent>
      </Card>

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
          <option value="flagged">Flagged Content</option>
        </select>
        <select
          className="border rounded px-2 py-1 pr-6 text-sm"
          value={tierFilter}
          onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
        >
          <option value="all">All Tiers</option>
          {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        
        {/* Advanced Filters Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="ml-2"
        >
          {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
        </Button>
      </div>

      {/* Advanced Filters Section */}
      {showAdvancedFilters && (
        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <h4 className="text-sm font-medium mb-3 text-gray-700">Advanced Filters</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-600">Last Login After</label>
              <input
                type="date"
                className="w-full border rounded px-2 py-1 text-sm"
                onChange={e => setLastLoginFilter(e.target.value)}
                value={lastLoginFilter || ''}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-600">Last Login Before</label>
              <input
                type="date"
                className="w-full border rounded px-2 py-1 text-sm"
                onChange={e => setLastLoginFilterEnd(e.target.value)}
                value={lastLoginFilterEnd || ''}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-600">Account Created After</label>
              <input
                type="date"
                className="w-full border rounded px-2 py-1 text-sm"
                onChange={e => setAccountCreatedFilter(e.target.value)}
                value={accountCreatedFilter || ''}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-600">Account Created Before</label>
              <input
                type="date"
                className="w-full border rounded px-2 py-1 text-sm"
                onChange={e => setAccountCreatedFilterEnd(e.target.value)}
                value={accountCreatedFilterEnd || ''}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLastLoginFilter(undefined);
                setLastLoginFilterEnd(undefined);
                setAccountCreatedFilter(undefined);
                setAccountCreatedFilterEnd(undefined);
              }}
            >
              Clear Advanced Filters
            </Button>
          </div>
        </div>
      )}

      {/* Enhanced Sorting */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-600">Sort by:</span>
        <select
          className="border rounded px-2 py-1 pr-6 text-sm"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          <option value="name">Name</option>
          <option value="email">Email</option>
          <option value="status">Status</option>
          <option value="userType">User Type</option>
          <option value="lastLogin">Last Login</option>
          <option value="accountCreated">Account Created</option>
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
          className="flex items-center gap-1"
        >
          {sortDirection === 'asc' ? '↑' : '↓'} {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
        </Button>
      </div>

      {/* Column Chooser UI */}
      <div className="flex gap-2 mb-2 items-center">
        <span className="text-xs text-gray-500">Columns:</span>
        {DEFAULT_COLUMNS.map(col => (
          <label key={col.key} className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={visibleColumns.includes(col.key)} onChange={() => toggleColumn(col.key)} />
            {col.label}
          </label>
        ))}
      </div>

      {/* Custom Export Button - moved here as per user request */}
      <Button onClick={() => setShowExportModal(true)} className="mb-4 w-fit flex items-center gap-2" variant="outline">
        <span className="text-lg">📤</span>
        Custom Export
      </Button>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 items-center bg-blue-50 border border-blue-200 rounded p-2">
          <Button size="sm" onClick={handleBulkActivate}>Activate</Button>
          <Button size="sm" onClick={handleBulkDeactivate}>Deactivate</Button>
          <Button size="sm" onClick={handleBulkSuspend}>Suspend</Button>
          <Button size="sm" variant="destructive" onClick={() => setShowDeleteConfirm(true)}>Delete</Button>
          <Button size="sm" onClick={handleBulkExport}>Export</Button>
          <div className="flex items-center gap-1">
            <select className="border rounded px-2 py-1 text-sm" value={roleToAssign} onChange={e => setRoleToAssign(e.target.value)}>
              {USER_TYPES.map(type => (
                <option key={type} value={type}>{type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</option>
              ))}
            </select>
            <Button size="sm" onClick={handleBulkRole}>Assign Role</Button>
          </div>
          <Button size="sm" onClick={handleBulkNotify}>Send Notification</Button>
          <Button size="sm" onClick={handleBulkResetPassword}>Reset Password</Button>
          <span className="ml-2 text-xs text-gray-600">{selected.length} selected</span>
          <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <DialogContent className="max-w-sm">
              <DialogTitle>Confirm Delete</DialogTitle>
              <div className="mb-4">Are you sure you want to delete {selected.length} user(s)? This action cannot be undone.</div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleBulkDelete}>Delete</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* User Grid (cards) - only render fields in visibleColumns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pageUsers.map((u) => (
          <Card key={u.id} className="relative hover:shadow-md transition-shadow">
            <input
              type="checkbox"
              checked={selected.includes(u.id)}
              onChange={() => handleSelect(u.id)}
              className="absolute top-3 left-3 w-4 h-4 z-10"
            />
            <CardHeader className="flex items-center gap-3">
              {visibleColumns.includes('avatar') && (
                <div className="relative">
                  {u.image ? (
                    <img src={u.image} alt={u.name} className="w-12 h-12 rounded-full object-cover border-2 border-gray-200" />
                  ) : (
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600 text-white font-bold text-lg border-2 border-blue-200 shadow-sm">
                      {getInitials(u.name)}
                    </div>
                  )}
                  {/* Online status indicator */}
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                    u.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                  }`}></div>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {visibleColumns.includes('name') && (
                    <CardTitle className="text-base truncate">{u.name}</CardTitle>
                  )}
                  {visibleColumns.includes('userType') && (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRoleColor(u.userType)}`}>
                      {u.userType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </span>
                  )}
                </div>
                {visibleColumns.includes('email') && (
                  <p className="text-sm text-gray-600 truncate">{u.email}</p>
                )}
                <div className="flex flex-wrap gap-1 mt-1">
                  {visibleColumns.includes('status') && (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(u.status)}`}>
                      {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {visibleColumns.includes('verificationStatus') && (
                  <div className="flex gap-2 items-center text-sm">
                    <span className="text-gray-500">Verification:</span>
                    <Badge variant={u.verificationStatus === 'verified' ? 'success' : u.verificationStatus === 'rejected' ? 'destructive' : 'warning'} className="capitalize">
                      {u.verificationStatus}
                    </Badge>
                  </div>
                )}
                {visibleColumns.includes('contentStatus') && u.contentStatus !== 'approved' && (
                  <div className="flex gap-2 items-center text-sm">
                    <span className="text-gray-500">Content:</span>
                    <Badge variant={u.contentStatus === 'flagged' ? 'destructive' : 'warning'} className="capitalize">
                      {u.contentStatus.split('_').join(' ')}
                    </Badge>
                  </div>
                )}
                {visibleColumns.includes('adminPrivileges') && u.adminPrivileges && (
                  <div className="text-xs text-gray-500 mt-2 p-2 bg-gray-50 rounded">
                    <p className="font-medium">Admin Access: {u.adminPrivileges.accessLevel}</p>
                    <p className="text-xs">Can Review: {u.adminPrivileges.canReviewContent ? 'Yes' : 'No'}</p>
                  </div>
                )}
              </div>
              {visibleColumns.includes('actions') && (
                <div className="mt-3 flex justify-start gap-2">
                  <Button size="sm" onClick={() => handleQuickView(u)} className="bg-gray-600 hover:bg-gray-700">
                    Quick View
                  </Button>
                  <Button size="sm" onClick={() => setEditing(u)} className="bg-blue-600 hover:bg-blue-700">
                    Manage User
                  </Button>
                  {u.userType !== 'admin' && (
                    <Button 
                      size="sm" 
                      onClick={() => handleImpersonate(u)} 
                      className="bg-orange-600 hover:bg-orange-700"
                      title="Impersonate this user"
                    >
                      👤
                    </Button>
                  )}
                </div>
              )}
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
              {editing.image ? (
                <img src={editing.image} alt={editing.name} className="w-16 h-16 rounded-full object-cover border" />
              ) : (
                <div className="w-16 h-16 rounded-full flex items-center justify-center bg-blue-200 text-blue-800 font-bold text-2xl border">
                  {editing.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                </div>
              )}
              <div>
                <div className="font-semibold">{editing.email}</div>
                <div className="flex gap-2 mt-1">
                  <Badge variant={editing.status === 'active' ? 'success' : editing.status === 'suspended' ? 'destructive' : 'secondary'} className="capitalize text-xs">{editing.status}</Badge>
                  <Badge variant={editing.userType === 'admin' ? 'secondary' : editing.userType === 'service_provider' ? 'success' : 'outline'} className="capitalize text-xs">{editing.userType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</Badge>
                </div>
              </div>
            </div>
            {/* Impersonate User Button */}
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={() => alert('Impersonate user feature coming soon!')}>Impersonate User</Button>
            </div>
            {/* Audit Trail */}
            <div>
              <h3 className="font-semibold mb-1">Audit Trail</h3>
              <ul className="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto border rounded p-2 bg-gray-50">
                {(editing.activity && editing.activity.length > 0)
                  ? editing.activity.map((a, i) => <li key={i}>• {a}</li>)
                  : <li>No history yet.</li>}
              </ul>
            </div>
            {/* Admin Notes (multiple, with timestamp/author) */}
            <div>
              <h3 className="font-semibold mb-1">Admin Notes</h3>
              <ul className="space-y-2 mb-2">
                {(editing.adminNotes && editing.adminNotes.length > 0)
                  ? editing.adminNotes.map(note => (
                      <li key={note.id} className="bg-gray-50 border rounded p-2 text-xs flex flex-col">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-blue-700">{note.author}</span>
                          <span className="text-gray-400">{note.date}</span>
                        </div>
                        <div>{note.text}</div>
                        {/* TODO: Add edit/delete actions for notes if needed */}
                      </li>
                    ))
                  : <li className="text-gray-400">No notes yet.</li>}
              </ul>
              <form className="flex gap-2" onSubmit={e => {
                e.preventDefault();
                const newNote = {
                  id: Date.now().toString(),
                  text: newAdminNote,
                  author: 'Admin', // TODO: Replace with real admin name
                  date: new Date().toLocaleString()
                };
                saveUser({
                  ...editing,
                  adminNotes: [newNote, ...(editing.adminNotes || [])]
                });
                setNewAdminNote('');
              }}>
                <input
                  className="border rounded px-2 py-1 text-xs flex-1"
                  placeholder="Add a note..."
                  value={newAdminNote}
                  onChange={e => setNewAdminNote(e.target.value)}
                />
                <Button size="sm" type="submit">Add</Button>
              </form>
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

      {/* Quick View Modal */}
      {showQuickView && quickViewUser && (
        <Dialog open={showQuickView} onOpenChange={setShowQuickView}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="relative">
                  {quickViewUser.image ? (
                    <img src={quickViewUser.image} alt={quickViewUser.name} className="w-12 h-12 rounded-full object-cover border-2 border-gray-200" />
                  ) : (
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600 text-white font-bold text-lg border-2 border-blue-200 shadow-sm">
                      {getInitials(quickViewUser.name)}
                    </div>
                  )}
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                    quickViewUser.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                  }`}></div>
                </div>
                <div>
                  <h2 className="text-xl font-bold">{quickViewUser.name}</h2>
                  <p className="text-sm text-gray-600">{quickViewUser.email}</p>
                </div>
              </DialogTitle>
            </DialogHeader>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* User Details */}
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-3">Account Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(quickViewUser.status)}`}>
                        {quickViewUser.status.charAt(0).toUpperCase() + quickViewUser.status.slice(1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">User Type:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRoleColor(quickViewUser.userType)}`}>
                        {quickViewUser.userType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tier:</span>
                      <span className="font-medium">{quickViewUser.tier}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Verification:</span>
                      <Badge variant={quickViewUser.verificationStatus === 'verified' ? 'success' : quickViewUser.verificationStatus === 'rejected' ? 'destructive' : 'warning'} className="capitalize">
                        {quickViewUser.verificationStatus}
                      </Badge>
                    </div>
                    {quickViewUser.contentStatus !== 'approved' && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Content Status:</span>
                        <Badge variant={quickViewUser.contentStatus === 'flagged' ? 'destructive' : 'warning'} className="capitalize">
                          {quickViewUser.contentStatus.split('_').join(' ')}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
                {/* Job History Section */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-3">Job History</h3>
                  {mockJobs.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {mockJobs.map(job => (
                        <div key={job.id} className="bg-white p-2 rounded border min-w-0 flex flex-col gap-1">
                          <div className="font-medium text-sm text-gray-800 break-words">{job.type}</div>
                          <div className="text-xs text-gray-500 break-words">Vendor: {job.vendor}</div>
                          <div className="text-xs text-gray-500">Date: {job.date}</div>
                          <div className="text-xs font-semibold" style={{ color: job.status === 'completed' ? '#16a34a' : '#b91c1c' }}>
                            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                          </div>
                          <Button size="sm" variant="outline" className="mt-1 w-fit self-end" onClick={() => { setJobDetails(job); setShowJobDetails(true); }}>
                            View Details
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No jobs found for this user.</p>
                  )}
                </div>
              </div>
              {/* Admin Notes & Audit Trail */}
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-3">Admin Notes</h3>
                  {quickViewUser.adminNotes && quickViewUser.adminNotes.length > 0 ? (
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {quickViewUser.adminNotes.map((note, index) => (
                        <div key={index} className="bg-white p-3 rounded border">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium text-gray-700 break-words">{note.author}</span>
                            <span className="text-xs text-gray-500">{new Date(note.date).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{note.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No admin notes yet.</p>
                  )}
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-3">Audit Trail</h3>
                  {isLoadingAudit ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-2 text-sm text-gray-600">Loading audit trail...</span>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {auditTrail.map((entry) => (
                        <div key={entry.id} className="bg-white p-3 rounded border">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-sm font-medium text-gray-700 break-words">{entry.action}</span>
                            <span className="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-gray-600 break-words">By: {entry.admin}</span>
                          </div>
                          <p className="text-xs text-gray-600 whitespace-pre-wrap break-words">{entry.details}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowQuickView(false)}>
                Close
              </Button>
              <Button onClick={() => { setShowQuickView(false); setEditing(quickViewUser); }}>
                Edit User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Note Modal */}
      {showAddNote && (
        <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Admin Note</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Note Text</label>
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="w-full p-3 border rounded-lg text-sm"
                  rows={4}
                  placeholder="Enter your private note about this user..."
                />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="private-note" defaultChecked />
                <label htmlFor="private-note" className="text-sm text-gray-600">
                  Private note (only visible to admins)
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddNote(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddNote} 
                disabled={!newNoteText.trim() || isAddingNote}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isAddingNote ? 'Adding...' : 'Add Note'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Custom Export Modal */}
      {showExportModal && (
        <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Custom Export</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Format</label>
                <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} className="w-full p-2 border rounded">
                  <option value="csv">CSV</option>
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Columns</label>
                <select multiple value={exportColumns} onChange={(e) => setExportColumns(Array.from(e.target.selectedOptions, option => option.value))} className="w-full p-2 border rounded h-20">
                  {DEFAULT_COLUMNS.map(col => (
                    <option key={col.key} value={col.key}>{col.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleExport} disabled={isExporting} className="w-full">
                  {isExporting ? 'Exporting...' : 'Export Users'}
                </Button>
              </div>
            </div>
            {/* Export History */}
            {exportHistory.length > 0 && (
              <div>
                <h4 className="text-md font-medium mb-2">Export History</h4>
                <div className="space-y-2">
                  {exportHistory.slice(0, 5).map(export_ => (
                    <div key={export_.id} className="flex items-center justify-between p-2 bg-white rounded border">
                      <div>
                        <span className="text-sm font-medium">{export_.format.toUpperCase()}</span>
                        <span className="text-xs text-gray-500 ml-2">{new Date(export_.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={export_.status === 'completed' ? 'success' : 'warning'} className="text-xs">
                          {export_.status}
                        </Badge>
                        <Button size="sm" variant="outline">Download</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExportModal(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Impersonation Confirmation Modal */}
      {showImpersonateConfirm && userToImpersonate && (
        <Dialog open={showImpersonateConfirm} onOpenChange={setShowImpersonateConfirm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-orange-600">⚠️</span>
                Confirm User Impersonation
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-semibold text-orange-800 mb-2">Security Warning</h4>
                <p className="text-sm text-orange-700">
                  You are about to impersonate <strong>{userToImpersonate.name}</strong>. 
                  This action will be logged and you will have access to their account view.
                </p>
              </div>
              
              <div className="bg-gray-50 p-3 rounded">
                <h4 className="font-medium mb-2">User Details</h4>
                <div className="text-sm space-y-1">
                  <div><strong>Name:</strong> {userToImpersonate.name}</div>
                  <div><strong>Email:</strong> {userToImpersonate.email}</div>
                  <div><strong>Role:</strong> {userToImpersonate.userType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</div>
                  <div><strong>Status:</strong> {userToImpersonate.status}</div>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">Important Notes</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• This action is logged for security audit</li>
                  <li>• You can exit impersonation from the user menu</li>
                  <li>• Impersonation will automatically expire after 30 minutes</li>
                  <li>• Do not perform sensitive actions while impersonating</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowImpersonateConfirm(false)}>
                Cancel
              </Button>
              <Button 
                onClick={confirmImpersonation} 
                disabled={isImpersonating}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isImpersonating ? 'Starting Impersonation...' : 'Start Impersonation'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Job Details Modal */}
      {showJobDetails && jobDetails && (
        <Dialog open={showJobDetails} onOpenChange={setShowJobDetails}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Job Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">Type:</span>
                <span>{jobDetails.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Vendor:</span>
                <span>{jobDetails.vendor}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Date:</span>
                <span>{jobDetails.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Status:</span>
                <span>{jobDetails.status}</span>
              </div>
              <div>
                <span className="font-medium">Feedback:</span>
                <p className="text-sm text-gray-700 mt-1">{jobDetails.feedback}</p>
              </div>
              <div>
                <span className="font-medium">Details:</span>
                <p className="text-sm text-gray-700 mt-1">{jobDetails.details}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowJobDetails(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 