# My Bookings - Backend Integration Guide

## Overview
The My Bookings page integrates with vendor booking systems to provide users with a comprehensive view of their service appointments, including real-time status updates, communication tools, and booking management features.

## Database Schema

### Bookings Table
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

### Booking Reviews Table
```sql
CREATE TABLE booking_reviews (
  id VARCHAR(36) PRIMARY KEY,
  booking_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  vendor_id VARCHAR(36) NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  UNIQUE KEY unique_booking_review (booking_id)
);
```

### Booking Reschedule History Table
```sql
CREATE TABLE booking_reschedule_history (
  id VARCHAR(36) PRIMARY KEY,
  booking_id VARCHAR(36) NOT NULL,
  from_date DATE NOT NULL,
  from_time TIME NOT NULL,
  to_date DATE NOT NULL,
  to_time TIME NOT NULL,
  reason TEXT,
  requested_by ENUM('user', 'vendor', 'system') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);
```

### Booking Communication Table
```sql
CREATE TABLE booking_communication (
  id VARCHAR(36) PRIMARY KEY,
  booking_id VARCHAR(36) NOT NULL,
  sender_type ENUM('user', 'vendor', 'system') NOT NULL,
  sender_id VARCHAR(36) NOT NULL,
  message_type ENUM('message', 'call', 'video', 'system') NOT NULL,
  content TEXT,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  INDEX idx_booking_created (booking_id, created_at)
);
```

## API Endpoints

### User Bookings

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

**Response:**
```json
{
  "bookings": [
    {
      "id": "booking_123",
      "serviceName": "Deep House Cleaning",
      "vendorName": "Sparkle Cleaners",
      "vendorId": "vendor_456",
      "vendorAvatar": "https://...",
      "serviceImage": "https://...",
      "date": "2024-01-20",
      "time": "10:00",
      "duration": 180,
      "status": "upcoming",
      "price": 150.00,
      "address": "123 Main St, Downtown, NY 10001",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "notes": "Please focus on kitchen and bathrooms",
      "specialRequests": ["Eco-friendly products", "Pet-safe cleaning"],
      "paymentStatus": "paid",
      "paymentMethod": "Credit Card ending in 1234",
      "bookingNumber": "BK-2024-001",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "vendor": {
        "id": "vendor_456",
        "name": "Sparkle Cleaners",
        "avatar": "https://...",
        "rating": 4.8,
        "reviewCount": 127,
        "phone": "+1 (555) 123-4567",
        "email": "contact@sparklecleaners.com",
        "isOnline": true,
        "responseTime": "5 min"
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

#### Get Booking Details
```http
GET /api/user/bookings/{bookingId}
```

#### Cancel Booking
```http
POST /api/user/bookings/{bookingId}/cancel
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
POST /api/user/bookings/{bookingId}/reschedule
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
POST /api/user/bookings/{bookingId}/review
```
**Request Body:**
```json
{
  "rating": 5,
  "review": "Excellent service! Very professional and thorough.",
  "anonymous": false
}
```

### Vendor Integration

#### Get Vendor Availability
```http
GET /api/vendors/{vendorId}/availability
```
**Query Parameters:**
- `date` - Date to check availability
- `service_id` - Service type for duration calculation

**Response:**
```json
{
  "vendorId": "vendor_456",
  "date": "2024-01-20",
  "availableSlots": [
    {
      "time": "09:00",
      "duration": 180,
      "available": true
    },
    {
      "time": "10:00",
      "duration": 180,
      "available": true
    },
    {
      "time": "11:00",
      "duration": 180,
      "available": false,
      "reason": "Existing booking"
    }
  ]
}
```

#### Create Booking (Vendor Calendar Integration)
```http
POST /api/bookings
```
**Request Body:**
```json
{
  "userId": "user_123",
  "vendorId": "vendor_456",
  "serviceId": "service_789",
  "date": "2024-01-20",
  "time": "10:00",
  "notes": "Please focus on kitchen and bathrooms",
  "specialRequests": ["Eco-friendly products"],
  "address": "123 Main St, Downtown, NY 10001",
  "latitude": 40.7128,
  "longitude": -74.0060
}
```

#### Update Booking Status (Vendor Side)
```http
PATCH /api/vendors/{vendorId}/bookings/{bookingId}/status
```
**Request Body:**
```json
{
  "status": "in-progress",
  "notes": "Started cleaning at 10:05 AM"
}
```

## Real-time Features

### WebSocket Events

#### Booking Status Updates
```javascript
// Client subscribes to booking updates
socket.emit('subscribe', { bookingId: 'booking_123' });

// Server sends status updates
socket.emit('booking_status_update', {
  bookingId: 'booking_123',
  status: 'in-progress',
  timestamp: '2024-01-20T10:05:00Z',
  notes: 'Vendor has arrived and started work'
});
```

#### Vendor Location Updates
```javascript
// Vendor location updates during service
socket.emit('vendor_location_update', {
  bookingId: 'booking_123',
  vendorId: 'vendor_456',
  latitude: 40.7128,
  longitude: -74.0060,
  timestamp: '2024-01-20T10:05:00Z'
});
```

#### Communication Messages
```javascript
// Real-time messaging between user and vendor
socket.emit('booking_message', {
  bookingId: 'booking_123',
  senderId: 'vendor_456',
  senderType: 'vendor',
  content: 'I\'m running 5 minutes late due to traffic',
  timestamp: '2024-01-20T09:55:00Z'
});
```

## Vendor Calendar Integration

### Calendar Sync
The vendor's booking calendar automatically syncs with user bookings:

1. **Booking Creation**: When a user books a service, it's immediately added to the vendor's calendar
2. **Status Updates**: Changes in booking status are reflected in both user and vendor views
3. **Rescheduling**: When either party reschedules, both calendars are updated
4. **Conflict Prevention**: System prevents double-booking by checking vendor availability

### Vendor Dashboard Integration
```javascript
// Vendor dashboard shows upcoming bookings
GET /api/vendors/{vendorId}/dashboard/bookings

// Response includes user details for each booking
{
  "today": [
    {
      "id": "booking_123",
      "serviceName": "Deep House Cleaning",
      "userName": "Jane Doe",
      "userPhone": "+1 (555) 123-4567",
      "userEmail": "jane.doe@email.com",
      "address": "123 Main St, Downtown, NY 10001",
      "time": "10:00",
      "duration": 180,
      "status": "upcoming",
      "notes": "Please focus on kitchen and bathrooms"
    }
  ],
  "upcoming": [...],
  "completed": [...]
}
```

## Payment Integration

### Payment Processing
```http
POST /api/bookings/{bookingId}/payment
```
**Request Body:**
```json
{
  "paymentMethod": "credit_card",
  "cardToken": "tok_visa",
  "amount": 150.00
}
```

### Refund Processing
```http
POST /api/bookings/{bookingId}/refund
```
**Request Body:**
```json
{
  "amount": 150.00,
  "reason": "Service cancelled by user",
  "refundMethod": "original_payment"
}
```

## Notification System

### Email Notifications
- Booking confirmation
- Booking reminders (24h, 1h before)
- Status updates
- Cancellation confirmations
- Payment receipts

### Push Notifications
- Real-time status updates
- Vendor arrival notifications
- Message notifications
- Payment confirmations

### SMS Notifications
- Booking confirmations
- Same-day reminders
- Vendor arrival alerts

## Security Considerations

### Authentication & Authorization
- JWT tokens for API access
- Role-based access control (user, vendor, admin)
- Booking ownership validation

### Data Protection
- PII encryption for user data
- Secure payment processing
- GDPR compliance for data handling

### Rate Limiting
- API rate limiting to prevent abuse
- Booking creation limits per user
- Communication frequency limits

## Error Handling

### Common Error Responses
```json
{
  "error": "BOOKING_NOT_FOUND",
  "message": "Booking with ID booking_123 not found",
  "code": 404
}

{
  "error": "BOOKING_ALREADY_CANCELLED",
  "message": "This booking has already been cancelled",
  "code": 400
}

{
  "error": "VENDOR_UNAVAILABLE",
  "message": "Vendor is not available at the requested time",
  "code": 409
}
```

## Testing Endpoints

### Test Data Setup
```bash
# Create test bookings
POST /api/test/bookings/create
{
  "userId": "test_user_1",
  "vendorId": "test_vendor_1",
  "count": 5
}

# Simulate booking status changes
POST /api/test/bookings/{bookingId}/simulate-status
{
  "status": "in-progress",
  "delay": 5000
}
```

This integration ensures seamless communication between user bookings and vendor calendars, providing real-time updates and comprehensive booking management capabilities. 