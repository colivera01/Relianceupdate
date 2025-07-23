'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Plus, 
  Users, 
  Video, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Play,
  Download,
  Eye,
  Send,
  Bell,
  Smartphone,
  Settings,
  ArrowRight
} from 'lucide-react';

// BACKEND DEVELOPER NOTES:
// - POST /api/vendor/jobs/create-with-assignment - Create job and assign employee in one call
// - POST /api/vendor/jobs/:jobId/initiate-video - Start video creation process
// - GET /api/vendor/jobs/:jobId/videos/pending - Get videos pending approval
// - POST /api/vendor/jobs/:jobId/videos/:videoId/approve - Approve video for client
// - POST /api/vendor/jobs/:jobId/videos/:videoId/reject - Reject video with reason
// - POST /api/vendor/notifications/send - Send notifications to employees
// - GET /api/vendor/employees/available - Get available employees for assignment

// Enhanced workflow demonstration
export default function EnhancedWorkflow() {
  const [workflowStep, setWorkflowStep] = useState(1);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [showVideoApproval, setShowVideoApproval] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);

  const workflowSteps = [
    {
      id: 1,
      title: "Create Job",
      description: "Manager creates job with client details",
      icon: Plus,
      managerAction: "Create job and assign employee",
      employeeAction: "Receive job notification",
      status: "completed"
    },
    {
      id: 2,
      title: "Employee Assignment",
      description: "Assign job to available employee",
      icon: Users,
      managerAction: "Select employee and send assignment",
      employeeAction: "Accept job assignment",
      status: "completed"
    },
    {
      id: 3,
      title: "Initiate Video Process",
      description: "Manager starts video creation workflow",
      icon: Video,
      managerAction: "Initiate video recording process",
      employeeAction: "Receive video recording request",
      status: "active"
    },
    {
      id: 4,
      title: "Employee Records Video",
      description: "Employee records service video on-site",
      icon: Smartphone,
      managerAction: "Monitor recording progress",
      employeeAction: "Record and upload video",
      status: "pending"
    },
    {
      id: 5,
      title: "Manager Reviews",
      description: "Manager reviews and approves video",
      icon: Eye,
      managerAction: "Review video and approve/reject",
      employeeAction: "Receive approval status",
      status: "pending"
    },
    {
      id: 6,
      title: "Client Delivery",
      description: "Approved video sent to client",
      icon: Send,
      managerAction: "Release video to client",
      employeeAction: "Job completed",
      status: "pending"
    }
  ];

  const mockJobs = [
    {
      id: 1,
      title: 'Water Heater Repair',
      client: 'John Smith',
      status: 'in-progress',
      assignedEmployee: 'Mike Johnson',
      employeeStatus: 'on-site',
      videoStatus: 'recording',
      createdAt: '2024-01-15',
      estimatedCompletion: '2024-01-20',
      videos: [
        {
          id: 1,
          title: 'Initial Assessment',
          status: 'pending-approval',
          uploadedAt: '2024-01-15 10:30',
          duration: '2:45',
          employee: 'Mike Johnson'
        }
      ]
    }
  ];

  const mockEmployees = [
    { id: 1, name: 'Mike Johnson', status: 'available', lastActive: '2 minutes ago' },
    { id: 2, name: 'Lisa Chen', status: 'busy', lastActive: '15 minutes ago' },
    { id: 3, name: 'David Wilson', status: 'available', lastActive: '5 minutes ago' }
  ];

  const handleCreateJobWithAssignment = () => {
    // Simulate creating job and assigning employee
    console.log('Creating job with employee assignment...');
    setWorkflowStep(2);
  };

  const handleInitiateVideoProcess = () => {
    // Simulate initiating video recording process
    console.log('Initiating video recording process...');
    setWorkflowStep(3);
  };

  const handleApproveVideo = (videoId) => {
    // Simulate video approval
    console.log('Video approved:', videoId);
    setShowVideoApproval(false);
  };

  const handleRejectVideo = (videoId, reason) => {
    // Simulate video rejection
    console.log('Video rejected:', videoId, 'Reason:', reason);
    setShowVideoApproval(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Workflow Overview */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-2xl font-bold mb-6">Enhanced Workflow: Manager & Employee Collaboration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflowSteps.map((step, index) => (
            <Card key={step.id} className={`relative ${
              step.status === 'active' ? 'ring-2 ring-blue-500' : 
              step.status === 'completed' ? 'bg-green-50' : 'bg-gray-50'
            }`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    step.status === 'completed' ? 'bg-green-500 text-white' :
                    step.status === 'active' ? 'bg-blue-500 text-white' :
                    'bg-gray-300 text-gray-600'
                  }`}>
                    <step.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="text-sm text-gray-600">{step.description}</p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="bg-white p-2 rounded border">
                    <span className="font-medium text-blue-600">Manager:</span>
                    <p className="text-gray-700">{step.managerAction}</p>
                  </div>
                  <div className="bg-white p-2 rounded border">
                    <span className="font-medium text-green-600">Employee:</span>
                    <p className="text-gray-700">{step.employeeAction}</p>
                  </div>
                </div>
                
                {index < workflowSteps.length - 1 && (
                  <ArrowRight className="w-6 h-6 text-gray-400 absolute -right-3 top-1/2 transform -translate-y-1/2 hidden lg:block" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Manager Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Job & Assign */}
        <Card className="bg-white shadow-sm border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create Job & Assign Employee
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Recommended Workflow:</h4>
              <ol className="text-sm text-blue-800 space-y-1">
                <li>1. Create job with client details</li>
                <li>2. Select available employee</li>
                <li>3. Send assignment notification</li>
                <li>4. Employee receives job on mobile app</li>
              </ol>
            </div>
            
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => setShowCreateJob(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Job & Assign
            </Button>
          </CardContent>
        </Card>

        {/* Video Management */}
        <Card className="bg-white shadow-sm border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              Video Approval Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">Video Workflow:</h4>
              <ol className="text-sm text-green-800 space-y-1">
                <li>1. Manager initiates video process</li>
                <li>2. Employee records on mobile app</li>
                <li>3. Video uploaded for review</li>
                <li>4. Manager approves/rejects</li>
                <li>5. Approved video sent to client</li>
              </ol>
            </div>
            
            <Button 
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={() => setShowVideoApproval(true)}
            >
              <Eye className="w-4 h-4 mr-2" />
              Review Pending Videos
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Employee Status Dashboard */}
      <Card className="bg-white shadow-sm border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Employee Status Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mockEmployees.map(employee => (
              <div key={employee.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className={`w-3 h-3 rounded-full ${
                  employee.status === 'available' ? 'bg-green-500' : 'bg-yellow-500'
                }`}></div>
                <div className="flex-1">
                  <p className="font-medium">{employee.name}</p>
                  <p className="text-sm text-gray-600">
                    {employee.status} • {employee.lastActive}
                  </p>
                </div>
                <Badge className={
                  employee.status === 'available' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }>
                  {employee.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create Job Modal */}
      <Dialog open={showCreateJob} onOpenChange={setShowCreateJob}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Job & Assign Employee</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Job Title</label>
              <Input placeholder="e.g., Water Heater Repair" />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Client Name</label>
              <Input placeholder="e.g., John Smith" />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Client Phone</label>
              <Input placeholder="(555) 123-4567" />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Client Email</label>
              <Input placeholder="client@example.com" />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Assign Employee</label>
              <select className="w-full p-2 border rounded-md">
                <option>Select employee...</option>
                {mockEmployees.filter(emp => emp.status === 'available').map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} (Available)</option>
                ))}
              </select>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={handleCreateJobWithAssignment}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create & Assign
              </Button>
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setShowCreateJob(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Approval Modal */}
      <Dialog open={showVideoApproval} onOpenChange={setShowVideoApproval}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Pending Videos</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {mockJobs[0].videos.map(video => (
              <div key={video.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium">{video.title}</h4>
                    <p className="text-sm text-gray-600">
                      Uploaded by {video.employee} on {video.uploadedAt}
                    </p>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-800">
                    Pending Review
                  </Badge>
                </div>
                
                <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center mb-3">
                  <div className="text-center text-white">
                    <Play className="w-12 h-12 mx-auto mb-2" />
                    <p>Video Preview</p>
                    <p className="text-sm">Duration: {video.duration}</p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => handleApproveVideo(video.id)}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve & Send to Client
                  </Button>
                  <Button 
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleRejectVideo(video.id, 'Quality issues')}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Workflow Benefits */}
      <Card className="bg-white shadow-sm border">
        <CardHeader>
          <CardTitle>Workflow Benefits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-blue-900 mb-3">For Managers:</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• Centralized job creation and assignment</li>
                <li>• Real-time employee status monitoring</li>
                <li>• Video quality control before client delivery</li>
                <li>• Automated notifications and reminders</li>
                <li>• Complete audit trail for compliance</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-green-900 mb-3">For Employees:</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• Simple mobile interface for job management</li>
                <li>• Easy video recording with legal compliance</li>
                <li>• Clear job status and instructions</li>
                <li>• Offline capability for remote locations</li>
                <li>• Instant feedback on video approval</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 