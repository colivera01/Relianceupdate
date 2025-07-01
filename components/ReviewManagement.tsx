"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Tooltip } from './ui/tooltip';
import { TooltipProvider } from "@radix-ui/react-tooltip";

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

const seedReviews: Review[] = [
  {
    id: 1,
    vendor: "Reliable Plumbers",
    vendorImage: vendorLogos[0],
    user: "User1",
    reviewerType: "user",
    userImage: "https://randomuser.me/api/portraits/men/11.jpg",
    rating: 5,
    type: "video",
    date: "2024-06-01",
    closedDate: "2024-06-02",
    content: "Excellent service! The plumber arrived on time and fixed the issue quickly. Highly recommend.",
    mediaUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    flagged: false,
    auto: false,
    status: "approved",
    replies: [
      { id: 1, author: "Admin", content: "Thank you for your feedback!", timestamp: "2024-06-02 10:00" }
    ]
  },
  {
    id: 2,
    vendor: "Bright Electric",
    vendorImage: vendorLogos[1],
    user: "User2",
    reviewerType: "user",
    userImage: "https://randomuser.me/api/portraits/women/12.jpg",
    rating: 2,
    type: "photo",
    date: "2024-06-03",
    closedDate: "2024-06-04",
    content: "The electrician was late and the problem wasn't fully resolved. Disappointed.",
    mediaUrl: "https://via.placeholder.com/400x200?text=Photo+2",
    flagged: true,
    auto: true,
    status: "pending",
    replies: []
  },
  {
    id: 3,
    vendor: "Spark HVAC",
    vendorImage: vendorLogos[2],
    user: "User3",
    reviewerType: "vendor",
    userImage: "https://randomuser.me/api/portraits/men/13.jpg",
    rating: 4,
    type: "photo",
    date: "2024-06-05",
    closedDate: "2024-06-06",
    content: "Great customer, clear instructions, prompt payment.",
    mediaUrl: "https://via.placeholder.com/400x200?text=Photo+3",
    flagged: false,
    auto: false,
    status: "approved",
    replies: [
      { id: 2, author: "Admin", content: "Glad to hear it went well!", timestamp: "2024-06-06 09:30" }
    ]
  },
  {
    id: 4,
    vendor: "Reliable Plumbers",
    vendorImage: vendorLogos[0],
    user: "User4",
    reviewerType: "user",
    userImage: "https://randomuser.me/api/portraits/women/14.jpg",
    rating: 1,
    type: "video",
    date: "2024-06-07",
    closedDate: "2024-06-08",
    content: "Terrible experience. The plumber was rude and left a mess.",
    mediaUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    flagged: true,
    auto: false,
    status: "rejected",
    replies: [
      { id: 3, author: "Admin", content: "We're sorry to hear this. We'll investigate.", timestamp: "2024-06-08 11:15" }
    ]
  },
  {
    id: 5,
    vendor: "Bright Electric",
    vendorImage: vendorLogos[1],
    user: "User5",
    reviewerType: "user",
    userImage: "https://randomuser.me/api/portraits/men/15.jpg",
    rating: 3,
    type: "photo",
    date: "2024-06-09",
    closedDate: "2024-06-10",
    content: "Average service. The job was done but took longer than expected.",
    mediaUrl: "https://via.placeholder.com/400x200?text=Photo+5",
    flagged: false,
    auto: true,
    status: "pending",
    replies: []
  },
  {
    id: 6,
    vendor: "Spark HVAC",
    vendorImage: vendorLogos[2],
    user: "User6",
    reviewerType: "user",
    userImage: "https://randomuser.me/api/portraits/women/16.jpg",
    rating: 5,
    type: "video",
    date: "2024-06-11",
    closedDate: "2024-06-12",
    content: "Outstanding! The technician was knowledgeable and friendly.",
    mediaUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    flagged: false,
    auto: false,
    status: "approved",
    replies: []
  },
  // Add more reviews to fill the grid and show all features
  ...Array.from({ length: 18 }, (_, i) => ({
    id: i + 7,
    vendor: ["Reliable Plumbers", "Bright Electric", "Spark HVAC"][i % 3],
    vendorImage: vendorLogos[i % 3],
    user: `User${i + 7}`,
    reviewerType: SOURCES[i % SOURCES.length],
    userImage: `https://randomuser.me/api/portraits/${i % 2 ? "women" : "men"}/${i + 17}.jpg`,
    rating: RATINGS[i % RATINGS.length],
    type: TYPES[i % TYPES.length],
    date: `2024-06-${String(i + 13).padStart(2, "0")}`,
    closedDate: `2024-06-${String(i + 14).padStart(2, "0")}`,
    content: `Sample review content #${i + 7}. This is a longer review to demonstrate the UI. Everything went as expected.`,
    mediaUrl: TYPES[i % TYPES.length] === "video"
      ? "https://www.w3schools.com/html/mov_bbb.mp4"
      : `https://via.placeholder.com/400x200?text=Photo+${i + 7}`,
    flagged: i % 4 === 0,
    auto: i % 3 === 0,
    status: ["pending", "approved", "rejected"][i % 3] as Status,
    replies: i % 5 === 0 ? [
      { id: i + 100, author: "Admin", content: "Thank you for your review!", timestamp: `2024-06-${String(i + 14).padStart(2, "0")}` }
    ] : []
  }))
];

export default function ReviewManagement() {
  const [reviews, setReviews] = useState<Review[]>(seedReviews);
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

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const logAction = (id: number, action: string, reason?: string) => {
    setAdminLog(prev => [...prev, { id: Date.now(), reviewId: id, action, actor: 'Admin', timestamp: new Date().toLocaleString(), reason }]);
  };
  const updateStatus = (id: number, status: Status) => {
    setReviews(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    setViewing(v => v && v.id === id ? { ...v, status } : v);
    logAction(id, status, editReason);
    setEditingContent(false);
    setEditReason("");
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
    (r.content.toLowerCase().includes(debounced) || r.vendor.toLowerCase().includes(debounced) || r.user.toLowerCase().includes(debounced)) &&
    (typeFilter === 'all' || r.type === typeFilter) &&
    (ratingFilter === 'all' || r.rating === ratingFilter) &&
    (flagFilter === 'all' || (flagFilter === 'flagged' ? r.flagged : !r.flagged)) &&
    (sourceFilter === 'all' || r.reviewerType === sourceFilter) &&
    (autoFilter === 'all' || (autoFilter === 'auto' ? r.auto : !r.auto)) &&
    (statusFilter === 'all' || r.status === statusFilter) &&
    (!fromDate || r.date >= fromDate) &&
    (!toDate   || r.date <= toDate)
  ), [reviews, debounced, typeFilter, ratingFilter, flagFilter, sourceFilter, autoFilter, statusFilter, fromDate, toDate]);

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <h2 className="text-2xl font-bold mb-4">Review Management</h2>

        {/* KPI Banner */}
        <div className="flex flex-wrap gap-6 bg-blue-50 p-6 rounded-lg border border-blue-100 shadow-sm items-center">
          <div className="text-lg font-semibold"><span className="text-blue-700">Total Reviews:</span> {reviews.length}</div>
          <div className="text-lg font-semibold"><span className="text-blue-700">% Flagged:</span> {Math.round((reviews.filter(r => r.flagged).length / reviews.length) * 100)}%</div>
          <div className="text-lg font-semibold"><span className="text-blue-700">Avg Rating:</span> {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}★</div>
          <div className="text-lg font-semibold"><span className="text-blue-700">New (24h):</span> {reviews.filter(r => new Date(r.date) >= new Date(Date.now() - 86400000)).length}</div>
        </div>

        {/* Filters & Bulk */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Input placeholder="Search by vendor/user/content" className="max-w-xs" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search reviews" />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="Filter by type" className="border rounded px-2 py-1 pr-6 text-sm">
            <option value="all">All Types</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={ratingFilter} onChange={e => setRatingFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))} aria-label="Filter by rating" className="border rounded px-2 py-1 pr-6 text-sm">
            <option value="all">All Ratings</option>
            {RATINGS.map(r => <option key={r} value={r}>{r}★</option>)}
          </select>
          <select value={flagFilter} onChange={e => setFlagFilter(e.target.value)} aria-label="Filter by flagged" className="border rounded px-2 py-1 pr-6 text-sm">
            <option value="all">All Flags</option>
            <option value="flagged">Flagged</option>
            <option value="unflagged">Unflagged</option>
          </select>
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} aria-label="Filter by source" className="border rounded px-2 py-1 pr-6 text-sm">
            <option value="all">All Sources</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={autoFilter} onChange={e => setAutoFilter(e.target.value)} aria-label="Filter by review mode" className="border rounded px-2 py-1 pr-6 text-sm">
            <option value="all">All Modes</option>
            <option value="auto">Auto</option>
            <option value="manual">Manual</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as Status)} aria-label="Filter by status" className="border rounded px-2 py-1 pr-6 text-sm">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-36" aria-label="From date" />
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-36" aria-label="To date" />
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 bg-gray-100 p-2 rounded ml-auto">
              <Button size="sm" onClick={() => selectedIds.forEach(id => updateStatus(id, 'approved'))}>Approve</Button>
              <Button size="sm" onClick={() => selectedIds.forEach(id => updateStatus(id, 'rejected'))}>Reject</Button>
              <Button size="sm" variant="destructive" onClick={() => {/* delete logic */}}>Delete</Button>
              <Button size="sm" variant="outline" onClick={() => {/* export logic */}}>Export</Button>
            </div>
          )}
        </div>

        {/* Review Grid */}
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(r => {
            const isDup = dupMap[r.content] > 1;
            const isIPSpam = ipMap[r.user] > 1;
            return (
              <Card key={r.id} className="p-4 shadow-md border hover:ring-2 hover:ring-blue-400 transition" tabIndex={0} onKeyPress={e => { if (e.key === 'Enter') setViewing(r); }}>
                <div className="flex justify-between mb-2">
                  <Tooltip content={r.status.charAt(0).toUpperCase() + r.status.slice(1)}>
                    <Badge variant={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'destructive' : 'outline'}>{r.status}</Badge>
                  </Tooltip>
                  <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleSelect(r.id)} aria-label={`Select review ${r.id}`} />
                </div>
                { (isDup || isIPSpam) && <Badge variant="destructive" title="Duplicate or suspicious reviewer">⚠️ Suspicious Activity</Badge> }
                <div className="flex justify-center mb-2">
                  <img src={r.reviewerType === 'vendor' ? r.vendorImage : r.userImage} alt={r.reviewerType === 'vendor' ? r.vendor : r.user} loading="lazy" className="w-12 h-12 rounded-full border" />
                </div>
                <div className="flex justify-between items-center mb-2">
                  <Tooltip content={r.auto ? 'Auto-moderated' : 'Manually reviewed'}>
                    <Badge variant={r.auto ? 'destructive' : 'secondary'}>{r.auto ? 'Auto' : 'Manual'}</Badge>
                  </Tooltip>
                  <Badge variant="outline">{r.rating}★</Badge>
                </div>
                <div className="flex gap-2 text-xs text-gray-500 mb-2">
                  <span>{daysBetween(new Date(), new Date(r.date))} days after review</span>
                  <span>{daysBetween(new Date(r.date), new Date(r.closedDate))} days since close</span>
                </div>
                <CardHeader className="py-1"><CardTitle>{r.content.length > 50 ? r.content.slice(0, 50) + '...' : r.content}</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 truncate">{r.reviewerType === 'vendor' ? r.vendor : r.user}</p>
                  <Button size="sm" className="mt-2 focus:outline-none focus:ring" onClick={() => { setViewing(r); setContentInput(r.content); }} aria-label={`View details for review ${r.id}`}>Details</Button>
                </CardContent>
              </Card>
            );
          })}
        </ul>

        {/* Detail Modal */}
        {viewing && (
          <Dialog open onOpenChange={() => setViewing(null)}>
            <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto space-y-4">
              <DialogTitle>Review #{viewing.id} Details</DialogTitle>
              <div className="flex gap-2 text-xs">
                <Badge>{viewing.rating}★</Badge>
                <Badge variant="outline">{viewing.type}</Badge>
                {viewing.flagged && <Badge variant="destructive" title="Flagged by system or user">Flagged</Badge>}
                {viewing.auto && <Badge variant="secondary">Auto</Badge>}
              </div>
              {viewing.type === 'video'
                ? <video controls className="w-full" loading="lazy"><source src={viewing.mediaUrl} type="video/mp4" /></video>
                : <img src={viewing.mediaUrl} alt="media" className="w-full rounded" loading="lazy" />
              }
              <div className="mt-2 text-sm">
                <strong>Content:</strong> {!editingContent
                  ? (<p>{viewing.content}</p>)
                  : (<textarea className="w-full border rounded p-2" rows={3} value={contentInput} onChange={e => setContentInput(e.target.value)} />)}
              </div>
              {editingContent && <Input placeholder="Reason for edit" value={editReason} onChange={e => setEditReason(e.target.value)} />}
            </DialogContent>
          </Dialog>
        )}

        {/* Backend Developer Notes */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">📋 Backend Developer Notes</h3>
          <div className="text-sm text-blue-700 space-y-2">
            <p><strong>Endpoints Needed:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><code>GET /api/reviews</code> – List reviews (with filters, search, pagination)</li>
              <li><code>PATCH /api/reviews/:id</code> – Update review status, content, replies</li>
              <li><code>POST /api/reviews/bulk-action</code> – Bulk approve/reject/delete reviews</li>
              <li><code>POST /api/reviews/:id/reply</code> – Add reply to review</li>
            </ul>
            <p><strong>Review Data Format:</strong></p>
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
            <p><strong>Integration Notes:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>All review actions (approve, reject, edit, reply) should call the appropriate endpoint and update the UI on success.</li>
              <li>Bulk actions should accept an array of review IDs and an action type.</li>
              <li>Show loading and error states for all async actions.</li>
              <li>Paginate review lists on the backend for large datasets.</li>
            </ul>
            <p className="mt-2"><strong>Validation & Security:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Only admins can approve/reject/edit reviews and add replies.</li>
              <li>All endpoints should validate user permissions and input data.</li>
              <li>Return clear error messages for failed actions.</li>
            </ul>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
} 