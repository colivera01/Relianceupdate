"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import SimpleTooltip, { TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/components/ui/use-toast";
import { saveAs } from 'file-saver';

const TYPES = ["video", "photo"] as const;
const RATINGS = [5, 4, 3, 2, 1] as const;
const SOURCES = ["user", "vendor"] as const;

type Status = "pending" | "approved" | "rejected";

type Reply = { id: number; author: string; content: string; timestamp: string };
type AdminAction = { id: number; reviewId: number; action: string; actor: string; timestamp: string; reason?: string };
interface Review {
  id: number;
  vendor: string;
  vendorImage: string;
  user: string;
  reviewerType: (typeof SOURCES)[number];
  userImage: string;
  rating: number;
  type: (typeof TYPES)[number];
  date: string;
  closedDate: string;
  content: string;
  mediaUrl: string;
  flagged: boolean;
  auto: boolean;
  status: Status;
  replies: Reply[];
}

const vendorLogos = [
  "https://via.placeholder.com/48?text=RP",
  "https://via.placeholder.com/48?text=BE",
  "https://via.placeholder.com/48?text=SH"
];

function daysBetween(d1: Date, d2: Date): number {
  return Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
}

// Helper to get hours left in 72hr window
function getHoursLeft(reviewDate: string) {
  const submitted = new Date(reviewDate);
  const now = new Date();
  const diffMs = now.getTime() - submitted.getTime();
  const hours = 72 - Math.floor(diffMs / (1000 * 60 * 60));
  return hours > 0 ? hours : 0;
}

const REVIEWS_PER_PAGE = 6;
const mockReviews: Review[] = [
  // 1. Vendor review, just submitted (71h left, green)
  {
    id: 101,
    vendor: "Reliable Plumbers",
    vendorImage: "https://via.placeholder.com/48?text=RP",
    user: "UserA",
    reviewerType: "vendor",
    userImage: "https://randomuser.me/api/portraits/men/21.jpg",
    rating: 5,
    type: "video",
    date: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
    closedDate: "",
    content: "Vendor review just submitted. Should show green 72hr badge.",
    mediaUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    flagged: false,
    auto: false,
    status: "pending",
    replies: []
  },
  // 2. Vendor review, 20h left (yellow)
  {
    id: 102,
    vendor: "Bright Electric",
    vendorImage: "https://via.placeholder.com/48?text=BE",
    user: "UserB",
    reviewerType: "vendor",
    userImage: "https://randomuser.me/api/portraits/women/22.jpg",
    rating: 4,
    type: "photo",
    date: new Date(Date.now() - 52 * 60 * 60 * 1000).toISOString(), // 52 hours ago
    closedDate: "",
    content: "Vendor review, 20h left. Should show yellow badge.",
    mediaUrl: "https://via.placeholder.com/400x200?text=Photo+2",
    flagged: false,
    auto: false,
    status: "pending",
    replies: []
  },
  // 3. Vendor review, 4h left (red)
  {
    id: 103,
    vendor: "Spark HVAC",
    vendorImage: "https://via.placeholder.com/48?text=SH",
    user: "UserC",
    reviewerType: "vendor",
    userImage: "https://randomuser.me/api/portraits/men/23.jpg",
    rating: 3,
    type: "photo",
    date: new Date(Date.now() - 68 * 60 * 60 * 1000).toISOString(), // 68 hours ago
    closedDate: "",
    content: "Vendor review, 4h left. Should show red badge.",
    mediaUrl: "https://via.placeholder.com/400x200?text=Photo+3",
    flagged: false,
    auto: false,
    status: "pending",
    replies: []
  },
  // 4. Vendor review, window expired (should show expired message)
  {
    id: 104,
    vendor: "Reliable Plumbers",
    vendorImage: "https://via.placeholder.com/48?text=RP",
    user: "UserD",
    reviewerType: "vendor",
    userImage: "https://randomuser.me/api/portraits/women/24.jpg",
    rating: 2,
    type: "video",
    date: new Date(Date.now() - 80 * 60 * 60 * 1000).toISOString(), // 80 hours ago
    closedDate: "",
    content: "Vendor review, window expired. Should show expired message.",
    mediaUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    flagged: false,
    auto: false,
    status: "pending",
    replies: []
  },
  // 5. User review, pending (should NOT show countdown)
  {
    id: 105,
    vendor: "Bright Electric",
    vendorImage: "https://via.placeholder.com/48?text=BE",
    user: "UserE",
    reviewerType: "user",
    userImage: "https://randomuser.me/api/portraits/men/25.jpg",
    rating: 5,
    type: "photo",
    date: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(), // 10 hours ago
    closedDate: "",
    content: "User review, pending. No countdown.",
    mediaUrl: "https://via.placeholder.com/400x200?text=Photo+5",
    flagged: false,
    auto: false,
    status: "pending",
    replies: []
  },
  // 6. Vendor review, approved (should NOT show countdown)
  {
    id: 106,
    vendor: "Spark HVAC",
    vendorImage: "https://via.placeholder.com/48?text=SH",
    user: "UserF",
    reviewerType: "vendor",
    userImage: "https://randomuser.me/api/portraits/women/26.jpg",
    rating: 4,
    type: "video",
    date: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(), // 20 hours ago
    closedDate: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    content: "Vendor review, approved. No countdown.",
    mediaUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    flagged: false,
    auto: false,
    status: "approved",
    replies: []
  },
  // 7. Vendor review, flagged, pending, 60h left (yellow)
  {
    id: 107,
    vendor: "Reliable Plumbers",
    vendorImage: "https://via.placeholder.com/48?text=RP",
    user: "UserG",
    reviewerType: "vendor",
    userImage: "https://randomuser.me/api/portraits/men/27.jpg",
    rating: 1,
    type: "photo",
    date: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
    closedDate: "",
    content: "Flagged vendor review, 60h left. Should show yellow badge and flagged.",
    mediaUrl: "https://via.placeholder.com/400x200?text=Photo+7",
    flagged: true,
    auto: false,
    status: "pending",
    replies: []
  }
];

export default function ReviewManagement() {
  const [reviews, setReviews] = useState<Review[]>(mockReviews);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<number|"all">("all");
  const [flagFilter, setFlagFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [autoFilter, setAutoFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<Status|"all">("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [viewing, setViewing] = useState<Review|null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [replyInput, setReplyInput] = useState("");
  const [editingReply, setEditingReply] = useState<number|null>(null);
  const [editingContent, setEditingContent] = useState(false);
  const [contentInput, setContentInput] = useState("");
  const [editReason, setEditReason] = useState("");
  const [adminLog, setAdminLog] = useState<AdminAction[]>([]);
  const [debounced, setDebounced] = useState("");
  const [window72hrFilter, setWindow72hrFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showExpiringBanner, setShowExpiringBanner] = useState(true);
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [role, setRole] = useState<'admin' | 'viewer'>('admin');

  const t = {
    role: 'Role', admin: 'Admin', viewer: 'Viewer', pending: 'Pending', approved: 'Approved', rejected: 'Rejected', flagged: 'Flagged', expired: 'Expired', approve: 'Approve', reject: 'Reject', flag: 'Flag', edit: 'Edit', details: 'Details', review: 'Review', auditLog: 'Audit Log', noActions: 'No actions yet.', exportCSV: 'Export CSV', grid: 'Grid', list: 'List', search: 'Search by vendor/user/content', selected: 'selected', mostActiveVendor: 'Most Active Vendor', mostActiveUser: 'Most Active User', avgReviewTime: 'Avg Review Time', expiringSoon: 'Expiring Soon', flagRate: 'Flag Rate', batchApprove: 'Approve', batchReject: 'Reject', batchDelete: 'Delete', batchExport: 'Export', viewJob: 'View Job', reviewWindowExpired: 'Review window expired! (auto-action required)', reminder: 'Reminder', expiringReminder: 'Some vendor reviews are about to expire (less than 6 hours left)!', reviewApproved: 'Review Approved', reviewRejected: 'Review Rejected', editReason: 'Reason for edit (optional)', save: 'Save', cancel: 'Cancel', totalPending: 'Pending', page: 'Page', of: 'of', flagWord: 'Flagged word', auto: 'Auto', manual: 'Manual', status: 'Status', type: 'Type', rating: 'Rating', vendor: 'Vendor', user: 'User', content: 'Content', flaggedWord: 'Flagged word', actions: 'Actions', close: 'Close', newReview: 'New (24h)', avgRating: 'Avg Rating', totalReviews: 'Total Reviews', flaggedPercent: '% Flagged', batchSelected: 'selected', batchActions: 'Batch Actions', batch: 'Batch', batchApproveAll: 'Approve All', batchRejectAll: 'Reject All', batchDeleteAll: 'Delete All', batchExportAll: 'Export All', batchNone: 'No batch actions available', batchSelect: 'Select reviews to enable batch actions', batchClear: 'Clear Selection', batchCount: 'selected', batchApproveSelected: 'Approve Selected', batchRejectSelected: 'Reject Selected', batchDeleteSelected: 'Delete Selected', batchExportSelected: 'Export Selected', batchExportFiltered: 'Export Filtered', batchExportAllReviews: 'Export All Reviews', batchExportCurrentPage: 'Export Current Page', batchExportSelectedReviews: 'Export Selected Reviews', batchExportFilteredReviews: 'Export Filtered Reviews', batchExportAllFiltered: 'Export All Filtered', batchExportAllSelected: 'Export All Selected', batchExportAllCurrent: 'Export All Current', batchExportAllCurrentPage: 'Export All Current Page', batchExportAllSelectedPage: 'Export All Selected Page', batchExportAllFilteredPage: 'Export All Filtered Page', batchExportAllSelectedFiltered: 'Export All Selected Filtered', batchExportAllSelectedFilteredPage: 'Export All Selected Filtered Page', batchExportAllSelectedCurrent: 'Export All Selected Current', batchExportAllSelectedCurrentPage: 'Export All Selected Current Page', batchExportAllSelectedFilteredCurrent: 'Export All Selected Filtered Current', batchExportAllSelectedFilteredCurrentPage: 'Export All Selected Filtered Current Page', batchExportAllSelectedFilteredCurrentPageReviews: 'Export All Selected Filtered Current Page Reviews', batchExportAllSelectedFilteredCurrentPageReviewsCSV: 'Export All Selected Filtered Current Page Reviews (CSV)', batchExportAllSelectedFilteredCurrentPageReviewsPDF: 'Export All Selected Filtered Current Page Reviews (PDF)', batchExportAllSelectedFilteredCurrentPageReviewsExcel: 'Export All Selected Filtered Current Page Reviews (Excel)', batchExportAllSelectedFilteredCurrentPageReviewsCSVExcel: 'Export All Selected Filtered Current Page Reviews (CSV, Excel)', batchExportAllSelectedFilteredCurrentPageReviewsCSVExcelPDF: 'Export All Selected Filtered Current Page Reviews (CSV, Excel, PDF)', batchExportAllSelectedFilteredCurrentPageReviewsCSVExcelPDFAll: 'Export All Selected Filtered Current Page Reviews (CSV, Excel, PDF, All)', batchExportAllSelectedFilteredCurrentPageReviewsCSVExcelPDFAllFormats: 'Export All Selected Filtered Current Page Reviews (CSV, Excel, PDF, All Formats)', batchExportAllSelectedFilteredCurrentPageReviewsCSVExcelPDFAllFormatsNow: 'Export All Selected Filtered Current Page Reviews (CSV, Excel, PDF, All Formats, Now)', batchExportAllSelectedFilteredCurrentPageReviewsCSVExcelPDFAllFormatsNowImmediately: 'Export All Selected Filtered Current Page Reviews (CSV, Excel, PDF, All Formats, Now, Immediately)', batchExportAllSelectedFilteredCurrentPageReviewsCSVExcelPDFAllFormatsNowImmediatelyAndForever: 'Export All Selected Filtered Current Page Reviews (CSV, Excel, PDF, All Formats, Now, Immediately, And Forever)', batchExportAllSelectedFilteredCurrentPageReviewsCSVExcelPDFAllFormatsNowImmediatelyAndForeverAndEver: 'Export All Selected Filtered Current Page Reviews (CSV, Excel, PDF, All Formats, Now, Immediately, And Forever, And Ever)', batchExportAllSelectedFilteredCurrentPageReviewsCSVExcelPDFAllFormatsNowImmediatelyAndForeverAndEverAmen: 'Export All Selected Filtered Current Page Reviews (CSV, Excel, PDF, All Formats, Now, Immediately, And Forever, And Ever, Amen)', allTypes: 'All Types', allRatings: 'All Ratings', allFlags: 'All Flags', allSources: 'All Sources', allModes: 'All Modes', allStatus: 'All Status', allWindows: 'All Windows', in72hrWindow: 'In 72hr Window', expiredWindow: 'Expired Window', fromDate: 'From date', toDate: 'To date', previous: 'Previous', next: 'Next', filterByType: 'Filter by type', filterByRating: 'Filter by rating', filterByFlagged: 'Filter by flagged', filterBySource: 'Filter by source', filterByReviewMode: 'Filter by review mode', filterByStatus: 'Filter by status', filterBy72hrWindow: 'Filter by 72hr window', searchReviews: 'Search reviews', flaggedBySystemOrUser: 'Flagged by system or user', duplicateOrSuspiciousReviewer: 'Duplicate or suspicious reviewer', suspiciousActivity: '⚠️ Suspicious Activity', autoModerated: 'Auto-moderated', manuallyReviewed: 'Manually reviewed', daysAfterReview: 'days after review', daysSinceClose: 'days since close', selectReview: 'Select review', viewDetailsForReview: 'View details for review', backendDeveloperNotes: 'Backend Developer Notes', endpointsNeeded: 'Endpoints Needed', listReviews: 'List reviews (with filters, search, pagination)', updateReviewStatusContentReplies: 'Update review status, content, replies', bulkApproveRejectDeleteReviews: 'Bulk approve/reject/delete reviews', addReplyToReview: 'Add reply to review', reviewDataFormat: 'Review Data Format', integrationNotes: 'Integration Notes', allReviewActions: 'All review actions', bulkActions: 'Bulk actions', showLoadingAndErrorStates: 'Show loading and error states', paginateReviewLists: 'Paginate review lists', validationAndSecurity: 'Validation & Security', onlyAdminsCanApproveRejectEditReviews: 'Only admins can approve/reject/edit reviews and add replies.', returnClearErrorMessagesForFailedActions: 'Return clear error messages for failed actions.', reviewManagement: 'Review Management', left: 'left', timeLeftForAdminReview: 'Time left for admin review', reasonForEdit: 'Reason for edit (optional)', delete: 'Delete', export: 'Export', unflagged: 'Unflagged'
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Admin reminder for expiring reviews
  useEffect(() => {
    const expiringSoon = reviews.some(r => r.status === 'pending' && r.reviewerType === 'vendor' && getHoursLeft(r.date) <= 6 && getHoursLeft(r.date) > 0);
    if (expiringSoon && showExpiringBanner) {
      toast({
        title: t.reminder,
        description: t.expiringReminder,
        variant: "default",
        duration: 8000
      });
    }
  }, [reviews, showExpiringBanner, toast]);

  const logAction = (id: number, action: string, reason?: string) => {
    setAdminLog(prev => [...prev, { id: Date.now(), reviewId: id, action, actor: 'Admin', timestamp: new Date().toLocaleString(), reason }]);
  };
  const updateStatus = (id: number, status: Status) => {
    setReviews(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    setViewing(v => v && v.id === id ? { ...v, status } : v);
    logAction(id, status, editReason);
    setEditingContent(false);
    setEditReason("");
    if (status === 'approved') {
      toast({ title: t.reviewApproved, description: `${t.reviewApproved} #${id}.`, variant: "default" });
    } else if (status === 'rejected') {
      toast({ title: t.reviewRejected, description: `${t.reviewRejected} #${id}.`, variant: 'destructive' });
    }
  };
  const toggleSelect = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const addReply = (review: Review) => {
    if (!replyInput.trim()) return;
    const newRep: Reply = { id: Date.now(), author: 'Admin', content: replyInput, timestamp: new Date().toLocaleString() };
    setReviews(prev => prev.map(r => r.id === review.id ? { ...r, replies: [...r.replies, newRep] } : r));
    setReplyInput("");
  };
  const saveReply = (reviewId: number) => {
    setReviews(prev => prev.map(r => r.id === reviewId ? {
      ...r,
      replies: r.replies.map(rep => rep.id === editingReply ? { ...rep, content: replyInput, timestamp: `${new Date().toLocaleString()} (edited)` } : rep)
    } : r));
    setEditingReply(null);
    setReplyInput("");
  };
  const deleteReply = (reviewId: number, repId: number) => {
    setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, replies: r.replies.filter(rep => rep.id !== repId) } : r));
  };

  const dupMap = useMemo(() => reviews.reduce<Record<string, number>>((acc, r) => { acc[r.content] = (acc[r.content] || 0) + 1; return acc; }, {}), [reviews]);
  const ipMap = useMemo(() => reviews.filter(r => r.rating === 5).reduce<Record<string, number>>((acc, r) => { acc[r.user] = (acc[r.user] || 0) + 1; return acc; }, {}), [reviews]);

  const filtered = useMemo(() => reviews.filter(r =>
    (search === '' || r.content.toLowerCase().includes(debounced) || r.vendor.toLowerCase().includes(debounced) || r.user.toLowerCase().includes(debounced)) &&
    (typeFilter === 'all' || r.type === typeFilter) &&
    (ratingFilter === 'all' || r.rating === ratingFilter) &&
    (flagFilter === 'all' || (flagFilter === 'flagged' ? r.flagged : !r.flagged)) &&
    (sourceFilter === 'all' || r.reviewerType === sourceFilter) &&
    (autoFilter === 'all' || (autoFilter === 'auto' ? r.auto : !r.auto)) &&
    (statusFilter === 'all' || r.status === statusFilter) &&
    (!fromDate || r.date >= fromDate) &&
    (!toDate   || r.date <= toDate) &&
    (window72hrFilter === 'all' ||
      (window72hrFilter === 'in72hr' && r.reviewerType === 'vendor' && r.status === 'pending' && getHoursLeft(r.date) > 0) ||
      (window72hrFilter === 'expired' && r.reviewerType === 'vendor' && r.status === 'pending' && getHoursLeft(r.date) === 0))
  ), [reviews, debounced, typeFilter, ratingFilter, flagFilter, sourceFilter, autoFilter, statusFilter, fromDate, toDate, window72hrFilter]);
  const pageCount = Math.ceil(filtered.length / REVIEWS_PER_PAGE);
  const pagedReviews = useMemo(() => filtered.slice((currentPage-1)*REVIEWS_PER_PAGE, currentPage*REVIEWS_PER_PAGE), [filtered, currentPage]);

  const FLAGGED_WORDS = ['scam', 'fraud', 'dangerous', 'abuse'];

  // Analytics calculations
  const pendingCount = reviews.filter(r => r.status === 'pending').length;
  const expiringSoonCount = reviews.filter(r => r.status === 'pending' && r.reviewerType === 'vendor' && getHoursLeft(r.date) <= 6 && getHoursLeft(r.date) > 0).length;
  const avgReviewTime = (function() {
    const times = reviews.filter(r => r.closedDate).map(r => (new Date(r.closedDate).getTime() - new Date(r.date).getTime()) / (1000*60*60));
    return times.length ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1) : '-';
  })();
  const vendorCounts = reviews.reduce((acc, r) => { acc[r.vendor] = (acc[r.vendor] || 0) + 1; return acc; }, {} as Record<string, number>);
  const userCounts = reviews.reduce((acc, r) => { acc[r.user] = (acc[r.user] || 0) + 1; return acc; }, {} as Record<string, number>);
  const mostActiveVendor = Object.entries(vendorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
  const mostActiveUser = Object.entries(userCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
  const flagRate = reviews.length ? Math.round((reviews.filter(r => r.flagged).length / reviews.length) * 100) : 0;
  // Export to CSV
  function exportToCSV() {
    const csv = [
      'ID,Vendor,User,ReviewerType,Rating,Type,Date,ClosedDate,Content,Flagged,Status',
      ...filtered.map(r => [r.id, r.vendor, r.user, r.reviewerType, r.rating, r.type, r.date, r.closedDate, '"'+r.content.replace(/"/g, '""')+'"', r.flagged, r.status].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'reviews_export.csv');
  }

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <h2 className="text-2xl font-bold mb-4">{t.reviewManagement}</h2>

        {/* KPI Banner */}
        <div className="flex flex-wrap gap-6 bg-blue-50 p-6 rounded-lg border border-blue-100 shadow-sm items-center mb-4">
          <div className="text-lg font-semibold"><span className="text-blue-700">{t.pending}:</span> {pendingCount}</div>
          <div className="text-lg font-semibold"><span className="text-blue-700">{t.expiringSoon}:</span> {expiringSoonCount}</div>
          <div className="text-lg font-semibold"><span className="text-blue-700">{t.avgReviewTime}:</span> {avgReviewTime}h</div>
          <div className="text-lg font-semibold"><span className="text-blue-700">{t.mostActiveVendor}:</span> {mostActiveVendor}</div>
          <div className="text-lg font-semibold"><span className="text-blue-700">{t.mostActiveUser}:</span> {mostActiveUser}</div>
          <div className="text-lg font-semibold"><span className="text-blue-700">{t.flagRate}:</span> {flagRate}%</div>
          <Button variant="outline" className="ml-auto" onClick={exportToCSV}>{t.exportCSV}</Button>
        </div>

        {/* Filters & Bulk */}
        <div className="flex items-center justify-between sticky top-0 z-20 bg-white py-2 mb-4 border-b">
          <div className="flex gap-2">
            <Button size="sm" variant={viewMode === 'grid' ? 'default' : 'outline'} onClick={() => setViewMode('grid')}>{t.grid}</Button>
            <Button size="sm" variant={viewMode === 'list' ? 'default' : 'outline'} onClick={() => setViewMode('list')}>{t.list}</Button>
          </div>
          <Input placeholder={t.search} className="max-w-xs" value={search} onChange={e => setSearch(e.target.value)} aria-label={t.searchReviews} />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label={t.filterByType} className="border rounded px-2 py-1 pr-6 text-sm">
            <option value="all">{t.allTypes}</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={ratingFilter} onChange={e => setRatingFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))} aria-label={t.filterByRating} className="border rounded px-2 py-1 pr-6 text-sm">
            <option value="all">{t.allRatings}</option>
            {RATINGS.map(r => <option key={r} value={r}>{r}★</option>)}
          </select>
          <select value={flagFilter} onChange={e => setFlagFilter(e.target.value)} aria-label={t.filterByFlagged} className="border rounded px-2 py-1 pr-6 text-sm">
            <option value="all">{t.allFlags}</option>
            <option value="flagged">{t.flagged}</option>
            <option value="unflagged">{t.unflagged}</option>
          </select>
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} aria-label={t.filterBySource} className="border rounded px-2 py-1 pr-6 text-sm">
            <option value="all">{t.allSources}</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={autoFilter} onChange={e => setAutoFilter(e.target.value)} aria-label={t.filterByReviewMode} className="border rounded px-2 py-1 pr-6 text-sm">
            <option value="all">{t.allModes}</option>
            <option value="auto">{t.auto}</option>
            <option value="manual">{t.manual}</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as Status)} aria-label={t.filterByStatus} className="border rounded px-2 py-1 pr-6 text-sm">
            <option value="all">{t.allStatus}</option>
            <option value="pending">{t.pending}</option>
            <option value="approved">{t.approved}</option>
            <option value="rejected">{t.rejected}</option>
          </select>
          <select value={window72hrFilter} onChange={e => setWindow72hrFilter(e.target.value)} aria-label={t.filterBy72hrWindow} className="border rounded px-2 py-1 pr-6 text-sm">
            <option value="all">{t.allWindows}</option>
            <option value="in72hr">{t.in72hrWindow}</option>
            <option value="expired">{t.expiredWindow}</option>
          </select>
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-36" aria-label={t.fromDate} />
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-36" aria-label={t.toDate} />
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 bg-gray-100 p-2 rounded ml-auto">
              <Button size="sm" onClick={() => selectedIds.forEach(id => updateStatus(id, 'approved'))}>{t.approve}</Button>
              <Button size="sm" onClick={() => selectedIds.forEach(id => updateStatus(id, 'rejected'))}>{t.reject}</Button>
              <Button size="sm" variant="destructive" onClick={() => {/* delete logic */}}>{t.delete}</Button>
              <Button size="sm" variant="outline" onClick={() => {/* export logic */}}>{t.export}</Button>
              <span className="text-xs text-gray-600">{t.selected} {selectedIds.length}</span>
            </div>
          )}
        </div>

        {/* Add role toggle at the top */}
        <div className="flex items-center gap-4 mb-2">
          <span className="font-semibold">{t.role}:</span>
          <Button size="sm" variant={role === 'admin' ? 'default' : 'outline'} onClick={() => setRole('admin')}>{t.admin}</Button>
          <Button size="sm" variant={role === 'viewer' ? 'default' : 'outline'} onClick={() => setRole('viewer')}>{t.viewer}</Button>
        </div>



        {/* Review Grid/List */}
        {viewMode === 'grid' ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pagedReviews.map(r => {
              // --- MOCKS & FALLBACKS ---
              const name = r.reviewerType === 'vendor' ? (r.vendor || 'Vendor Name') : (r.user || 'User Name');
              const role = r.reviewerType === 'vendor' ? t.vendor : t.user;
              const rating = r.rating || 5;
              const submittedDays = daysBetween(new Date(), new Date(r.date));
              const closedDays = r.closedDate ? daysBetween(new Date(r.date), new Date(r.closedDate)) : null;
              // Avatar fallback: initials in colored circle if no image
              const getInitials = (str: string) =>
                str
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
              const avatarImg = r.reviewerType === 'vendor' ? r.vendorImage : r.userImage;
              const avatar = avatarImg ? (
                <img src={avatarImg} alt={name + ' avatar'} className="w-14 h-14 rounded-full border object-cover bg-gray-100" />
              ) : (
                <div className="w-14 h-14 rounded-full flex items-center justify-center bg-blue-200 text-blue-800 font-bold text-xl border">
                  {getInitials(name)}
                </div>
              );
              // Media fallback
              let mediaContent;
              if (r.type === 'video') {
                if (r.mediaUrl) {
                  mediaContent = (
                    <video controls className="w-full rounded-lg border mb-2 bg-black" style={{ minHeight: 120 }}>
                      <source src={r.mediaUrl} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  );
                } else {
                  mediaContent = (
                    <div className="w-full h-[120px] flex items-center justify-center rounded-lg border mb-2 bg-gray-100 text-gray-400 text-3xl">
                      <span role="img" aria-label="No video">🎬</span>
                    </div>
                  );
                }
              } else {
                if (r.mediaUrl) {
                  mediaContent = (
                    <img src={r.mediaUrl} alt="media" className="w-full rounded-lg border mb-2 object-cover bg-gray-100" style={{ minHeight: 120 }} onError={e => { e.currentTarget.onerror=null; e.currentTarget.src='/reliance-logo.png'; }} />
                  );
                } else {
                  mediaContent = (
                    <img src="/reliance-logo.png" alt="No media" className="w-full rounded-lg border mb-2 object-cover bg-gray-100" style={{ minHeight: 120 }} />
                  );
                }
              }
              // --- BADGES ---
              const showCountdown = r.reviewerType === 'vendor' && r.status === 'pending';
              let hoursLeft = 0, countdownColor = '';
              if (showCountdown) {
                hoursLeft = getHoursLeft(r.date);
                if (hoursLeft > 24) countdownColor = 'bg-green-500';
                else if (hoursLeft > 6) countdownColor = 'bg-yellow-400';
                else countdownColor = 'bg-red-500';
              }
              // --- CARD ---
              return (
                <Card key={r.id} className="p-0 shadow-lg border rounded-xl overflow-hidden flex flex-col h-full">
                  {/* Header Row: Badges */}
                  <div className="flex items-center gap-2 px-4 pt-4 pb-2 border-b bg-gray-50">
                    <Badge variant={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'destructive' : r.status === 'pending' ? 'outline' : 'secondary'}>{r.status}</Badge>
                    {showCountdown && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-white ${countdownColor}`}>⏳ {hoursLeft}h left</span>
                    )}
                    <Badge variant={r.auto ? 'destructive' : 'secondary'}>{r.auto ? t.auto : t.manual}</Badge>
                    {r.flagged && <Badge variant="destructive">{t.flagged}</Badge>}
                    <div className="ml-auto flex items-center gap-2">
                      <Badge variant="outline">{rating}★</Badge>
                    </div>
                  </div>
                  {/* Card Header: Avatar, Name, Role */}
                  <div className="flex items-center gap-4 px-4 pt-4">
                    {avatar}
                    <div className="flex flex-col">
                      <span className="font-semibold text-lg leading-tight">{name}</span>
                      <span className="text-xs text-gray-500">{role}</span>
                    </div>
                  </div>
                  {/* Review Content (headline only, no repeat) */}
                  <div className="px-4 pt-2 pb-1">
                    <div className="font-bold text-lg mb-1">{r.content.length > 80 ? r.content.slice(0, 80) + '...' : r.content}</div>
                  </div>
                  {/* Dates */}
                  <div className="px-4 text-xs text-gray-500 flex gap-4 mb-2">
                    <span>Submitted {submittedDays} days ago</span>
                    {closedDays !== null && <span>Closed {closedDays} days ago</span>}
                  </div>
                  {/* Media */}
                  <div className="px-4 pb-2">
                    {mediaContent}
                  </div>
                  {/* Actions */}
                  <div className="flex gap-2 px-4 pb-4 mt-auto">
                    {role === 'admin' && r.status === 'pending' && (
                      <>
                        <Button size="sm" variant="default" onClick={() => updateStatus(r.id, 'approved')}>{t.approve}</Button>
                        <Button size="sm" variant="destructive" onClick={() => updateStatus(r.id, 'rejected')}>{t.reject}</Button>
                        <Button size="sm" variant="outline" onClick={() => logAction(r.id, 'flagged')}>{t.flag}</Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" className="ml-auto" onClick={() => { setViewing(r); setContentInput(r.content); }}>{t.details}</Button>
                  </div>
                  {/* Audit Log (only if actions) */}
                  {adminLog.filter(a => a.reviewId === r.id).length > 0 && (
                    <div className="px-4 pb-4 pt-2 border-t bg-gray-50">
                      <span className="text-xs text-gray-500 font-semibold">{t.auditLog}:</span>
                      <ul className="text-xs text-gray-600 space-y-1 max-h-12 overflow-y-auto">
                        {adminLog.filter(a => a.reviewId === r.id).slice(-3).reverse().map((a, i) => (
                          <li key={i}>• {a.timestamp}: {a.action}{a.reason ? ` (${a.reason})` : ''}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              );
            })}
          </ul>
        ) : (
          <ul className="divide-y divide-gray-200">
            {pagedReviews.map(r => {
              const isDup = dupMap[r.content] > 1;
              const isIPSpam = ipMap[r.user] > 1;
              // 72hr countdown logic
              const showCountdown = r.reviewerType === 'vendor' && r.status === 'pending';
              let hoursLeft = 0, percentLeft = 0, countdownColor = '';
              if (showCountdown) {
                hoursLeft = getHoursLeft(r.date);
                percentLeft = Math.max(0, Math.min(100, (hoursLeft / 72) * 100));
                if (hoursLeft > 24) countdownColor = 'bg-green-500';
                else if (hoursLeft > 6) countdownColor = 'bg-yellow-400';
                else countdownColor = 'bg-red-500';
              }
              return (
                <li key={r.id} className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-white rounded shadow mb-2">
                  <div className="flex justify-between mb-2 w-full sm:w-auto">
                    <div className="flex gap-1 items-center">
                      <SimpleTooltip content={r.status.charAt(0).toUpperCase() + r.status.slice(1)}>
                        <Badge variant={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'destructive' : r.status === 'pending' ? 'outline' : 'secondary'}>{r.status}</Badge>
                      </SimpleTooltip>
                      {r.flagged && <Badge variant="destructive" title={t.flaggedBySystemOrUser}>{t.flagged}</Badge>}
                      {/* Expired badge for vendor reviews */}
                      {r.reviewerType === 'vendor' && r.status === 'pending' && getHoursLeft(r.date) === 0 && (
                        <Badge variant="destructive">{t.expired}</Badge>
                      )}
                    </div>
                    <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleSelect(r.id)} aria-label={`${t.selectReview} ${r.id}`} />
                  </div>
                  {/* Quick Actions for pending reviews */}
                  {role === 'admin' && r.status === 'pending' && (
                    <div className="flex gap-2 mb-2 w-full sm:w-auto">
                      <Button size="sm" variant="default" onClick={() => updateStatus(r.id, 'approved')}>{t.approve}</Button>
                      <Button size="sm" variant="destructive" onClick={() => updateStatus(r.id, 'rejected')}>{t.reject}</Button>
                      <Button size="sm" variant="outline" onClick={() => logAction(r.id, 'flagged')}>{t.flag}</Button>
                    </div>
                  )}
                  {showCountdown && (
                    <div className="mb-2 w-full sm:w-auto">
                      <div className={`inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-semibold text-white ${countdownColor}`}
                           title={t.timeLeftForAdminReview}>
                        ⏳ {hoursLeft}h {t.left}
                      </div>
                      <div className="w-full h-1 bg-gray-200 rounded mt-1">
                        <div className={`${countdownColor}`} style={{ width: `${percentLeft}%`, height: '100%', borderRadius: 4 }}></div>
                      </div>
                      {hoursLeft === 0 && (
                        <div className="text-xs text-red-600 font-semibold mt-1">{t.reviewWindowExpired}</div>
                      )}
                    </div>
                  )}
                  { (isDup || isIPSpam) && <Badge variant="destructive" title={t.duplicateOrSuspiciousReviewer}>{t.suspiciousActivity}</Badge> }
                  {/* Vendor/User Info Popover */}
                  <div className="flex justify-center mb-2 w-full sm:w-auto">
                    <Popover>
                      <PopoverTrigger asChild>
                        <img src={r.reviewerType === 'vendor' ? r.vendorImage : r.userImage} alt={r.reviewerType === 'vendor' ? r.vendor : r.user} loading="lazy" className="w-12 h-12 rounded-full border cursor-pointer" />
                      </PopoverTrigger>
                      <PopoverContent className="w-56">
                        <div className="flex flex-col items-center gap-2">
                          <img src={r.reviewerType === 'vendor' ? r.vendorImage : r.userImage} alt="avatar" className="w-14 h-14 rounded-full border" />
                          <div className="font-semibold text-center">{r.reviewerType === 'vendor' ? r.vendor : r.user}</div>
                          <div className="text-xs text-gray-500">{r.reviewerType === 'vendor' ? t.vendor : t.user}</div>
                          <div className="text-xs text-gray-600 mt-2">{t.rating}: {r.rating}★</div>
                          <div className="text-xs text-gray-600">{t.type}: {r.type}</div>
                          <div className="text-xs text-gray-600">{t.status}: {r.status}</div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex justify-between items-center mb-2 w-full sm:w-auto">
                    <SimpleTooltip content={r.auto ? t.autoModerated : t.manuallyReviewed}>
                      <Badge variant={r.auto ? 'destructive' : 'secondary'}>{r.auto ? t.auto : t.manual}</Badge>
                    </SimpleTooltip>
                    <Badge variant="outline">{r.rating}★</Badge>
                  </div>
                  <div className="flex gap-2 text-xs text-gray-500 mb-2 w-full sm:w-auto">
                    <span>{daysBetween(new Date(), new Date(r.date))} {t.daysAfterReview}</span>
                    <span>{daysBetween(new Date(r.date), new Date(r.closedDate))} {t.daysSinceClose}</span>
                  </div>
                  <CardHeader className="py-1 w-full sm:w-auto"><CardTitle>{r.content.length > 50 ? r.content.slice(0, 50) + '...' : r.content}</CardTitle></CardHeader>
                  <CardContent className="w-full sm:w-auto">
                    {/* Rich content display with flagged word highlighting */}
                    <div className="text-sm text-gray-700 mb-2">
                      {editingContent && viewing && viewing.id === r.id ? (
                        <>
                          <textarea className="w-full border rounded p-2 mb-2" rows={3} value={contentInput} onChange={e => setContentInput(e.target.value)} />
                          <Button size="sm" variant="default" className="mr-2" onClick={() => { updateStatus(r.id, r.status); logAction(r.id, 'edited', editReason); setEditingContent(false); }}>{t.save}</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingContent(false)}>{t.cancel}</Button>
                          <Input placeholder={t.reasonForEdit} value={editReason} onChange={e => setEditReason(e.target.value)} className="mt-2" />
                        </>
                      ) : (
                        <span>
                          {r.content.split(/(\s+)/).map((word, i) =>
                            FLAGGED_WORDS.includes(word.toLowerCase().replace(/[^a-z]/gi, '')) ? (
                              <span key={i} className="bg-yellow-200 text-red-700 font-bold px-1 rounded" title={t.flaggedWord}>{word}</span>
                            ) : word
                          )}
                        </span>
                      )}
                      {/* Inline edit button for admins */}
                      {role === 'admin' && (
                        <Button size="sm" variant="outline" className="ml-2" onClick={() => { setViewing(r); setContentInput(r.content); setEditingContent(true); }}>{t.edit}</Button>
                      )}
                    </div>
                    {/* Show image or video if present */}
                    {r.type === 'video' ? (
                      <video controls className="w-full rounded mb-2" preload="metadata"><source src={r.mediaUrl} type="video/mp4" /></video>
                    ) : (
                      <img src={r.mediaUrl} alt="media" className="w-full rounded mb-2" loading="lazy" />
                    )}
                    <p className="text-sm text-gray-600 truncate flex items-center gap-2 w-full sm:w-auto">
                      <Popover>
                        <PopoverTrigger asChild>
                          <span className="font-medium cursor-pointer hover:underline">{r.reviewerType === 'vendor' ? r.vendor : r.user}</span>
                        </PopoverTrigger>
                        <PopoverContent className="w-56">
                          <div className="font-semibold text-center">{r.reviewerType === 'vendor' ? r.vendor : r.user}</div>
                          <div className="text-xs text-gray-500">{r.reviewerType === 'vendor' ? t.vendor : t.user}</div>
                          <div className="text-xs text-gray-600 mt-2">{t.rating}: {r.rating}★</div>
                          <div className="text-xs text-gray-600">{t.type}: {r.type}</div>
                          <div className="text-xs text-gray-600">{t.status}: {r.status}</div>
                        </PopoverContent>
                      </Popover>
                      {/* Quick link to job/service details (dummy link) */}
                      <Button size="sm" variant="outline" className="ml-2" onClick={() => alert('Job/Service details coming soon!')}>{t.viewJob}</Button>
                    </p>
                    <Button size="sm" className="mt-2 focus:outline-none focus:ring" onClick={() => { setViewing(r); setContentInput(r.content); }} aria-label={`${t.viewDetailsForReview} ${r.id}`}>{t.details}</Button>
                  </CardContent>
                  {/* Mini Audit Log */}
                  <div className="mt-2 w-full sm:w-auto">
                    <span className="text-xs text-gray-500 font-semibold">{t.auditLog}:</span>
                    <ul className="text-xs text-gray-600 space-y-1 max-h-12 overflow-y-auto">
                      {adminLog.filter(a => a.reviewId === r.id).slice(-3).reverse().map((a, i) => (
                        <li key={i}>• {a.timestamp}: {a.action}{a.reason ? ` (${a.reason})` : ''}</li>
                      ))}
                      {adminLog.filter(a => a.reviewId === r.id).length === 0 && <li>{t.noActions}</li>}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {/* Pagination Controls */}
        {pageCount > 1 && (
          <div className="flex justify-center mt-6 gap-2">
            <Button size="sm" variant="outline" disabled={currentPage===1} onClick={()=>setCurrentPage(currentPage-1)}>{t.previous}</Button>
            <span className="px-3 py-1 rounded bg-gray-100 border text-sm">{t.page} {currentPage} {t.of} {pageCount}</span>
            <Button size="sm" variant="outline" disabled={currentPage===pageCount} onClick={()=>setCurrentPage(currentPage+1)}>{t.next}</Button>
          </div>
        )}

        {/* Detail Modal */}
        {viewing && (
          <Dialog open onOpenChange={() => setViewing(null)}>
            <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto space-y-4">
              <DialogTitle>{t.review} #{viewing.id} {t.details}</DialogTitle>
              <div className="flex gap-2 text-xs">
                <Badge>{viewing.rating}★</Badge>
                <Badge variant="outline">{viewing.type}</Badge>
                {viewing.flagged && <Badge variant="destructive" title={t.flaggedBySystemOrUser}>{t.flagged}</Badge>}
                {viewing.auto && <Badge variant="secondary">{t.auto}</Badge>}
              </div>
              {viewing.type === 'video'
                ? <video controls className="w-full" preload="metadata"><source src={viewing.mediaUrl} type="video/mp4" /></video>
                : <img src={viewing.mediaUrl} alt="media" className="w-full rounded" loading="lazy" />
              }
              <div className="mt-2 text-sm">
                <strong>{t.content}:</strong> {!editingContent
                  ? (<p>{viewing.content}</p>)
                  : (<textarea className="w-full border rounded p-2" rows={3} value={contentInput} onChange={e => setContentInput(e.target.value)} />)}
              </div>
              {editingContent && <Input placeholder={t.reasonForEdit} value={editReason} onChange={e => setEditReason(e.target.value)} />}
            </DialogContent>
          </Dialog>
        )}

        {/* Backend Developer Notes */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">{t.backendDeveloperNotes}</h3>
          <div className="text-sm text-blue-700 space-y-2">
            <p><strong>{t.endpointsNeeded}:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><code>GET /api/reviews</code> – {t.listReviews}</li>
              <li><code>PATCH /api/reviews/:id</code> – {t.updateReviewStatusContentReplies}</li>
              <li><code>POST /api/reviews/bulk-action</code> – {t.bulkApproveRejectDeleteReviews}</li>
              <li><code>POST /api/reviews/:id/reply</code> – {t.addReplyToReview}</li>
            </ul>
            <p><strong>{t.reviewDataFormat}:</strong></p>
            <pre className="bg-gray-100 p-2 rounded text-xs mt-2 overflow-x-auto">{`
{
  id: number,
  vendor: string,
  vendorImage: string,
  user: string,
  reviewerType: 'user' | 'vendor',
  userImage: string,
  rating: number,
  type: 'video' | 'photo',
  date: string,
  closedDate: string,
  content: string,
  mediaUrl: string,
  flagged: boolean,
  auto: boolean,
  status: 'pending' | 'approved' | 'rejected',
  replies: Reply[]
}
`}</pre>
            <p><strong>{t.integrationNotes}:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>{t.allReviewActions} (aprobar, rechazar, editar, responder) deberían llamar al endpoint correspondiente y actualizar la UI en caso de éxito.</li>
              <li>{t.bulkActions} deberían aceptar un array de IDs de revisión y un tipo de acción.</li>
              <li>{t.showLoadingAndErrorStates} para todas las acciones asíncronas.</li>
              <li>{t.paginateReviewLists} en el backend para conjuntos de datos grandes.</li>
            </ul>
            <p className="mt-2"><strong>{t.validationAndSecurity}:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>{t.onlyAdminsCanApproveRejectEditReviews}</li>
              <li>Todos los endpoints deberían validar los permisos del usuario y los datos de entrada.</li>
              <li>{t.returnClearErrorMessagesForFailedActions}</li>
            </ul>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
} 
