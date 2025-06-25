import React, { useState, useEffect } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';

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

// Simple RichTextEditor stub using Textarea
const RichTextEditor = ({ value, onChange }) => (
  <textarea
    className="border p-2 rounded w-full h-24"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder="Rich text editor (plain textarea stub)"
  />
);

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState([
    { id: 'TCK-1001', requester: 'User123', subject: 'Unable to access account', status: 'New', priority: 'High', assignedTo: '', description: 'I cannot login with my credentials.', createdAt: '2025-06-03T10:00:00Z', attachments: [], escalated: false },
    { id: 'TCK-1002', requester: 'Vendor456', subject: 'Payment not processing', status: 'In Progress', priority: 'Medium', assignedTo: 'Agent A', description: 'My payment fails with error code 402.', createdAt: '2025-06-02T09:15:00Z', attachments: [], escalated: false },
    { id: 'TCK-1003', requester: 'User789', subject: 'Feature request: add dark mode', status: 'Resolved', priority: 'Low', assignedTo: 'Agent B', description: 'It would be great to have dark mode.', createdAt: '2025-05-28T14:30:00Z', attachments: [], escalated: false },
  ]);
  const [filteredTickets, setFilteredTickets] = useState(tickets);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedTickets, setSelectedTickets] = useState(new Set());
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyContent, setReplyContent] = useState('');

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
  }, [tickets]);

  // Apply search and filter
  useEffect(() => {
    let temp = [...tickets];
    if (filterStatus !== 'all') {
      temp = temp.filter((t) => t.status === filterStatus);
    }
    if (searchQuery) {
      temp = temp.filter(
        (t) =>
          t.id.includes(searchQuery) ||
          t.requester.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.subject.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredTickets(temp);
  }, [tickets, searchQuery, filterStatus]);

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
  };
  // Bulk close logic placeholder
  const bulkClose = () => {
    const newTickets = tickets.map((t) =>
      selectedTickets.has(t.id) ? { ...t, status: 'Resolved' } : t
    );
    setTickets(newTickets);
    setSelectedTickets(new Set());
  };
  const bulkDelete = () => {
    setTickets((prev) => prev.filter((t) => !selectedTickets.has(t.id)));
    setSelectedTickets(new Set());
  };

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Support / Help Tickets</h1>
        <a href="/knowledge-base">Knowledge Base</a>
      </div>

      {/* Toolbar: Search, Filter, Bulk Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <Input
          placeholder="Search by ID, requester, subject"
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
        <Button onClick={bulkAssign} disabled={selectedTickets.size === 0}>Assign Selected</Button>
        <Button onClick={bulkClose} disabled={selectedTickets.size === 0}>Close Selected</Button>
        <DestructiveButton onClick={bulkDelete} disabled={selectedTickets.size === 0}>Delete Selected</DestructiveButton>
      </div>

      {/* Ticket Queue Section */}
      <section style={{ marginBottom: '2rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th><Checkbox
                checked={selectedTickets.size === filteredTickets.length && filteredTickets.length > 0}
                onChange={(checked) => {
                  if (checked) {
                    setSelectedTickets(new Set(filteredTickets.map((t) => t.id)));
                  } else {
                    setSelectedTickets(new Set());
                  }
                }}
              /></th>
              <th>Ticket ID</th>
              <th>Requester</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Assigned To</th>
              <th>Age</th>
              <th>Escalated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.map((ticket) => (
              <tr key={ticket.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ textAlign: 'center' }}><Checkbox
                  checked={selectedTickets.has(ticket.id)}
                  onChange={(checked) => {
                    const newSet = new Set(selectedTickets);
                    if (checked) newSet.add(ticket.id);
                    else newSet.delete(ticket.id);
                    setSelectedTickets(newSet);
                  }}
                /></td>
                <td>{ticket.id}</td>
                <td>{ticket.requester}</td>
                <td>{ticket.subject}</td>
                <td>{ticket.status}</td>
                <td>{ticket.priority}</td>
                <td>{ticket.assignedTo || 'Unassigned'}</td>
                <td>{formatDistanceToNow(parseISO(ticket.createdAt))} ago</td>
                <td>{ticket.escalated ? <span style={{ color: 'red', fontWeight: 'bold' }}>Yes</span> : 'No'}</td>
                <td>
                  <details>
                    <summary><Button variant="outline" size="sm" onClick={() => setSelectedTicket(ticket)}>View</Button></summary>
                    <Card>
                      <CardContent>
                        <p><strong>Ticket ID:</strong> {selectedTicket?.id}</p>
                        <p><strong>Requester:</strong> {selectedTicket?.requester}</p>
                        <p><strong>Subject:</strong> {selectedTicket?.subject}</p>
                        <p><strong>Status:</strong> {selectedTicket?.status}</p>
                        <p><strong>Priority:</strong> {selectedTicket?.priority}</p>
                        <div>
                          <label>Assigned To:</label>
                          <Select
                            value={selectedTicket?.assignedTo || ''}
                            onChange={(value) => {
                              setTickets((prev) => prev.map((t) => t.id === selectedTicket.id ? { ...t, assignedTo: value } : t));
                            }}
                            options={[
                              { value: '', label: 'Unassigned' },
                              { value: 'Agent A', label: 'Agent A' },
                              { value: 'Agent B', label: 'Agent B' },
                              { value: 'Agent C', label: 'Agent C' },
                            ]}
                          />
                        </div>
                        <div>
                          <label>Description:</label>
                          <Textarea disabled value={selectedTicket?.description} />
                        </div>
                        <div>
                          <label>Attachments:</label>
                          <ul>
                            {(selectedTicket?.attachments || []).length > 0 ? (
                              selectedTicket.attachments.map((att, idx) => (
                                <li key={idx}>
                                  <a href={att.url} target="_blank" rel="noopener noreferrer">
                                    {att.filename}
                                  </a>
                                </li>
                              ))
                            ) : (
                              <li>No attachments</li>
                            )}
                          </ul>
                        </div>
                        <div>
                          <label>Add Attachment:</label>
                          <Input type="file" onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const newAttachment = { url: URL.createObjectURL(file), filename: file.name };
                              setTickets((prev) => prev.map((t) =>
                                t.id === selectedTicket.id ? { ...t, attachments: [...t.attachments, newAttachment] } : t
                              ));
                            }
                          }} />
                        </div>
                        <div>
                          <label>Reply (Rich Text):</label>
                          <RichTextEditor value={replyContent} onChange={setReplyContent} />
                        </div>
                      </CardContent>
                    </Card>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
} 