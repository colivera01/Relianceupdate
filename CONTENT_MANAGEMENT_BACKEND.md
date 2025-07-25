# Content Management Backend Integration

## Overview
Backend integration notes for content management system including video/image upload, approval workflow, content delivery to customers, and content archiving.

## Content Upload & Management

### Upload Content
```http
POST /api/content/upload
```
**Request Body:** (multipart/form-data)
- `file` - Media file (video, image, document)
- `jobId` - Associated job ID
- `contentType` - video, image, or document
- `title` - Content title
- `description` - Content description
- `metadata` - Additional metadata (JSON)

**Response:**
```json
{
  "id": "content_123",
  "jobId": "job_456",
  "contentType": "video",
  "title": "Deep House Cleaning - Kitchen",
  "description": "Kitchen cleaning process",
  "fileUrl": "https://storage.projectreliance.com/content/video_123.mp4",
  "thumbnailUrl": "https://storage.projectreliance.com/thumbnails/video_123.jpg",
  "fileSize": 52428800,
  "duration": 180,
  "status": "pending_approval",
  "uploadedAt": "2024-01-20T10:30:00Z",
  "metadata": {
    "resolution": "1920x1080",
    "format": "mp4",
    "bitrate": "5000kbps"
  }
}
```

### Get Job Content
```http
GET /api/jobs/{jobId}/content
```
**Query Parameters:**
- `status` - Filter by content status
- `type` - Filter by content type

**Response:**
```json
{
  "jobId": "job_456",
  "content": [
    {
      "id": "content_123",
      "contentType": "video",
      "title": "Deep House Cleaning - Kitchen",
      "description": "Kitchen cleaning process",
      "fileUrl": "https://storage.projectreliance.com/content/video_123.mp4",
      "thumbnailUrl": "https://storage.projectreliance.com/thumbnails/video_123.jpg",
      "status": "pending_approval",
      "uploadedAt": "2024-01-20T10:30:00Z",
      "uploadedBy": "employee_789",
      "duration": 180,
      "fileSize": 52428800
    }
  ],
  "summary": {
    "totalContent": 3,
    "pendingApproval": 2,
    "approved": 1,
    "delivered": 0
  }
}
```

### Get Content Details
```http
GET /api/content/{contentId}
```

**Response:**
```json
{
  "id": "content_123",
  "jobId": "job_456",
  "contentType": "video",
  "title": "Deep House Cleaning - Kitchen",
  "description": "Kitchen cleaning process",
  "fileUrl": "https://storage.projectreliance.com/content/video_123.mp4",
  "thumbnailUrl": "https://storage.projectreliance.com/thumbnails/video_123.jpg",
  "fileSize": 52428800,
  "duration": 180,
  "status": "pending_approval",
  "uploadedAt": "2024-01-20T10:30:00Z",
  "uploadedBy": "employee_789",
  "approvedAt": null,
  "approvedBy": null,
  "deliveredAt": null,
  "archivedAt": null,
  "metadata": {
    "resolution": "1920x1080",
    "format": "mp4",
    "bitrate": "5000kbps"
  },
  "approvalHistory": [
    {
      "action": "uploaded",
      "timestamp": "2024-01-20T10:30:00Z",
      "userId": "employee_789",
      "notes": "Kitchen cleaning video uploaded"
    }
  ]
}
```

## Approval Workflow

### Get Pending Approvals
```http
GET /api/vendors/{vendorId}/content/pending-approval
```
**Query Parameters:**
- `jobId` - Filter by specific job
- `contentType` - Filter by content type
- `page` - Page number for pagination
- `limit` - Number of items per page

**Response:**
```json
{
  "pendingApprovals": [
    {
      "id": "content_123",
      "jobId": "job_456",
      "contentType": "video",
      "title": "Deep House Cleaning - Kitchen",
      "description": "Kitchen cleaning process",
      "thumbnailUrl": "https://storage.projectreliance.com/thumbnails/video_123.jpg",
      "uploadedAt": "2024-01-20T10:30:00Z",
      "uploadedBy": {
        "id": "employee_789",
        "name": "Mike Johnson",
        "avatar": "https://..."
      },
      "job": {
        "id": "job_456",
        "title": "Deep House Cleaning",
        "clientName": "Jane Doe",
        "address": "123 Main St, Downtown, NY 10001"
      },
      "duration": 180,
      "fileSize": 52428800
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

### Approve Content
```http
POST /api/content/{contentId}/approve
```
**Request Body:**
```json
{
  "approved": true,
  "notes": "Content meets quality standards",
  "autoDeliver": true
}
```

**Response:**
```json
{
  "success": true,
  "contentId": "content_123",
  "status": "approved",
  "approvedAt": "2024-01-20T11:00:00Z",
  "approvedBy": "vendor_123",
  "notes": "Content meets quality standards",
  "deliveryScheduled": true,
  "deliveryTime": "2024-01-20T11:05:00Z"
}
```

### Reject Content
```http
POST /api/content/{contentId}/reject
```
**Request Body:**
```json
{
  "reason": "Poor video quality",
  "notes": "Please re-record with better lighting",
  "allowResubmission": true
}
```

**Response:**
```json
{
  "success": true,
  "contentId": "content_123",
  "status": "rejected",
  "rejectedAt": "2024-01-20T11:00:00Z",
  "rejectedBy": "vendor_123",
  "reason": "Poor video quality",
  "notes": "Please re-record with better lighting",
  "canResubmit": true
}
```

### Get Approval History
```http
GET /api/content/{contentId}/approval-history
```

**Response:**
```json
{
  "contentId": "content_123",
  "history": [
    {
      "action": "uploaded",
      "timestamp": "2024-01-20T10:30:00Z",
      "userId": "employee_789",
      "userName": "Mike Johnson",
      "notes": "Kitchen cleaning video uploaded"
    },
    {
      "action": "approved",
      "timestamp": "2024-01-20T11:00:00Z",
      "userId": "vendor_123",
      "userName": "Sparkle Cleaners",
      "notes": "Content meets quality standards"
    }
  ]
}
```

## Content Delivery

### Deliver Content to Customer
```http
POST /api/content/{contentId}/deliver
```
**Request Body:**
```json
{
  "deliveryMethod": "email",
  "notificationMessage": "Your cleaning service video is ready!",
  "startCountdown": true
}
```

**Response:**
```json
{
  "success": true,
  "contentId": "content_123",
  "deliveredAt": "2024-01-20T11:05:00Z",
  "deliveredTo": "user_456",
  "deliveryMethod": "email",
  "countdownStarted": true,
  "countdownExpires": "2024-01-23T11:05:00Z",
  "notificationSent": true
}
```

### Get Customer Delivery Status
```http
GET /api/content/{contentId}/delivery-status
```

**Response:**
```json
{
  "contentId": "content_123",
  "deliveredAt": "2024-01-20T11:05:00Z",
  "deliveredTo": "user_456",
  "status": "delivered",
  "viewedAt": null,
  "countdownExpires": "2024-01-23T11:05:00Z",
  "timeRemaining": 259200, // seconds
  "notifications": [
    {
      "type": "email",
      "sentAt": "2024-01-20T11:05:00Z",
      "status": "delivered"
    },
    {
      "type": "push",
      "sentAt": "2024-01-20T11:05:00Z",
      "status": "delivered"
    }
  ]
}
```

### Mark Content as Viewed
```http
POST /api/content/{contentId}/viewed
```
**Request Body:**
```json
{
  "viewedAt": "2024-01-20T12:00:00Z",
  "viewDuration": 180,
  "deviceInfo": {
    "platform": "web",
    "browser": "Chrome",
    "version": "120.0"
  }
}
```

**Response:**
```json
{
  "success": true,
  "contentId": "content_123",
  "viewedAt": "2024-01-20T12:00:00Z",
  "countdownStarted": true,
  "countdownExpires": "2024-01-23T12:00:00Z"
}
```

## Content Archiving

### Archive Content
```http
POST /api/content/{contentId}/archive
```
**Request Body:**
```json
{
  "reason": "Customer review completed",
  "archiveType": "automatic",
  "retentionPeriod": 365 // days
}
```

**Response:**
```json
{
  "success": true,
  "contentId": "content_123",
  "archivedAt": "2024-01-20T15:00:00Z",
  "archivedBy": "system",
  "reason": "Customer review completed",
  "retentionPeriod": 365,
  "expiresAt": "2025-01-20T15:00:00Z"
}
```

### Get Archived Content
```http
GET /api/vendors/{vendorId}/content/archived
```
**Query Parameters:**
- `jobId` - Filter by specific job
- `dateFrom` - Filter from date
- `dateTo` - Filter to date
- `page` - Page number for pagination
- `limit` - Number of items per page

**Response:**
```json
{
  "archivedContent": [
    {
      "id": "content_123",
      "jobId": "job_456",
      "contentType": "video",
      "title": "Deep House Cleaning - Kitchen",
      "thumbnailUrl": "https://storage.projectreliance.com/thumbnails/video_123.jpg",
      "archivedAt": "2024-01-20T15:00:00Z",
      "archivedBy": "system",
      "reason": "Customer review completed",
      "expiresAt": "2025-01-20T15:00Z",
      "job": {
        "id": "job_456",
        "title": "Deep House Cleaning",
        "clientName": "Jane Doe",
        "completedAt": "2024-01-20T13:00:00Z"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

### Restore Archived Content
```http
POST /api/content/{contentId}/restore
```
**Request Body:**
```json
{
  "reason": "Customer requested access"
}
```

**Response:**
```json
{
  "success": true,
  "contentId": "content_123",
  "restoredAt": "2024-01-20T16:00:00Z",
  "restoredBy": "vendor_123",
  "status": "approved"
}
```

## Content Analytics

### Get Content Analytics
```http
GET /api/content/analytics
```
**Query Parameters:**
- `vendorId` - Filter by vendor
- `period` - daily, weekly, monthly, yearly
- `dateFrom` - Start date
- `dateTo` - End date

**Response:**
```json
{
  "period": "monthly",
  "totalContent": 150,
  "contentByType": {
    "video": 120,
    "image": 25,
    "document": 5
  },
  "contentByStatus": {
    "pending_approval": 15,
    "approved": 100,
    "delivered": 80,
    "archived": 35
  },
  "approvalMetrics": {
    "averageApprovalTime": 2.5, // hours
    "approvalRate": 85.5,
    "rejectionRate": 14.5
  },
  "deliveryMetrics": {
    "averageDeliveryTime": 1.2, // hours
    "viewRate": 78.5,
    "averageViewDuration": 145 // seconds
  },
  "topContent": [
    {
      "id": "content_123",
      "title": "Deep House Cleaning - Kitchen",
      "views": 45,
      "averageViewDuration": 180,
      "rating": 4.8
    }
  ]
}
```

## Content Processing

### Process Video Content
```http
POST /api/content/{contentId}/process
```
**Request Body:**
```json
{
  "processingOptions": {
    "generateThumbnail": true,
    "extractMetadata": true,
    "optimizeQuality": true,
    "createPreview": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "contentId": "content_123",
  "processingJobId": "process_789",
  "status": "processing",
  "estimatedCompletion": "2024-01-20T11:30:00Z"
}
```

### Get Processing Status
```http
GET /api/content/{contentId}/processing-status
```

**Response:**
```json
{
  "contentId": "content_123",
  "processingJobId": "process_789",
  "status": "completed",
  "progress": 100,
  "startedAt": "2024-01-20T11:00:00Z",
  "completedAt": "2024-01-20T11:25:00Z",
  "results": {
    "thumbnailGenerated": true,
    "metadataExtracted": true,
    "qualityOptimized": true,
    "previewCreated": true
  }
}
```

## Content Security

### Generate Secure URL
```http
POST /api/content/{contentId}/secure-url
```
**Request Body:**
```json
{
  "expiresIn": 3600, // seconds
  "maxViews": 1,
  "watermark": true
}
```

**Response:**
```json
{
  "contentId": "content_123",
  "secureUrl": "https://storage.projectreliance.com/secure/content_123?token=abc123",
  "expiresAt": "2024-01-20T12:00:00Z",
  "maxViews": 1,
  "currentViews": 0
}
```

### Validate Content Access
```http
POST /api/content/{contentId}/validate-access
```
**Request Body:**
```json
{
  "token": "abc123",
  "userId": "user_456"
}
```

**Response:**
```json
{
  "valid": true,
  "contentId": "content_123",
  "accessGranted": true,
  "expiresAt": "2024-01-20T12:00:00Z",
  "viewsRemaining": 1
}
```

## Real-time Content Updates

### WebSocket Events

#### Content Status Updates
```javascript
// Subscribe to content status updates
socket.emit('subscribe_content', { contentId: 'content_123' });

// Receive content status updates
socket.on('content_status_update', (data) => {
  console.log('Content status updated:', data);
  // {
  //   contentId: 'content_123',
  //   status: 'approved',
  //   approvedAt: '2024-01-20T11:00:00Z',
  //   approvedBy: 'vendor_123'
  // }
});
```

#### Content Delivery Notifications
```javascript
// Subscribe to content delivery updates
socket.emit('subscribe_content_delivery', { contentId: 'content_123' });

// Receive delivery updates
socket.on('content_delivered', (data) => {
  console.log('Content delivered:', data);
  // {
  //   contentId: 'content_123',
  //   deliveredAt: '2024-01-20T11:05:00Z',
  //   deliveredTo: 'user_456',
  //   countdownExpires: '2024-01-23T11:05:00Z'
  // }
});
```

#### Content View Notifications
```javascript
// Subscribe to content view updates
socket.emit('subscribe_content_views', { contentId: 'content_123' });

// Receive view updates
socket.on('content_viewed', (data) => {
  console.log('Content viewed:', data);
  // {
  //   contentId: 'content_123',
  //   viewedAt: '2024-01-20T12:00:00Z',
  //   viewedBy: 'user_456',
  //   viewDuration: 180
  // }
});
```

This backend integration provides comprehensive content management with approval workflow, delivery system, and archiving capabilities. 