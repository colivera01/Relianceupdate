'use client';
import { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';

// BACKEND DEVELOPER NOTES:
// - Fetch jobs for this vendor from GET /api/vendor/jobs
// - When creating a job, POST to /api/vendor/jobs with job title, client name, phone, email, etc.
// - When uploading media, POST to /api/vendor/jobs/:jobId/media
// - Consent requests should trigger notifications to client (email/SMS) via backend
// - Job status, audit trail, and assigned employees should be persisted in the backend
// - All actions (create, update, upload, approve, reject) should be logged for audit
// - Use vendor authentication/authorization for all API calls

const mockJobs = [
  { id: 1, title: 'Water Heater Repair', client: 'John Smith', status: 'pending', consent: null, media: [], audit: [] },
  { id: 2, title: 'AC Installation', client: 'Jane Doe', status: 'pending', consent: null, media: [], audit: [] },
];

const mockEmployees = [
  { id: 1, name: "Maria Lopez", photo: "https://randomuser.me/api/portraits/women/44.jpg" },
  { id: 2, name: "James Lee", photo: "https://randomuser.me/api/portraits/men/45.jpg" }
];

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

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/vendor">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <h2 className="text-2xl font-bold">Manage Jobs</h2>
        <Button className="ml-auto" onClick={() => setShowCreateJob(true)}>
          + Create Job
        </Button>
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
      {jobs.map((job) => (
        <Card key={job.id} className="mb-6">
          <CardHeader className="flex justify-between items-center">
            <CardTitle>{job.title}</CardTitle>
            <Button onClick={() => handleCreateVideo(job)}>Create Service Video</Button>
          </CardHeader>
          <CardContent>
            <div className="text-gray-700 mb-2">Client: {job.client}</div>
            <div className="text-xs text-gray-500 mb-2">Status: {job.status === 'pending-review' ? 'Pending Review' : 'In Progress'}</div>
            {job.assignedEmployees && job.assignedEmployees.length > 0 && (
              <div className="text-xs text-gray-700 mb-2">Assigned: {job.assignedEmployees.join(', ')}</div>
            )}
            <Button size="sm" variant="outline" className="mb-2" onClick={() => setShowAudit(a => !a)}>{showAudit ? 'Hide' : 'Show'} Audit Trail</Button>
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
                  <div>Where are you recording from?</div>
                  <div className="space-y-2 mt-2">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="location" value="business" checked={location === 'business'} onChange={() => setLocation('business')} />
                      My Physical Business Address
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="location" value="customer-residence" checked={location === 'customer-residence'} onChange={() => setLocation('customer-residence')} />
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
          </ul>
        </div>
      </div>
    </div>
  );
} 