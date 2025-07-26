# Complete Backend Integration Guide - Project Reliance

## Table of Contents
1. [Database Schema](#database-schema)
2. [API Endpoints](#api-endpoints)
3. [Vendor Data Integration Requirements](#vendor-data-integration-requirements)
4. [User Dashboard & Discovery](#user-dashboard--discovery)
5. [Booking System](#booking-system)
6. [Reviews System](#reviews-system)
7. [Favorites System](#favorites-system)
8. [Search & Discovery](#search--discovery)
9. [User Profile & Settings](#user-profile--settings)
10. [Messaging System](#messaging-system)
11. [Notification System](#notification-system)
12. [Payment System](#payment-system)
13. [Analytics & Reporting](#analytics--reporting)
14. [File Management](#file-management)
15. [Security & Authentication](#security--authentication)

---

## Database Schema

### Core Tables

#### users
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  bio TEXT,
  profile_photo_url VARCHAR(500),
  member_since TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  is_premium BOOLEAN DEFAULT FALSE,
  location_enabled BOOLEAN DEFAULT TRUE,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### vendors
```sql
CREATE TABLE vendors (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  business_name VARCHAR(255) NOT NULL,
  business_type VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  bio TEXT,
  profile_photo_url VARCHAR(500),
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  phone VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(500),
  years_in_business INTEGER,
  verified BOOLEAN DEFAULT FALSE,
  featured BOOLEAN DEFAULT FALSE,
  insurance BOOLEAN DEFAULT FALSE,
  bonded BOOLEAN DEFAULT FALSE,
  licensed BOOLEAN DEFAULT FALSE,
  average_rating DECIMAL(3, 2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_jobs INTEGER DEFAULT 0,
  completion_rate DECIMAL(5, 2) DEFAULT 0,
  average_response_time INTEGER DEFAULT 0, -- in minutes
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### vendor_service_types
```sql
CREATE TABLE vendor_service_types (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER REFERENCES vendors(id),
  service_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### services
```sql
CREATE TABLE services (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER REFERENCES vendors(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2),
  price_type VARCHAR(50), -- 'fixed', 'hourly', 'quote'
  category VARCHAR(100) NOT NULL,
  features TEXT[], -- Array of features
  inclusions TEXT[], -- Array of what's included
  exclusions TEXT[], -- Array of what's not included
  images TEXT[], -- Array of image URLs
  videos TEXT[], -- Array of video URLs
  availability_schedule JSONB, -- Complex availability data
  response_time VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### bookings
```sql
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  vendor_id INTEGER REFERENCES vendors(id),
  service_id INTEGER REFERENCES services(id),
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'
  total_amount DECIMAL(10, 2),
  notes TEXT,
  user_notes TEXT,
  vendor_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### reviews
```sql
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  vendor_id INTEGER REFERENCES vendors(id),
  booking_id INTEGER REFERENCES bookings(id),
  type VARCHAR(20) NOT NULL DEFAULT 'written', -- 'written' (users write reviews about vendors)
  creation_type VARCHAR(20) NOT NULL, -- 'manual', 'auto'
  rating INTEGER NOT NULL CHECK (rating >= 0 AND rating <= 5), -- 0 for pending reviews
  title VARCHAR(255), -- NULL for pending reviews
  content TEXT, -- NULL for pending reviews
  helpful_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending', -- 'published', 'pending', 'rejected'
  auto_generated_reason VARCHAR(255),
  auto_generated_at TIMESTAMP, -- When auto-review was generated
  manual_review_deadline TIMESTAMP, -- 72 hours from service completion
  images TEXT[], -- Array of image URLs
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### favorites
```sql
CREATE TABLE favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  vendor_id INTEGER REFERENCES vendors(id),
  notes TEXT,
  last_contacted TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### messages
```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER REFERENCES users(id),
  recipient_id INTEGER REFERENCES users(id),
  booking_id INTEGER REFERENCES bookings(id),
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'image', 'file'
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### notifications
```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB, -- Additional data for the notification
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### payments
```sql
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER REFERENCES bookings(id),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Endpoints

### Authentication
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
POST /api/auth/forgot-password
POST /api/auth/reset-password
POST /api/auth/verify-2fa
```

### Users
```
GET /api/users/profile
PUT /api/users/profile
PUT /api/users/password
PUT /api/users/location
POST /api/users/upload-photo
DELETE /api/users/account
```

### Vendors
```
GET /api/vendors
GET /api/vendors/:id
POST /api/vendors
PUT /api/vendors/:id
DELETE /api/vendors/:id
GET /api/vendors/:id/services
GET /api/vendors/:id/reviews
GET /api/vendors/:id/availability
POST /api/vendors/:id/contact
```

### Services
```
GET /api/services
GET /api/services/:id
POST /api/services
PUT /api/services/:id
DELETE /api/services/:id
GET /api/services/search
POST /api/services/:id/upload-media
DELETE /api/services/:id/media/:mediaId
```

### Bookings
```
GET /api/bookings
GET /api/bookings/:id
POST /api/bookings
PUT /api/bookings/:id
DELETE /api/bookings/:id
POST /api/bookings/:id/confirm
POST /api/bookings/:id/cancel
POST /api/bookings/:id/complete
GET /api/bookings/:id/payment
POST /api/bookings/:id/payment
```

### Reviews
```
GET /api/reviews
GET /api/reviews/:id
POST /api/reviews
PUT /api/reviews/:id
DELETE /api/reviews/:id
POST /api/reviews/:id/helpful
POST /api/reviews/:id/reply
GET /api/reviews/auto-generate
POST /api/reviews/auto-generate
POST /api/reviews/check-72-hour-deadline
POST /api/reviews/create-pending
GET /api/reviews/pending-count
POST /api/reviews/:id/complete
```

### Favorites
```
GET /api/favorites
POST /api/favorites
DELETE /api/favorites/:id
PUT /api/favorites/:id/notes
POST /api/favorites/:id/contact
```

### Search & Discovery
```
GET /api/search
GET /api/discover
GET /api/categories
GET /api/categories/:id/vendors
POST /api/search/filters
```

### Messages
```
GET /api/messages
GET /api/messages/:id
POST /api/messages
PUT /api/messages/:id/read
DELETE /api/messages/:id
```

### Notifications
```
GET /api/notifications
PUT /api/notifications/:id/read
DELETE /api/notifications/:id
POST /api/notifications/send
```

### Analytics
```
GET /api/analytics/dashboard
GET /api/analytics/bookings
GET /api/analytics/reviews
GET /api/analytics/revenue
GET /api/analytics/vendor-performance
```

---

## Vendor Data Integration Requirements

### Critical Vendor Page Data Requirements

#### 1. Vendor Profile Page (`/vendor/profile`)
**Required Fields for User Discovery:**
- Business Name
- Business Type
- Service Categories (multi-select)
- Business Bio
- Profile Photo
- Address & Location
- Phone & Email
- Years in Business
- Insurance/Bonded/Licensed Status
- Service Areas (radius/zip codes)

**Data Flow:**
```javascript
// Vendor profile data populates:
- User Discover page vendor cards
- Service detail pages
- Search results
- Favorites page
```

#### 2. Service Management Page (`/vendor/services`)
**Required Fields for User Service Pages:**
- Service Name
- Service Description
- Pricing (fixed/hourly/quote)
- Service Category
- Features List
- What's Included
- What's Not Included
- Service Images (multiple)
- Service Videos (multiple)
- Availability Schedule
- Response Time
- Service Areas

**Data Flow:**
```javascript
// Service data populates:
- User Dashboard trending services
- Service detail pages
- Search results
- Booking flow
- Reviews (service name/description)
```

#### 3. Vendor Dashboard Analytics
**Required Metrics for User Trust:**
- Total Jobs Completed
- Average Rating
- Response Time
- Completion Rate
- Customer Satisfaction Score
- Years in Business
- Verification Status

**Data Flow:**
```javascript
// Analytics data populates:
- Vendor cards on user pages
- Service detail pages
- Search result rankings
- Trust indicators
```

---

## User Dashboard & Discovery

### Personalized Features Backend Requirements

#### 1. "For You" Section
```javascript
// API: GET /api/dashboard/personalized
{
  "personalizedServices": [
    {
      "id": "service_id",
      "reason": "Based on your recent plumbing booking",
      "confidence": 0.85
    }
  ]
}
```

#### 2. Seasonal Suggestions
```javascript
// API: GET /api/dashboard/seasonal
{
  "seasonalServices": [
    {
      "id": "service_id",
      "reason": "HVAC maintenance recommended for summer",
      "weatherBased": true
    }
  ]
}
```

#### 3. Recently Viewed
```javascript
// API: GET /api/dashboard/recently-viewed
{
  "recentlyViewed": [
    {
      "serviceId": "service_id",
      "viewedAt": "2024-01-20T10:30:00Z",
      "viewCount": 3
    }
  ]
}
```

#### 4. Smart Categories
```javascript
// API: GET /api/dashboard/smart-categories
{
  "smartCategories": [
    {
      "category": "plumbing",
      "reason": "Based on your search history",
      "vendorCount": 15
    }
  ]
}
```

### Social Proof Features

#### 1. Social Proof Indicators
```javascript
// API: GET /api/dashboard/social-proof
{
  "socialProof": [
    {
      "serviceId": "service_id",
      "message": "23 people in your area booked this service today",
      "count": 23,
      "timeframe": "today"
    }
  ]
}
```

#### 2. Community Reviews
```javascript
// API: GET /api/dashboard/community-reviews
{
  "communityReviews": [
    {
      "reviewId": "review_id",
      "neighborhood": "Downtown",
      "rating": 5,
      "excerpt": "Great service from local vendor..."
    }
  ]
}
```

### Advanced User Features

#### 1. Price Comparison
```javascript
// API: GET /api/dashboard/price-comparison
{
  "priceComparisons": [
    {
      "serviceId": "service_id",
      "averagePrice": 150,
      "yourPrice": 120,
      "savings": 30
    }
  ]
}
```

#### 2. Smart Notifications
```javascript
// API: GET /api/dashboard/notifications
{
  "notifications": [
    {
      "type": "service_reminder",
      "message": "Time to schedule your quarterly cleaning",
      "actionUrl": "/booking/service_id"
    }
  ]
}
```

#### 3. Calendar Integration
```javascript
// API: POST /api/calendar/sync
{
  "provider": "google", // or "outlook", "apple"
  "bookings": [
    {
      "bookingId": "booking_id",
      "title": "Plumbing Service",
      "date": "2024-01-25",
      "time": "10:00"
    }
  ]
}
```

---

## Booking System

### Multi-Step Booking Flow

#### 1. Service Selection
```javascript
// API: GET /api/services/:id
{
  "service": {
    "id": "service_id",
    "name": "Emergency Plumbing",
    "description": "24/7 emergency plumbing services",
    "price": 150,
    "priceType": "fixed",
    "vendor": {
      "id": "vendor_id",
      "name": "Quick Fix Plumbing",
      "rating": 4.8,
      "responseTime": "30 minutes"
    },
    "availability": {
      "nextAvailable": "2024-01-20T14:00:00Z",
      "slots": ["14:00", "15:00", "16:00"]
    }
  }
}
```

#### 2. Date/Time Selection
```javascript
// API: GET /api/services/:id/availability
{
  "availability": {
    "dates": [
      {
        "date": "2024-01-20",
        "available": true,
        "slots": [
          {"time": "09:00", "available": true},
          {"time": "10:00", "available": false},
          {"time": "11:00", "available": true}
        ]
      }
    ]
  }
}
```

#### 3. User Details
```javascript
// API: POST /api/bookings
{
  "serviceId": "service_id",
  "bookingDate": "2024-01-20",
  "bookingTime": "14:00",
  "userNotes": "Emergency pipe burst",
  "contactInfo": {
    "phone": "+1234567890",
    "address": "123 Main St"
  }
}
```

#### 4. Review & Payment
```javascript
// API: POST /api/bookings/:id/confirm
{
  "paymentMethod": "credit_card",
  "paymentToken": "tok_123456",
  "totalAmount": 150.00
}
```

### My Bookings Page

#### 1. Booking List
```javascript
// API: GET /api/bookings?status=upcoming
{
  "bookings": [
    {
      "id": "booking_id",
      "service": {
        "name": "Plumbing Repair",
        "vendor": "Quick Fix Plumbing"
      },
      "date": "2024-01-25",
      "time": "10:00",
      "status": "confirmed",
      "totalAmount": 150.00,
      "actions": ["reschedule", "cancel", "contact"]
    }
  ]
}
```

#### 2. Booking Actions
```javascript
// API: PUT /api/bookings/:id/reschedule
{
  "newDate": "2024-01-26",
  "newTime": "14:00"
}

// API: PUT /api/bookings/:id/cancel
{
  "reason": "Emergency came up",
  "refundRequested": true
}
```

---

## Reviews System

### Review Management

#### 1. Review Creation
```javascript
// API: POST /api/reviews
{
  "vendorId": "vendor_id",
  "bookingId": "booking_id",
  "rating": 5,
  "title": "Excellent service!",
  "content": "Very professional and fast...",
  "images": ["url1", "url2"],
  "creationType": "manual" // or "auto"
}
```

#### 2. Review Creation Flow
```javascript
// 1. Service Completion - Create Pending Review
// API: POST /api/reviews/create-pending
{
  "bookingId": "booking_id",
  "userId": "user_id",
  "vendorId": "vendor_id",
  "serviceName": "Interior House Painting",
  "serviceDate": "2024-01-22T08:00:00Z",
  "price": 1200,
  "category": "painting-services"
}

// 2. User Writes Review
// API: POST /api/reviews/:id/complete
{
  "rating": 5,
  "title": "Excellent painting service",
  "content": "The painters did an amazing job...",
  "images": ["url1", "url2"]
}

// 3. Auto-Generation Logic (72-hour timer)
// API: POST /api/reviews/auto-generate
{
  "bookingId": "booking_id",
  "reason": "no_review_after_72_hours",
  "defaultRating": 5, // Always 5 stars for auto-generated reviews
  "defaultTitle": "Service completed successfully",
  "defaultContent": "Your service has been completed successfully. This review was automatically generated as no review was submitted within 72 hours of service completion.",
  "autoGeneratedAt": "2024-01-20T10:30:00Z"
}
```

#### 3. Review Display & Management
```javascript
// API: GET /api/reviews?status=pending&creationType=manual
{
  "reviews": [
    {
      "id": "review_id",
      "type": "written",
      "creationType": "manual",
      "status": "pending",
      "vendor": {
        "name": "Premium Paint Pros",
        "image": "url"
      },
      "rating": 0, // Pending reviews have 0 rating
      "title": null, // Pending reviews have no title
      "content": null, // Pending reviews have no content
      "serviceName": "Interior House Painting",
      "serviceDate": "2024-01-22T08:00:00Z",
      "price": 1200,
      "category": "painting-services",
      "createdAt": "2024-01-22T10:00:00Z"
    }
  ]
}

// API: GET /api/reviews/pending-count
{
  "pendingCount": 2,
  "totalReviews": 9
}
```

---

## Favorites System

### Favorites Management

#### 1. Add to Favorites
```javascript
// API: POST /api/favorites
{
  "vendorId": "vendor_id",
  "notes": "Great for emergencies"
}
```

#### 2. Favorites List
```javascript
// API: GET /api/favorites
{
  "favorites": [
    {
      "id": "favorite_id",
      "vendor": {
        "id": "vendor_id",
        "name": "Quick Fix Plumbing",
        "image": "url",
        "rating": 4.8,
        "distance": 4.6
      },
      "notes": "Great for emergencies",
      "lastContacted": "2024-01-20T14:15:00Z",
      "favoritedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### 3. Favorites Actions
```javascript
// API: PUT /api/favorites/:id/notes
{
  "notes": "Updated notes about this vendor"
}

// API: DELETE /api/favorites/:id
// Removes vendor from favorites
```

---

## Search & Discovery

### Search Functionality

#### 1. Search API
```javascript
// API: GET /api/search?q=plumbing&category=plumbing&distance=10&rating=4
{
  "results": [
    {
      "id": "vendor_id",
      "name": "Quick Fix Plumbing",
      "category": "plumbing",
      "rating": 4.8,
      "distance": 4.6,
      "priceRange": "moderate",
      "availability": "available_now",
      "verified": true,
      "featured": true
    }
  ],
  "filters": {
    "categories": ["plumbing", "electrical"],
    "priceRanges": ["budget", "moderate", "premium"],
    "availability": ["now", "today", "week"]
  }
}
```

#### 2. Discovery API
```javascript
// API: GET /api/discover
{
  "featuredServices": [
    {
      "category": "plumbing",
      "vendorCount": 15,
      "icon": "🔧"
    }
  ],
  "categories": [
    {
      "id": "plumbing",
      "name": "Plumbing",
      "icon": "🔧",
      "vendorCount": 15,
      "vendors": [...]
    }
  ]
}
```

---

## User Profile & Settings

### Profile Management

#### 1. Profile Data
```javascript
// API: GET /api/users/profile
{
  "profile": {
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "phone": "+1234567890",
    "address": "123 Main St",
    "bio": "Homeowner in downtown area",
    "profilePhoto": "url",
    "memberSince": "2023-01-15T10:30:00Z",
    "lastLogin": "2024-01-20T14:30:00Z",
    "isPremium": true,
    "locationEnabled": true,
    "twoFactorEnabled": false
  }
}
```

#### 2. Settings Management
```javascript
// API: PUT /api/users/settings
{
  "locationEnabled": true,
  "twoFactorEnabled": true,
  "notificationPreferences": {
    "email": true,
    "push": true,
    "sms": false
  }
}
```

---

## Messaging System

### Message Management

#### 1. Conversations
```javascript
// API: GET /api/messages
{
  "conversations": [
    {
      "id": "conversation_id",
      "participant": {
        "id": "vendor_id",
        "name": "Quick Fix Plumbing",
        "image": "url"
      },
      "lastMessage": {
        "content": "I'll be there in 30 minutes",
        "timestamp": "2024-01-20T14:30:00Z",
        "unread": true
      }
    }
  ]
}
```

#### 2. Messages
```javascript
// API: GET /api/messages/:conversationId
{
  "messages": [
    {
      "id": "message_id",
      "sender": "user_id",
      "content": "When will you arrive?",
      "timestamp": "2024-01-20T14:25:00Z",
      "read": true
    }
  ]
}
```

---

## Notification System

### Notification Management

#### 1. Notifications List
```javascript
// API: GET /api/notifications
{
  "notifications": [
    {
      "id": "notification_id",
      "type": "booking_confirmed",
      "title": "Booking Confirmed",
      "message": "Your plumbing service is confirmed for tomorrow",
      "data": {
        "bookingId": "booking_id",
        "serviceName": "Plumbing Repair"
      },
      "read": false,
      "createdAt": "2024-01-20T10:30:00Z"
    }
  ]
}
```

#### 2. Notification Types
- Booking confirmations
- Service reminders
- Price drop alerts
- New vendor alerts
- Review requests
- Payment confirmations

---

## Payment System

### Payment Processing

#### 1. Payment Methods
```javascript
// API: GET /api/payments/methods
{
  "methods": [
    {
      "id": "method_id",
      "type": "credit_card",
      "last4": "1234",
      "brand": "visa",
      "expiry": "12/25"
    }
  ]
}
```

#### 2. Payment Processing
```javascript
// API: POST /api/payments/process
{
  "bookingId": "booking_id",
  "amount": 150.00,
  "paymentMethodId": "method_id",
  "currency": "USD"
}
```

---

## Analytics & Reporting

### Dashboard Analytics

#### 1. User Analytics
```javascript
// API: GET /api/analytics/user-dashboard
{
  "metrics": {
    "totalBookings": 25,
    "totalSpent": 2500.00,
    "averageRating": 4.6,
    "favoriteVendors": 8
  },
  "recentActivity": [
    {
      "type": "booking",
      "description": "Booked plumbing service",
      "timestamp": "2024-01-20T10:30:00Z"
    }
  ]
}
```

#### 2. Vendor Analytics
```javascript
// API: GET /api/analytics/vendor/:id
{
  "metrics": {
    "totalJobs": 1247,
    "averageRating": 4.8,
    "completionRate": 98.5,
    "responseTime": 120, // minutes
    "customerSatisfaction": 4.9
  }
}
```

---

## File Management

### Media Upload

#### 1. Image Upload
```javascript
// API: POST /api/upload/image
{
  "file": "binary_data",
  "type": "profile_photo", // or "service_image", "review_image"
  "entityId": "user_id" // or "service_id", "review_id"
}
```

#### 2. Video Upload
```javascript
// API: POST /api/upload/video
{
  "file": "binary_data",
  "type": "service_video",
  "serviceId": "service_id"
}
```

---

## Security & Authentication

### Authentication

#### 1. JWT Tokens
```javascript
// Token structure
{
  "userId": "user_id",
  "email": "user@example.com",
  "role": "user", // or "vendor", "admin"
  "permissions": ["read", "write"],
  "exp": 1642684800
}
```

#### 2. Two-Factor Authentication
```javascript
// API: POST /api/auth/2fa/setup
{
  "secret": "generated_secret",
  "qrCode": "data:image/png;base64,..."
}

// API: POST /api/auth/2fa/verify
{
  "token": "123456"
}
```

### Data Protection

#### 1. Input Validation
- Sanitize all user inputs
- Validate file uploads
- Prevent SQL injection
- XSS protection

#### 2. Rate Limiting
```javascript
// Rate limiting rules
{
  "auth": {
    "login": "5 requests per minute",
    "register": "3 requests per hour"
  },
  "api": {
    "search": "100 requests per minute",
    "bookings": "10 requests per minute"
  }
}
```

---

## Integration Checklist

### Vendor Side Requirements

#### ✅ Profile Management
- [ ] Business information form
- [ ] Service type selection
- [ ] Profile photo upload
- [ ] Address and location
- [ ] Credentials (insurance, bonded, licensed)
- [ ] Service areas definition

#### ✅ Service Management
- [ ] Service creation form
- [ ] Pricing configuration
- [ ] Features and inclusions
- [ ] Media upload (images/videos)
- [ ] Availability scheduling
- [ ] Service area mapping

#### ✅ Analytics Dashboard
- [ ] Performance metrics display
- [ ] Review management
- [ ] Booking calendar
- [ ] Revenue tracking
- [ ] Customer feedback

### User Side Requirements

#### ✅ Dashboard Integration
- [ ] Personalized recommendations
- [ ] Social proof indicators
- [ ] Price comparison
- [ ] Smart notifications
- [ ] Calendar integration

#### ✅ Booking System
- [ ] Multi-step booking flow
- [ ] Payment processing
- [ ] Booking management
- [ ] Review system
- [ ] Favorites system

#### ✅ Search & Discovery
- [ ] Advanced filtering
- [ ] Location-based search
- [ ] Category browsing
- [ ] Vendor comparison

### Backend Requirements

#### ✅ API Development
- [ ] RESTful API endpoints
- [ ] Authentication system
- [ ] Data validation
- [ ] Error handling
- [ ] Rate limiting

#### ✅ Database Design
- [ ] Normalized schema
- [ ] Indexing strategy
- [ ] Data relationships
- [ ] Backup procedures

#### ✅ Security Implementation
- [ ] JWT authentication
- [ ] Input sanitization
- [ ] File upload security
- [ ] Data encryption

---

## Deployment Considerations

### Environment Setup
- Production database (PostgreSQL)
- Redis for caching
- File storage (AWS S3)
- CDN for static assets
- Load balancer
- SSL certificates

### Monitoring
- Application performance monitoring
- Error tracking
- Database performance
- API response times
- User analytics

### Scalability
- Horizontal scaling
- Database sharding
- Caching strategies
- CDN optimization
- Microservices architecture

---

This comprehensive backend integration guide ensures all frontend features have proper data sources and API endpoints for full functionality. 