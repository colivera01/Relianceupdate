// BACKEND DEVELOPER NOTES:
// - POST /api/vendor/support-tickets: Create a new support ticket (fields: subject, description, attachments[])
// - GET /api/vendor/support-tickets: List all tickets for the current vendor (filter by status, date, search)
// - GET /api/vendor/support-tickets/:id: Get details and conversation for a ticket
// - POST /api/vendor/support-tickets/:id/reply: Add a reply/message to a ticket (with optional attachments)
// - Attachments should be uploaded to a secure storage and referenced by URL
// - Tickets should be linked to the vendor's account and visible to admins for review/response
// - Admin panel should notify admins of new/unresolved tickets
// - Status transitions: New → In Progress → Resolved (admin sets status)
// - Only the vendor who created the ticket (and admins) can view/reply
// - All timestamps should be in ISO 8601 format (UTC)
// - Consider rate limiting ticket creation to prevent spam
//
// This file currently uses mock data and local state for demonstration purposes.
'use client';
import React, { useState, useEffect } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Info, Eye } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from './ui/dialog';
import { useToast } from './ui/use-toast';
import { Toaster } from './ui/toaster';

// Stub UI components to avoid alias import issues
const Card = ({ children }) => <div className="border rounded p-4 shadow mb-4">{children}</div>;
const CardContent = ({ children }) => <div>{children}</div>;
const Button = ({ children, ...props }) => <button className="px-4 py-2 bg-blue-500 text-white rounded" {...props}>{children}</button>;
const DestructiveButton = ({ children, ...props }) => <button className="px-4 py-2 bg-red-500 text-white rounded" {...props}>{children}</button>;
const Input = (props) => <input className="border p-2 rounded w-full" {...props} />;
const Textarea = (props) => <textarea className="border p-2 rounded w-full" {...props} />;
const Checkbox = ({ checked, onChange }) => (
  <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
);
const Select = ({ value, onChange, options }) => (
  <select className="border p-2 rounded" value={value} onChange={(e) => onChange(e.target.value)}>
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
);

// Add a Badge component for status, priority, and escalation
const Badge = ({ children, color }) => (
  <span className={`px-2 py-1 rounded text-xs font-semibold ${color}`}>{children}</span>
);

// Simple RichTextEditor stub using Textarea
const RichTextEditor = ({ value, onChange }) => (
  <textarea
    className="border p-2 rounded w-full h-24"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder="Rich text editor (plain textarea stub)"
  />
);

// Helper for avatar/initials
const Avatar = ({ name }) => {
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() : '?';
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-red-500'];
  const color = colors[(name ? name.charCodeAt(0) : 0) % colors.length];
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white font-bold text-xs ${color}`}>{initials}</span>
  );
};

// Add mock audit trail data to each ticket
const getAuditTrail = (ticket) => [
  { type: 'created', user: ticket.requester, at: ticket.createdAt, desc: 'Ticket created' },
  { type: 'assigned', user: ticket.assignedTo || 'Unassigned', at: ticket.createdAt, desc: ticket.assignedTo ? `Assigned to ${ticket.assignedTo}` : 'Unassigned' },
  { type: 'status', user: ticket.assignedTo || 'System', at: ticket.createdAt, desc: `Status set to ${ticket.status}` },
  // Add more mock actions as needed
];

export default function SupportTicketsPage() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState([
    { id: 'TCK-1001', requester: 'User123', subject: 'Unable to access account', status: 'New', priority: 'High', assignedTo: '', description: 'I cannot login with my credentials.', createdAt: '2025-06-03T10:00:00Z', attachments: [], escalated: false },
    { id: 'TCK-1002', requester: 'Vendor456', subject: 'Payment not processing', status: 'In Progress', priority: 'Medium', assignedTo: 'Agent A', description: 'My payment fails with error code 402.', createdAt: '2025-06-02T09:15:00Z', attachments: [], escalated: false },
    { id: 'TCK-1003', requester: 'User789', subject: 'Feature request: add dark mode', status: 'Resolved', priority: 'Low', assignedTo: 'Agent B', description: 'It would be great to have dark mode.', createdAt: '2025-05-28T14:30:00Z', attachments: [], escalated: false },
  ]);
  const [filteredTickets, setFilteredTickets] = useState(tickets);
  const [searchQuery, setSearchQuery] = useState('');
  // Remove assigned agent/avatar, bulk actions, audit trail, and extra filters
  // Add create ticket button state
  const [showCreateModal, setShowCreateModal] = useState(false);
  // Simplified filter state
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [selectedTickets, setSelectedTickets] = useState(new Set());
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [showKB, setShowKB] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const pageCount = Math.ceil(filteredTickets.length / pageSize);
  const paginatedTickets = filteredTickets.slice((page - 1) * pageSize, page * pageSize);

  // Real-time WebSocket placeholder
  useEffect(() => {
    try {
      const ws = new WebSocket('wss://example.com/tickets');
      ws.onmessage = (event) => {
        const newTicket = JSON.parse(event.data);
        setTickets((prev) => [newTicket, ...prev]);
      };
      return () => ws.close();
    } catch {
      // Ignore if WebSocket not available
    }
  }, []);

  // Auto-escalate tickets older than 24 hours
  useEffect(() => {
    const now = new Date();
    setTickets((prev) =>
      prev.map((t) => {
        const created = parseISO(t.createdAt);
        const hoursAgo = (now - created) / (1000 * 60 * 60);
        return { ...t, escalated: hoursAgo > 24 && t.status !== 'Resolved' };
      })
    );
  }, []);

  // Apply search and filter
  useEffect(() => {
    let temp = [...tickets];
    if (filterStatus !== 'all') {
      temp = temp.filter((t) => t.status === filterStatus);
    }
    if (filterDateFrom) {
      temp = temp.filter((t) => new Date(t.createdAt) >= new Date(filterDateFrom));
    }
    if (filterDateTo) {
      temp = temp.filter((t) => new Date(t.createdAt) <= new Date(filterDateTo));
    }
    if (searchQuery) {
      temp = temp.filter(
        (t) =>
          t.id.includes(searchQuery) ||
          t.subject.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredTickets(temp);
  }, [tickets, searchQuery, filterStatus, filterDateFrom, filterDateTo]);

  const sendEmailNotification = (ticket) => {
    // Placeholder: integrate with email service
    console.log(`Email sent for ticket ${ticket.id}`);
  };

  // Bulk assign logic placeholder
  const bulkAssign = () => {
    const newTickets = tickets.map((t) =>
      selectedTickets.has(t.id) ? { ...t, assignedTo: 'Agent A' } : t
    );
    setTickets(newTickets);
    setSelectedTickets(new Set());
    toast({ title: 'Bulk Assign', description: 'Selected tickets have been assigned.' });
  };
  // Bulk close logic placeholder
  const bulkClose = () => {
    const newTickets = tickets.map((t) =>
      selectedTickets.has(t.id) ? { ...t, status: 'Resolved' } : t
    );
    setTickets(newTickets);
    setSelectedTickets(new Set());
    toast({ title: 'Bulk Close', description: 'Selected tickets have been closed.' });
  };
  const bulkDelete = () => {
    setTickets((prev) => prev.filter((t) => !selectedTickets.has(t.id)));
    setSelectedTickets(new Set());
    toast({ title: 'Bulk Delete', description: 'Selected tickets have been deleted.' });
  };

  // In the component, add state for new ticket form
  const [newTicket, setNewTicket] = useState({ subject: '', description: '', attachments: [] });
  const [creating, setCreating] = useState(false);

  return (
    <div style={{ padding: '1rem' }}>
      <Toaster />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Support / Help Tickets</h1>
      </div>

      {/* Toolbar: Only search, status, date filters, clear, and create ticket button */}
      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <Input
          placeholder="Search by ID or subject"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ maxWidth: '200px' }}
        />
        <Select
          value={filterStatus}
          onChange={setFilterStatus}
          options={[
            { value: 'all', label: 'All Statuses' },
            { value: 'New', label: 'New' },
            { value: 'In Progress', label: 'In Progress' },
            { value: 'Resolved', label: 'Resolved' },
          ]}
        />
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">From</label>
          <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{ minWidth: '120px' }} />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">To</label>
          <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={{ minWidth: '120px' }} />
        </div>
        <Button variant="ghost" size="sm" onClick={() => {
          setSearchQuery('');
          setFilterStatus('all');
          setFilterDateFrom('');
          setFilterDateTo('');
        }}>Clear</Button>
        <Button onClick={() => setShowCreateModal(true)} variant="default" size="sm">+ Create Support Ticket</Button>
      </div>

      {/* Ticket Queue Section */}
      <section style={{ marginBottom: '2rem' }}>
        <div className="overflow-x-auto rounded-lg shadow border border-gray-200 text-xs sm:text-sm">
          <table className="min-w-full bg-white">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr>
                <th className="p-2 text-center align-middle"><Checkbox
                  checked={selectedTickets.size === filteredTickets.length && filteredTickets.length > 0}
                  onChange={(checked) => {
                    if (checked) {
                      setSelectedTickets(new Set(filteredTickets.map((t) => t.id)));
                    } else {
                      setSelectedTickets(new Set());
                    }
                  }}
                  aria-label="Select all tickets"
                /></th>
                <th className="p-2 text-left align-middle">Ticket ID</th>
                <th className="p-2 text-left align-middle max-w-[220px]">Subject</th>
                <th className="p-2 text-left align-middle">Status</th>
                <th className="p-2 text-left align-middle">Age</th>
                <th className="p-2 text-center align-middle">Urgent</th>
                <th className="p-2 text-center align-middle">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTickets.map((ticket) => {
                const isEscalated = ticket.escalated;
                return (
                  <tr
                    key={ticket.id}
                    className={`transition-colors ${isEscalated ? 'bg-red-50' : 'hover:bg-blue-50'}`}
                  >
                    <td className="text-center align-middle"><Checkbox
                      checked={selectedTickets.has(ticket.id)}
                      onChange={(checked) => {
                        const newSet = new Set(selectedTickets);
                        if (checked) newSet.add(ticket.id);
                        else newSet.delete(ticket.id);
                        setSelectedTickets(newSet);
                      }}
                      aria-label={`Select ticket ${ticket.id}`}
                    /></td>
                    <td className="p-2 align-middle font-mono text-xs text-gray-700">{ticket.id}</td>
                    <td className="p-2 align-middle max-w-[220px] truncate" title={ticket.subject}>{ticket.subject}</td>
                    <td className="p-2 align-middle">
                      <Badge color={
                        ticket.status === 'Resolved' ? 'bg-green-100 text-green-800' :
                        ticket.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                        ticket.status === 'New' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }>{ticket.status}</Badge>
                    </td>
                    <td className="p-2 align-middle">{formatDistanceToNow(parseISO(ticket.createdAt))} ago</td>
                    <td className="p-2 align-middle text-center">
                      {isEscalated ? <Badge color="bg-red-500 text-white">Yes</Badge> : <Badge color="bg-gray-200 text-gray-600">No</Badge>}
                    </td>
                    <td className="p-2 align-middle text-center">
                      <Dialog>
                        <DialogTrigger asChild>
                          <button
                            className="inline-flex items-center justify-center p-2 rounded hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            aria-label={`View details for ticket ${ticket.id}`}
                            tabIndex={0}
                            title="View details"
                          >
                            <Eye className="w-5 h-5 text-blue-700" />
                            <span className="sr-only">View details</span>
                          </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg w-full sm:max-w-2xl p-2 sm:p-6">
                          <DialogHeader>
                            <DialogTitle>Ticket Details</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-2">
                            <div><strong>Subject:</strong> {ticket.subject}</div>
                            <div><strong>Status:</strong> <Badge color={
                              ticket.status === 'Resolved' ? 'bg-green-100 text-green-800' :
                              ticket.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                              ticket.status === 'New' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }>{ticket.status}</Badge></div>
                            <div><strong>Created:</strong> {formatDistanceToNow(parseISO(ticket.createdAt))} ago</div>
                            <div><strong>Description:</strong> <div className="whitespace-pre-line bg-gray-50 p-2 rounded mt-1">{ticket.description}</div></div>
                            <div className="font-semibold mb-2">Attachments</div>
                            <ul className="mb-2">
                              {(ticket.attachments || []).length > 0 ? (
                                ticket.attachments.map((att, idx) => (
                                  <li key={idx}>
                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">{att.filename}</a>
                                  </li>
                                ))
                              ) : (
                                <li className="text-gray-400">No attachments</li>
                              )}
                            </ul>
                            <Input type="file" onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                const newAttachment = { url: URL.createObjectURL(file), filename: file.name };
                                setTickets((prev) => prev.map((t) =>
                                  t.id === ticket.id ? { ...t, attachments: [...t.attachments, newAttachment] } : t
                                ));
                              }
                            }} />
                            <div className="font-semibold mt-4 mb-2">Reply (Rich Text)</div>
                            <RichTextEditor value={replyContent} onChange={setReplyContent} />
                            {ticket.status !== 'Resolved' && (
                              <div className="mt-4">
                                <Button onClick={() => {
                                  // Placeholder for sending reply logic
                                  console.log(`Sending reply for ticket ${ticket.id}`);
                                  setReplyContent(''); // Clear reply after sending
                                }}>Send Reply</Button>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {/* Add pagination controls below the table */}
      <div className="flex justify-between items-center mt-4">
        <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1} aria-label="Previous page">Previous</Button>
        <span className="text-sm text-gray-600">Page {page} of {pageCount}</span>
        <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page === pageCount} aria-label="Next page">Next</Button>
      </div>

      {/* Create Support Ticket Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg w-full sm:max-w-xl p-2 sm:p-6">
          <DialogHeader>
            <DialogTitle>Create Support Ticket</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={e => {
              e.preventDefault();
              if (!newTicket.subject.trim() || !newTicket.description.trim()) return;
              setCreating(true);
              // Simulate ticket creation
              setTimeout(() => {
                setTickets(prev => [
                  {
                    id: `TCK-${1000 + prev.length + 1}`,
                    requester: 'You',
                    subject: newTicket.subject,
                    status: 'New',
                    priority: 'Low',
                    assignedTo: '',
                    description: newTicket.description,
                    createdAt: new Date().toISOString(),
                    attachments: newTicket.attachments,
                    escalated: false,
                  },
                  ...prev,
                ]);
                setNewTicket({ subject: '', description: '', attachments: [] });
                setShowCreateModal(false);
                setCreating(false);
                toast({ title: 'Ticket Created', description: 'Your support ticket has been submitted.' });
              }, 600);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium mb-1">Subject <span className="text-red-500">*</span></label>
              <Input
                value={newTicket.subject}
                onChange={e => setNewTicket(t => ({ ...t, subject: e.target.value }))}
                required
                maxLength={120}
                placeholder="Brief summary of your issue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description <span className="text-red-500">*</span></label>
              <Textarea
                value={newTicket.description}
                onChange={e => setNewTicket(t => ({ ...t, description: e.target.value }))}
                required
                rows={4}
                placeholder="Describe your issue in detail"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Attachments</label>
              <Input
                type="file"
                multiple
                onChange={e => {
                  const files = Array.from(e.target.files || []);
                  setNewTicket(t => ({
                    ...t,
                    attachments: files.map(file => ({ url: URL.createObjectURL(file), filename: file.name })),
                  }));
                }}
              />
              <div className="text-xs text-gray-500 mt-1">Optional. You can attach screenshots or documents.</div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={creating || !newTicket.subject.trim() || !newTicket.description.trim()}>Submit Ticket</Button>
              <DialogClose asChild>
                <Button type="button" variant="ghost">Cancel</Button>
              </DialogClose>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Knowledge Base Modal */}
      <Dialog open={showKB} onOpenChange={setShowKB}>
        <DialogContent className="max-w-lg w-full sm:max-w-xl p-2 sm:p-6">
          <DialogHeader>
            <DialogTitle>Vendor Knowledge Base</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold mb-1">How to Create a Support Ticket</h2>
              <ul className="list-disc pl-5 text-sm text-gray-700">
                <li>Click the <b>+ Create Support Ticket</b> button above the table.</li>
                <li>Fill in the subject and description of your issue. Attach files if needed.</li>
                <li>Submit your ticket. You’ll see it appear in the list below.</li>
              </ul>
            </div>
            <div>
              <h2 className="font-semibold mb-1">What Happens Next?</h2>
              <ul className="list-disc pl-5 text-sm text-gray-700">
                <li>Your ticket will be reviewed by our support team.</li>
                <li>You’ll receive a response in this portal and (optionally) by email.</li>
                <li>You can reply or add more info to your ticket until it’s resolved.</li>
              </ul>
            </div>
            <div>
              <h2 className="font-semibold mb-1">Response Times</h2>
              <ul className="list-disc pl-5 text-sm text-gray-700">
                <li>We aim to respond to all tickets within 1 business day.</li>
                <li>Urgent issues are prioritized and flagged as "Urgent" in your ticket list.</li>
              </ul>
            </div>
            <div>
              <h2 className="font-semibold mb-1">Common Topics</h2>
              <ul className="list-disc pl-5 text-sm text-gray-700">
                <li>Account access and password reset</li>
                <li>Billing and payment questions</li>
                <li>Job management and approvals</li>
                <li>Profile and settings updates</li>
                <li>Feature requests and feedback</li>
              </ul>
            </div>
            <div className="text-xs text-gray-500">For urgent issues, please create a ticket and mark the subject as "Urgent".</div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 