# Complete Backend Integration Guide - Project Reliance

## Overview
This document provides comprehensive backend integration notes for all features in Project Reliance, including user management, vendor operations, booking systems, messaging, and administrative functions.

## Database Schema

### Core Tables

#### Users Table
```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  avatar_url VARCHAR(500),
  user_type ENUM('user', 'vendor', 'admin') NOT NULL,
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_email (email),
  INDEX idx_user_type (user_type),
  INDEX idx_status (status)
);
```

#### Vendors Table
```sql
CREATE TABLE vendors (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  business_name VARCHAR(255) NOT NULL,
  business_description TEXT,
  business_address TEXT NOT NULL,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  website VARCHAR(255),
  years_in_business INT,
  rating DECIMAL(3,2) DEFAULT 0.00,
  review_count INT DEFAULT 0,
  total_jobs INT DEFAULT 0,
  total_earnings DECIMAL(12,2) DEFAULT 0.00,
  verification_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
  insurance_verified BOOLEAN DEFAULT FALSE,
  bonded_verified BOOLEAN DEFAULT FALSE,
  licensed_verified BOOLEAN DEFAULT FALSE,
  availability_status ENUM('available', 'busy', 'offline') DEFAULT 'offline',
  response_time VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_location (latitude, longitude),
  INDEX idx_rating (rating),
  INDEX idx_verification (verification_status)
);
```

#### Services Table
```sql
CREATE TABLE services (
  id VARCHAR(36) PRIMARY KEY,
  vendor_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration_minutes INT NOT NULL,
  image_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  INDEX idx_vendor_category (vendor_id, category),
  INDEX idx_category (category)
);
```

#### Bookings Table
```sql
CREATE TABLE bookings (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  vendor_id VARCHAR(36) NOT NULL,
  service_id VARCHAR(36) NOT NULL,
  booking_number VARCHAR(20) UNIQUE NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration_minutes INT NOT NULL,
  status ENUM('upcoming', 'in-progress', 'completed', 'cancelled', 'rescheduled') NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  notes TEXT,
  special_requests JSON,
  payment_status ENUM('paid', 'pending', 'refunded') NOT NULL,
  payment_method VARCHAR(100),
  cancellation_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  FOREIGN KEY (service_id) REFERENCES services(id),
  INDEX idx_user_date (user_id, date),
  INDEX idx_vendor_date (vendor_id, date),
  INDEX idx_status (status)
);
```

#### Jobs Table (Vendor Work Management)
```sql
CREATE TABLE jobs (
  id VARCHAR(36) PRIMARY KEY,
  vendor_id VARCHAR(36) NOT NULL,
  booking_id VARCHAR(36),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('pending', 'in-progress', 'completed', 'cancelled') NOT NULL,
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  estimated_duration INT, -- in minutes
  actual_duration INT, -- in minutes
  assigned_employee_id VARCHAR(36),
  client_name VARCHAR(255),
  client_contact VARCHAR(255),
  address TEXT,
  scheduled_date DATE,
  scheduled_time TIME,
  completed_date TIMESTAMP,
  price DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (assigned_employee_id) REFERENCES employees(id),
  INDEX idx_vendor_status (vendor_id, status),
  INDEX idx_assigned_employee (assigned_employee_id),
  INDEX idx_scheduled_date (scheduled_date)
);
```

#### Employees Table
```sql
CREATE TABLE employees (
  id VARCHAR(36) PRIMARY KEY,
  vendor_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  avatar_url VARCHAR(500),
  role VARCHAR(100) NOT NULL,
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  hourly_rate DECIMAL(8,2),
  skills JSON,
  availability JSON,
  last_active TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_vendor_status (vendor_id, status),
  INDEX idx_last_active (last_active)
);
```

#### Content/Media Table
```sql
CREATE TABLE content (
  id VARCHAR(36) PRIMARY KEY,
  job_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36),
  content_type ENUM('video', 'image', 'document') NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  title VARCHAR(255),
  description TEXT,
  duration_seconds INT, -- for videos
  file_size BIGINT,
  status ENUM('pending_approval', 'approved', 'rejected', 'delivered', 'archived') NOT NULL,
  approval_notes TEXT,
  approved_by VARCHAR(36),
  approved_at TIMESTAMP,
  delivered_at TIMESTAMP,
  archived_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (job_id) REFERENCES jobs(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  INDEX idx_job_status (job_id, status),
  INDEX idx_employee (employee_id),
  INDEX idx_status (status)
);
```

#### Reviews Table
```sql
CREATE TABLE reviews (
  id VARCHAR(36) PRIMARY KEY,
  booking_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  vendor_id VARCHAR(36) NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  UNIQUE KEY unique_booking_review (booking_id),
  INDEX idx_vendor_rating (vendor_id, rating)
);
```

#### Messages/Conversations Tables
```sql
CREATE TABLE conversations (
  id VARCHAR(36) PRIMARY KEY,
  conversation_type ENUM('user_vendor', 'user_support', 'vendor_admin', 'general') NOT NULL,
  title VARCHAR(255),
  is_group BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_type_updated (conversation_type, updated_at)
);

CREATE TABLE conversation_participants (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  role ENUM('participant', 'admin') DEFAULT 'participant',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP,
  
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY unique_participant (conversation_id, user_id),
  INDEX idx_conversation (conversation_id),
  INDEX idx_user (user_id)
);

CREATE TABLE messages (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL,
  sender_id VARCHAR(36) NOT NULL,
  sender_type ENUM('user', 'vendor', 'admin', 'system') NOT NULL,
  message_type ENUM('text', 'image', 'file', 'system') DEFAULT 'text',
  content TEXT NOT NULL,
  file_url VARCHAR(500),
  file_name VARCHAR(255),
  file_size BIGINT,
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (sender_id) REFERENCES users(id),
  INDEX idx_conversation_created (conversation_id, created_at),
  INDEX idx_sender (sender_id)
);
```

#### Notifications Table
```sql
CREATE TABLE notifications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSON,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_read (user_id, is_read),
  INDEX idx_created (created_at)
);
```

## API Endpoints

### Authentication & User Management

#### User Registration
```http
POST /api/auth/register
```
**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "userType": "user"
}
```

#### User Login
```http
POST /api/auth/login
```
**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

#### Get User Profile
```http
GET /api/user/profile
```

#### Update User Profile
```http
PATCH /api/user/profile
```
**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "avatarUrl": "https://..."
}
```

#### Update User Location
```http
PATCH /api/user/location
```
**Request Body:**
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "address": "123 Main St, Downtown, NY 10001"
}
```

### Vendor Management

#### Vendor Registration
```http
POST /api/vendors/register
```
**Request Body:**
```json
{
  "businessName": "Sparkle Cleaners",
  "businessDescription": "Professional cleaning services",
  "businessAddress": "123 Business St, NY 10001",
  "phone": "+1234567890",
  "email": "contact@sparklecleaners.com",
  "category": "cleaning",
  "services": [
    {
      "name": "Deep House Cleaning",
      "description": "Complete house cleaning service",
      "price": 150.00,
      "duration": 180
    }
  ]
}
```

#### Get Vendor Profile
```http
GET /api/vendors/{vendorId}
```

#### Update Vendor Profile
```http
PATCH /api/vendors/{vendorId}
```

#### Get Vendor Services
```http
GET /api/vendors/{vendorId}/services
```

#### Add Vendor Service
```http
POST /api/vendors/{vendorId}/services
```

#### Get Vendor Availability
```http
GET /api/vendors/{vendorId}/availability
```
**Query Parameters:**
- `date` - Date to check availability
- `service_id` - Service type for duration calculation

### Booking System

#### Create Booking
```http
POST /api/bookings
```
**Request Body:**
```json
{
  "vendorId": "vendor_123",
  "serviceId": "service_456",
  "date": "2024-01-20",
  "time": "10:00",
  "notes": "Please focus on kitchen and bathrooms",
  "specialRequests": ["Eco-friendly products"],
  "address": "123 Main St, Downtown, NY 10001",
  "latitude": 40.7128,
  "longitude": -74.0060
}
```

#### Get User Bookings
```http
GET /api/user/bookings
```
**Query Parameters:**
- `status` - Filter by booking status
- `date_from` - Filter bookings from date
- `date_to` - Filter bookings to date
- `search` - Search in service name, vendor name, or booking number
- `page` - Page number for pagination
- `limit` - Number of bookings per page

#### Get Booking Details
```http
GET /api/bookings/{bookingId}
```

#### Cancel Booking
```http
POST /api/bookings/{bookingId}/cancel
```
**Request Body:**
```json
{
  "reason": "Schedule conflict",
  "refundRequested": true
}
```

#### Reschedule Booking
```http
POST /api/bookings/{bookingId}/reschedule
```
**Request Body:**
```json
{
  "newDate": "2024-01-22",
  "newTime": "14:00",
  "reason": "Schedule change"
}
```

#### Submit Review
```http
POST /api/bookings/{bookingId}/review
```
**Request Body:**
```json
{
  "rating": 5,
  "review": "Excellent service! Very professional and thorough.",
  "anonymous": false
}
```

### Job Management (Vendor Side)

#### Get Vendor Jobs
```http
GET /api/vendors/{vendorId}/jobs
```
**Query Parameters:**
- `status` - Filter by job status
- `employee_id` - Filter by assigned employee
- `date_from` - Filter jobs from date
- `date_to` - Filter jobs to date

#### Create Job
```http
POST /api/vendors/{vendorId}/jobs
```
**Request Body:**
```json
{
  "title": "Deep House Cleaning",
  "description": "Complete house cleaning for 3-bedroom apartment",
  "priority": "medium",
  "estimatedDuration": 180,
  "clientName": "Jane Doe",
  "clientContact": "+1234567890",
  "address": "123 Main St, Downtown, NY 10001",
  "scheduledDate": "2024-01-20",
  "scheduledTime": "10:00",
  "price": 150.00,
  "notes": "Focus on kitchen and bathrooms"
}
```

#### Update Job Status
```http
PATCH /api/vendors/{vendorId}/jobs/{jobId}/status
```
**Request Body:**
```json
{
  "status": "in-progress",
  "notes": "Started cleaning at 10:05 AM"
}
```

#### Assign Employee to Job
```http
POST /api/vendors/{vendorId}/jobs/{jobId}/assign
```
**Request Body:**
```json
{
  "employeeId": "employee_123"
}
```

#### Archive Content
```http
POST /api/vendors/{vendorId}/jobs/{jobId}/archive-content
```
**Request Body:**
```json
{
  "contentId": "content_123",
  "archiveReason": "Customer review completed"
}
```

### Content/Media Management

#### Upload Content
```http
POST /api/content/upload
```
**Request Body:** (multipart/form-data)
- `file` - Media file
- `jobId` - Associated job ID
- `contentType` - video, image, or document
- `title` - Content title
- `description` - Content description

#### Get Job Content
```http
GET /api/jobs/{jobId}/content
```

#### Approve Content
```http
POST /api/content/{contentId}/approve
```
**Request Body:**
```json
{
  "approved": true,
  "notes": "Content meets quality standards"
}
```

#### Deliver Content to Customer
```http
POST /api/content/{contentId}/deliver
```

### Employee Management

#### Get Vendor Employees
```http
GET /api/vendors/{vendorId}/employees
```

#### Add Employee
```http
POST /api/vendors/{vendorId}/employees
```
**Request Body:**
```json
{
  "firstName": "Mike",
  "lastName": "Johnson",
  "email": "mike@sparklecleaners.com",
  "phone": "+1234567890",
  "role": "Cleaner",
  "hourlyRate": 25.00,
  "skills": ["Deep Cleaning", "Window Cleaning", "Carpet Cleaning"]
}
```

#### Update Employee Status
```http
PATCH /api/vendors/{vendorId}/employees/{employeeId}
```
**Request Body:**
```json
{
  "status": "active",
  "lastActive": "2024-01-20T10:00:00Z"
}
```

### Messaging System

#### Get User Conversations
```http
GET /api/user/messages/conversations
```
**Query Parameters:**
- `type` - Filter by conversation type
- `search` - Search in conversation title or participant names

#### Get Conversation Messages
```http
GET /api/user/messages/conversations/{conversationId}
```
**Query Parameters:**
- `page` - Page number for pagination
- `limit` - Number of messages per page

#### Send Message
```http
POST /api/user/messages/conversations/{conversationId}
```
**Request Body:**
```json
{
  "content": "Hello! I have a question about my booking.",
  "messageType": "text"
}
```

#### Create New Conversation
```http
POST /api/user/messages/conversations
```
**Request Body:**
```json
{
  "participantIds": ["user_123", "vendor_456"],
  "conversationType": "user_vendor",
  "title": "Booking Discussion"
}
```

#### Mark Messages as Read
```http
PUT /api/user/messages/conversations/{conversationId}/read
```

#### Delete Conversation
```http
DELETE /api/user/messages/conversations/{conversationId}
```

### Vendor Messages

#### Get Vendor Conversations
```http
GET /api/vendors/{vendorId}/messages/conversations
```

#### Send Vendor Message
```http
POST /api/vendors/{vendorId}/messages/conversations/{conversationId}
```

### Admin Messages (Support)

#### Get Support Conversations
```http
GET /api/admin/messages/support
```

#### Assign Support Conversation
```http
PUT /api/admin/messages/support/{conversationId}/assign
```
**Request Body:**
```json
{
  "adminId": "admin_123"
}
```

### File Upload

#### Upload Message Attachment
```http
POST /api/messages/upload
```
**Request Body:** (multipart/form-data)
- `file` - File to upload
- `conversationId` - Target conversation

### Notifications

#### Get User Notifications
```http
GET /api/user/notifications
```
**Query Parameters:**
- `unread_only` - Filter unread notifications only
- `type` - Filter by notification type

#### Mark Notification as Read
```http
PUT /api/user/notifications/{notificationId}/read
```

#### Send Push Notification
```http
POST /api/notifications/push
```
**Request Body:**
```json
{
  "userId": "user_123",
  "title": "Booking Reminder",
  "message": "Your cleaning appointment is in 1 hour",
  "data": {
    "bookingId": "booking_123",
    "type": "booking_reminder"
  }
}
```

### Analytics & Reporting

#### Get User Dashboard Stats
```http
GET /api/user/dashboard/stats
```

#### Get Vendor Dashboard Stats
```http
GET /api/vendors/{vendorId}/dashboard/stats
```

#### Get Admin Dashboard Stats
```http
GET /api/admin/dashboard/stats
```

#### Get User Growth Analytics
```http
GET /api/admin/analytics/user-growth
```
**Query Parameters:**
- `period` - daily, weekly, monthly
- `date_from` - Start date
- `date_to` - End date

### Discovery & Search

#### Search Vendors
```http
GET /api/discover/vendors
```
**Query Parameters:**
- `category` - Service category
- `location` - User location
- `radius` - Search radius in miles
- `rating` - Minimum rating
- `price_range` - Price range filter
- `availability` - Available now filter

#### Get Vendor Categories
```http
GET /api/discover/categories
```

#### Get Trending Services
```http
GET /api/discover/trending
```
**Query Parameters:**
- `location` - User location
- `limit` - Number of trending services

## Real-time Features (WebSocket)

### Connection
```javascript
const socket = io('https://api.projectreliance.com', {
  auth: {
    token: 'jwt_token_here'
  }
});
```

### Events

#### Booking Updates
```javascript
// Subscribe to booking updates
socket.emit('subscribe', { bookingId: 'booking_123' });

// Receive booking status updates
socket.on('booking_status_update', (data) => {
  console.log('Booking updated:', data);
});
```

#### Vendor Location Updates
```javascript
// Receive vendor location updates during service
socket.on('vendor_location_update', (data) => {
  console.log('Vendor location:', data);
});
```

#### Message Notifications
```javascript
// Receive new message notifications
socket.on('new_message', (data) => {
  console.log('New message:', data);
});
```

#### Real-time Messaging
```javascript
// Send message
socket.emit('send_message', {
  conversationId: 'conv_123',
  content: 'Hello!',
  messageType: 'text'
});

// Receive message
socket.on('message_received', (data) => {
  console.log('Message received:', data);
});
```

## Payment Integration

### Stripe Integration
```javascript
// Create payment intent
POST /api/payments/create-intent
{
  "amount": 15000, // in cents
  "currency": "usd",
  "bookingId": "booking_123"
}

// Confirm payment
POST /api/payments/confirm
{
  "paymentIntentId": "pi_1234567890",
  "bookingId": "booking_123"
}
```

### Refund Processing
```javascript
POST /api/payments/refund
{
  "bookingId": "booking_123",
  "amount": 15000,
  "reason": "Service cancelled by user"
}
```

## Security Considerations

### Authentication
- JWT tokens with refresh mechanism
- Role-based access control (RBAC)
- API rate limiting
- CORS configuration

### Data Protection
- PII encryption for sensitive data
- GDPR compliance
- Data retention policies
- Secure file upload validation

### API Security
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF tokens

## Error Handling

### Standard Error Response
```json
{
  "error": "ERROR_CODE",
  "message": "Human readable error message",
  "code": 400,
  "details": {
    "field": "Additional error details"
  }
}
```

### Common Error Codes
- `AUTHENTICATION_FAILED` - Invalid credentials
- `AUTHORIZATION_FAILED` - Insufficient permissions
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `VALIDATION_ERROR` - Invalid input data
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_SERVER_ERROR` - Server error

## Testing Endpoints

### Create Test Data
```bash
# Create test bookings
POST /api/test/bookings/create
{
  "userId": "test_user_1",
  "vendorId": "test_vendor_1",
  "count": 5
}

# Create test messages
POST /api/test/messages/create
{
  "conversationId": "test_conv_1",
  "count": 10
}
```

### Simulate Real-time Events
```bash
# Simulate booking status change
POST /api/test/bookings/{bookingId}/simulate-status
{
  "status": "in-progress",
  "delay": 5000
}

# Simulate vendor location update
POST /api/test/vendors/{vendorId}/simulate-location
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "interval": 30000
}
```

This comprehensive backend integration guide covers all the features and functionality needed for Project Reliance, ensuring seamless communication between frontend and backend systems. 