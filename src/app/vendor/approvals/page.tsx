'use client';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Image } from 'lucide-react';
import Link from 'next/link';

// BACKEND DEVELOPER NOTES:
// - Fetch pending media for approval from GET /api/vendor/approvals or /api/vendor/jobs?status=pending-approval
// - Approve/reject media via POST /api/vendor/approvals/:mediaId/approve or /reject
// - Media URLs should be real file storage links (S3, etc.)
// - All actions should be logged in the audit trail
// - Approval should trigger notification to client (email/SMS) and update job status
// - Use vendor authentication/authorization for all API calls

// Mock jobs with media uploads - now with actual URLs
const mockJobs = [
  { id: 1, title: 'Water Heater Repair', media: [
    { 
      url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4', 
      employee: 'Maria Lopez', 
      status: 'pending-approval', 
      uploadedAt: '2024-06-10 10:00', 
      type: 'video',
      thumbnail: 'https://picsum.photos/200/150?random=1'
    },
    { 
      url: 'https://picsum.photos/400/300?random=2', 
      employee: 'James Lee', 
      status: 'pending-approval', 
      uploadedAt: '2024-06-10 10:05', 
      type: 'photo',
      thumbnail: 'https://picsum.photos/200/150?random=2'
    }
  ], audit: [] },
  { id: 2, title: 'AC Installation', media: [
    { 
      url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4', 
      employee: 'Chris Evans', 
      status: 'pending-approval', 
      uploadedAt: '2024-06-10 11:30', 
      type: 'video',
      thumbnail: 'https://picsum.photos/200/150?random=3'
    }
  ], audit: [] },
];

export default function PendingApprovals() {
  const [jobs, setJobs] = useState(mockJobs);
  const [selectedMedia, setSelectedMedia] = useState(null);

  const handleApprove = (jobId, idx) => {
    setJobs(jobs => jobs.map(j =>
      j.id === jobId
        ? {
            ...j,
            media: j.media.map((m, i) => i === idx ? { ...m, status: 'approved' } : m),
            audit: [...(j.audit || []), `Media approved by manager on ${new Date().toLocaleString()}`]
          }
        : j
    ));
  };
  
  const handleReject = (jobId, idx) => {
    setJobs(jobs => jobs.map(j =>
      j.id === jobId
        ? {
            ...j,
            media: j.media.map((m, i) => i === idx ? { ...m, status: 'rejected' } : m),
            audit: [...(j.audit || []), `Media rejected by manager on ${new Date().toLocaleString()}`]
          }
        : j
    ));
  };

  const openMediaViewer = (media) => {
    setSelectedMedia(media);
  };

  return (
    <div className="px-4 md:px-8 py-8 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/vendor">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <h2 className="text-2xl font-bold">Pending Approvals</h2>
      </div>
      
      {jobs.map(job => (
        <Card key={job.id} className="mb-6">
          <CardHeader>
            <CardTitle>{job.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {job.media && job.media.filter(m => m.status === 'pending-approval').length === 0 && (
              <div className="text-xs text-gray-500 mb-2">No pending uploads for this job.</div>
            )}
            {job.media && job.media.filter(m => m.status === 'pending-approval').map((m, idx) => (
              <div key={idx} className="flex items-center gap-4 bg-gray-50 rounded-lg p-4 mb-4 border">
                {/* Media Preview */}
                <div className="relative">
                  {m.type === 'video' ? (
                    <div className="relative w-32 h-24 bg-black rounded-lg overflow-hidden cursor-pointer" onClick={() => openMediaViewer(m)}>
                      <img src={m.thumbnail} alt="Video thumbnail" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Play className="w-8 h-8 text-white bg-black bg-opacity-50 rounded-full p-1" />
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-32 h-24 bg-gray-200 rounded-lg overflow-hidden cursor-pointer" onClick={() => openMediaViewer(m)}>
                      <img src={m.url} alt="Uploaded photo" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <Image className="w-6 h-6 text-white bg-black bg-opacity-50 rounded p-1" />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Media Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{m.employee}</span>
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-xs text-gray-500">{m.uploadedAt}</span>
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    {m.type === 'video' ? 'Video Upload' : 'Photo Upload'}
                  </div>
                  <div className="text-xs text-yellow-700 font-medium">Status: Pending Approval</div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => openMediaViewer(m)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    Review
                  </Button>
                  <Button 
                    size="sm" 
                    variant="default" 
                    onClick={() => handleApprove(job.id, idx)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    onClick={() => handleReject(job.id, idx)}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Media Viewer Modal */}
      {selectedMedia && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">
                Review: {selectedMedia.type === 'video' ? 'Video' : 'Photo'} by {selectedMedia.employee}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedMedia(null)}>✕</Button>
            </div>
            <div className="p-4">
              {selectedMedia.type === 'video' ? (
                <video 
                  src={selectedMedia.url} 
                  controls 
                  className="w-full max-h-[70vh] rounded"
                  poster={selectedMedia.thumbnail}
                />
              ) : (
                <img 
                  src={selectedMedia.url} 
                  alt="Review photo" 
                  className="w-full max-h-[70vh] object-contain rounded"
                />
              )}
              <div className="mt-4 text-sm text-gray-600">
                <p><strong>Employee:</strong> {selectedMedia.employee}</p>
                <p><strong>Uploaded:</strong> {selectedMedia.uploadedAt}</p>
                <p><strong>Type:</strong> {selectedMedia.type === 'video' ? 'Video' : 'Photo'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backend Developer Notes Section */}
      <div className="mt-10">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded shadow-sm">
          <h3 className="font-bold text-yellow-800 mb-2">Backend Developer Notes</h3>
          <ul className="text-sm text-yellow-900 list-disc pl-5 space-y-1">
            <li>Fetch pending media for approval from <b>GET /api/vendor/approvals</b> or <b>/api/vendor/jobs?status=pending-approval</b></li>
            <li>Approve/reject media via <b>POST /api/vendor/approvals/:mediaId/approve</b> or <b>/reject</b></li>
            <li>Media URLs should be real file storage links (S3, etc.)</li>
            <li>All actions should be logged in the audit trail</li>
            <li>Approval should trigger notification to client (email/SMS) and update job status</li>
            <li>Use vendor authentication/authorization for all API calls</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 