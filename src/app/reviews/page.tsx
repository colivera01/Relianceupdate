"use client";

import { TooltipProvider } from "../../../components/ui/tooltip";
import SimpleTooltip from "../../../components/ui/tooltip";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem
} from "../../../components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle
} from "../../../components/ui/dialog";
import { Badge } from "../../../components/ui/badge";
import { useState, useEffect } from "react";
import { Fragment } from "react";

// Helper to get time left in ms
function getTimeLeft(expiresAt: Date) {
  return expiresAt.getTime() - Date.now();
}

// Helper to format ms as 'Xh Ym left'
function formatCountdown(ms: number) {
  if (ms <= 0) return "Expired";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m left`;
}

// Helper to get progress (0-100)
function getProgress(expiresAt: Date, createdAt: Date) {
  const total = expiresAt.getTime() - createdAt.getTime();
  const left = expiresAt.getTime() - Date.now();
  return Math.max(0, Math.min(100, Math.round((left / total) * 100)));
}

const now = Date.now();
const oneDay = 24 * 60 * 60 * 1000;
const mockReviews = [
  {
    id: 1,
    type: "vendor",
    media: [
      { url: "https://www.w3schools.com/html/mov_bbb.mp4", type: "video" },
      { url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80", type: "image" },
      { url: "https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=400&q=80", type: "image" }
    ],
    vendorName: "Sparkle Cleaners",
    jobId: "J-1001",
    userType: "business",
    source: "manual",
    flagged: false,
    public: true,
    adminNote: "",
    reviewer: "Vendor Rep",
    status: "Pending",
    rating: 4,
    summary: "Uploaded service completion video.",
    details: "Vendor submitted a video of the completed cleaning service.",
    createdAt: new Date(now - oneDay),
    expiresAt: new Date(now + 12 * 60 * 60 * 1000),
    submittedAt: new Date(now - 2 * 60 * 60 * 1000),
    auditTrail: [
      { action: "Created", by: "system", at: new Date(now - oneDay) },
      { action: "Note added: 'Check video quality'", by: "admin1", at: new Date(now - 6 * 60 * 60 * 1000) },
      { action: "Flagged", by: "admin2", at: new Date(now - 2 * 60 * 60 * 1000) },
    ],
  },
  {
    id: 2,
    type: "user",
    media: [],
    vendorName: "Sparkle Cleaners",
    jobId: "J-1001",
    userType: "customer",
    source: "auto",
    flagged: true,
    public: false,
    adminNote: "Possible spam, review needed.",
    reviewer: "Jane Smith",
    status: "Approved",
    rating: 5,
    summary: "Great job!",
    details: "Auto-generated 5-star review after 72 hours.",
    createdAt: new Date(now - 2 * oneDay),
    expiresAt: new Date(now - oneDay),
    submittedAt: new Date(now - oneDay),
    auditTrail: [
      { action: "Created (auto-generated)", by: "system", at: new Date(now - 2 * oneDay) },
      { action: "Flagged", by: "admin2", at: new Date(now - 1 * 60 * 60 * 1000) },
      { action: "Note added: 'Possible spam'", by: "admin1", at: new Date(now - 30 * 60 * 1000) },
    ],
  },
  {
    id: 3,
    type: "user",
    media: [],
    vendorName: "QuickFix Plumbing",
    jobId: "J-1002",
    userType: "customer",
    source: "manual",
    flagged: false,
    public: true,
    adminNote: "",
    reviewer: "Bob Lee",
    status: "Pending",
    rating: 2,
    summary: "Not satisfied.",
    details: "Plumber was late and did not clean up.",
    createdAt: new Date(now - 2 * oneDay),
    expiresAt: new Date(now + 2 * 60 * 60 * 1000),
    submittedAt: new Date(now - 3 * 60 * 60 * 1000),
    auditTrail: [
      { action: "Created", by: "system", at: new Date(now - 2 * oneDay) },
    ],
  },
];

// Analytics/Trends mock calculations
const totalReviews = mockReviews.length;
const flaggedReviews = mockReviews.filter(r => r.flagged).length;
const avgRating = (mockReviews.reduce((sum, r) => sum + r.rating, 0) / mockReviews.length).toFixed(2);
const vendorCounts = mockReviews.reduce((acc, r) => {
  acc[r.vendorName] = (acc[r.vendorName] || 0) + 1;
  return acc;
}, {} as Record<string, number>);
const mostActiveVendor = Object.entries(vendorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

function GoldStars({ rating }: { rating: number }) {
  return (
    <span className="text-yellow-400">
      {"★".repeat(rating)}
      <span className="text-gray-300">{"☆".repeat(5 - rating)}</span>
    </span>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full h-2 bg-gray-200 rounded mt-2 mb-2">
      <div
        className="h-2 rounded bg-yellow-400 transition-all"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export default function ReviewManagementPage() {
  const [adminNotes, setAdminNotes] = useState<{ [id: number]: string }>({});
  const [selected, setSelected] = useState<number[]>([]);
  const [expanded, setExpanded] = useState<{ [id: number]: boolean }>({});
  const [lightbox, setLightbox] = useState<{ open: boolean; media: { url: string; type: string }[]; index: number } | null>(null);
  const [noteSaved, setNoteSaved] = useState<{ [id: number]: boolean }>({});
  const [auditTrailState, setAuditTrailState] = useState<{ [id: number]: any[] }>({});
  const [toast, setToast] = useState<{ message: string; undo: (() => void) | null } | null>(null);
  const [importModal, setImportModal] = useState(false);
  const [confirm, setConfirm] = useState<{ open: boolean; action: null | (() => void); message: string }>({ open: false, action: null, message: "" });
  const [page, setPage] = useState(1);
  const pageSize = 2;
  const totalPages = Math.ceil(mockReviews.length / pageSize);

  // Get unique vendor names for filter
  const vendorNames = Array.from(new Set(mockReviews.map(r => r.vendorName)));
  const [filters, setFilters] = useState({
    vendor: 'all',
    flagged: 'all',
    public: 'all',
    source: 'all',
    sort: 'recent',
    search: '',
  });

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleNoteChange = (id: number, note: string) => {
    setAdminNotes((prev) => ({ ...prev, [id]: note }));
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    setSelected(mockReviews.map(r => r.id));
  };
  const deselectAll = () => {
    setSelected([]);
  };

  // Batch action handlers (mocked)
  const batchFlag = () => {
    setToast({
      message: `Flagged reviews: ${selected.join(", ")}`,
      undo: () => setToast({ message: "Undo not implemented (mock)", undo: null })
    });
  };
  const batchRemove = () => {
    setConfirm({
      open: true,
      action: () => setToast({ message: `Removed reviews: ${selected.join(", ")}`, undo: () => setToast({ message: "Undo not implemented (mock)", undo: null }) }),
      message: `Are you sure you want to remove ${selected.length} review(s)?`
    });
  };
  const batchTogglePublic = () => {
    setConfirm({
      open: true,
      action: () => setToast({ message: `Toggled public/private for: ${selected.join(", ")}`, undo: () => setToast({ message: "Undo not implemented (mock)", undo: null }) }),
      message: `Are you sure you want to toggle public/private for ${selected.length} review(s)?`
    });
  };

  const handleSaveNote = (id: number) => {
    setNoteSaved((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => setNoteSaved((prev) => ({ ...prev, [id]: false })), 1500);
    alert('Admin note saved!'); // Replace with toast/snackbar in production
  };

  const handleEscalate = (id: number) => {
    const nowDate = new Date();
    setAuditTrailState(prev => ({
      ...prev,
      [id]: [
        ...(prev[id] || mockReviews.find(r => r.id === id)?.auditTrail || []),
        { action: 'Escalated to Quality Team', by: 'admin1', at: nowDate }
      ]
    }));
    alert('Review escalated to Quality Team!');
  };

  return (
    <TooltipProvider>
      <div className="p-8 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Review Management</h1>
        {/* Batch Action Bar */}
        <div className="flex items-center gap-4 mb-4">
          <input
            type="checkbox"
            checked={selected.length === mockReviews.length}
            onChange={e => e.target.checked ? selectAll() : deselectAll()}
            className="mr-2"
          />
          <span className="text-sm">Select All</span>
          {selected.length > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={batchFlag}>Flag</Button>
              <Button size="sm" variant="destructive" onClick={batchRemove}>Remove</Button>
              <Button size="sm" variant="outline" onClick={batchTogglePublic}>Toggle Public/Private</Button>
              <span className="text-xs text-gray-500 ml-2">{selected.length} selected</span>
            </>
          )}
        </div>
        {/* Advanced Filter Bar */}
        <div className="flex flex-wrap gap-4 mb-8 items-end">
          <div className="flex flex-col w-48">
            <label className="mb-1 text-sm font-medium">Search</label>
            <Input
              placeholder="Search reviews..."
              value={filters.search || ""}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            />
          </div>
          <div className="flex flex-col w-48">
            <label className="mb-1 text-sm font-medium">Status</label>
            <Select defaultValue="all">
              <SelectTrigger>All</SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col w-48">
            <label className="mb-1 text-sm font-medium">Rating</label>
            <Select defaultValue="all">
              <SelectTrigger>All</SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="5">5 Stars</SelectItem>
                <SelectItem value="4">4 Stars</SelectItem>
                <SelectItem value="3">3 Stars</SelectItem>
                <SelectItem value="2">2 Stars</SelectItem>
                <SelectItem value="1">1 Star</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Vendor Filter */}
          <div className="flex flex-col w-48">
            <label className="mb-1 text-sm font-medium">Vendor</label>
            <Select value={filters.vendor} onValueChange={v => setFilters(f => ({ ...f, vendor: v }))}>
              <SelectTrigger>{filters.vendor === 'all' ? 'All' : filters.vendor}</SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {vendorNames.map(vendor => (
                  <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Flagged/Public Filter */}
          <div className="flex flex-col w-40">
            <label className="mb-1 text-sm font-medium">Flagged</label>
            <Select value={filters.flagged} onValueChange={v => setFilters(f => ({ ...f, flagged: v }))}>
              <SelectTrigger>{filters.flagged === 'all' ? 'All' : filters.flagged === 'true' ? 'Flagged' : 'Not Flagged'}</SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Flagged</SelectItem>
                <SelectItem value="false">Not Flagged</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col w-40">
            <label className="mb-1 text-sm font-medium">Public</label>
            <Select value={filters.public} onValueChange={v => setFilters(f => ({ ...f, public: v }))}>
              <SelectTrigger>{filters.public === 'all' ? 'All' : filters.public === 'true' ? 'Public' : 'Private'}</SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Public</SelectItem>
                <SelectItem value="false">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Source Filter */}
          <div className="flex flex-col w-40">
            <label className="mb-1 text-sm font-medium">Source</label>
            <Select value={filters.source} onValueChange={v => setFilters(f => ({ ...f, source: v }))}>
              <SelectTrigger>{filters.source === 'all' ? 'All' : filters.source === 'auto' ? 'Auto-Generated' : 'Manual'}</SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="auto">Auto-Generated</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Sort Dropdown */}
          <div className="flex flex-col w-40">
            <label className="mb-1 text-sm font-medium">Sort By</label>
            <Select value={filters.sort} onValueChange={v => setFilters(f => ({ ...f, sort: v }))}>
              <SelectTrigger>
                {filters.sort === 'recent' ? 'Most Recent' : filters.sort === 'lowest' ? 'Lowest Rating' : 'Most Flagged'}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="lowest">Lowest Rating</SelectItem>
                <SelectItem value="flagged">Most Flagged</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Date Range Picker Placeholder */}
          <div className="flex flex-col w-48">
            <label className="mb-1 text-sm font-medium">Date Range</label>
            <Input placeholder="Date range (coming soon)" disabled />
          </div>
        </div>
        {/* Analytics/Trends Banner */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded p-4 text-center">
            <div className="text-xs text-blue-700">Total Reviews</div>
            <div className="text-2xl font-bold">{totalReviews}</div>
          </div>
          <div className="bg-yellow-50 rounded p-4 text-center">
            <div className="text-xs text-yellow-700">Flagged Reviews</div>
            <div className="text-2xl font-bold">{flaggedReviews}</div>
          </div>
          <div className="bg-green-50 rounded p-4 text-center">
            <div className="text-xs text-green-700">Average Rating</div>
            <div className="text-2xl font-bold">{avgRating}</div>
          </div>
          <div className="bg-purple-50 rounded p-4 text-center">
            <div className="text-xs text-purple-700">Most Active Vendor</div>
            <div className="text-lg font-bold">{mostActiveVendor}</div>
          </div>
        </div>
        {/* Toast/Snackbar */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded shadow-lg flex items-center gap-4 z-50">
            <span>{toast.message}</span>
            {toast.undo && (
              <button className="underline text-blue-300" onClick={toast.undo} tabIndex={0}>Undo</button>
            )}
          </div>
        )}
        {/* Bulk Import Button and Modal */}
        <div className="flex justify-end mb-4">
          <Button size="sm" variant="outline" onClick={() => setImportModal(true)}>
            Bulk Import Reviews
          </Button>
        </div>
        {importModal && (
          <Dialog open={importModal} onOpenChange={setImportModal}>
            <DialogContent>
              <DialogTitle>Bulk Import Reviews</DialogTitle>
              <input type="file" className="mb-4" />
              <Button onClick={() => setImportModal(false)}>Close</Button>
            </DialogContent>
          </Dialog>
        )}
        {/* Confirmation Dialog */}
        {confirm.open && (
          <Dialog open={confirm.open} onOpenChange={open => setConfirm(c => ({ ...c, open }))}>
            <DialogContent>
              <DialogTitle>Confirm Action</DialogTitle>
              <div className="mb-4">{confirm.message}</div>
              <div className="flex gap-2">
                <Button onClick={() => { confirm.action && confirm.action(); setConfirm(c => ({ ...c, open: false })); }}>Yes</Button>
                <Button variant="outline" onClick={() => setConfirm(c => ({ ...c, open: false }))}>Cancel</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {/* Review Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {mockReviews
            .filter(review => {
              const q = (filters.search || "").toLowerCase();
              return (
                !q ||
                review.summary.toLowerCase().includes(q) ||
                review.reviewer.toLowerCase().includes(q) ||
                (adminNotes[review.id] ?? review.adminNote).toLowerCase().includes(q)
              );
            })
            .slice((page - 1) * pageSize, page * pageSize)
            .map((review) => {
              const timeLeft = getTimeLeft(review.expiresAt);
              const isExpiring = review.status === "Pending" && timeLeft > 0 && timeLeft < 48 * 60 * 60 * 1000;
              const progress = getProgress(review.expiresAt, review.createdAt);
              const hasMedia = review.media && review.media.length > 0;
              return (
                <Dialog key={review.id}>
                  <div
                    className={`bg-white rounded-lg shadow p-4 flex flex-col h-full relative border ${review.flagged ? "border-red-400 bg-red-50" : "border-transparent"} ${hasMedia ? 'cursor-pointer hover:bg-gray-50 transition' : ''}`}
                    onClick={hasMedia ? () => setLightbox({ open: true, media: review.media, index: 0 }) : undefined}
                  >
                    {/* Checkbox for batch selection - move to top left */}
                    <div className="absolute top-3 left-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(review.id)}
                        onChange={() => toggleSelect(review.id)}
                        className="w-4 h-4 accent-blue-500"
                      />
                    </div>
                    {/* Top Row: Type, Source, Flagged, Public */}
                    <div className="flex items-center gap-2 mb-2 ml-8">
                      <Badge className={review.type === "vendor" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}>
                        {review.type === "vendor" ? "Vendor" : "User"}
                      </Badge>
                      <Badge className={review.source === "auto" ? "bg-gray-200 text-gray-700" : "bg-purple-100 text-purple-800"}>
                        {review.source === "auto" ? "Auto-Generated" : "Manual"}
                      </Badge>
                      {review.flagged && <Badge className="bg-red-500 text-white">Flagged</Badge>}
                      <Badge className={review.public ? "bg-green-200 text-green-800" : "bg-gray-300 text-gray-700"}>
                        {review.public ? "Public" : "Private"}
                      </Badge>
                    </div>
                    {/* Media Preview for Vendor or Text Review for User */}
                    {hasMedia ? (
                      <div className="mb-2 flex flex-col gap-2">
                        <div className="flex gap-2">
                          {review.media.map((media, idx) => (
                            <div key={idx} className="relative group" style={{ width: 64, height: 48 }}>
                              {media.type === "video" ? (
                                <video
                                  src={media.url}
                                  className="object-cover rounded w-16 h-12 border border-gray-200"
                                  muted
                                  preload="metadata"
                                />
                              ) : (
                                <img
                                  src={media.url}
                                  alt="Media"
                                  className="object-cover rounded w-16 h-12 border border-gray-200"
                                />
                              )}
                              <span className="absolute inset-0 bg-black bg-opacity-10 opacity-0 group-hover:opacity-100 rounded transition" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mb-2 text-xs text-gray-400 italic">Text Review</div>
                    )}
                    {/* Metadata */}
                    <div className="text-xs text-gray-500 mb-1">
                      Vendor: <a href="#" className="font-medium text-blue-700 underline hover:text-blue-900" tabIndex={0}>{review.vendorName}</a> |
                      Job ID: <a href="#" className="font-mono text-blue-700 underline hover:text-blue-900" tabIndex={0}>{review.jobId}</a> |
                      User Type: {review.userType}
                    </div>
                    <div className="text-xs text-gray-500 mb-2">Submitted: {review.submittedAt.toLocaleString()}</div>
                    {/* Reviewer, Status, Rating, Expiry */}
                    <div className="font-semibold mb-1 flex items-center gap-2">
                      <a href="#" className="text-black underline hover:text-blue-700" tabIndex={0}>{review.reviewer}</a>
                      {isExpiring && (
                        <Badge className="bg-yellow-400 text-yellow-900 animate-pulse">Expiring soon!</Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mb-2">Status: {review.status}</div>
                    <div className="mb-2 flex items-center gap-2">
                      Rating:
                      <SimpleTooltip content={`${review.rating} out of 5 stars`}>
                        <span><GoldStars rating={review.rating} /></span>
                      </SimpleTooltip>
                    </div>
                    {isExpiring && (
                      <>
                        <ProgressBar percent={progress} />
                        <div className="text-xs text-yellow-700 font-medium mb-2">
                          <SimpleTooltip content="Time left to review">
                            <span>{formatCountdown(timeLeft)}</span>
                          </SimpleTooltip>
                        </div>
                      </>
                    )}
                    {/* Review Text (truncated) */}
                    <div className="text-gray-700 flex-1 mb-2">
                      {review.source === "auto" ? (
                        <span className="italic text-gray-500">Auto-generated 5-star review. No user comment.</span>
                      ) : review.summary.length > 60 && !expanded[review.id] ? (
                        <>
                          {review.summary.slice(0, 60)}...
                          <button className="ml-2 text-xs text-blue-600 underline" onClick={e => { e.stopPropagation(); setExpanded(ex => ({ ...ex, [review.id]: true })); }}>
                            Read more
                          </button>
                        </>
                      ) : review.summary.length > 60 && expanded[review.id] ? (
                        <>
                          {review.summary}
                          <button className="ml-2 text-xs text-blue-600 underline" onClick={e => { e.stopPropagation(); setExpanded(ex => ({ ...ex, [review.id]: false })); }}>
                            Show less
                          </button>
                        </>
                      ) : (
                        review.summary
                      )}
                    </div>
                    {/* Admin Controls */}
                    <div className="flex gap-2 mb-2">
                      <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setToast({ message: `${review.flagged ? "Unflagged" : "Flagged"} review ${review.id}`, undo: () => setToast({ message: "Undo not implemented (mock)", undo: null }) }); }}>{review.flagged ? "Unflag" : "Flag"}</Button>
                      <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setConfirm({ open: true, action: () => setToast({ message: `${review.public ? "Made Private" : "Made Public"} review ${review.id}`, undo: () => setToast({ message: "Undo not implemented (mock)", undo: null }) }), message: `Are you sure you want to ${review.public ? "make private" : "make public"} this review?` }); }}>{review.public ? "Make Private" : "Make Public"}</Button>
                      <Button size="sm" variant="destructive" onClick={e => { e.stopPropagation(); setConfirm({ open: true, action: () => setToast({ message: `Removed review ${review.id}`, undo: () => setToast({ message: "Undo not implemented (mock)", undo: null }) }), message: "Are you sure you want to remove this review?" }); }}>Remove</Button>
                    </div>
                    {/* Admin Note */}
                    <div className="mb-2">
                      <label className="block text-xs font-medium mb-1">Admin Note</label>
                      <div className="flex gap-2 items-center">
                        <Input
                          value={adminNotes[review.id] ?? review.adminNote}
                          onChange={e => handleNoteChange(review.id, e.target.value)}
                          placeholder="Add note..."
                          className="text-xs"
                        />
                        <Button size="sm" onClick={() => handleSaveNote(review.id)}>
                          Save Note
                        </Button>
                      </div>
                      {noteSaved[review.id] && (
                        <span className="text-green-600 text-xs ml-2">Saved!</span>
                      )}
                    </div>
                    {/* Audit Trail */}
                    <div className="mb-2">
                      <div className="font-semibold mb-1">Audit Trail</div>
                      <ul className="text-xs text-gray-600 space-y-1">
                        {(auditTrailState[review.id] || review.auditTrail).map((entry, idx) => (
                          <li key={idx}>
                            <span className="font-medium">{entry.action}</span> by <span className="text-blue-700">{entry.by}</span> on {entry.at.toLocaleString()}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mb-4">
                      <Button size="sm" variant="outline" onClick={() => handleEscalate(review.id)}>
                        Escalate to Quality Team
                      </Button>
                    </div>
                    {/* Details Modal Trigger */}
                    <DialogTrigger asChild>
                      <Button className="mt-2 w-full">Review Details</Button>
                    </DialogTrigger>
                    {/* Details Modal */}
                    <DialogContent className="max-h-[80vh] overflow-y-auto">
                      <DialogTitle>Review Details</DialogTitle>
                      <div className="mb-2 font-semibold">Reviewer: {review.reviewer}</div>
                      <div className="mb-2">Status: {review.status}</div>
                      <div className="mb-2 flex items-center gap-2">
                        Rating:
                        <SimpleTooltip content={`${review.rating} out of 5 stars`}>
                          <span><GoldStars rating={review.rating} /></span>
                        </SimpleTooltip>
                      </div>
                      {isExpiring && (
                        <>
                          <ProgressBar percent={progress} />
                          <div className="text-xs text-yellow-700 font-medium mb-2">
                            <SimpleTooltip content="Time left to review">
                              <span>{formatCountdown(timeLeft)}</span>
                            </SimpleTooltip>
                          </div>
                        </>
                      )}
                      <div className="mb-2">Summary: {review.summary}</div>
                      <div className="mb-2">Details: {review.details}</div>
                      <div className="mb-2">Vendor: {review.vendorName}</div>
                      <div className="mb-2">Job ID: {review.jobId}</div>
                      <div className="mb-2">User Type: {review.userType}</div>
                      <div className="mb-2">Source: {review.source}</div>
                      <div className="mb-2">Flagged: {review.flagged ? "Yes" : "No"}</div>
                      <div className="mb-2">Public: {review.public ? "Yes" : "No"}</div>
                      <div className="mb-2">Admin Note: {adminNotes[review.id] ?? review.adminNote}</div>
                      {review.type === "vendor" && review.media.length > 0 && (
                        <div className="mb-2">
                          <div className="font-semibold mb-1">Vendor Media</div>
                          {review.media[0].type === "video" ? (
                            <video src={review.media[0].url} controls className="w-full h-48 object-cover rounded" />
                          ) : (
                            <img src={review.media[0].url} alt="Vendor media" className="w-full h-48 object-cover rounded" />
                          )}
                        </div>
                      )}
                      <div className="mb-4">
                        <Button size="sm" variant="outline" onClick={() => setToast({ message: "Notification sent (mock)", undo: null })}>
                          Send Notification
                        </Button>
                      </div>
                    </DialogContent>
                  </div>
                </Dialog>
              );
            })}
        </div>
        {/* Media Lightbox Modal (gallery) */}
        {lightbox?.open && (
          <Dialog open={lightbox.open} onOpenChange={open => setLightbox(open ? lightbox : null)}>
            <DialogContent className="flex flex-col items-center max-h-[90vh]">
              <div className="flex gap-2 mb-4">
                {lightbox.media.map((media, idx) => (
                  <div
                    key={idx}
                    className={`border rounded cursor-pointer ${idx === lightbox.index ? 'border-blue-500' : 'border-gray-200'}`}
                    style={{ width: 64, height: 48 }}
                    onClick={() => setLightbox(l => l && { ...l, index: idx })}
                  >
                    {media.type === "video" ? (
                      <video src={media.url} className="object-cover w-16 h-12 rounded" muted preload="metadata" />
                    ) : (
                      <img src={media.url} alt="Media" className="object-cover w-16 h-12 rounded" />
                    )}
                  </div>
                ))}
              </div>
              <div className="w-full flex justify-center">
                {lightbox.media[lightbox.index].type === "video" ? (
                  <video src={lightbox.media[lightbox.index].url} controls autoPlay className="w-full max-h-[60vh] rounded" />
                ) : (
                  <img src={lightbox.media[lightbox.index].url} alt="Media" className="w-full max-h-[60vh] rounded" />
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
        {/* Pagination Controls */}
        <div className="flex justify-center items-center gap-2 mt-8 mb-8">
          <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
          <span className="text-sm">Page {page} of {totalPages}</span>
          <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
        </div>
      </div>
      {/* Backend Developer Notes */}
      <div className="max-w-4xl mx-auto mt-16 mb-8 p-6 bg-gray-50 border border-gray-200 rounded shadow-sm">
        <h2 className="text-lg font-bold mb-2">Backend Developer Notes</h2>
        <ul className="list-disc pl-6 text-sm space-y-2">
          <li>
            <b>Review Data Model:</b> Each review should include: <code>id</code>, <code>reviewer</code>, <code>type</code> (user/vendor), <code>media</code> (array: &#123;url, type&#125;), <code>vendorName</code>, <code>jobId</code>, <code>userType</code>, <code>source</code> (manual/auto), <code>flagged</code>, <code>public</code>, <code>adminNote</code>, <code>status</code>, <code>rating</code>, <code>summary</code>, <code>details</code>, <code>createdAt</code>, <code>expiresAt</code>, <code>submittedAt</code>, <code>auditTrail</code> (array of admin actions)
          </li>
          <li>
            <b>Endpoints:</b>
            <ul className="list-disc pl-6">
              <li><code>GET /api/reviews</code> (filters: search, vendor, status, rating, flagged, public, source, date range, pagination, sort)</li>
              <li><code>POST /api/reviews/import</code> (bulk import reviews)</li>
              <li><code>POST /api/reviews/:id/flag</code> (flag/unflag review)</li>
              <li><code>POST /api/reviews/:id/remove</code> (remove/hide review)</li>
              <li><code>POST /api/reviews/:id/public</code> (toggle public/private)</li>
              <li><code>POST /api/reviews/:id/note</code> (add/update admin note)</li>
              <li><code>POST /api/reviews/:id/escalate</code> (escalate to quality team)</li>
              <li><code>POST /api/reviews/:id/notify</code> (send notification)</li>
              <li><code>GET /api/vendors</code> (for vendor filter dropdown)</li>
            </ul>
          </li>
          <li><b>Batch Actions:</b> Endpoints should support batch operations (flag/remove multiple reviews by IDs).</li>
          <li><b>Audit Trail:</b> Log every admin action (flag, remove, note, escalate, notify, public/private toggle) with <code>action</code>, <code>by</code>, <code>at</code>, and details.</li>
          <li><b>Media Handling:</b> Reviews may have multiple media files (images/videos). Serve via secure URLs or CDN.</li>
          <li><b>Permissions:</b> Only users with <code>review:moderate</code> or <code>admin</code> roles can perform admin actions. Log all actions for audit.</li>
          <li><b>Notifications:</b> Integrate with notification system (email, in-app, etc.) for flagged, escalated, or removed reviews. Log notification events in audit trail.</li>
          <li><b>Pagination & Performance:</b> All list endpoints should support pagination and efficient filtering/sorting. Add DB indexes as needed.</li>
          <li><b>Export/Import:</b> Endpoints for exporting filtered reviews (CSV, PDF). Bulk import endpoint for onboarding/migration.</li>
          <li><b>Future Features:</b> Review trend analytics, escalation workflow, real-time updates (WebSocket or polling).</li>
        </ul>
      </div>
    </TooltipProvider>
  );
} 