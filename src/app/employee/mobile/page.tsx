'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { 
  CheckCircle, 
  Clock, 
  MapPin, 
  Video, 
  Upload, 
  User, 
  Phone, 
  Mail, 
  Camera, 
  AlertTriangle,
  Shield,
  ArrowLeft,
  Play,
  Pause,
  Square,
  Mic,
  MicOff,
  Settings,
  LogOut
} from 'lucide-react';
import Link from 'next/link';

// BACKEND DEVELOPER NOTES:
// - GET /api/employee/jobs - Fetch jobs assigned to this employee
// - POST /api/employee/jobs/:jobId/accept - Accept a job assignment
// - POST /api/employee/jobs/:jobId/status - Update job status
// - POST /api/employee/jobs/:jobId/videos - Upload video for job
// - GET /api/employee/profile - Get employee profile and permissions
// - POST /api/employee/device/heartbeat - Send device status updates
// - All endpoints require employee authentication via paired device

type EmployeeJobVideo = {
  id: number;
  title: string;
  duration: number;
  uploadedAt: string;
  status: string;
};

type EmployeeJob = {
  id: number;
  title: string;
  client: string;
  phone: string;
  email: string;
  address: string;
  status: string;
  priority: string;
  estimatedDuration: string;
  assignedAt: string;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string;
  videos: EmployeeJobVideo[];
  managerNotes: string;
};

// Mock data for employee view
const mockEmployeeJobs: EmployeeJob[] = [
  {
    id: 1,
    title: 'Water Heater Repair',
    client: 'John Smith',
    phone: '(555) 123-4567',
    email: 'john@example.com',
    address: '123 Main St, Springfield, IL',
    status: 'assigned', // assigned, accepted, in-progress, completed
    priority: 'high',
    estimatedDuration: '2 hours',
    assignedAt: '2024-01-15 09:00',
    acceptedAt: null,
    startedAt: null,
    completedAt: null,
    notes: 'Customer requested morning appointment',
    videos: [],
    managerNotes: 'Check for gas leaks before starting work'
  },
  {
    id: 2,
    title: 'HVAC Maintenance',
    client: 'Sarah Wilson',
    phone: '(555) 987-6543',
    email: 'sarah@example.com',
    address: '456 Oak Ave, Springfield, IL',
    status: 'accepted',
    priority: 'medium',
    estimatedDuration: '1.5 hours',
    assignedAt: '2024-01-14 14:30',
    acceptedAt: '2024-01-14 15:00',
    startedAt: null,
    completedAt: null,
    notes: 'Annual maintenance check',
    videos: [],
    managerNotes: 'Focus on filter replacement and system efficiency'
  }
];

const mockEmployeeProfile = {
  id: 'emp-001',
  name: 'Mike Johnson',
  photo: 'https://randomuser.me/api/portraits/men/32.jpg',
  role: 'Technician',
  vendorId: 'vendor-001',
  vendorName: 'Tech Solutions Inc.',
  permissions: 'full-access',
  pairedAt: '2024-01-10',
  deviceId: 'device-001',
  isOnline: true
};

export default function EmployeeMobilePage() {
  const [jobs, setJobs] = useState<EmployeeJob[]>(mockEmployeeJobs);
  const [profile, setProfile] = useState(mockEmployeeProfile);
  const [selectedJob, setSelectedJob] = useState<EmployeeJob | null>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [showVideoRecording, setShowVideoRecording] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [recordingState, setRecordingState] = useState('idle'); // idle, recording, paused, processing
  const [recordingTime, setRecordingTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [filter, setFilter] = useState('all'); // all, assigned, accepted, in-progress, completed

  // Recording timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (recordingState === 'recording') {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval !== undefined) clearInterval(interval);
    };
  }, [recordingState]);

  const handleAcceptJob = (jobId: number) => {
    setJobs(jobs.map(job => 
      job.id === jobId 
        ? { ...job, status: 'accepted', acceptedAt: new Date().toISOString() }
        : job
    ));
    
    // Backend call: POST /api/employee/jobs/:jobId/accept
    console.log('Job accepted:', jobId);
  };

  const handleStartJob = (jobId: number) => {
    setJobs(jobs.map(job => 
      job.id === jobId 
        ? { ...job, status: 'in-progress', startedAt: new Date().toISOString() }
        : job
    ));
    
    // Backend call: POST /api/employee/jobs/:jobId/status
    console.log('Job started:', jobId);
  };

  const handleCompleteJob = (jobId: number) => {
    setJobs(jobs.map(job => 
      job.id === jobId 
        ? { ...job, status: 'completed', completedAt: new Date().toISOString() }
        : job
    ));
    
    // Backend call: POST /api/employee/jobs/:jobId/status
    console.log('Job completed:', jobId);
  };

  const handleStartRecording = () => {
    setRecordingState('recording');
    setRecordingTime(0);
    
    // Backend call: POST /api/employee/jobs/:jobId/videos/start
    console.log('Started recording for job:', selectedJob?.id);
  };

  const handlePauseRecording = () => {
    setRecordingState('paused');
    
    // Backend call: POST /api/employee/jobs/:jobId/videos/pause
    console.log('Paused recording for job:', selectedJob?.id);
  };

  const handleStopRecording = () => {
    setRecordingState('processing');
    
    // Simulate video processing
    setTimeout(() => {
      setRecordingState('idle');
      setRecordingTime(0);
      setShowVideoRecording(false);
      
      // Add video to job
      if (selectedJob) {
        const newVideo = {
          id: Date.now(),
          title: `Service Video - ${new Date().toLocaleString()}`,
          duration: recordingTime,
          uploadedAt: new Date().toISOString(),
          status: 'pending-approval'
        };
        
        setJobs(jobs.map(job => 
          job.id === selectedJob.id 
            ? { ...job, videos: [...job.videos, newVideo] }
            : job
        ));
      }
      
      // Backend call: POST /api/employee/jobs/:jobId/videos/upload
      console.log('Video uploaded for job:', selectedJob?.id);
    }, 2000);
  };

  const handleAddNote = (jobId: number) => {
    if (newNote.trim()) {
      setJobs(jobs.map(job => 
        job.id === jobId 
          ? { ...job, notes: job.notes + '\n' + newNote }
          : job
      ));
      setNewNote('');
      
      // Backend call: POST /api/employee/jobs/:jobId/notes
      console.log('Note added to job:', jobId);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredJobs = jobs.filter(job => 
    filter === 'all' || job.status === filter
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <img src={profile.photo} alt={profile.name} className="w-10 h-10 rounded-full" />
            <div>
              <h1 className="font-semibold text-gray-900">{profile.name}</h1>
              <p className="text-sm text-gray-600">{profile.role} • {profile.vendorName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${profile.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border-b">
        <div className="flex overflow-x-auto p-2 gap-2">
          {['all', 'assigned', 'accepted', 'in-progress', 'completed'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                filter === status 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs List */}
      <div className="p-4 space-y-4">
        {filteredJobs.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No jobs available</p>
          </div>
        ) : (
          filteredJobs.map(job => (
            <Card key={job.id} className="bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{job.title}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getStatusColor(job.status)}>
                        {job.status.replace('-', ' ')}
                      </Badge>
                      <Badge className={getPriorityColor(job.priority)}>
                        {job.priority}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedJob(job);
                      setShowJobDetails(true);
                    }}
                  >
                    View
                  </Button>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{job.client}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{job.address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{job.estimatedDuration}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4">
                  {job.status === 'assigned' && (
                    <Button 
                      size="sm" 
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => handleAcceptJob(job.id)}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Accept Job
                    </Button>
                  )}
                  
                  {job.status === 'accepted' && (
                    <Button 
                      size="sm" 
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleStartJob(job.id)}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Start Job
                    </Button>
                  )}
                  
                  {job.status === 'in-progress' && (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setSelectedJob(job);
                          setShowVideoRecording(true);
                        }}
                      >
                        <Video className="w-4 h-4 mr-1" />
                        Record Video
                      </Button>
                      <Button 
                        size="sm" 
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => handleCompleteJob(job.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Complete
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Job Details Modal */}
      <Dialog open={showJobDetails} onOpenChange={setShowJobDetails}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Job Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedJob && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{selectedJob.title}</h3>
                <div className="flex gap-2 mt-2">
                  <Badge className={getStatusColor(selectedJob.status)}>
                    {selectedJob.status.replace('-', ' ')}
                  </Badge>
                  <Badge className={getPriorityColor(selectedJob.priority)}>
                    {selectedJob.priority}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">{selectedJob.client}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <span>{selectedJob.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span>{selectedJob.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <span>{selectedJob.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span>Estimated: {selectedJob.estimatedDuration}</span>
                </div>
              </div>

              {selectedJob.managerNotes && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-1">Manager Notes:</h4>
                  <p className="text-sm text-blue-800">{selectedJob.managerNotes}</p>
                </div>
              )}

              {selectedJob.notes && (
                <div>
                  <h4 className="font-medium mb-2">Job Notes:</h4>
                  <p className="text-sm text-gray-600">{selectedJob.notes}</p>
                </div>
              )}

              <div>
                <h4 className="font-medium mb-2">Add Note:</h4>
                <div className="flex gap-2">
                  <Input
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    className="flex-1"
                  />
                  <Button 
                    size="sm"
                    onClick={() => handleAddNote(selectedJob.id)}
                    disabled={!newNote.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {selectedJob.videos.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Videos ({selectedJob.videos.length}):</h4>
                  <div className="space-y-2">
                    {selectedJob.videos.map(video => (
                      <div key={video.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium">{video.title}</p>
                          <p className="text-sm text-gray-600">
                            Duration: {formatTime(video.duration)}
                          </p>
                        </div>
                        <Badge className={
                          video.status === 'pending-approval' 
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }>
                          {video.status.replace('-', ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                {selectedJob.status === 'in-progress' && (
                  <Button 
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={() => {
                      setShowJobDetails(false);
                      setShowVideoRecording(true);
                    }}
                  >
                    <Video className="w-4 h-4 mr-1" />
                    Record Video
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowJobDetails(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Video Recording Modal */}
      <Dialog open={showVideoRecording} onOpenChange={setShowVideoRecording}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              Record Service Video
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center">
              {recordingState === 'idle' && (
                <div className="text-center text-white">
                  <Camera className="w-12 h-12 mx-auto mb-2" />
                  <p>Ready to record</p>
                </div>
              )}
              {recordingState === 'recording' && (
                <div className="text-center text-white">
                  <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse mx-auto mb-2"></div>
                  <p>Recording...</p>
                  <p className="text-2xl font-mono">{formatTime(recordingTime)}</p>
                </div>
              )}
              {recordingState === 'paused' && (
                <div className="text-center text-white">
                  <Pause className="w-12 h-12 mx-auto mb-2" />
                  <p>Paused</p>
                  <p className="text-2xl font-mono">{formatTime(recordingTime)}</p>
                </div>
              )}
              {recordingState === 'processing' && (
                <div className="text-center text-white">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-2"></div>
                  <p>Processing video...</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </Button>
              
              <div className="text-sm text-gray-600">
                {selectedJob?.client} • {selectedJob?.title}
              </div>
            </div>

            <div className="flex gap-2">
              {recordingState === 'idle' && (
                <Button 
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  onClick={handleStartRecording}
                >
                  <Video className="w-4 h-4 mr-1" />
                  Start Recording
                </Button>
              )}
              
              {recordingState === 'recording' && (
                <>
                  <Button 
                    variant="outline"
                    className="flex-1"
                    onClick={handlePauseRecording}
                  >
                    <Pause className="w-4 h-4 mr-1" />
                    Pause
                  </Button>
                  <Button 
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    onClick={handleStopRecording}
                  >
                    <Square className="w-4 h-4 mr-1" />
                    Stop
                  </Button>
                </>
              )}
              
              {recordingState === 'paused' && (
                <>
                  <Button 
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={handleStartRecording}
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Resume
                  </Button>
                  <Button 
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    onClick={handleStopRecording}
                  >
                    <Square className="w-4 h-4 mr-1" />
                    Stop
                  </Button>
                </>
              )}
            </div>

            <div className="bg-yellow-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <span className="font-medium text-yellow-800">Legal Notice</span>
              </div>
              <p className="text-sm text-yellow-700">
                By recording this video, you confirm you have proper consent and are at the authorized location for this service.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Device Status</span>
              <Badge className={profile.isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                {profile.isOnline ? 'Online' : 'Offline'}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span>Vendor</span>
              <span className="font-medium">{profile.vendorName}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span>Permissions</span>
              <span className="font-medium">{profile.permissions}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span>Paired Since</span>
              <span className="font-medium">{profile.pairedAt}</span>
            </div>
            
            <Button 
              variant="destructive" 
              className="w-full"
              onClick={() => {
                // Backend call: POST /api/employee/device/unpair
                console.log('Device unpairing requested');
              }}
            >
              <LogOut className="w-4 h-4 mr-1" />
              Unpair Device
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 