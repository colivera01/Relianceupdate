'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Search, Filter, Download, Trash2, Info, Video, Upload, X, MapPin, Shield, AlertTriangle, Edit, MessageSquare, Users, Clock, CheckCircle, Calendar, ChevronDown, ChevronLeft, ChevronRight, Eye, HardDrive } from 'lucide-react';
import Link from 'next/link';

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
// - NEW: Job status updates should POST to /api/vendor/jobs/:jobId/status
// - NEW: Employee assignments should POST to /api/vendor/jobs/:jobId/assignments
// - NEW: Job notes should POST to /api/vendor/jobs/:jobId/notes

// Mock data
const mockJobs = [
  {
    id: 1,
    title: 'Water Heater Repair',
    client: 'John Smith',
    phone: '(555) 123-4567',
    email: 'john@example.com',
    status: 'in-progress',
    assignedEmployees: ['Mike Johnson'],
    createdAt: '2024-01-15',
    estimatedCompletion: '2024-01-20',
    notes: [
      { id: 1, text: 'Customer requested morning appointment', author: 'Mike Johnson', date: '2024-01-15' },
      { id: 2, text: 'Parts ordered - arriving tomorrow', author: 'Mike Johnson', date: '2024-01-15' }
    ],
    audit: ['Job created on 2024-01-15', 'Assigned to Mike Johnson on 2024-01-15'],
    videos: [
      { id: 3, title: 'Water Heater Diagnosis', url: '/videos/water-heater-diagnosis.mp4', uploadedAt: '2024-01-15', status: 'pending-approval', uploadedBy: 'Mike Johnson' }
    ]
  },
  {
    id: 2,
    title: 'HVAC Maintenance',
    client: 'Sarah Wilson',
    phone: '(555) 987-6543',
    email: 'sarah@example.com',
    status: 'completed',
    assignedEmployees: ['Lisa Chen'],
    createdAt: '2024-01-10',
    completedAt: '2024-01-12',
    notes: [
      { id: 1, text: 'Annual maintenance completed', author: 'Lisa Chen', date: '2024-01-12' },
      { id: 2, text: 'Customer satisfied with service', author: 'Lisa Chen', date: '2024-01-12' }
    ],
    audit: ['Job created on 2024-01-10', 'Completed on 2024-01-12'],
    videos: [
      { id: 1, title: 'Initial Assessment', url: '/videos/hvac-assessment.mp4', uploadedAt: '2024-01-10', status: 'approved', reviewedAt: '2024-01-10T10:30:00Z', reviewedBy: 'Manager', archivedDate: '2024-01-10', approvalMethod: 'manual' },
      { id: 2, title: 'Final Inspection', url: '/videos/hvac-final.mp4', uploadedAt: '2024-01-12', status: 'approved', reviewedAt: '2024-01-12T15:45:00Z', reviewedBy: 'Manager', archivedDate: '2024-01-12', approvalMethod: 'manual' }
    ],
    customerApprovalStatus: 'completed',
    customerApprovalRequestedAt: '2024-01-10T10:30:00Z',
    customerApprovalCompletedAt: '2024-01-10T11:15:00Z',
    customerApprovalWorkflow: {
      status: 'completed',
      initiatedAt: '2024-01-10T10:30:00Z',
      completedAt: '2024-01-10T11:15:00Z',
      videoId: 1,
      approvalMethod: 'manual',
      managerNotes: 'Service completed successfully'
    }
  }
];

const mockEmployees = [
  { id: 1, name: "Mike Johnson", photo: "https://randomuser.me/api/portraits/men/32.jpg" },
  { id: 2, name: "Lisa Chen", photo: "https://randomuser.me/api/portraits/women/44.jpg" },
  { id: 3, name: "David Wilson", photo: "https://randomuser.me/api/portraits/men/45.jpg" },
  { id: 4, name: "Maria Garcia", photo: "https://randomuser.me/api/portraits/women/46.jpg" }
];

const BUSINESS_ADDRESS = { lat: 28.5383, lng: -81.3792 }; // Example: Orlando, FL
const LOCATION_RADIUS_METERS = 100;

// Helper function to calculate distance between two points
const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};

export default function VendorJobs() {
  const [jobs, setJobs] = useState(mockJobs);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [showVideoUpload, setShowVideoUpload] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [newJob, setNewJob] = useState({ title: '', client: '', phone: '', email: '' });
  const [newVideo, setNewVideo] = useState({ title: '', description: '', file: null });
  const [search, setSearch] = useState('');
  const [isEmployeeView, setIsEmployeeView] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Bulk selection state
  const [selectedJobIds, setSelectedJobIds] = useState([]);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [showBulkAssignmentModal, setShowBulkAssignmentModal] = useState(false);
  
  // Auto-approval system state
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [showAutoApproveWarning, setShowAutoApproveWarning] = useState(false);
  const [autoApproveSettings, setAutoApproveSettings] = useState({
    enabled: false,
    employeeWhitelist: [], // Specific employees who can auto-approve
    maxDuration: 300, // Max video duration in seconds (5 minutes)
    requireLocation: true, // Must have valid location
    requireConsent: true, // Must have customer consent
    notifyManager: true, // Send notification to manager after auto-approval
    auditTrail: true // Log all auto-approvals
  });
  
  // Legal compliance state
  const [location, setLocation] = useState('');
  const [showConsent, setShowConsent] = useState(false);
  const [consentStatus, setConsentStatus] = useState('');
  const [customerConsentStatus, setCustomerConsentStatus] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  
  // Fraud prevention state
  const [attemptCount, setAttemptCount] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  
  // Enhancement 1: Job Status Management
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  
  // Enhancement 2: Employee Assignment Management
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  
  // Enhancement 3: Job Notes/Comments System
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editingNote, setEditingNote] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Video approval system state
  const [showVideoApprovalModal, setShowVideoApprovalModal] = useState(false);
  const [selectedVideoForApproval, setSelectedVideoForApproval] = useState(null);
  const [approvalReason, setApprovalReason] = useState('');
  const [showVideoArchive, setShowVideoArchive] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState('all'); // all, approved, rejected
  const [archiveDateFilter, setArchiveDateFilter] = useState('');
  const [archiveEmployeeFilter, setArchiveEmployeeFilter] = useState('all');
  
  // Job archiving system
  const [archivedJobs, setArchivedJobs] = useState([]);
  const [showArchivedJobs, setShowArchivedJobs] = useState(false);
  const [jobArchiveFilter, setJobArchiveFilter] = useState('all'); // all, completed, cancelled
  const [selectedArchiveDate, setSelectedArchiveDate] = useState('');
  const [showCustomerApprovalWorkflow, setShowCustomerApprovalWorkflow] = useState(false);
  const [customerApprovalJob, setCustomerApprovalJob] = useState(null);
  
  // Video details modal state
  const [showVideoDetailsModal, setShowVideoDetailsModal] = useState(false);
  const [selectedVideoForDetails, setSelectedVideoForDetails] = useState(null);
  
  // Job details modal state
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [selectedJobForDetails, setSelectedJobForDetails] = useState(null);
  
  // Calendar date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState('');
  
  // Memory tracking state
  const [currentMemoryUsage, setCurrentMemoryUsage] = useState(0);
  const [memoryLimit, setMemoryLimit] = useState(1024); // MB
  const [memoryTier, setMemoryTier] = useState('basic'); // basic, pro, enterprise

  // Update memory usage when component mounts or videos change
  useEffect(() => {
    updateMemoryUsage();
  }, [jobs]); // Recalculate when jobs change

  // Filter jobs based on view mode and search
  const filteredJobs = jobs.filter(job => {
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    const matchesSearch = job.title.toLowerCase().includes(search.toLowerCase()) || 
                         job.client.toLowerCase().includes(search.toLowerCase());
    
    // In employee view, only show jobs assigned to current employee
    if (isEmployeeView) {
      const isAssignedToMe = job.assignedEmployees.includes('Mike Johnson'); // Mock current employee
      return matchesStatus && matchesSearch && isAssignedToMe;
    }
    
    return matchesStatus && matchesSearch;
  });

  const handleCreateJob = () => {
    const job = {
      id: Date.now(),
      ...newJob,
      status: 'pending',
      assignedEmployees: [],
      createdAt: new Date().toISOString().split('T')[0],
      notes: [],
      audit: [`Job created on ${new Date().toLocaleDateString()}`],
      videos: []
    };
    setJobs([...jobs, job]);
    setNewJob({ title: '', client: '', phone: '', email: '' });
    setShowCreateJob(false);
  };

  const handleVideoUpload = () => {
    if (selectedJob && newVideo.title && newVideo.file) {
      const video = {
        id: Date.now(),
        title: newVideo.title,
        description: newVideo.description,
        url: URL.createObjectURL(newVideo.file),
        uploadedAt: new Date().toISOString().split('T')[0]
      };
      
      setJobs(jobs.map(job => 
        job.id === selectedJob.id 
          ? { ...job, videos: [...job.videos, video] }
          : job
      ));
      
      setNewVideo({ title: '', description: '', file: null });
      setShowVideoUpload(false);
      setSelectedJob(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) {
      setNewVideo({ ...newVideo, file });
    }
  };

  // Enhancement 1: Job Status Management Functions
  const handleStatusUpdate = (job, newStatus, reason = '') => {
    const updatedJob = {
      ...job,
      status: newStatus,
      audit: [...job.audit, `Status changed to ${newStatus} on ${new Date().toLocaleDateString()}${reason ? ` - Reason: ${reason}` : ''}`]
    };
    
    if (newStatus === 'completed') {
      updatedJob.completedAt = new Date().toISOString().split('T')[0];
    }
    
    setJobs(jobs.map(j => j.id === job.id ? updatedJob : j));
    setShowStatusModal(false);
    setEditingJob(null);
    setNewStatus('');
    setStatusReason('');
  };

  const openStatusModal = (job) => {
    setEditingJob(job);
    setNewStatus(job.status);
    setShowStatusModal(true);
  };

  // Enhancement 2: Employee Assignment Management Functions
  const handleAssignmentUpdate = (job, selectedEmployees) => {
    const updatedJob = {
      ...job,
      assignedEmployees: selectedEmployees,
      audit: [...job.audit, `Employees updated to: ${selectedEmployees.join(', ')} on ${new Date().toLocaleDateString()}`]
    };
    
    setJobs(jobs.map(j => j.id === job.id ? updatedJob : j));
    setShowAssignmentModal(false);
    setSelectedJob(null);
    setSelectedEmployees([]);
  };

  const openAssignmentModal = (job) => {
    setSelectedJob(job);
    setSelectedEmployees(job.assignedEmployees || []);
    setShowAssignmentModal(true);
  };

  // Enhancement 3: Job Notes/Comments System Functions
  const handleAddNote = (job) => {
    if (newNote.trim()) {
      const note = {
        id: Date.now(),
        text: newNote,
        author: 'You', // TODO: Replace with actual user
        date: new Date().toLocaleDateString()
      };
      
      const updatedJob = {
        ...job,
        notes: [...job.notes, note],
        audit: [...job.audit, `Note added on ${new Date().toLocaleDateString()}`]
      };
      
      setJobs(jobs.map(j => j.id === job.id ? updatedJob : j));
      setNewNote('');
    }
  };

  const handleEditNote = (job, noteId) => {
    const note = job.notes.find(n => n.id === noteId);
    setEditingNote(note);
    setEditingNoteText(note.text);
  };

  const handleSaveNoteEdit = (job, noteId) => {
    const updatedJob = {
      ...job,
      notes: job.notes.map(note => 
        note.id === noteId 
          ? { ...note, text: editingNoteText, date: `${new Date().toLocaleDateString()} (edited)` }
          : note
      ),
      audit: [...job.audit, `Note edited on ${new Date().toLocaleDateString()}`]
    };
    
    setJobs(jobs.map(j => j.id === job.id ? updatedJob : j));
    setEditingNote(null);
    setEditingNoteText('');
  };

  const handleDeleteNote = (job, noteId) => {
    const updatedJob = {
      ...job,
      notes: job.notes.filter(note => note.id !== noteId),
      audit: [...job.audit, `Note deleted on ${new Date().toLocaleDateString()}`]
    };
    
    setJobs(jobs.map(j => j.id === job.id ? updatedJob : j));
  };

  const openNotesModal = (job) => {
    setSelectedJob(job);
    setShowNotesModal(true);
  };

  // Bulk selection functions
  const toggleBulkMode = () => {
    console.log('Toggle bulk mode clicked, current state:', isBulkMode);
    setIsBulkMode(!isBulkMode);
    if (isBulkMode) {
      setSelectedJobIds([]);
    }
    // Show feedback
    alert(isBulkMode ? 'Exited bulk mode' : 'Entered bulk mode - select jobs to assign');
  };

  const toggleJobSelection = (jobId) => {
    setSelectedJobIds(prev => 
      prev.includes(jobId) 
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    );
  };

  const selectAllJobs = () => {
    setSelectedJobIds(filteredJobs.map(job => job.id));
  };

  const clearSelection = () => {
    setSelectedJobIds([]);
  };

  const handleBulkAssignment = (selectedEmployees) => {
    setJobs(jobs.map(job => 
      selectedJobIds.includes(job.id)
        ? { 
            ...job, 
            assignedEmployees: selectedEmployees,
            audit: [...job.audit, `Bulk assigned to ${selectedEmployees.join(', ')} on ${new Date().toLocaleDateString()}`]
          }
        : job
    ));
    setSelectedJobIds([]);
    setIsBulkMode(false);
    setShowBulkAssignmentModal(false);
  };

  // Auto-approval functions
  const toggleAutoApprove = () => {
    console.log('Toggle auto-approve clicked, current state:', autoApproveSettings.enabled);
    if (!autoApproveSettings.enabled) {
      setShowAutoApproveWarning(true);
    } else {
      setAutoApproveSettings(prev => ({ ...prev, enabled: false }));
      alert('Auto-approve disabled');
    }
  };

  const confirmAutoApprove = () => {
    setAutoApproveSettings(prev => ({ ...prev, enabled: true }));
    setShowAutoApproveWarning(false);
    
    // Log the auto-approval activation
    console.log('Auto-approval enabled with settings:', autoApproveSettings);
    alert('Auto-approve enabled! Videos will be automatically approved when criteria are met.');
  };

  const handleAutoApproveVideo = (job, video, employee) => {
    // Check if auto-approval conditions are met
    const conditions = {
      employeeWhitelisted: autoApproveSettings.employeeWhitelist.includes(employee) || autoApproveSettings.employeeWhitelist.length === 0,
      durationValid: video.duration <= autoApproveSettings.maxDuration,
      locationValid: autoApproveSettings.requireLocation ? job.locationVerified : true,
      consentValid: autoApproveSettings.requireConsent ? job.customerConsent : true
    };

    const allConditionsMet = Object.values(conditions).every(Boolean);

    if (allConditionsMet) {
      // Auto-approve the video
      const updatedVideo = {
        ...video,
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: 'Auto-Approval System',
        autoApproved: true
      };

      setJobs(jobs.map(j => 
        j.id === job.id 
          ? { 
              ...j, 
              videos: j.videos.map(v => v.id === video.id ? updatedVideo : v),
              audit: [...j.audit, `Video "${video.title}" auto-approved for ${employee} on ${new Date().toLocaleDateString()}`]
            }
          : j
      ));

      // Notify manager if enabled
      if (autoApproveSettings.notifyManager) {
        console.log(`Notification sent to manager: Video "${video.title}" auto-approved for ${employee}`);
      }

      return { success: true, video: updatedVideo };
    } else {
      // Log failed auto-approval attempt
      console.log('Auto-approval failed - conditions not met:', conditions);
      return { success: false, conditions };
    }
  };

  const getPendingVideosCount = () => {
    return jobs.reduce((count, job) => {
      return count + job.videos.filter(video => video.status === 'pending-approval').length;
    }, 0);
  };

  // Video approval functions
  const openVideoApproval = (video, job) => {
    setSelectedVideoForApproval({ video, job });
    setShowVideoApprovalModal(true);
    setApprovalReason('');
  };

  const handleVideoApproval = (approved) => {
    if (!selectedVideoForApproval) return;

    const { video, job } = selectedVideoForApproval;
    const updatedVideo = {
      ...video,
      status: approved ? 'approved' : 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'Manager', // In real app, get from auth context
      reviewReason: approvalReason,
      archivedDate: new Date().toISOString().split('T')[0], // Archive by date
      approvalMethod: autoApproveSettings.enabled ? 'auto' : 'manual'
    };

    const updatedJob = {
      ...job,
      videos: job.videos.map(v => v.id === video.id ? updatedVideo : v),
      audit: [...job.audit, `Video "${video.title}" ${approved ? 'approved' : 'rejected'} on ${new Date().toLocaleDateString()}`]
    };

    // If approved, trigger customer approval workflow
    if (approved) {
      updatedJob.customerApprovalStatus = 'pending';
      updatedJob.customerApprovalRequestedAt = new Date().toISOString();
      updatedJob.customerApprovalDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(); // 72 hours
      updatedJob.customerApprovalWorkflow = {
        status: 'initiated',
        initiatedAt: new Date().toISOString(),
        videoId: video.id,
        approvalMethod: autoApproveSettings.enabled ? 'auto' : 'manual',
        managerNotes: approvalReason
      };
    }

    setJobs(jobs.map(j => j.id === job.id ? updatedJob : j));

    setShowVideoApprovalModal(false);
    setSelectedVideoForApproval(null);
    setApprovalReason('');

    // If approved, show customer approval workflow
    if (approved) {
      setCustomerApprovalJob(updatedJob);
      setShowCustomerApprovalWorkflow(true);
    }
  };

  const getAllVideosForArchive = () => {
    const allVideos = [];
    jobs.forEach(job => {
      job.videos.forEach(video => {
        if (video.status === 'approved' || video.status === 'rejected') {
          allVideos.push({
            ...video,
            jobTitle: job.title,
            client: job.client,
            assignedEmployees: job.assignedEmployees
          });
        }
      });
    });
    return allVideos;
  };

  const getFilteredArchiveVideos = () => {
    let videos = getAllVideosForArchive();
    
    // Filter by status
    if (archiveFilter !== 'all') {
      videos = videos.filter(video => video.status === archiveFilter);
    }
    
    // Filter by date
    if (archiveDateFilter) {
      videos = videos.filter(video => video.archivedDate === archiveDateFilter);
    }

    // Filter by employee
    if (archiveEmployeeFilter !== 'all') {
      videos = videos.filter(video => 
        video.assignedEmployees && video.assignedEmployees.includes(archiveEmployeeFilter)
      );
    }
    
    return videos.sort((a, b) => new Date(b.reviewedAt) - new Date(a.reviewedAt));
  };

  const getArchiveEmployees = () => {
    const employees = new Set();
    getAllVideosForArchive().forEach(video => {
      if (video.assignedEmployees) {
        video.assignedEmployees.forEach(employee => employees.add(employee));
      }
    });
    return Array.from(employees).sort();
  };

  const getVideosByDate = (date) => {
    return getAllVideosForArchive().filter(video => video.archivedDate === date);
  };

  const getArchiveDates = () => {
    const dates = new Set();
    getAllVideosForArchive().forEach(video => {
      if (video.archivedDate) {
        dates.add(video.archivedDate);
      }
    });
    return Array.from(dates).sort().reverse();
  };

  // Video details functions
  const openVideoDetails = (video) => {
    setSelectedVideoForDetails(video);
    setShowVideoDetailsModal(true);
  };

  const openJobDetails = (job) => {
    setSelectedJobForDetails(job);
    setShowJobDetails(true);
  };

  // Memory tracking functions
  const calculateVideoMemoryUsage = (video) => {
    // Mock calculation - in real app, this would be actual file size
    return Math.floor(Math.random() * 50) + 10; // 10-60 MB per video
  };

  const updateMemoryUsage = () => {
    const totalUsage = getAllVideosForArchive().reduce((total, video) => {
      return total + calculateVideoMemoryUsage(video);
    }, 0);
    setCurrentMemoryUsage(totalUsage);
  };

  // Calendar functions
  const generateCalendarDays = (year, month) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const getVideosForDate = (date) => {
    const dateString = date.toISOString().split('T')[0];
    return getAllVideosForArchive().filter(video => video.archivedDate === dateString);
  };

  // Legal compliance functions
  const handleGeoLocationCheck = () => {
    setGeoError('');
    setGeoLoading(true);
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      setGeoLoading(false);
      return;
    }
    
    // Enhanced fraud prevention
    const startTime = Date.now();
    const userAgent = navigator.userAgent;
    const screenResolution = `${screen.width}x${screen.height}`;
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const accuracy = pos.coords.accuracy;
        const timestamp = pos.timestamp;
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Mock backend validation with enhanced security
        const dist = getDistanceMeters(latitude, longitude, BUSINESS_ADDRESS.lat, BUSINESS_ADDRESS.lng);
        
        // Enhanced validation checks
        const isValidLocation = dist <= LOCATION_RADIUS_METERS;
        const isValidAccuracy = accuracy <= 50; // Must be within 50 meters accuracy
        const isValidResponseTime = responseTime > 100 && responseTime < 10000; // Prevent spoofing
        
        if (isValidLocation && isValidAccuracy && isValidResponseTime) {
          setGeoError('');
          setGeoLoading(false);
          
          // Log successful verification with full metadata
          const verificationData = {
            jobId: selectedJob?.id,
            vendorId: 'current-vendor-id', // From auth context
            latitude,
            longitude,
            accuracy,
            distance: dist,
            timestamp,
            responseTime,
            userAgent,
            screenResolution,
            ipAddress: 'logged-server-side',
            deviceId: 'logged-server-side',
            verificationMethod: 'gps',
            success: true
          };
          
          // POST to backend for logging
          console.log('Location verification successful:', verificationData);
          
          setShowConsent(true);
          setConsentStatus('granted');
        } else {
          let errorMessage = 'Location verification failed. ';
          if (!isValidLocation) errorMessage += 'You are not at the registered business address. ';
          if (!isValidAccuracy) errorMessage += 'GPS accuracy is insufficient. ';
          if (!isValidResponseTime) errorMessage += 'Response time indicates potential spoofing. ';
          errorMessage += 'Please try again at the correct location or contact support.';
          
          setGeoError(errorMessage);
          setGeoLoading(false);
          
          // Log failed attempt
          const failedAttempt = {
            jobId: selectedJob?.id,
            vendorId: 'current-vendor-id',
            latitude,
            longitude,
            accuracy,
            distance: dist,
            timestamp,
            responseTime,
            userAgent,
            screenResolution,
            ipAddress: 'logged-server-side',
            deviceId: 'logged-server-side',
            verificationMethod: 'gps',
            success: false,
            failureReason: {
              invalidLocation: !isValidLocation,
              invalidAccuracy: !isValidAccuracy,
              invalidResponseTime: !isValidResponseTime
            }
          };
          
          console.log('Location verification failed:', failedAttempt);
        }
      },
      (err) => {
        const errorMessage = `Unable to retrieve your location (Error: ${err.code}). Please enable location services and try again.`;
        setGeoError(errorMessage);
        setGeoLoading(false);
        
        // Log geolocation error
        const errorData = {
          jobId: selectedJob?.id,
          vendorId: 'current-vendor-id',
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          screenResolution: `${screen.width}x${screen.height}`,
          ipAddress: 'logged-server-side',
          deviceId: 'logged-server-side',
          verificationMethod: 'gps',
          success: false,
          errorCode: err.code,
          errorMessage: err.message
        };
        
        console.log('Geolocation error:', errorData);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleRequestCustomerConsent = () => {
    setCustomerConsentStatus('pending');
    
    // Enhanced consent request with fraud prevention
    const consentRequestData = {
      jobId: selectedJob?.id,
      vendorId: 'current-vendor-id',
      customerEmail: selectedJob?.email,
      customerPhone: selectedJob?.phone,
      requestType: location === 'residence' ? 'residential_recording' : 'business_recording',
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      ipAddress: 'logged-server-side',
      deviceId: 'logged-server-side',
      consentToken: `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    // Mock backend consent request with enhanced security
    setTimeout(() => {
      setCustomerConsentStatus('granted');
      
      // Log successful consent
      const consentData = {
        ...consentRequestData,
        consentGranted: true,
        consentTimestamp: Date.now(),
        consentMethod: 'email_link', // or 'sms', 'in_person'
        legalTextVersion: 'v1.2.3', // Version of legal text shown
        customerIpAddress: 'logged-server-side',
        customerDeviceInfo: 'logged-server-side'
      };
      
      console.log('Customer consent granted:', consentData);
    }, 2000);
  };

  const handleContinue = () => {
    // Enhanced validation before proceeding
    if (!selectedJob) {
      console.error('No job selected for video creation');
      return;
    }
    
    if (!location) {
      console.error('No location type selected');
      return;
    }
    
    // Enhanced fraud prevention checks
    const now = Date.now();
    const timeSinceLastAttempt = now - lastAttemptTime;
    
    // Rate limiting: Max 3 attempts per minute
    if (timeSinceLastAttempt < 60000 && attemptCount >= 3) {
      setIsBlocked(true);
      setBlockReason('Too many attempts. Please wait 1 minute before trying again.');
      console.warn('Rate limit exceeded for vendor compliance checks');
      return;
    }
    
    // Reset attempt count if more than 1 minute has passed
    if (timeSinceLastAttempt > 60000) {
      setAttemptCount(0);
    }
    
    // Increment attempt count
    setAttemptCount(prev => prev + 1);
    setLastAttemptTime(now);
    
    // Log the compliance flow initiation with enhanced security
    const complianceFlowData = {
      jobId: selectedJob.id,
      vendorId: 'current-vendor-id',
      locationType: location,
      timestamp: now,
      userAgent: navigator.userAgent,
      ipAddress: 'logged-server-side',
      deviceId: 'logged-server-side',
      sessionId: 'logged-server-side',
      attemptCount: attemptCount + 1,
      timeSinceLastAttempt,
      isBlocked: false,
      securityChecks: {
        hasValidSession: true, // From auth context
        isAuthenticated: true, // From auth context
        hasValidPermissions: true, // From auth context
        deviceTrusted: true, // From device fingerprinting
        ipTrusted: true, // From IP reputation check
        noSuspiciousActivity: true // From behavioral analysis
      }
    };
    
    console.log('Compliance flow initiated:', complianceFlowData);
    
    // Additional security validation
    if (complianceFlowData.securityChecks.noSuspiciousActivity === false) {
      setIsBlocked(true);
      setBlockReason('Suspicious activity detected. Your account has been temporarily blocked for security review.');
      console.error('Suspicious activity detected in compliance flow');
      return;
    }
    
    // Close compliance modal and open video upload modal
    setShowComplianceModal(false);
    setShowModal(true);
    
    // Log successful compliance completion
    console.log('Compliance completed successfully, opening video upload modal');
    alert('Compliance completed! Opening video upload modal.');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get available employees (those without assigned jobs)
  const getAvailableEmployees = () => {
    const assignedEmployees = new Set();
    jobs.forEach(job => {
      if (job.assignedEmployees) {
        job.assignedEmployees.forEach(emp => assignedEmployees.add(emp));
      }
    });
    
    return mockEmployees.filter(emp => !assignedEmployees.has(emp.name));
  };

  // Job archiving functions
  const archiveJob = (job, reason = '') => {
    const archivedJob = {
      ...job,
      archivedAt: new Date().toISOString(),
      archiveReason: reason,
      originalId: job.id,
      id: `archived-${job.id}-${Date.now()}`
    };
    
    setArchivedJobs(prev => [...prev, archivedJob]);
    setJobs(prev => prev.filter(j => j.id !== job.id));
    
    console.log(`Job "${job.title}" archived: ${reason}`);
  };

  const unarchiveJob = (archivedJob) => {
    const restoredJob = {
      ...archivedJob,
      id: archivedJob.originalId,
      archivedAt: undefined,
      archiveReason: undefined,
      originalId: undefined
    };
    
    setJobs(prev => [...prev, restoredJob]);
    setArchivedJobs(prev => prev.filter(j => j.id !== archivedJob.id));
    
    console.log(`Job "${archivedJob.title}" restored from archive`);
  };

  const getFilteredArchivedJobs = () => {
    let filtered = archivedJobs;
    
    if (jobArchiveFilter !== 'all') {
      filtered = filtered.filter(job => job.status === jobArchiveFilter);
    }
    
    return filtered.sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
  };

  // Enhanced job approval with archiving
  const handleJobApproval = (job, approved, reason = '') => {
    const updatedJob = {
      ...job,
      status: approved ? 'completed' : 'cancelled',
      approvedAt: new Date().toISOString(),
      approvalReason: reason,
      audit: [...job.audit, `Job ${approved ? 'approved' : 'rejected'} on ${new Date().toLocaleDateString()}${reason ? ` - Reason: ${reason}` : ''}`]
    };

    setJobs(jobs.map(j => j.id === job.id ? updatedJob : j));

    // Auto-archive completed jobs after approval
    if (approved) {
      setTimeout(() => {
        archiveJob(updatedJob, 'Job completed and approved - auto-archived to reduce clutter');
      }, 2000); // Archive after 2 seconds to show completion
    }
  };

  return (
    <div className="px-4 md:px-8 py-8 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
      {/* Enhanced Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-full">
            <Info className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-1">Welcome to Job Management</h3>
            <p className="text-blue-100 text-sm leading-relaxed">
              Manage all your jobs efficiently. Click <strong>Create Job</strong> to add a new job, or use <strong>Create Service Video</strong> to upload progress. 
              Hover over any <Info className="inline w-4 h-4 align-text-bottom" /> for detailed help.
            </p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/vendor">
            <Button variant="outline" size="lg" className="bg-white hover:bg-gray-50 shadow-md">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h2 className="text-3xl font-bold text-gray-800">
              {isEmployeeView ? 'My Assigned Jobs' : 'Manage Jobs'}
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              {isEmployeeView ? 'View and manage your assigned service jobs' : 'Create, track, and manage all your service jobs'}
            </p>
          </div>
        </div>
        
        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">View Mode:</span>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setIsEmployeeView(false)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                !isEmployeeView 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Manager
            </button>
            <button
              onClick={() => setIsEmployeeView(true)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                isEmployeeView 
                  ? 'bg-white text-green-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Employee
            </button>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 min-w-0 search-input-container">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder={isEmployeeView ? "Search my jobs..." : "Search jobs by title or client..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 border-2 border-gray-200 rounded-lg w-full min-w-0"
              style={{ minWidth: '280px' }}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none px-4 py-2 pr-10 border-2 border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]"
            >
              <option value="all">{isEmployeeView ? 'All My Jobs' : 'All Status'}</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          
          {!isEmployeeView && (
            <>
              <Button 
                onClick={() => {
                  if (isBulkMode && selectedJobIds.length > 0) {
                    setShowBulkAssignmentModal(true);
                  } else {
                    toggleBulkMode();
                  }
                }} 
                className={`action-button ${isBulkMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-600 hover:bg-gray-700'}`}
              >
                <Users className="w-5 h-5 mr-2" />
                {isBulkMode ? (selectedJobIds.length > 0 ? `Assign ${selectedJobIds.length}` : 'Exit Bulk Mode') : 'Bulk Assign'}
              </Button>
              <Button 
                onClick={() => {
                  console.log('Create Job button clicked');
                  setShowCreateJob(true);
                  alert('Opening Create Job modal...');
                }} 
                className="action-button bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Job
              </Button>
              <Button 
                onClick={() => {
                  console.log('Create Service Video button clicked, filtered jobs:', filteredJobs.length);
                  if (filteredJobs.length > 0) {
                    setSelectedJob(filteredJobs[0]);
                    setShowComplianceModal(true);
                    alert('Opening Compliance modal for: ' + filteredJobs[0].title);
                  } else {
                    // Create a default job if none exist
                    const defaultJob = {
                      id: Date.now().toString(),
                      title: 'New Service Job',
                      client: 'New Client',
                      phone: '',
                      email: '',
                      status: 'pending',
                      assignedEmployees: [],
                      videos: [],
                      notes: [],
                      audit: ['Created for video upload on ' + new Date().toLocaleDateString()]
                    };
                    setSelectedJob(defaultJob);
                    setShowComplianceModal(true);
                    alert('Opening Compliance modal for new job');
                  }
                }} 
                className="action-button bg-green-600 hover:bg-green-700"
              >
                <Video className="w-5 h-5 mr-2" />
                Create Service Video
              </Button>
              <Button 
                onClick={toggleAutoApprove}
                className={`action-button ${autoApproveSettings.enabled ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'}`}
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                {autoApproveSettings.enabled ? 'Disable Auto-Approve' : 'Auto-Approve'}
              </Button>
              <Button 
                onClick={() => setShowVideoArchive(true)}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Video className="w-5 h-5 mr-2" />
                Content Archive
              </Button>
              <Button 
                onClick={() => setShowArchivedJobs(!showArchivedJobs)}
                className={`${showArchivedJobs ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-600 hover:bg-gray-700'}`}
              >
                <HardDrive className="w-5 h-5 mr-2" />
                {showArchivedJobs ? 'Hide Archived' : `Archived Jobs (${archivedJobs.length})`}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content Archive Modal */}
      <Dialog open={showVideoArchive} onOpenChange={setShowVideoArchive}>
        <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              Content Archive
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {/* Archive Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 video-archive-filters">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status Filter</label>
                <select
                  value={archiveFilter}
                  onChange={(e) => setArchiveFilter(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg appearance-none bg-white video-archive-dropdown"
                  style={{ 
                    backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'m6 8 4 4 4-4\'/%3e%3c/svg%3e")', 
                    backgroundRepeat: 'no-repeat', 
                    backgroundSize: '1.5em 1.5em' 
                  }}
                >
                  <option value="all">All Videos</option>
                  <option value="approved">Approved Only</option>
                  <option value="rejected">Rejected Only</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Filter</label>
                <div className="relative">
                  <button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className="w-full p-2 pr-10 border border-gray-300 rounded-lg appearance-none bg-white text-left flex items-center justify-between"
                  >
                    <span className={archiveDateFilter ? 'text-gray-900' : 'text-gray-500'}>
                      {archiveDateFilter ? new Date(archiveDateFilter).toLocaleDateString() : 'Select Date'}
                    </span>
                    <Calendar className="w-4 h-4 text-gray-400" />
                  </button>
                  
                  {showDatePicker && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-4" style={{ minWidth: '450px', width: 'max-content' }}>
                      <div className="flex items-center justify-between mb-3" style={{ minWidth: '350px', width: '100%' }}>
                        <button
                          onClick={() => {
                            const currentDate = new Date(selectedCalendarDate || Date.now());
                            const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
                            setSelectedCalendarDate(prevMonth.toISOString().split('T')[0]);
                          }}
                          className="p-2 hover:bg-gray-100 rounded flex items-center justify-center bg-white border"
                          style={{ minWidth: '45px', height: '35px' }}
                        >
                          <ChevronLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <span className="font-medium text-center flex-1 px-4">
                          {new Date(selectedCalendarDate || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                        <button
                          onClick={() => {
                            const currentDate = new Date(selectedCalendarDate || Date.now());
                            const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
                            setSelectedCalendarDate(nextMonth.toISOString().split('T')[0]);
                          }}
                          className="p-2 hover:bg-gray-100 rounded flex items-center justify-center bg-white border"
                          style={{ minWidth: '45px', height: '35px' }}
                        >
                          <ChevronRight className="w-5 h-5 text-gray-600" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-7 gap-3 text-xs mb-2 video-archive-calendar">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                          <div key={day} className="text-center text-gray-500 font-medium p-1">
                            {day}
                          </div>
                        ))}
                      </div>
                      
                      <div className="grid grid-cols-7 gap-3 video-archive-calendar">
                        {generateCalendarDays(
                          new Date(selectedCalendarDate || Date.now()).getFullYear(),
                          new Date(selectedCalendarDate || Date.now()).getMonth()
                        ).map((day, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              if (day) {
                                const dateString = day.toISOString().split('T')[0];
                                setArchiveDateFilter(dateString);
                                setShowDatePicker(false);
                              }
                            }}
                            className={`p-2 text-xs rounded hover:bg-blue-50 ${
                              day ? 'cursor-pointer' : 'cursor-default'
                            } ${
                              day && archiveDateFilter === day.toISOString().split('T')[0]
                                ? 'bg-blue-500 text-white'
                                : day
                                ? 'text-gray-700'
                                : 'text-gray-300'
                            } ${
                              day && getVideosForDate(day).length > 0
                                ? 'font-bold'
                                : ''
                            }`}
                            disabled={!day}
                          >
                            {day ? day.getDate() : ''}
                          </button>
                        ))}
                      </div>
                      
                      <div className="mt-3 pt-3 border-t">
                        <button
                          onClick={() => {
                            setArchiveDateFilter('');
                            setShowDatePicker(false);
                          }}
                          className="w-full p-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                        >
                          Clear Filter
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee Filter</label>
                <select
                  value={archiveEmployeeFilter}
                  onChange={(e) => setArchiveEmployeeFilter(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg appearance-none bg-white video-archive-dropdown"
                  style={{ 
                    backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'m6 8 4 4 4-4\'/%3e%3c/svg%3e")', 
                    backgroundRepeat: 'no-repeat', 
                    backgroundSize: '1.5em 1.5em',
                    backgroundPosition: 'right 1.75rem center',
                    minWidth: '240px',
                    width: '100%',
                    paddingRight: '3.5rem'
                  }}
                >
                  <option value="all">All Employees</option>
                  {getArchiveEmployees().map(employee => (
                    <option key={employee} value={employee}>
                      {employee}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Archive Stats */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{getAllVideosForArchive().filter(v => v.status === 'approved').length}</p>
                  <p className="text-sm text-gray-600">Approved</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{getAllVideosForArchive().filter(v => v.status === 'rejected').length}</p>
                  <p className="text-sm text-gray-600">Rejected</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-600">{getAllVideosForArchive().length}</p>
                  <p className="text-sm text-gray-600">Total</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">{currentMemoryUsage}</p>
                  <p className="text-sm text-gray-600">MB Used</p>
                </div>
              </div>
            </div>

            {/* Video List */}
            <div className="space-y-3">
              {getFilteredArchiveVideos().map(video => (
                <div key={video.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{video.title}</h4>
                      <div className="text-sm text-gray-600 mt-1">
                        <p>Job: {video.jobTitle}</p>
                        <p>Client: {video.client}</p>
                        <p>Reviewed: {new Date(video.reviewedAt).toLocaleDateString()} {video.reviewedBy}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline">
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openVideoDetails(video)}>
                        <Info className="w-4 h-4 mr-1" />
                        Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-shrink-0 pt-4">
            <Button 
              onClick={() => setShowVideoArchive(false)} 
              className="w-full"
            >
              Close Archive
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Job Details Modal */}
      <Dialog open={showJobDetails} onOpenChange={setShowJobDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Info className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <DialogTitle className="text-xl">Job Details</DialogTitle>
                  <p className="text-sm text-gray-600">Comprehensive job information</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowJobDetails(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          {selectedJobForDetails && (
            <div className="flex-1 overflow-y-auto space-y-6">
              {/* Job Header */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{selectedJobForDetails.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">Job ID: {selectedJobForDetails.id}</p>
                  </div>
                  <Badge className={getStatusColor(selectedJobForDetails.status)}>
                    {selectedJobForDetails.status}
                  </Badge>
                </div>
              </div>

              {/* Client Information */}
              <div className="bg-white border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Client Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Client Name</p>
                    <p className="font-medium">{selectedJobForDetails.client}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="font-medium">{selectedJobForDetails.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{selectedJobForDetails.email || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Created Date</p>
                    <p className="font-medium">{selectedJobForDetails.createdAt}</p>
                  </div>
                </div>
              </div>

              {/* Assignment Information */}
              <div className="bg-white border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Assignment Information</h4>
                {selectedJobForDetails.assignedEmployees && selectedJobForDetails.assignedEmployees.length > 0 ? (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Assigned Employees</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedJobForDetails.assignedEmployees.map((employee, index) => (
                        <Badge key={index} className="bg-green-100 text-green-800">
                          {employee}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">No employees assigned to this job</p>
                )}
              </div>

              {/* Videos */}
              <div className="bg-white border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Service Videos</h4>
                {selectedJobForDetails.videos && selectedJobForDetails.videos.length > 0 ? (
                  <div className="space-y-3">
                    {selectedJobForDetails.videos.map((video, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{video.title}</p>
                          <p className="text-sm text-gray-600">{video.description}</p>
                          <p className="text-xs text-gray-500">Uploaded: {video.uploadedAt}</p>
                        </div>
                        <Badge className={video.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                          {video.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No videos uploaded for this job</p>
                )}
              </div>

              {/* Notes */}
              <div className="bg-white border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Notes & Comments</h4>
                {selectedJobForDetails.notes && selectedJobForDetails.notes.length > 0 ? (
                  <div className="space-y-3">
                    {selectedJobForDetails.notes.map((note, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm">{note.text}</p>
                        <p className="text-xs text-gray-500 mt-1">Added: {note.date}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No notes added to this job</p>
                )}
              </div>

              {/* Audit Trail */}
              <div className="bg-white border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Audit Trail</h4>
                {selectedJobForDetails.audit && selectedJobForDetails.audit.length > 0 ? (
                  <div className="space-y-2">
                    {selectedJobForDetails.audit.map((entry, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm text-gray-700">{entry}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No audit trail available</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJobDetails(false)}>
              Close
            </Button>
            <Button 
              onClick={() => {
                setShowJobDetails(false);
                openAssignmentModal(selectedJobForDetails);
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              <Users className="w-4 h-4 mr-2" />
              {selectedJobForDetails?.assignedEmployees?.length > 0 ? 'Reassign' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Details Modal */}
      <Dialog open={showVideoDetailsModal} onOpenChange={setShowVideoDetailsModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Video className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <DialogTitle className="text-xl">Video Details</DialogTitle>
                  <p className="text-sm text-gray-600">Comprehensive video information</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowVideoDetailsModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          {selectedVideoForDetails && (
            <div className="flex-1 overflow-y-auto space-y-6">
              {/* Video Header */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{selectedVideoForDetails.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">Video ID: {selectedVideoForDetails.id}</p>
                  </div>
                  <Badge className={selectedVideoForDetails.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {selectedVideoForDetails.status}
                  </Badge>
                </div>
              </div>

              {/* Video Preview Section */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Video Preview</h4>
                <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Video className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Video preview would be displayed here</p>
                    <p className="text-xs text-gray-500 mt-1">Duration: ~3:45 | Quality: HD</p>
                  </div>
                </div>
              </div>

              {/* Video Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Video Metadata */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Video Metadata</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">File Size:</span>
                      <span className="text-sm font-medium">24.5 MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Duration:</span>
                      <span className="text-sm font-medium">3 minutes 45 seconds</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Resolution:</span>
                      <span className="text-sm font-medium">1920x1080 (HD)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Format:</span>
                      <span className="text-sm font-medium">MP4</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Upload Date:</span>
                      <span className="text-sm font-medium">{new Date(selectedVideoForDetails.reviewedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Upload Time:</span>
                      <span className="text-sm font-medium">{new Date(selectedVideoForDetails.reviewedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>

                {/* Job Information */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Job Information</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Job Title:</span>
                      <span className="text-sm font-medium">{selectedVideoForDetails.jobTitle}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Client:</span>
                      <span className="text-sm font-medium">{selectedVideoForDetails.client}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Job Status:</span>
                      <span className="text-sm font-medium">In Progress</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Job ID:</span>
                      <span className="text-sm font-medium">JOB-{selectedVideoForDetails.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Location:</span>
                      <span className="text-sm font-medium">123 Main St, City, State</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Priority:</span>
                      <span className="text-sm font-medium">Medium</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Review Information */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Review Information</h4>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Reviewed By</p>
                      <p className="font-medium">{selectedVideoForDetails.reviewedBy}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Review Date</p>
                      <p className="font-medium">{new Date(selectedVideoForDetails.reviewedAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Review Time</p>
                      <p className="font-medium">{new Date(selectedVideoForDetails.reviewedAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">Review Notes</p>
                    <p className="text-sm bg-gray-50 p-3 rounded border">
                      {selectedVideoForDetails.status === 'approved' 
                        ? "Video quality is excellent. All safety protocols followed correctly. Work completed according to specifications."
                        : "Video quality needs improvement. Some safety protocols not clearly visible. Please re-record with better lighting."
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Audit Trail */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Audit Trail</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-600">{new Date(selectedVideoForDetails.reviewedAt).toLocaleDateString()} {new Date(selectedVideoForDetails.reviewedAt).toLocaleTimeString()}</span>
                    <span className="font-medium">Video {selectedVideoForDetails.status} by {selectedVideoForDetails.reviewedBy}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-600">{new Date(Date.now() - 86400000).toLocaleDateString()} 14:30:22</span>
                    <span className="font-medium">Video uploaded by John Smith</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span className="text-gray-600">{new Date(Date.now() - 172800000).toLocaleDateString()} 09:15:45</span>
                    <span className="font-medium">Job assigned to John Smith</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex-shrink-0 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-1" />
                  Download Video
                </Button>
                <Button variant="outline" size="sm">
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Share
                </Button>
              </div>
              <Button onClick={() => setShowVideoDetailsModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Job Modal */}
      <Dialog open={showCreateJob} onOpenChange={setShowCreateJob}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Job</DialogTitle>
            <DialogDescription>
              Create a new service job with client details and requirements.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
              <Input
                placeholder="Enter job title"
                value={newJob.title}
                onChange={(e) => setNewJob({...newJob, title: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
              <Input
                placeholder="Enter client name"
                value={newJob.client}
                onChange={(e) => setNewJob({...newJob, client: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <Input
                placeholder="Enter phone number"
                value={newJob.phone}
                onChange={(e) => setNewJob({...newJob, phone: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input
                placeholder="Enter email address"
                value={newJob.email}
                onChange={(e) => setNewJob({...newJob, email: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateJob(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateJob}>
              Create Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Upload Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Service Video</DialogTitle>
            <DialogDescription>
              Upload a video for the selected job: {selectedJob?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Video Title</label>
              <Input
                placeholder="Enter video title"
                value={newVideo.title}
                onChange={(e) => setNewVideo({...newVideo, title: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                placeholder="Enter video description"
                value={newVideo.description}
                onChange={(e) => setNewVideo({...newVideo, description: e.target.value})}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Video File</label>
              <Input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleVideoUpload}>
              Upload Video
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assignment Modal */}
      <Dialog open={showBulkAssignmentModal} onOpenChange={setShowBulkAssignmentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Assign Jobs</DialogTitle>
            <DialogDescription>
              Assign {selectedJobIds.length} selected jobs to employees.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Employees</label>
              <div className="space-y-2">
                {['John Smith', 'Mike Johnson', 'Sarah Wilson', 'David Brown'].map(employee => (
                  <label key={employee} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedEmployees.includes(employee)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEmployees([...selectedEmployees, employee]);
                        } else {
                          setSelectedEmployees(selectedEmployees.filter(emp => emp !== employee));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{employee}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkAssignmentModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleBulkAssignment(selectedEmployees)}>
              Assign Jobs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Individual Job Assignment Modal */}
      <Dialog open={showAssignmentModal} onOpenChange={setShowAssignmentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedJob?.assignedEmployees?.length > 0 ? 'Reassign Job' : 'Assign Job'}
            </DialogTitle>
            <DialogDescription>
              {selectedJob?.assignedEmployees?.length > 0 
                ? `Currently assigned to: ${selectedJob.assignedEmployees.join(', ')}`
                : 'Select employees to assign to this job.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Employees</label>
              <div className="space-y-2">
                {['John Smith', 'Mike Johnson', 'Sarah Wilson', 'David Brown'].map(employee => (
                  <label key={employee} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedEmployees.includes(employee)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEmployees([...selectedEmployees, employee]);
                        } else {
                          setSelectedEmployees(selectedEmployees.filter(emp => emp !== employee));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{employee}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignmentModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleAssignmentUpdate(selectedJob, selectedEmployees)}>
              {selectedJob?.assignedEmployees?.length > 0 ? 'Reassign' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-Approve Warning Modal */}
      <Dialog open={showAutoApproveWarning} onOpenChange={setShowAutoApproveWarning}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enable Auto-Approve?</DialogTitle>
            <DialogDescription>
              This will automatically approve videos that meet the criteria. Are you sure you want to enable this feature?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutoApproveWarning(false)}>
              Cancel
            </Button>
            <Button onClick={confirmAutoApprove}>
              Enable Auto-Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compliance Modal - Legal Security Flow */}
      <Dialog open={showComplianceModal} onOpenChange={setShowComplianceModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Legal Compliance & Security Verification
            </DialogTitle>
            <DialogDescription>
              Complete the required legal compliance steps before creating a service video.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Step 1: Location Selection */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-3">Step 1: Select Recording Location</h3>
              <div className="space-y-3">
                <label className="flex items-center space-x-3">
                  <input 
                    type="radio" 
                    name="location" 
                    value="business" 
                    checked={location === 'business'} 
                    onChange={() => setLocation('business')} 
                  />
                  <span>At Business Address (Location verification required)</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input 
                    type="radio" 
                    name="location" 
                    value="residence" 
                    checked={location === 'residence'} 
                    onChange={() => setLocation('residence')} 
                  />
                  <span>At Customer Residence (Customer consent required)</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input 
                    type="radio" 
                    name="location" 
                    value="customer-business" 
                    checked={location === 'customer-business'} 
                    onChange={() => setLocation('customer-business')} 
                  />
                  <span>At Customer Business (Customer consent + Location verification)</span>
                </label>
              </div>
            </div>

            {/* Step 2: Location-specific Requirements */}
            {location && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3">Step 2: Complete Requirements</h3>
                
                {/* Business Address Flow */}
                {location === 'business' && (
                  <div>
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-900">Location Verification Required</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            You must be at the registered business address to proceed. Your location will be verified.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-yellow-900">Legal Notice</h4>
                          <p className="text-sm text-yellow-700 mt-1">
                            By proceeding, you confirm you are present at the business address. Falsifying your location may result in account suspension and legal action. Your location and device info will be logged for compliance and security.
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button onClick={handleGeoLocationCheck} disabled={geoLoading} className="w-full">
                      {geoLoading ? 'Verifying Location...' : 'Verify My Location'}
                    </Button>
                    
                    {geoError && (
                      <div className="mt-2 p-2 bg-red-50 text-red-700 rounded text-sm">
                        {geoError}
                      </div>
                    )}
                  </div>
                )}

                {/* Customer Residence Flow */}
                {location === 'residence' && (
                  <div>
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Users className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-900">Customer Consent Required</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            Recording at a customer's residence requires explicit consent. The customer will receive a secure notification to review and agree to the terms.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-yellow-900">Legal Notice</h4>
                          <p className="text-sm text-yellow-700 mt-1">
                            By proceeding, you confirm you have informed the customer and will only record after receiving their consent. All actions will be logged for compliance and security.
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button 
                      onClick={handleRequestCustomerConsent} 
                      disabled={customerConsentStatus === 'pending' || customerConsentStatus === 'granted'}
                      className="w-full"
                    >
                      Request Customer Consent
                    </Button>
                    
                    {customerConsentStatus === 'pending' && (
                      <div className="mt-2 text-sm text-blue-600">Waiting for customer consent…</div>
                    )}
                    {customerConsentStatus === 'granted' && (
                      <div className="mt-2 text-sm text-green-600">Consent received. You may proceed.</div>
                    )}
                  </div>
                )}

                {/* Customer Business Flow */}
                {location === 'customer-business' && (
                  <div>
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Users className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-900">Customer Consent & Location Verification</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            Recording at a customer's business address requires both customer consent and location verification. The customer will receive a secure link to review and agree to the terms before you can proceed. You may also be asked to verify your location.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-yellow-900">Legal Notice</h4>
                          <p className="text-sm text-yellow-700 mt-1">
                            By proceeding, you confirm you have informed the customer and will only record after receiving their consent. Your location and device info may be logged for compliance and security.
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button 
                      onClick={handleRequestCustomerConsent} 
                      disabled={customerConsentStatus === 'pending' || customerConsentStatus === 'granted'}
                      className="w-full"
                    >
                      Request Customer Consent
                    </Button>
                    
                    {customerConsentStatus === 'pending' && (
                      <div className="mt-2 text-sm text-blue-600">Waiting for customer consent…</div>
                    )}
                    {customerConsentStatus === 'granted' && (
                      <div className="mt-2 text-sm text-green-600">Consent received. You may proceed.</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Proceed to Video Creation */}
            {location && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3">Step 3: Proceed to Video Creation</h3>
                
                {/* Business Address - Show after location verification */}
                {location === 'business' && consentStatus === 'granted' && (
                  <div>
                    <div className="mb-4 p-3 bg-green-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-green-900">Location Verified</h4>
                          <p className="text-sm text-green-700 mt-1">
                            Your location has been verified. You may proceed to create the service video.
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button onClick={handleContinue} className="w-full bg-green-600 hover:bg-green-700">
                      Continue to Video Creation
                    </Button>
                  </div>
                )}

                {/* Customer Residence - Show after consent */}
                {location === 'residence' && customerConsentStatus === 'granted' && (
                  <div>
                    <div className="mb-4 p-3 bg-green-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-green-900">Customer Consent Received</h4>
                          <p className="text-sm text-green-700 mt-1">
                            Customer consent has been received. You may proceed to create the service video.
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button onClick={handleContinue} className="w-full bg-green-600 hover:bg-green-700">
                      Continue to Video Creation
                    </Button>
                  </div>
                )}

                {/* Customer Business - Show after consent */}
                {location === 'customer-business' && customerConsentStatus === 'granted' && (
                  <div>
                    <div className="mb-4 p-3 bg-green-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-green-900">Customer Consent Received</h4>
                          <p className="text-sm text-green-700 mt-1">
                            Customer consent has been received. You may proceed to create the service video.
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button onClick={handleContinue} className="w-full bg-green-600 hover:bg-green-700">
                      Continue to Video Creation
                    </Button>
                  </div>
                )}

                {/* Show waiting states */}
                {(location === 'customer-residence' || location === 'customer-business') && consentStatus === 'pending' && (
                  <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Clock className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-yellow-900">Waiting for Customer Consent</h4>
                        <p className="text-sm text-yellow-700 mt-1">
                          Waiting for customer consent...
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Show declined states */}
                {(location === 'customer-residence' || location === 'customer-business') && consentStatus === 'declined' && (
                  <div className="mb-4 p-3 bg-red-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <X className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-red-900">Customer Consent Declined</h4>
                        <p className="text-sm text-red-700 mt-1">
                          Customer has declined consent. You cannot proceed with video creation.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Fraud Prevention Warning */}
            {isBlocked && (
              <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-900">Access Temporarily Blocked</h4>
                    <p className="text-sm text-red-700 mt-1">{blockReason}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComplianceModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Available Employees Section */}
      <div className="mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-green-800 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Available Employees
            </h3>
            <Badge className="bg-green-100 text-green-800">
              {getAvailableEmployees().length} available
            </Badge>
          </div>
          
          {getAvailableEmployees().length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {getAvailableEmployees().map(employee => (
                <div key={employee.id} className="bg-white border border-green-200 rounded-lg p-3 flex items-center gap-3">
                  <img 
                    src={employee.photo} 
                    alt={employee.name} 
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="font-medium text-gray-900">{employee.name}</p>
                    <p className="text-sm text-green-600">Available for assignment</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-600">All employees are currently assigned to jobs</p>
            </div>
          )}
        </div>
      </div>

      {/* Archived Jobs Section */}
      {showArchivedJobs && (
        <div className="mb-6">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-orange-800 flex items-center gap-2">
                <HardDrive className="w-5 h-5" />
                Archived Jobs
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={jobArchiveFilter}
                  onChange={(e) => setJobArchiveFilter(e.target.value)}
                  className="px-3 py-1 text-sm border border-orange-300 rounded bg-white"
                >
                  <option value="all">All Archived</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <Badge className="bg-orange-100 text-orange-800">
                  {getFilteredArchivedJobs().length} archived
                </Badge>
              </div>
            </div>
            
            {getFilteredArchivedJobs().length > 0 ? (
              <div className="space-y-3">
                {getFilteredArchivedJobs().map(job => (
                  <div key={job.id} className="bg-white border border-orange-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{job.title}</h4>
                        <div className="text-sm text-gray-600 mt-1">
                          <p>Client: {job.client}</p>
                          <p>Archived: {new Date(job.archivedAt).toLocaleDateString()}</p>
                          <p className="text-orange-600">Reason: {job.archiveReason}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => unarchiveJob(job)}
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          <ArrowLeft className="w-4 h-4 mr-1" />
                          Restore
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-600">No archived jobs found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Jobs List */}
      <div className="space-y-4">
        {selectedJobIds.length > 0 && (
          <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-900">
                {selectedJobIds.length} job{selectedJobIds.length > 1 ? 's' : ''} selected
              </span>
              <Button size="sm" variant="outline" onClick={selectAllJobs}>
                Select All
              </Button>
              <Button size="sm" variant="outline" onClick={clearSelection}>
                Clear Selection
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                onClick={() => setShowBulkAssignmentModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Users className="w-4 h-4 mr-1" />
                Assign to Employees
              </Button>
            </div>
          </div>
        )}
        
        {filteredJobs.map(job => (
          <Card key={job.id} className={`hover:shadow-md transition-shadow ${selectedJobIds.includes(job.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedJobIds.includes(job.id)}
                    onChange={() => toggleJobSelection(job.id)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <div>
                    <CardTitle className="text-xl">{job.title}</CardTitle>
                    <p className="text-gray-600">Client: {job.client}</p>
                    <p className="text-gray-600">Phone: {job.phone}</p>
                    <p className="text-gray-600">Created: {job.createdAt}</p>
                    {job.assignedEmployees && job.assignedEmployees.length > 0 && (
                      <p className="text-sm text-blue-600 mt-1">
                        Assigned: {job.assignedEmployees.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(job.status)}>
                    {job.status}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => openJobDetails(job)}>
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => openAssignmentModal(job)}
                    className="text-green-600 border-green-200 hover:bg-green-50"
                  >
                    <Users className="w-4 h-4 mr-1" />
                    {job.assignedEmployees && job.assignedEmployees.length > 0 ? 'Reassign' : 'Assign'}
                  </Button>
                  {job.status === 'in-progress' && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleJobApproval(job, true, 'Job completed successfully')}
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                  )}
                  {job.status === 'completed' && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => archiveJob(job, 'Manually archived to reduce clutter')}
                      className="text-orange-600 border-orange-200 hover:bg-orange-50"
                    >
                      <HardDrive className="w-4 h-4 mr-1" />
                      Archive
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
} 