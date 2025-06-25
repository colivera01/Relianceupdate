import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

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

const seedReviews: Review[] = Array.from({ length: 24 }, (_, i) => {
  const reviewDate = new Date(Date.now() - i * 86400000);
  const closedDate = new Date(reviewDate.getTime() - ((i % 5) + 1) * 86400000);
  const type = TYPES[i % TYPES.length];
  return {
    id: i + 1,
    vendor: ["Reliable Plumbers", "Bright Electric", "Spark HVAC"][i % 3],
    vendorImage: vendorLogos[i % vendorLogos.length],
    user: `User${i + 1}`,
    reviewerType: SOURCES[i % SOURCES.length],
    userImage: `https://via.placeholder.com/48?text=U${i + 1}`,
    rating: RATINGS[i % RATINGS.length],
    type,
    date: reviewDate.toISOString().slice(0, 10),
    closedDate: closedDate.toISOString().slice(0, 10),
    content: `Sample review content #${i + 1}.`,  
    mediaUrl: type === "video"
      ? "https://www.w3schools.com/html/mov_bbb.mp4"
      : `https://via.placeholder.com/400x200?text=Photo+${i + 1}`,
    flagged: i % 7 === 0,
    auto: i % 6 === 0,
    status: "pending",
    replies: []
  };
});

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
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Review Management</h2>

      {/* KPI Banner */}
      <div className="flex flex-wrap gap-4 bg-blue-50 p-4 rounded">
        <div><strong>Total Reviews:</strong> {reviews.length}</div>
        <div><strong>% Flagged:</strong> {Math.round((reviews.filter(r => r.flagged).length / reviews.length) * 100)}%</div>
        <div><strong>Avg Rating:</strong> {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}★</div>
        <div><strong>New (24h):</strong> {reviews.filter(r => new Date(r.date) >= new Date(Date.now() - 86400000)).length}</div>
      </div>

      {/* Filters & Bulk */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Input placeholder="Search by vendor/user/content" className="max-w-xs" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search reviews" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="Filter by type">
          <option value="all">All Types</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={ratingFilter} onChange={e => setRatingFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))} aria-label="Filter by rating">
          <option value="all">All Ratings</option>
          {RATINGS.map(r => <option key={r} value={r}>{r}★</option>)}
        </select>
        <select value={flagFilter} onChange={e => setFlagFilter(e.target.value)} aria-label="Filter by flagged">
          <option value="all">All Flags</option>
          <option value="flagged">Flagged</option>
          <option value="unflagged">Unflagged</option>
        </select>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} aria-label="Filter by source">
          <option value="all">All Sources</option>
          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={autoFilter} onChange={e => setAutoFilter(e.target.value)} aria-label="Filter by review mode">
          <option value="all">All Modes</option>
          <option value="auto">Auto</option>
          <option value="manual">Manual</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as Status)} aria-label="Filter by status">
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
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(r => {
          const isDup = dupMap[r.content] > 1;
          const isIPSpam = ipMap[r.user] > 1;
          return (
            <Card key={r.id} className="p-4" tabIndex={0} onKeyPress={e => { if (e.key === 'Enter') setViewing(r); }}>
              <div className="flex justify-between mb-2">
                <Badge variant={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'destructive' : 'outline'}>{r.status}</Badge>
                <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleSelect(r.id)} aria-label={`Select review ${r.id}`} />
              </div>
              { (isDup || isIPSpam) && <Badge variant="destructive">⚠️ Suspicious Activity</Badge> }
              <div className="flex justify-center mb-2">
                <img src={r.reviewerType === 'vendor' ? r.vendorImage : r.userImage} alt={r.reviewerType === 'vendor' ? r.vendor : r.user} loading="lazy" className="w-12 h-12 rounded-full" />
              </div>
              <div className="flex justify-between items-center mb-2">
                <Badge variant={r.auto ? 'destructive' : 'secondary'}>{r.auto ? 'Auto' : 'Manual'}</Badge>
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
              {viewing.flagged && <Badge variant="destructive">Flagged</Badge>}
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
    </div>
  );
} 