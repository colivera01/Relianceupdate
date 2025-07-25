# Vendor Dashboard Backend Integration

## Overview
Backend integration notes for vendor dashboard features including client statistics, team member management, and real-time status tracking.

## Client Statistics API

### Get Client Statistics
```http
GET /api/vendors/{vendorId}/dashboard/clients
```

**Response:**
```json
{
  "totalClients": 45,
  "activeClients": 32,
  "inactiveClients": 13,
  "newClientsThisMonth": 8,
  "clientGrowth": {
    "percentage": 15.2,
    "trend": "up"
  },
  "topClients": [
    {
      "id": "client_123",
      "name": "Jane Doe",
      "totalBookings": 12,
      "totalSpent": 1800.00,
      "lastBooking": "2024-01-15T10:30:00Z",
      "rating": 5
    }
  ],
  "clientRetention": {
    "rate": 78.5,
    "returningClients": 28,
    "oneTimeClients": 17
  }
}
```

### Get Client Details
```http
GET /api/vendors/{vendorId}/clients/{clientId}
```

**Response:**
```json
{
  "id": "client_123",
  "name": "Jane Doe",
  "email": "jane.doe@email.com",
  "phone": "+1234567890",
  "address": "123 Main St, Downtown, NY 10001",
  "totalBookings": 12,
  "totalSpent": 1800.00,
  "averageRating": 4.8,
  "preferredServices": ["Deep House Cleaning", "Window Cleaning"],
  "bookingHistory": [
    {
      "id": "booking_123",
      "serviceName": "Deep House Cleaning",
      "date": "2024-01-15",
      "status": "completed",
      "price": 150.00,
      "rating": 5
    }
  ],
  "communicationHistory": [
    {
      "type": "message",
      "content": "When will you arrive?",
      "timestamp": "2024-01-15T09:30:00Z"
    }
  ]
}
```

## Team Member Management API

### Get Team Members
```http
GET /api/vendors/{vendorId}/employees
```

**Response:**
```json
{
  "totalEmployees": 8,
  "onlineEmployees": 5,
  "offlineEmployees": 3,
  "employees": [
    {
      "id": "employee_123",
      "firstName": "Mike",
      "lastName": "Johnson",
      "email": "mike@sparklecleaners.com",
      "phone": "+1234567890",
      "avatarUrl": "https://...",
      "role": "Senior Cleaner",
      "status": "active",
      "isOnline": true,
      "lastActive": "2024-01-20T10:30:00Z",
      "hourlyRate": 25.00,
      "skills": ["Deep Cleaning", "Window Cleaning", "Carpet Cleaning"],
      "currentJob": {
        "id": "job_123",
        "title": "Deep House Cleaning",
        "clientName": "Jane Doe",
        "address": "123 Main St, Downtown, NY 10001",
        "startTime": "2024-01-20T10:00:00Z",
        "estimatedEndTime": "2024-01-20T13:00:00Z"
      },
      "stats": {
        "jobsCompleted": 45,
        "averageRating": 4.7,
        "totalHours": 180,
        "earnings": 4500.00
      }
    }
  ]
}
```

### Update Employee Online Status
```http
PATCH /api/vendors/{vendorId}/employees/{employeeId}/status
```

**Request Body:**
```json
{
  "isOnline": true,
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "123 Main St, Downtown, NY 10001"
  }
}
```

### Get Employee Performance
```http
GET /api/vendors/{vendorId}/employees/{employeeId}/performance
```

**Query Parameters:**
- `period` - daily, weekly, monthly, yearly
- `date_from` - Start date
- `date_to` - End date

**Response:**
```json
{
  "employeeId": "employee_123",
  "period": "monthly",
  "stats": {
    "jobsCompleted": 12,
    "jobsCancelled": 1,
    "averageRating": 4.7,
    "totalHours": 48,
    "earnings": 1200.00,
    "onTimePercentage": 95.8,
    "customerSatisfaction": 4.6
  },
  "trends": {
    "jobsCompleted": {
      "current": 12,
      "previous": 10,
      "change": 20.0
    },
    "averageRating": {
      "current": 4.7,
      "previous": 4.5,
      "change": 4.4
    }
  },
  "recentJobs": [
    {
      "id": "job_123",
      "title": "Deep House Cleaning",
      "clientName": "Jane Doe",
      "date": "2024-01-20",
      "rating": 5,
      "duration": 180,
      "earnings": 100.00
    }
  ]
}
```

## Real-time Status Tracking

### WebSocket Events

#### Employee Status Updates
```javascript
// Subscribe to employee status updates
socket.emit('subscribe_employees', { vendorId: 'vendor_123' });

// Receive employee status updates
socket.on('employee_status_update', (data) => {
  console.log('Employee status updated:', data);
  // {
  //   employeeId: 'employee_123',
  //   isOnline: true,
  //   lastActive: '2024-01-20T10:30:00Z',
  //   currentJob: { ... },
  //   location: { latitude: 40.7128, longitude: -74.0060 }
  // }
});
```

#### Job Status Updates
```javascript
// Subscribe to job updates
socket.emit('subscribe_jobs', { vendorId: 'vendor_123' });

// Receive job status updates
socket.on('job_status_update', (data) => {
  console.log('Job status updated:', data);
  // {
  //   jobId: 'job_123',
  //   status: 'in-progress',
  //   assignedEmployee: 'employee_123',
  //   startTime: '2024-01-20T10:00:00Z',
  //   estimatedEndTime: '2024-01-20T13:00:00Z'
  // }
});
```

#### Client Activity Updates
```javascript
// Subscribe to client activity
socket.emit('subscribe_clients', { vendorId: 'vendor_123' });

// Receive client activity updates
socket.on('client_activity', (data) => {
  console.log('Client activity:', data);
  // {
  //   clientId: 'client_123',
  //   activity: 'new_booking',
  //   bookingId: 'booking_456',
  //   timestamp: '2024-01-20T10:30:00Z'
  // }
});
```

## Dashboard Analytics API

### Get Dashboard Overview
```http
GET /api/vendors/{vendorId}/dashboard/overview
```

**Response:**
```json
{
  "today": {
    "bookings": 5,
    "completedJobs": 3,
    "revenue": 750.00,
    "pendingJobs": 2
  },
  "thisWeek": {
    "bookings": 25,
    "completedJobs": 20,
    "revenue": 3750.00,
    "pendingJobs": 5
  },
  "thisMonth": {
    "bookings": 95,
    "completedJobs": 88,
    "revenue": 14250.00,
    "pendingJobs": 7
  },
  "trends": {
    "revenue": {
      "current": 14250.00,
      "previous": 12800.00,
      "change": 11.3
    },
    "bookings": {
      "current": 95,
      "previous": 82,
      "change": 15.9
    },
    "rating": {
      "current": 4.7,
      "previous": 4.6,
      "change": 2.2
    }
  },
  "upcomingBookings": [
    {
      "id": "booking_123",
      "serviceName": "Deep House Cleaning",
      "clientName": "Jane Doe",
      "date": "2024-01-20",
      "time": "10:00",
      "assignedEmployee": "Mike Johnson"
    }
  ],
  "recentReviews": [
    {
      "id": "review_123",
      "clientName": "John Smith",
      "rating": 5,
      "review": "Excellent service! Very professional.",
      "date": "2024-01-19T15:30:00Z"
    }
  ]
}
```

### Get Revenue Analytics
```http
GET /api/vendors/{vendorId}/dashboard/revenue
```

**Query Parameters:**
- `period` - daily, weekly, monthly, yearly
- `date_from` - Start date
- `date_to` - End date

**Response:**
```json
{
  "period": "monthly",
  "totalRevenue": 14250.00,
  "averageRevenue": 475.00,
  "revenueGrowth": 11.3,
  "breakdown": {
    "byService": [
      {
        "serviceName": "Deep House Cleaning",
        "revenue": 8000.00,
        "percentage": 56.1
      },
      {
        "serviceName": "Window Cleaning",
        "revenue": 4250.00,
        "percentage": 29.8
      }
    ],
    "byEmployee": [
      {
        "employeeName": "Mike Johnson",
        "revenue": 6000.00,
        "percentage": 42.1
      }
    ]
  },
  "dailyRevenue": [
    {
      "date": "2024-01-01",
      "revenue": 450.00,
      "bookings": 3
    }
  ]
}
```

## Job Assignment & Management

### Assign Job to Employee
```http
POST /api/vendors/{vendorId}/jobs/{jobId}/assign
```

**Request Body:**
```json
{
  "employeeId": "employee_123",
  "notes": "Please focus on kitchen and bathrooms",
  "estimatedDuration": 180
}
```

### Get Employee Availability
```http
GET /api/vendors/{vendorId}/employees/{employeeId}/availability
```

**Query Parameters:**
- `date` - Date to check availability
- `duration` - Required duration in minutes

**Response:**
```json
{
  "employeeId": "employee_123",
  "date": "2024-01-20",
  "available": true,
  "availableSlots": [
    {
      "startTime": "09:00",
      "endTime": "12:00",
      "duration": 180
    },
    {
      "startTime": "14:00",
      "endTime": "17:00",
      "duration": 180
    }
  ],
  "currentJob": {
    "id": "job_123",
    "title": "Deep House Cleaning",
    "startTime": "10:00",
    "endTime": "13:00"
  }
}
```

### Update Job Progress
```http
PATCH /api/vendors/{vendorId}/jobs/{jobId}/progress
```

**Request Body:**
```json
{
  "status": "in-progress",
  "progress": 50,
  "notes": "Completed kitchen and living room, working on bathrooms",
  "estimatedCompletion": "2024-01-20T13:00:00Z"
}
```

## Notification System

### Get Vendor Notifications
```http
GET /api/vendors/{vendorId}/notifications
```

**Response:**
```json
{
  "notifications": [
    {
      "id": "notif_123",
      "type": "new_booking",
      "title": "New Booking Received",
      "message": "Jane Doe booked Deep House Cleaning for tomorrow at 10:00 AM",
      "data": {
        "bookingId": "booking_123",
        "clientName": "Jane Doe",
        "serviceName": "Deep House Cleaning"
      },
      "isRead": false,
      "createdAt": "2024-01-20T10:30:00Z"
    }
  ]
}
```

### Mark Notification as Read
```http
PUT /api/vendors/{vendorId}/notifications/{notificationId}/read
```

## Performance Monitoring

### Get System Performance
```http
GET /api/vendors/{vendorId}/dashboard/performance
```

**Response:**
```json
{
  "responseTime": {
    "average": 150,
    "max": 500,
    "min": 50
  },
  "uptime": {
    "percentage": 99.9,
    "lastDowntime": "2024-01-15T02:00:00Z"
  },
  "activeConnections": 25,
  "dataUsage": {
    "storage": "2.5 GB",
    "bandwidth": "150 MB/day"
  }
}
```

This backend integration ensures the vendor dashboard provides real-time insights into client activity, team performance, and business metrics. 