'use client';
import { useState, useRef } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Info } from 'lucide-react';

// BACKEND DEVELOPER NOTES:
// - Fetch jobs for this vendor from GET /api/vendor/jobs
// - When creating a job, POST to /api/vendor/jobs with job title, client name, phone, email, etc.
// - When uploading media, POST to /api/vendor/jobs/:jobId/media
// - Consent requests should trigger notifications to client (email/SMS) via backend
// - Job status, audit trail, and assigned employees should be persisted in the backend
// - All actions (create, update, upload, approve, reject) should be logged for audit
// - Use vendor authentication/authorization for all API calls
// - NEW: When vendor selects 'At business address', POST geo-coordinates to /api/vendor/validate-location with jobId and expected address. Log all attempts (success/failure, coordinates, IP, timestamp).
// - NEW: Store legal consent text and metadata for each service video creation attempt.

const mockJobs = [
  { id: 1, title: 'Water Heater Repair', client: 'John Smith', status: 'pending', consent: null, media: [], audit: [], assignedEmployees: ['Maria Lopez', 'James Lee'] },
  { id: 2, title: 'AC Installation', client: 'Jane Doe', status: 'pending', consent: null, media: [], audit: [], assignedEmployees: ['Maria Lopez'] },
];

const mockEmployees = [
  { id: 1, name: "Maria Lopez", photo: "https://randomuser.me/api/portraits/women/44.jpg" },
  { id: 2, name: "James Lee", photo: "https://randomuser.me/api/portraits/men/45.jpg" }
];

const BUSINESS_ADDRESS = { lat: 28.5383, lng: -81.3792 }; // Example: Orlando, FL
const LOCATION_RADIUS_METERS = 100; // Acceptable radius

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  // Haversine formula
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Add a helper for status badge
function StatusBadge({ status }) {
  let color = 'bg-gray-300 text-gray-800';
  let label = status;
  if (status === 'pending') { color = 'bg-yellow-200 text-yellow-800'; label = 'Pending'; }
  if (status === 'in-progress') { color = 'bg-blue-200 text-blue-800'; label = 'In Progress'; }
  if (status === 'pending-review') { color = 'bg-orange-200 text-orange-800'; label = 'Pending Review'; }
  if (status === 'completed') { color = 'bg-green-200 text-green-800'; label = 'Completed'; }
  if (status === 'rejected') { color = 'bg-red-200 text-red-800'; label = 'Rejected'; }
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${color}`}>{label}</span>;
}

// Add a helper for job progress stepper
function JobProgress({ status }) {
  const steps = [
    { key: 'pending', label: 'Created' },
    { key: 'in-progress', label: 'In Progress' },
    { key: 'pending-review', label: 'Pending Review' },
    { key: 'completed', label: 'Completed' },
  ];
  let currentIdx = steps.findIndex(s => s.key === status);
  if (status === 'rejected') currentIdx = 2; // treat rejected as after pending review
  return (
    <div className="flex items-center gap-2 my-2">
      {steps.map((step, idx) => (
        <div key={step.key} className="flex items-center gap-1">
          <div className={`w-3 h-3 rounded-full border-2 ${idx <= currentIdx ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`}></div>
          <span className={`text-xs ${idx <= currentIdx ? 'text-blue-700 font-semibold' : 'text-gray-400'}`}>{step.label}</span>
          {idx < steps.length - 1 && <div className={`w-6 h-0.5 ${idx < currentIdx ? 'bg-blue-500' : 'bg-gray-200'}`}></div>}
        </div>
      ))}
      {status === 'rejected' && <span className="ml-2 text-xs text-red-600 font-semibold">Rejected</span>}
    </div>
  );
}

// Timeline icon helper
function TimelineIcon({ type }) {
  if (type.includes('upload')) return <span className="w-3 h-3 bg-purple-400 rounded-full inline-block mr-2" title="Media Upload" />;
  if (type.includes('assign')) return <span className="w-3 h-3 bg-blue-400 rounded-full inline-block mr-2" title="Assignment" />;
  if (type.includes('status')) return <span className="w-3 h-3 bg-green-400 rounded-full inline-block mr-2" title="Status Change" />;
  if (type.includes('delete')) return <span className="w-3 h-3 bg-red-400 rounded-full inline-block mr-2" title="Delete" />;
  return <span className="w-3 h-3 bg-gray-300 rounded-full inline-block mr-2" title="Other" />;
}

// CSV export helper
function exportJobsToCSV(jobs) {
  if (!jobs.length) return;
  const headers = ['ID', 'Title', 'Client', 'Status', 'Assigned Employees'];
  const rows = jobs.map(j => [j.id, j.title, j.client, j.status, (j.assignedEmployees || []).join('; ')]);
  let csv = headers.join(',') + '\n' + rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jobs_export.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// File type icon helper
function FileTypeIcon({ type }) {
  if (type.startsWith('image')) return <span title="Image" className="inline-block w-4 h-4 bg-blue-200 rounded mr-1" />;
  if (type.startsWith('video')) return <span title="Video" className="inline-block w-4 h-4 bg-purple-200 rounded mr-1" />;
  if (type === 'application/pdf') return <span title="PDF" className="inline-block w-4 h-4 bg-red-200 rounded mr-1" />;
  if (type.includes('word')) return <span title="Doc" className="inline-block w-4 h-4 bg-indigo-200 rounded mr-1" />;
  return <span title="File" className="inline-block w-4 h-4 bg-gray-200 rounded mr-1" />;
}

// Tooltip helper
function InfoTooltip({ text }) {
  return (
    <span className="relative group ml-1 align-middle">
      <Info className="w-4 h-4 text-blue-400 cursor-pointer inline" />
      <span className="absolute left-1/2 -translate-x-1/2 mt-2 max-w-xs w-max bg-white border border-gray-300 rounded shadow-lg text-xs text-gray-700 p-2 opacity-0 group-hover:opacity-100 pointer-events-none z-10 whitespace-normal text-left">
        {text}
      </span>
    </span>
  );
}

export default function VendorJobs() {
  const [jobs, setJobs] = useState(mockJobs);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [location, setLocation] = useState('');
  const [showConsent, setShowConsent] = useState(false);
  const [consentStatus, setConsentStatus] = useState('pending');
  const [showCustomerPage, setShowCustomerPage] = useState(false);
  const [customerAgreed, setCustomerAgreed] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [employees] = useState(mockEmployees);
  const [assignedEmployees, setAssignedEmployees] = useState([]);
  const [currentUploader, setCurrentUploader] = useState('');
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [newJob, setNewJob] = useState({ title: '', client: '', phone: '', email: '' });
  const [geoError, setGeoError] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  // Add state for consent status for customer options
  const [customerConsentStatus, setCustomerConsentStatus] = useState<'idle' | 'pending' | 'granted'>('idle');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [search, setSearch] = useState('');
  const [detailsJob, setDetailsJob] = useState(null);
  const [editAssigned, setEditAssigned] = useState([]);
  const [showHelp, setShowHelp] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<number[]>([]);
  const [jobNotes, setJobNotes] = useState<Record<number, {id:number, text:string, author:string, date:string}[]>>({});
  const noteInputRef = useRef<HTMLInputElement>(null);
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number|null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const currentUser = 'You'; // TODO: Replace with real user info
  const [dragActive, setDragActive] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<number[]>([]);

  // Filter, sort, and search jobs
  let filteredJobs = jobs.filter(job =>
    (statusFilter === 'all' || job.status === statusFilter) &&
    (job.title.toLowerCase().includes(search.toLowerCase()) || job.client.toLowerCase().includes(search.toLowerCase()))
  );
  if (sortBy === 'title') filteredJobs.sort((a, b) => a.title.localeCompare(b.title));
  else if (sortBy === 'client') filteredJobs.sort((a, b) => a.client.localeCompare(b.client));
  else filteredJobs.sort((a, b) => a.id - b.id); // assuming id is by creation order

  // Move pagination variables after filteredJobs
  const JOBS_PER_PAGE = 5;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(filteredJobs.length / JOBS_PER_PAGE);
  const paginatedJobs = filteredJobs.slice((currentPage - 1) * JOBS_PER_PAGE, currentPage * JOBS_PER_PAGE);

  const allJobIds = filteredJobs.map(j => j.id);
  const allSelected = selectedJobIds.length === filteredJobs.length && filteredJobs.length > 0;
  const toggleSelectAll = () => setSelectedJobIds(allSelected ? [] : allJobIds);
  const toggleSelectJob = (id: number) => setSelectedJobIds(ids => ids.includes(id) ? ids.filter(jid => jid !== id) : [...ids, id]);
  const clearSelection = () => setSelectedJobIds([]);
  // Bulk action handlers (mock)
  const handleBulkStatus = (status: string) => {
    setJobs(jobs => jobs.map(j => selectedJobIds.includes(j.id) ? { ...j, status, audit: [...(j.audit || []), `Bulk status changed to ${status} on ${new Date().toLocaleString()}`] } : j));
    clearSelection();
    // TODO: Integrate with backend bulk status update endpoint
  };
  const handleBulkDelete = () => {
    if (!window.confirm('Are you sure you want to delete the selected jobs? This cannot be undone.')) return;
    setJobs(jobs => jobs.filter(j => !selectedJobIds.includes(j.id)));
    clearSelection();
    // TODO: Integrate with backend bulk delete endpoint
  };

  // When opening details modal, set editAssigned to current assigned employees
  const handleOpenDetails = (job) => {
    setDetailsJob(job);
    setEditAssigned(job.assignedEmployees || []);
  };

  // Handle assignment changes
  const handleAssignChange = (e) => {
    const value = e.target.value;
    setEditAssigned(prev =>
      prev.includes(value)
        ? prev.filter(emp => emp !== value)
        : [...prev, value]
    );
  };

  const handleSaveAssignments = () => {
    setJobs(jobs => jobs.map(j =>
      j.id === detailsJob.id
        ? {
            ...j,
            assignedEmployees: editAssigned,
            audit: [...(j.audit || []), `Assigned employees updated: ${editAssigned.join(', ')} on ${new Date().toLocaleString()}`]
          }
        : j
    ));
    setDetailsJob(j => ({ ...j, assignedEmployees: editAssigned }));
  };

  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'pending-review', label: 'Pending Review' },
    { value: 'completed', label: 'Completed' },
    { value: 'rejected', label: 'Rejected' },
  ];
  const sortOptions = [
    { value: 'date', label: 'Date Created' },
    { value: 'title', label: 'Job Title' },
    { value: 'client', label: 'Client Name' },
  ];

  const handleCreateVideo = (job) => {
    setSelectedJob(job);
    setShowModal(true);
    setLocation('');
    setShowConsent(false);
    setConsentStatus('pending');
    setShowCustomerPage(false);
    setCustomerAgreed(false);
    setUploadedMedia(null);
    setUploadSuccess(false);
    setShowAudit(false);
  };

  const handleContinue = () => {
    setShowModal(false);
    if (location === 'business') {
      setShowConsent(true);
      setConsentStatus('granted');
    } else {
      setShowConsent(true);
      setConsentStatus('pending');
    }
  };

  const handleSimulateConsent = (granted) => {
    setConsentStatus(granted ? 'granted' : 'declined');
  };

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file && currentUploader) {
      setJobs(jobs => jobs.map(j =>
        j.id === selectedJob.id
          ? {
              ...j,
              media: [
                ...(j.media || []),
                {
                  url: URL.createObjectURL(file),
                  employee: currentUploader,
                  status: 'pending-approval',
                  uploadedAt: new Date().toLocaleString(),
                  type: file.type.startsWith('video') ? 'video' : 'photo',
                }
              ],
              audit: [...(j.audit || []), `Media uploaded by ${currentUploader} on ${new Date().toLocaleString()}`]
            }
          : j
      ));
      setUploadSuccess(true);
      setCurrentUploader('');
    }
  };

  const handleSubmitForReview = () => {
    setJobs(jobs => jobs.map(j =>
      j.id === selectedJob.id
        ? { ...j, status: 'pending-review', audit: [...(j.audit || []), `Submitted for review on ${new Date().toLocaleString()} by: ${assignedEmployees.join(', ')}`], assignedEmployees }
        : j
    ));
    setUploadSuccess(false);
  };

  const handleReplaceMedia = () => {
    setUploadedMedia(null);
    setUploadSuccess(false);
  };

  const handleDeleteMedia = () => {
    setUploadedMedia(null);
    setUploadSuccess(false);
    setJobs(jobs => jobs.map(j =>
      j.id === selectedJob.id
        ? { ...j, audit: [...(j.audit || []), `Media deleted on ${new Date().toLocaleString()}`] }
        : j
    ));
  };

  const handleCreateJob = () => {
    setJobs(jobs => [
      ...jobs,
      {
        id: jobs.length + 1,
        title: newJob.title,
        client: newJob.client,
        phone: newJob.phone,
        email: newJob.email,
        status: 'pending',
        consent: null,
        media: [],
        audit: [],
      },
    ]);
    setShowCreateJob(false);
    setNewJob({ title: '', client: '', phone: '', email: '' });
  };

  const handleGeoLocationCheck = () => {
    setGeoError('');
    setGeoLoading(true);
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      setGeoLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        // Mock backend validation
        const dist = getDistanceMeters(latitude, longitude, BUSINESS_ADDRESS.lat, BUSINESS_ADDRESS.lng);
        if (dist <= LOCATION_RADIUS_METERS) {
          setGeoError('');
          setGeoLoading(false);
          // Allow video creation
          setShowConsent(true);
          setConsentStatus('granted');
        } else {
          setGeoError('Your location could not be verified as the business address. Please try again at the correct location or contact support.');
          setGeoLoading(false);
        }
      },
      (err) => {
        setGeoError('Unable to retrieve your location. Please enable location services and try again.');
        setGeoLoading(false);
      }
    );
  };

  const handleRequestCustomerConsent = () => {
    setCustomerConsentStatus('pending');
    // Simulate backend call to send consent link
    setTimeout(() => setCustomerConsentStatus('granted'), 3000); // Simulate consent after 3s
  };

  // Add note handlers
  const handleAddNote = (jobId:number) => {
    if (!newNote.trim()) return;
    setJobNotes(notes => ({
      ...notes,
      [jobId]: [
        { id: Date.now(), text: newNote, author: currentUser, date: new Date().toLocaleString() },
        ...(notes[jobId] || [])
      ]
    }));
    setNewNote('');
    // TODO: Integrate with backend
  };
  const handleDeleteNote = (jobId:number, noteId:number) => {
    setJobNotes(notes => ({
      ...notes,
      [jobId]: (notes[jobId] || []).filter(n => n.id !== noteId)
    }));
    // TODO: Integrate with backend
  };
  const handleEditNote = (jobId:number, noteId:number) => {
    setEditingNoteId(noteId);
    const note = (jobNotes[jobId] || []).find(n => n.id === noteId);
    setEditingNoteText(note?.text || '');
  };
  const handleSaveEditNote = (jobId:number, noteId:number) => {
    setJobNotes(notes => ({
      ...notes,
      [jobId]: (notes[jobId] || []).map(n => n.id === noteId ? { ...n, text: editingNoteText } : n)
    }));
    setEditingNoteId(null);
    setEditingNoteText('');
    // TODO: Integrate with backend
  };

  // Drag-and-drop handlers
  const handleDragOver = (e) => { e.preventDefault(); setDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setDragActive(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (!detailsJob) return;
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => handleUploadFile(file, detailsJob));
  };
  const handleUploadFile = (file, job) => {
    setJobs(jobs => jobs.map(j =>
      j.id === job.id
        ? {
            ...j,
            media: [
              ...(j.media || []),
              {
                url: URL.createObjectURL(file),
                name: file.name,
                type: file.type,
                uploadedAt: new Date().toLocaleString(),
                id: Date.now() + Math.random(),
              }
            ],
            audit: [...(j.audit || []), `Media uploaded: ${file.name} (${file.type}) on ${new Date().toLocaleString()}`]
          }
        : j
    ));
    // TODO: Integrate with backend
  };
  const handleBatchDeleteMedia = () => {
    if (!detailsJob) return;
    setJobs(jobs => jobs.map(j =>
      j.id === detailsJob.id
        ? {
            ...j,
            media: (j.media || []).filter(m => !selectedMedia.includes(m.id)),
            audit: [...(j.audit || []), `Batch media deleted: ${selectedMedia.length} files on ${new Date().toLocaleString()}`]
          }
        : j
    ));
    setSelectedMedia([]);
    // TODO: Integrate with backend
  };
  const handleBatchDownloadMedia = () => {
    if (!detailsJob) return;
    (detailsJob.media || []).filter(m => selectedMedia.includes(m.id)).forEach(m => {
      const a = document.createElement('a');
      a.href = m.url;
      a.download = m.name || 'file';
      a.click();
    });
  };
  const toggleSelectMedia = (id) => setSelectedMedia(sel => sel.includes(id) ? sel.filter(mid => mid !== id) : [...sel, id]);
  const clearMediaSelection = () => setSelectedMedia([]);

  return (
    <div className="px-4 md:px-8 py-8">
      {/* Onboarding Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4 flex items-center gap-3 mb-4">
        <Info className="w-5 h-5 text-blue-500" />
        <span className="text-blue-900 text-sm">
          Welcome! Here you can manage all your jobs. Click <b>Create Job</b> to add a new job, or use the <b>Create Service Video</b> button to upload progress for a job. Hover over any <Info className="inline w-4 h-4 align-text-bottom text-blue-400" /> for more details.
        </span>
      </div>
      <div className="flex items-center gap-4 mb-6 justify-between">
        <div className="flex items-center gap-4">
          <Link href="/vendor">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h2 className="text-2xl font-bold">Manage Jobs</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowHelp(true)}>Help & FAQ</Button>
      </div>
      <Dialog open={showCreateJob} onOpenChange={setShowCreateJob}>
        <DialogContent className="w-full max-w-md p-6">
          <DialogTitle>Create New Job</DialogTitle>
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleCreateJob(); }}>
            <div>
              <label className="block text-sm font-medium mb-1">Job Title</label>
              <Input value={newJob.title} onChange={e => setNewJob({ ...newJob, title: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Client Name</label>
              <Input value={newJob.client} onChange={e => setNewJob({ ...newJob, client: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Client Phone</label>
              <Input value={newJob.phone} onChange={e => setNewJob({ ...newJob, phone: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Client Email</label>
              <Input type="email" value={newJob.email} onChange={e => setNewJob({ ...newJob, email: e.target.value })} required />
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" type="button" onClick={() => setShowCreateJob(false)}>Cancel</Button>
              <Button type="submit">Create Job</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="w-full max-w-lg p-6">
          <DialogTitle>Manage Jobs – Help & FAQ</DialogTitle>
          <ul className="mt-4 space-y-3 text-sm text-gray-700">
            <li><b>How do I assign employees to a job?</b><br />Open the job details (View Details), then use the checkboxes under "Edit Assignments" to add or remove employees. Click "Save Assignments" to update.</li>
            <li><b>How do I upload a service video?</b><br />Click "Create Service Video" on a job card and follow the prompts. You may need to verify your location or request customer consent depending on the recording location.</li>
            <li><b>What do the job statuses mean?</b><br />Badges and the progress bar show if a job is pending, in progress, pending review, completed, or rejected. Hover over the status badge for more info.</li>
            <li><b>How do I add or remove employees?</b><br />Go to the Employees section in the sidebar to manage your team.</li>
            <li><b>How do I see the audit trail?</b><br />Open job details and scroll to the Audit Trail section to see all actions and changes for the job.</li>
            <li><b>Need more help?</b><br />Contact support via the Support link in the sidebar.</li>
          </ul>
        </DialogContent>
      </Dialog>
      {/* Bulk Actions Bar */}
      {selectedJobIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white border shadow-lg rounded px-6 py-3 flex gap-4 items-center z-50">
          <span className="font-medium text-sm">{selectedJobIds.length} selected</span>
          <Button size="sm" variant="outline" onClick={() => handleBulkStatus('completed')}>Mark Completed</Button>
          <Button size="sm" variant="outline" onClick={() => handleBulkStatus('pending')}>Mark Pending</Button>
          <Button size="sm" variant="outline" onClick={handleBulkDelete} className="text-red-600">Delete</Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
        </div>
      )}
      {/* Export Buttons above job list header */}
      <div className="flex flex-wrap gap-4 items-end mb-4 justify-between">
        <div className="flex gap-2 items-end">
          <Button size="sm" variant="outline" onClick={() => exportJobsToCSV(selectedJobIds.length > 0 ? jobs.filter(j => selectedJobIds.includes(j.id)) : jobs)}>
            Export {selectedJobIds.length > 0 ? 'Selected' : 'All'} as CSV
          </Button>
          <Button size="sm" variant="outline" disabled>
            Export as PDF (Coming Soon)
          </Button>
          {/* TODO: Implement PDF export and backend export integration */}
          <div>
            <label className="block text-xs font-medium mb-1">Status</label>
            <select className="border rounded px-2 py-1 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Sort By</label>
            <select className="border rounded px-2 py-1 text-sm min-w-[140px] pr-6" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              {sortOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Search</label>
            <Input className="max-w-xs" placeholder="Job title or client" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
            <span className="text-xs">Select All</span>
          </div>
        </div>
        <Button onClick={() => setShowCreateJob(true)} className="h-10">Create Job</Button>
      </div>
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 my-4">
          <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>Prev</Button>
          <span className="text-sm">Page {currentPage} of {totalPages}</span>
          <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>Next</Button>
        </div>
      )}
      {paginatedJobs.map((job) => (
        <Card key={job.id} className="mb-6">
          <CardHeader className="flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={selectedJobIds.includes(job.id)} onChange={() => toggleSelectJob(job.id)} />
                <CardTitle>{job.title}</CardTitle>
              </div>
              <JobProgress status={job.status} />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => handleCreateVideo(job)}>
                Create Service Video
                <span className="relative group ml-1">
                  <Info className="w-4 h-4 text-blue-400 cursor-pointer" />
                  <span className="absolute left-1/2 -translate-x-1/2 mt-2 max-w-xs w-max bg-white border border-gray-300 rounded shadow-lg text-xs text-gray-700 p-2 opacity-0 group-hover:opacity-100 pointer-events-none z-10 whitespace-normal text-left">
                    Upload or record a video to document your work for this job. Videos help with transparency and faster approvals.
                  </span>
                </span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleOpenDetails(job)}>
                View Details
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-gray-700 mb-2">Client: {job.client}</div>
            <div className="text-xs text-gray-500 mb-2 flex items-center gap-2">
              Status:
              <StatusBadge status={job.status} />
              <span className="relative group">
                <Info className="w-3 h-3 text-blue-400 cursor-pointer" />
                <span className="absolute left-1/2 -translate-x-1/2 mt-2 max-w-xs w-max bg-white border border-gray-300 rounded shadow-lg text-xs text-gray-700 p-2 opacity-0 group-hover:opacity-100 pointer-events-none z-10 whitespace-normal text-left">
                  Shows the current status of this job. Status updates help keep everyone informed.
                </span>
              </span>
            </div>
            {job.assignedEmployees && job.assignedEmployees.length > 0 && (
              <div className="text-xs text-gray-700 mb-2">Assigned: {job.assignedEmployees.join(', ')}</div>
            )}
            <div className="flex items-center gap-2 mb-2">
              <Button size="sm" variant="outline" onClick={() => setShowAudit(a => !a)}>{showAudit ? 'Hide' : 'Show'} Audit Trail</Button>
              <span className="relative group">
                <Info className="w-3 h-3 text-blue-400 cursor-pointer" />
                <span className="absolute left-1/2 -translate-x-1/2 mt-2 max-w-xs w-max bg-white border border-gray-300 rounded shadow-lg text-xs text-gray-700 p-2 opacity-0 group-hover:opacity-100 pointer-events-none z-10 whitespace-normal text-left">
                  View a detailed log of all actions and changes for this job.
                </span>
              </span>
            </div>
            {showAudit && (
              <ul className="text-xs text-gray-600 mb-2">
                {(job.audit || []).length === 0 && <li>No history yet.</li>}
                {(job.audit || []).map((entry, i) => <li key={i}>• {entry}</li>)}
              </ul>
            )}
            {job.media && job.media.length > 0 && (
              <div className="mb-2">
                <div className="font-semibold text-xs mb-1">Uploaded Media (Pending Approval):</div>
                <div className="flex flex-col gap-2">
                  {job.media.map((m, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-gray-100 rounded p-2">
                      {m.type === 'video' ? (
                        <video src={m.url} controls className="w-24 h-16 rounded" />
                      ) : (
                        <img src={m.url} alt="Uploaded" className="w-16 h-16 rounded object-cover" />
                      )}
                      <div className="flex-1">
                        <div className="text-xs">By: {m.employee}</div>
                        <div className="text-xs text-gray-500">{m.uploadedAt}</div>
                        <div className="text-xs text-yellow-700">Status: {m.status.replace('-', ' ')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Status and actions */}
            {selectedJob && selectedJob.id === job.id && showModal && (
              <Dialog open onOpenChange={() => setShowModal(false)}>
                <DialogContent className="w-full max-w-xs sm:max-w-md p-4 space-y-4 overflow-y-auto max-h-[90vh]">
                  <DialogTitle>Create Service Video</DialogTitle>
                  {location === 'business' && !showConsent && (
                    <div className="my-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
                      <div className="mb-2 text-sm text-gray-700">
                        <b>Location Verification Required</b><br />
                        To protect our users and prevent fraud, we need to verify you are at the registered business address. Please enable location access below.
                      </div>
                      <div className="mb-2 text-xs text-gray-500">
                        <b>Legal Notice:</b> By proceeding, you confirm you are present at the business address. Falsifying your location may result in account suspension and legal action. Your location and device info will be logged for compliance and security.
                      </div>
                      <Button onClick={handleGeoLocationCheck} disabled={geoLoading}>
                        {geoLoading ? 'Verifying Location...' : 'Verify My Location'}
                      </Button>
                      {geoError && <div className="mt-2 text-xs text-red-600">{geoError}</div>}
                    </div>
                  )}
                  {location === 'residence' && (
                    <div className="my-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
                      <div className="mb-2 text-sm text-gray-700">
                        <b>Customer Consent Required</b><br />
                        To protect our users, you must obtain explicit consent from the customer before recording a service video at their residence. The customer will receive a secure link to review and agree to the terms of service and privacy policy before you can proceed.
                      </div>
                      <div className="mb-2 text-xs text-gray-500">
                        <b>Legal Notice:</b> By proceeding, you confirm you have informed the customer and will only record after receiving their consent. All actions will be logged for compliance and security.
                      </div>
                      <Button onClick={handleRequestCustomerConsent} disabled={customerConsentStatus === 'pending' || customerConsentStatus === 'granted'}>
                        Request Customer Consent
                      </Button>
                      {customerConsentStatus === 'pending' && <div className="mt-2 text-xs text-blue-600">Waiting for customer consent…</div>}
                      {customerConsentStatus === 'granted' && <div className="mt-2 text-xs text-green-600">Consent received. You may proceed.</div>}
                    </div>
                  )}
                  {location === 'customer-business' && (
                    <div className="my-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
                      <div className="mb-2 text-sm text-gray-700">
                        <b>Customer Consent & Location Verification</b><br />
                        Recording at a customer’s business address requires both customer consent and location verification. The customer will receive a secure link to review and agree to the terms before you can proceed. You may also be asked to enable location access to confirm you are at the correct address.
                      </div>
                      <div className="mb-2 text-xs text-gray-500">
                        <b>Legal Notice:</b> By proceeding, you confirm you have informed the customer and will only record after receiving their consent. Your location and device info may be logged for compliance and security.
                      </div>
                      <Button onClick={handleRequestCustomerConsent} disabled={customerConsentStatus === 'pending' || customerConsentStatus === 'granted'}>
                        Request Customer Consent
                      </Button>
                      {customerConsentStatus === 'pending' && <div className="mt-2 text-xs text-blue-600">Waiting for customer consent…</div>}
                      {customerConsentStatus === 'granted' && <div className="mt-2 text-xs text-green-600">Consent received. You may proceed.</div>}
                    </div>
                  )}
                  <div>Where are you recording from?</div>
                  <div className="space-y-2 mt-2">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="location" value="business" checked={location === 'business'} onChange={() => setLocation('business')} />
                      My Physical Business Address
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="location" value="residence" checked={location === 'residence'} onChange={() => setLocation('residence')} />
                      Customer Residence Address
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="location" value="customer-business" checked={location === 'customer-business'} onChange={() => setLocation('customer-business')} />
                      Customer Business Address
                    </label>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                    <Button onClick={handleContinue} disabled={!location}>Continue</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {selectedJob && selectedJob.id === job.id && showConsent && (
              <div className="mt-4">
                {location === 'business' && consentStatus === 'granted' && (
                  <>
                    <div className="mb-2 text-green-700">Customer will be notified and can view the consent page.</div>
                    <Button variant="outline" className="mb-2" onClick={() => setShowCustomerPage(true)}>View as Customer</Button>
                    {uploadedMedia ? (
                      <div className="mt-2">
                        <video src={uploadedMedia} controls className="w-full max-w-xs" />
                        {uploadSuccess && <div className="text-green-700 text-sm mt-2">Upload successful!</div>}
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="outline" onClick={handleReplaceMedia}>Replace</Button>
                          <Button size="sm" variant="destructive" onClick={handleDeleteMedia}>Delete</Button>
                          <Button size="sm" onClick={handleSubmitForReview}>Submit for Review</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <input type="file" accept="video/*,image/*" capture className="mb-2" onChange={handleUpload} />
                        <div className="text-xs text-gray-500">Upload a video or photo from your device.</div>
                      </div>
                    )}
                  </>
                )}
                {(location === 'customer-residence' || location === 'customer-business') && consentStatus === 'pending' && (
                  <>
                    <div className="mb-2 text-yellow-700">Waiting for customer consent...</div>
                    <div className="flex gap-2 mb-2">
                      <Button size="sm" variant="outline" onClick={() => handleSimulateConsent(true)}>Simulate Consent Granted</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleSimulateConsent(false)}>Simulate Consent Declined</Button>
                    </div>
                  </>
                )}
                {(location === 'customer-residence' || location === 'customer-business') && consentStatus === 'granted' && (
                  <>
                    <div className="mb-2 text-green-700">Consent granted! You may now upload your service video or photo.</div>
                    <Button variant="outline" className="mb-2" onClick={() => setShowCustomerPage(true)}>View as Customer</Button>
                    {uploadedMedia ? (
                      <div className="mt-2">
                        <video src={uploadedMedia} controls className="w-full max-w-xs" />
                        {uploadSuccess && <div className="text-green-700 text-sm mt-2">Upload successful!</div>}
                        <div className="mt-2">
                          <label className="block text-sm font-medium mb-1">Who is uploading this media?</label>
                          <select
                            className="border rounded px-2 py-1 w-full mb-2"
                            value={currentUploader}
                            onChange={e => setCurrentUploader(e.target.value)}
                          >
                            <option value="">Select employee</option>
                            {employees.map(emp => (
                              <option key={emp.id} value={emp.name}>{emp.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="outline" onClick={handleReplaceMedia}>Replace</Button>
                          <Button size="sm" variant="destructive" onClick={handleDeleteMedia}>Delete</Button>
                          <Button size="sm" onClick={handleSubmitForReview}>Submit for Review</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <input type="file" accept="video/*,image/*" capture className="mb-2" onChange={handleUpload} />
                        <div className="text-xs text-gray-500">Upload a video or photo from your device.</div>
                      </div>
                    )}
                  </>
                )}
                {(location === 'customer-residence' || location === 'customer-business') && consentStatus === 'declined' && (
                  <div className="mb-2 text-red-700">Consent declined. Cannot record service video. Contact customer for more info.</div>
                )}
              </div>
            )}
            {showCustomerPage && (
              <Dialog open onOpenChange={() => setShowCustomerPage(false)}>
                <DialogContent className="w-full max-w-xs sm:max-w-md p-4 space-y-4 overflow-y-auto max-h-[90vh]">
                  <DialogTitle>Service Video Consent</DialogTitle>
                  <div className="mb-2">Thank you for choosing to view your service video from Reliance. Before accessing the video, please read and agree to our Terms of Service.</div>
                  <label className="flex items-center gap-2 mb-2">
                    <input type="checkbox" checked={customerAgreed} onChange={e => setCustomerAgreed(e.target.checked)} />
                    I have read and agree to the Terms of Service, including the 3-Day Default Review System.
                  </label>
                  <div className="flex gap-2">
                    <Button disabled={!customerAgreed} onClick={() => setShowCustomerPage(false)}>Proceed to Video</Button>
                    <Button variant="outline">Watch Reliance Intro Video</Button>
                  </div>
                  <div className="mt-4 text-xs text-gray-500">Interested in more features? <a href="#" className="underline">Register with Reliance</a></div>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>
      ))}
      {/* Job Details Modal (add media gallery above timeline) */}
      <Dialog open={!!detailsJob} onOpenChange={() => setDetailsJob(null)}>
        <DialogContent className="w-full max-w-2xl p-6" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
          <DialogTitle>Job Details</DialogTitle>
          {/* Media Gallery */}
          <div className="mt-2 mb-6">
            <h3 className="font-semibold mb-2 flex items-center">Media Gallery<InfoTooltip text="Upload and manage files (images, videos, documents) related to this job. Drag and drop or use the upload button below." /></h3>
            <div
              className={`border-2 border-dashed rounded p-4 mb-2 ${dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="text-xs text-gray-500 mb-2">Drag and drop files here, or use the upload button below.</div>
              <input type="file" multiple className="mb-2" onChange={e => {
                if (!detailsJob) return;
                Array.from(e.target.files).forEach(file => handleUploadFile(file, detailsJob));
              }} />
              {selectedMedia.length > 0 && (
                <div className="flex gap-2 mb-2">
                  <Button size="xs" variant="outline" onClick={handleBatchDownloadMedia}>Download Selected</Button>
                  <Button size="xs" variant="outline" onClick={handleBatchDeleteMedia} className="text-red-600">Delete Selected</Button>
                  <Button size="xs" variant="ghost" onClick={clearMediaSelection}>Clear</Button>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                {(detailsJob?.media || []).length === 0 && <div className="text-xs text-gray-400 col-span-4">No media uploaded yet.</div>}
                {(detailsJob?.media || []).map(m => (
                  <div key={m.id} className={`border rounded p-2 flex flex-col items-center relative ${selectedMedia.includes(m.id) ? 'ring-2 ring-blue-400' : ''}`}> 
                    <input type="checkbox" className="absolute top-1 left-1" checked={selectedMedia.includes(m.id)} onChange={() => toggleSelectMedia(m.id)} />
                    <FileTypeIcon type={m.type} />
                    {m.type.startsWith('image') ? (
                      <img src={m.url} alt={m.name} className="w-16 h-16 object-cover rounded mb-1" />
                    ) : m.type.startsWith('video') ? (
                      <video src={m.url} controls className="w-16 h-16 rounded mb-1" />
                    ) : (
                      <span className="text-xs text-gray-500 mb-1">{m.name}</span>
                    )}
                    <span className="text-xs text-gray-400 truncate w-full">{m.name}</span>
                    <span className="text-[10px] text-gray-300">{m.uploadedAt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Main job info */}
          <div className="mb-6">
            <div className="flex flex-wrap gap-8">
              <div>
                <div className="font-bold text-lg flex items-center">{detailsJob?.title} <StatusBadge status={detailsJob?.status} /></div>
                <JobProgress status={detailsJob?.status} />
                <div className="mt-2 text-sm"><b>Client:</b> {detailsJob?.client}</div>
                <div className="mt-2 text-sm flex items-center"><b>Assigned Employees:</b><InfoTooltip text="Employees currently assigned to this job." /></div>
                <div className="flex gap-2 mt-1 mb-2">
                  {(detailsJob?.assignedEmployees || []).map(emp => <span key={emp} className="bg-gray-100 rounded px-2 py-1 text-xs flex items-center"><img src={employees.find(e => e.name === emp)?.photo} alt={emp} className="w-5 h-5 rounded-full mr-1" />{emp}</span>)}
                </div>
                <div className="text-sm flex items-center"><b>Edit Assignments:</b><InfoTooltip text="Check or uncheck employees to assign or remove them from this job. Click 'Save Assignments' to apply changes." /></div>
                <div className="flex flex-col gap-1 mb-2">
                  {employees.map(emp => (
                    <label key={emp.id} className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={editAssigned.includes(emp.name)} onChange={handleAssignChange} value={emp.name} />
                      <img src={emp.photo} alt={emp.name} className="w-5 h-5 rounded-full" />{emp.name}
                    </label>
                  ))}
                </div>
                <Button size="sm" onClick={handleSaveAssignments} className="mb-2">Save Assignments</Button>
                <div className="text-sm flex items-center"><b>Consent Status:</b><InfoTooltip text="Shows if customer consent is required and whether it has been granted for this job." /></div>
                <div className="text-xs mb-2">{detailsJob?.consent || 'N/A'}</div>
                <div className="text-sm"><b>Created:</b> Job #{detailsJob?.id}</div>
              </div>
              <div>
                <div className="font-bold text-md mb-1 flex items-center">Media Gallery<InfoTooltip text="Quick view of all files uploaded for this job." /></div>
                <div className="text-xs text-gray-400">No media uploaded.</div>
              </div>
            </div>
          </div>
          {/* Audit Trail */}
          <div className="mt-6">
            <h3 className="font-semibold mb-2 flex items-center">Audit Trail<InfoTooltip text="A log of all important actions and changes made to this job." /></h3>
            <ul className="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto border rounded p-2 bg-gray-50">
              {(detailsJob?.audit && detailsJob.audit.length > 0)
                ? detailsJob.audit.map((a, i) => <li key={i}>• {a}</li>)
                : <li>No history yet.</li>}
            </ul>
          </div>
          {/* Activity Timeline */}
          <div className="mt-6">
            <h3 className="font-semibold mb-2 flex items-center">Activity Timeline<InfoTooltip text="Visual timeline of all job-related events and actions." /></h3>
            <div className="border-l-2 border-gray-200 pl-4 space-y-3">
              {(detailsJob?.audit || []).length === 0 && <div className="text-xs text-gray-400">No activity yet.</div>}
              {(detailsJob?.audit || []).map((entry, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <TimelineIcon type={entry.toLowerCase()} />
                  <span className="text-xs text-gray-700">{entry}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Job Notes Section */}
          <div className="mt-6">
            <h3 className="font-semibold mb-2 flex items-center">Job Notes<InfoTooltip text="Add private notes or comments about this job. Only visible to your team." /></h3>
            <div className="space-y-2 mb-2">
              {(jobNotes[detailsJob?.id] || []).length === 0 && <div className="text-xs text-gray-400">No notes yet.</div>}
              {(jobNotes[detailsJob?.id] || []).map(note => (
                <div key={note.id} className="flex items-start gap-2 bg-gray-50 rounded p-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs text-blue-700">{note.author}</span>
                      <span className="text-xs text-gray-400">{note.date}</span>
                    </div>
                    {editingNoteId === note.id ? (
                      <div className="flex gap-2 mt-1">
                        <input className="border rounded px-2 py-1 text-xs flex-1" value={editingNoteText} onChange={e => setEditingNoteText(e.target.value)} />
                        <Button size="xs" onClick={() => handleSaveEditNote(detailsJob.id, note.id)}>Save</Button>
                        <Button size="xs" variant="ghost" onClick={() => setEditingNoteId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="text-xs mt-1">{note.text}</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {note.author === currentUser && editingNoteId !== note.id && (
                      <>
                        <Button size="xs" variant="ghost" onClick={() => handleEditNote(detailsJob.id, note.id)}>Edit</Button>
                        <Button size="xs" variant="ghost" onClick={() => handleDeleteNote(detailsJob.id, note.id)}>Delete</Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={e => { e.preventDefault(); handleAddNote(detailsJob.id); }}>
              <input ref={noteInputRef} className="border rounded px-2 py-1 text-xs flex-1" placeholder="Add a note..." value={newNote} onChange={e => setNewNote(e.target.value)} />
              <Button size="sm" type="submit">Add</Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
      {/* Backend Developer Notes Section */}
      <div className="mt-10">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded shadow-sm">
          <h3 className="font-bold text-yellow-800 mb-2">Backend Developer Notes</h3>
          <ul className="text-sm text-yellow-900 list-disc pl-5 space-y-1">
            <li>Fetch jobs for this vendor from <b>GET /api/vendor/jobs</b></li>
            <li>When creating a job, <b>POST</b> to <b>/api/vendor/jobs</b> with job title, client name, phone, email, etc.</li>
            <li>When uploading media, <b>POST</b> to <b>/api/vendor/jobs/:jobId/media</b></li>
            <li>Consent requests should trigger notifications to client (email/SMS) via backend</li>
            <li>Job status, audit trail, and assigned employees should be persisted in the backend</li>
            <li>All actions (create, update, upload, approve, reject) should be logged for audit</li>
            <li>Use vendor authentication/authorization for all API calls</li>
            <li>When vendor selects 'At business address', <b>POST</b> geo-coordinates to <b>/api/vendor/validate-location</b> with jobId and expected address. Log all attempts (success/failure, coordinates, IP, timestamp).</li>
            <li>Store legal consent text and metadata for each service video creation attempt.</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 