# Bookings Backend Integration Guide
*Updated: January 2024 - Reflects all booking system implementations*

## Overview
This document outlines the backend requirements for the comprehensive booking system implemented in Project Reliance, including the multi-step booking flow, booking management, and all related features.

## Implemented Features

### 1. Multi-Step Booking Flow
- **Date & Time Selection**: Interactive calendar with availability checking
- **User Details Form**: Contact information and service requirements
- **Review & Confirmation**: Booking summary and terms acceptance
- **Payment Processing**: Secure payment handling
- **Confirmation Page**: Booking confirmation with next steps

### 2. My Bookings Page
- **Tabbed Navigation**: Upcoming, Past, Cancelled bookings
- **Search & Filtering**: Advanced search and category filtering
- **View Modes**: List and Calendar views
- **Booking Actions**: Reschedule, cancel, contact vendor, add to calendar
- **Receipt Management**: Download booking receipts
- **Review Integration**: Leave reviews for completed bookings

### 3. Booking Management
- **Status Tracking**: Pending, confirmed, completed, cancelled
- **Real-time Updates**: Live status updates and notifications
- **Booking History**: Complete booking timeline
- **Cancellation Handling**: Cancellation reasons and refunds

## Database Schema

### Core Booking Tables

```sql
-- Main Bookings Table
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    service_id INTEGER REFERENCES services(id) NOT NULL,
    vendor_id INTEGER REFERENCES vendors(id) NOT NULL,
    booking_date DATE NOT NULL,
    booking_time TIME NOT NULL,
    duration_minutes INTEGER,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
    total_price DECIMAL(10,2) NOT NULL,
    original_price DECIMAL(10,2),
    discount_amount DECIMAL(10,2),
    user_notes TEXT,
    vendor_notes TEXT,
    cancellation_reason TEXT,
    cancellation_fee DECIMAL(10,2),
    refund_amount DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    confirmed_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP
);

-- Booking Details (Custom Fields)
CREATE TABLE booking_details (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    field_value TEXT,
    field_type VARCHAR(50) DEFAULT 'text', -- text, number, boolean, date, file
    is_required BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Booking Status History
CREATE TABLE booking_status_history (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    changed_by INTEGER REFERENCES users(id),
    changed_by_type VARCHAR(20) DEFAULT 'user', -- user, vendor, admin, system
    reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Booking Payments
CREATE TABLE booking_payments (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
    payment_method VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    transaction_id VARCHAR(255),
    gateway_response JSONB,
    refund_amount DECIMAL(10,2) DEFAULT 0,
    refund_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Availability Management

```sql
-- Vendor Availability Schedule
CREATE TABLE vendor_availability (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
    start_time TIME,
    end_time TIME,
    is_available BOOLEAN DEFAULT true,
    break_start_time TIME,
    break_end_time TIME,
    max_bookings_per_day INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(vendor_id, day_of_week)
);

-- Vendor Time Slots
CREATE TABLE vendor_time_slots (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id),
    date DATE NOT NULL,
    time_slot TIME NOT NULL,
    duration_minutes INTEGER,
    is_available BOOLEAN DEFAULT true,
    is_booked BOOLEAN DEFAULT false,
    booking_id INTEGER REFERENCES bookings(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(vendor_id, date, time_slot)
);

-- Vendor Blocked Dates
CREATE TABLE vendor_blocked_dates (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
    blocked_date DATE NOT NULL,
    reason TEXT,
    is_recurring BOOLEAN DEFAULT false,
    recurring_pattern JSONB, -- For recurring blocked dates
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Booking Analytics & Metrics

```sql
-- Booking Analytics
CREATE TABLE booking_analytics (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    vendor_id INTEGER REFERENCES vendors(id),
    service_id INTEGER REFERENCES services(id),
    booking_value DECIMAL(10,2),
    commission_amount DECIMAL(10,2),
    platform_fee DECIMAL(10,2),
    vendor_payout DECIMAL(10,2),
    booking_source VARCHAR(50), -- direct, search, recommendation, etc.
    conversion_funnel_step VARCHAR(50),
    time_to_confirm_minutes INTEGER,
    time_to_complete_minutes INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Booking Metrics (Aggregated)
CREATE TABLE booking_metrics (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id),
    date DATE NOT NULL,
    total_bookings INTEGER DEFAULT 0,
    completed_bookings INTEGER DEFAULT 0,
    cancelled_bookings INTEGER DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0,
    average_booking_value DECIMAL(10,2) DEFAULT 0,
    response_time_minutes INTEGER,
    completion_rate DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(vendor_id, date)
);
```

## API Endpoints

### Booking Management

```typescript
// Create New Booking
POST /api/bookings
{
  "service_id": number,
  "vendor_id": number,
  "booking_date": "2024-01-25",
  "booking_time": "10:00:00",
  "user_notes": "string",
  "custom_fields": {
    "field_name": "field_value"
  }
}

// Get User Bookings
GET /api/bookings/user/:userId
Query Parameters:
- status: string (pending, confirmed, completed, cancelled)
- date_from: string (YYYY-MM-DD)
- date_to: string (YYYY-MM-DD)
- page: number
- limit: number

// Get Booking Details
GET /api/bookings/:bookingId

// Update Booking
PUT /api/bookings/:bookingId
{
  "user_notes": "string",
  "custom_fields": {
    "field_name": "field_value"
  }
}

// Cancel Booking
POST /api/bookings/:bookingId/cancel
{
  "reason": "string",
  "refund_requested": boolean
}

// Reschedule Booking
POST /api/bookings/:bookingId/reschedule
{
  "new_date": "2024-01-26",
  "new_time": "14:00:00",
  "reason": "string"
}
```

### Availability Management

```typescript
// Get Vendor Availability
GET /api/availability/vendor/:vendorId
Query Parameters:
- date_from: string (YYYY-MM-DD)
- date_to: string (YYYY-MM-DD)
- service_id: number

// Check Time Slot Availability
GET /api/availability/check
Query Parameters:
- vendor_id: number
- service_id: number
- date: string (YYYY-MM-DD)
- time: string (HH:MM:SS)

// Update Vendor Availability
PUT /api/availability/vendor/:vendorId
{
  "availability_schedule": [
    {
      "day_of_week": 1,
      "start_time": "09:00:00",
      "end_time": "17:00:00",
      "is_available": true
    }
  ]
}

// Block Vendor Dates
POST /api/availability/vendor/:vendorId/block
{
  "blocked_dates": ["2024-01-25", "2024-01-26"],
  "reason": "string"
}
```

### Booking Actions

```typescript
// Add Booking to Calendar
POST /api/bookings/:bookingId/calendar
{
  "calendar_type": "google|outlook|apple",
  "calendar_id": "string"
}

// Download Receipt
GET /api/bookings/:bookingId/receipt
Response: PDF file

// Generate Receipt
POST /api/bookings/:bookingId/receipt/generate
{
  "include_tax": boolean,
  "include_breakdown": boolean
}

// Contact Vendor
POST /api/bookings/:bookingId/contact
{
  "message": "string",
  "contact_method": "chat|email|phone"
}

// Leave Review (for completed bookings)
POST /api/bookings/:bookingId/review
{
  "rating": number (1-5),
  "review_text": "string",
  "review_title": "string"
}
```

### Booking Analytics

```typescript
// Get User Booking Analytics
GET /api/analytics/bookings/user/:userId
Query Parameters:
- period: string (week, month, year)
- date_from: string (YYYY-MM-DD)
- date_to: string (YYYY-MM-DD)

// Get Vendor Booking Analytics
GET /api/analytics/bookings/vendor/:vendorId
Query Parameters:
- period: string (week, month, year)
- date_from: string (YYYY-MM-DD)
- date_to: string (YYYY-MM-DD)

// Get Platform Booking Analytics
GET /api/analytics/bookings/platform
Query Parameters:
- period: string (week, month, year)
- date_from: string (YYYY-MM-DD)
- date_to: string (YYYY-MM-DD)
```

## Business Logic Implementation

### Booking Creation Flow

```typescript
interface BookingCreationRequest {
  service_id: number;
  vendor_id: number;
  booking_date: string;
  booking_time: string;
  user_notes?: string;
  custom_fields?: Record<string, any>;
}

async function createBooking(request: BookingCreationRequest): Promise<Booking> {
  // 1. Validate service and vendor
  const service = await validateService(request.service_id);
  const vendor = await validateVendor(request.vendor_id);
  
  // 2. Check availability
  const isAvailable = await checkAvailability(
    request.vendor_id,
    request.service_id,
    request.booking_date,
    request.booking_time
  );
  
  if (!isAvailable) {
    throw new Error('Selected time slot is not available');
  }
  
  // 3. Calculate pricing
  const pricing = await calculatePricing(
    request.service_id,
    request.booking_date,
    request.booking_time
  );
  
  // 4. Create booking
  const booking = await db.bookings.create({
    user_id: getCurrentUserId(),
    service_id: request.service_id,
    vendor_id: request.vendor_id,
    booking_date: request.booking_date,
    booking_time: request.booking_time,
    duration_minutes: service.duration_minutes,
    total_price: pricing.total_price,
    original_price: pricing.original_price,
    discount_amount: pricing.discount_amount,
    user_notes: request.user_notes,
    status: 'pending'
  });
  
  // 5. Reserve time slot
  await reserveTimeSlot(
    request.vendor_id,
    request.booking_date,
    request.booking_time,
    booking.id
  );
  
  // 6. Create booking details
  if (request.custom_fields) {
    await createBookingDetails(booking.id, request.custom_fields);
  }
  
  // 7. Send notifications
  await sendBookingNotifications(booking);
  
  return booking;
}
```

### Availability Checking

```typescript
async function checkAvailability(
  vendor_id: number,
  service_id: number,
  date: string,
  time: string
): Promise<boolean> {
  // 1. Check vendor availability schedule
  const dayOfWeek = new Date(date).getDay();
  const availability = await db.vendor_availability.findOne({
    where: { vendor_id, day_of_week: dayOfWeek }
  });
  
  if (!availability || !availability.is_available) {
    return false;
  }
  
  // 2. Check if time is within available hours
  const bookingTime = new Date(`2000-01-01T${time}`);
  const startTime = new Date(`2000-01-01T${availability.start_time}`);
  const endTime = new Date(`2000-01-01T${availability.end_time}`);
  
  if (bookingTime < startTime || bookingTime >= endTime) {
    return false;
  }
  
  // 3. Check if time slot is already booked
  const existingBooking = await db.vendor_time_slots.findOne({
    where: {
      vendor_id,
      date,
      time_slot: time,
      is_booked: true
    }
  });
  
  if (existingBooking) {
    return false;
  }
  
  // 4. Check blocked dates
  const blockedDate = await db.vendor_blocked_dates.findOne({
    where: { vendor_id, blocked_date: date }
  });
  
  if (blockedDate) {
    return false;
  }
  
  return true;
}
```

### Booking Status Management

```typescript
async function updateBookingStatus(
  booking_id: number,
  new_status: string,
  changed_by: number,
  reason?: string
): Promise<void> {
  const booking = await db.bookings.findByPk(booking_id);
  
  if (!booking) {
    throw new Error('Booking not found');
  }
  
  // Validate status transition
  const validTransitions = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: []
  };
  
  if (!validTransitions[booking.status].includes(new_status)) {
    throw new Error(`Invalid status transition from ${booking.status} to ${new_status}`);
  }
  
  // Update booking status
  await booking.update({
    status: new_status,
    [`${new_status}_at`]: new Date()
  });
  
  // Create status history record
  await db.booking_status_history.create({
    booking_id,
    status: new_status,
    changed_by,
    reason
  });
  
  // Handle status-specific actions
  switch (new_status) {
    case 'confirmed':
      await sendConfirmationNotification(booking);
      break;
    case 'completed':
      await sendCompletionNotification(booking);
      await requestReview(booking);
      break;
    case 'cancelled':
      await handleCancellation(booking, reason);
      break;
  }
}
```

## Notification System

### Booking Notifications

```typescript
interface BookingNotification {
  booking_id: number;
  notification_type: 'created' | 'confirmed' | 'reminder' | 'completed' | 'cancelled';
  recipient_id: number;
  recipient_type: 'user' | 'vendor';
  message: string;
  data: Record<string, any>;
}

async function sendBookingNotification(notification: BookingNotification): Promise<void> {
  // Create notification record
  await db.notifications.create({
    user_id: notification.recipient_id,
    notification_type: `booking_${notification.notification_type}`,
    title: getNotificationTitle(notification.notification_type),
    message: notification.message,
    notification_data: notification.data
  });
  
  // Send real-time notification
  await sendWebSocketNotification(notification.recipient_id, {
    type: 'booking_update',
    data: notification.data
  });
  
  // Send email/SMS if configured
  if (notification.recipient_type === 'user') {
    await sendEmailNotification(notification);
  }
}
```

## Payment Integration

### Payment Processing

```typescript
interface PaymentRequest {
  booking_id: number;
  payment_method: string;
  amount: number;
  currency: string;
}

async function processPayment(request: PaymentRequest): Promise<Payment> {
  const booking = await db.bookings.findByPk(request.booking_id);
  
  // Create payment record
  const payment = await db.booking_payments.create({
    booking_id: request.booking_id,
    payment_method: request.payment_method,
    amount: request.amount,
    currency: request.currency,
    payment_status: 'processing'
  });
  
  try {
    // Process payment through gateway
    const gatewayResponse = await paymentGateway.process({
      amount: request.amount,
      currency: request.currency,
      payment_method: request.payment_method,
      booking_reference: booking.id
    });
    
    // Update payment record
    await payment.update({
      payment_status: gatewayResponse.success ? 'completed' : 'failed',
      transaction_id: gatewayResponse.transaction_id,
      gateway_response: gatewayResponse
    });
    
    // Update booking status if payment successful
    if (gatewayResponse.success) {
      await updateBookingStatus(booking.id, 'confirmed', booking.user_id);
    }
    
    return payment;
  } catch (error) {
    await payment.update({
      payment_status: 'failed',
      gateway_response: { error: error.message }
    });
    throw error;
  }
}
```

## Security Considerations

### Data Validation

```typescript
function validateBookingRequest(request: any): BookingCreationRequest {
  const schema = Joi.object({
    service_id: Joi.number().integer().positive().required(),
    vendor_id: Joi.number().integer().positive().required(),
    booking_date: Joi.date().min('now').required(),
    booking_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).required(),
    user_notes: Joi.string().max(1000).optional(),
    custom_fields: Joi.object().optional()
  });
  
  const { error, value } = schema.validate(request);
  if (error) {
    throw new Error(`Validation error: ${error.details[0].message}`);
  }
  
  return value;
}
```

### Authorization

```typescript
async function authorizeBookingAccess(booking_id: number, user_id: number): Promise<boolean> {
  const booking = await db.bookings.findByPk(booking_id);
  
  if (!booking) {
    return false;
  }
  
  // User can access their own bookings
  if (booking.user_id === user_id) {
    return true;
  }
  
  // Vendor can access bookings for their services
  if (booking.vendor_id === user_id) {
    return true;
  }
  
  // Admin can access all bookings
  const user = await db.users.findByPk(user_id);
  if (user?.role === 'admin') {
    return true;
  }
  
  return false;
}
```

## Performance Optimization

### Database Indexing

```sql
-- Performance indexes for booking queries
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_vendor_id ON bookings(vendor_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_bookings_user_status ON bookings(user_id, status);
CREATE INDEX idx_bookings_vendor_status ON bookings(vendor_id, status);
CREATE INDEX idx_bookings_date_status ON bookings(booking_date, status);

-- Availability indexes
CREATE INDEX idx_time_slots_vendor_date ON vendor_time_slots(vendor_id, date);
CREATE INDEX idx_time_slots_available ON vendor_time_slots(vendor_id, date, is_available);
CREATE INDEX idx_availability_vendor_day ON vendor_availability(vendor_id, day_of_week);

-- Analytics indexes
CREATE INDEX idx_booking_analytics_date ON booking_analytics(created_at);
CREATE INDEX idx_booking_metrics_vendor_date ON booking_metrics(vendor_id, date);
```

### Caching Strategy

```typescript
// Cache vendor availability for 5 minutes
async function getCachedAvailability(vendor_id: number, date: string): Promise<TimeSlot[]> {
  const cacheKey = `availability:${vendor_id}:${date}`;
  
  let availability = await redis.get(cacheKey);
  if (availability) {
    return JSON.parse(availability);
  }
  
  availability = await db.vendor_time_slots.findAll({
    where: { vendor_id, date }
  });
  
  await redis.setex(cacheKey, 300, JSON.stringify(availability));
  return availability;
}

// Cache booking analytics for 1 hour
async function getCachedBookingAnalytics(user_id: number, period: string): Promise<Analytics> {
  const cacheKey = `analytics:bookings:${user_id}:${period}`;
  
  let analytics = await redis.get(cacheKey);
  if (analytics) {
    return JSON.parse(analytics);
  }
  
  analytics = await calculateBookingAnalytics(user_id, period);
  
  await redis.setex(cacheKey, 3600, JSON.stringify(analytics));
  return analytics;
}
```

## Testing Strategy

### Unit Tests

```typescript
describe('Booking Creation', () => {
  it('should create a booking with valid data', async () => {
    const bookingData = {
      service_id: 1,
      vendor_id: 1,
      booking_date: '2024-01-25',
      booking_time: '10:00:00',
      user_notes: 'Test booking'
    };
    
    const booking = await createBooking(bookingData);
    
    expect(booking).toBeDefined();
    expect(booking.status).toBe('pending');
    expect(booking.user_id).toBe(getCurrentUserId());
  });
  
  it('should reject booking for unavailable time slot', async () => {
    const bookingData = {
      service_id: 1,
      vendor_id: 1,
      booking_date: '2024-01-25',
      booking_time: '23:00:00' // Outside business hours
    };
    
    await expect(createBooking(bookingData)).rejects.toThrow('Selected time slot is not available');
  });
});
```

### Integration Tests

```typescript
describe('Booking Workflow', () => {
  it('should complete full booking workflow', async () => {
    // 1. Create booking
    const booking = await createBooking(validBookingData);
    
    // 2. Confirm booking
    await updateBookingStatus(booking.id, 'confirmed', booking.vendor_id);
    
    // 3. Process payment
    const payment = await processPayment({
      booking_id: booking.id,
      payment_method: 'card',
      amount: booking.total_price,
      currency: 'USD'
    });
    
    // 4. Complete booking
    await updateBookingStatus(booking.id, 'completed', booking.vendor_id);
    
    // 5. Verify final state
    const finalBooking = await db.bookings.findByPk(booking.id);
    expect(finalBooking.status).toBe('completed');
    expect(payment.payment_status).toBe('completed');
  });
});
```

## Implementation Priority

### Phase 1: Core Booking System
1. **Basic booking creation and management**
2. **Simple availability checking**
3. **Payment processing integration**
4. **Basic notifications**

### Phase 2: Enhanced Features
1. **Advanced availability management**
2. **Booking analytics and reporting**
3. **Rescheduling and cancellation**
4. **Review integration**

### Phase 3: Advanced Features
1. **Real-time availability updates**
2. **Advanced booking analytics**
3. **Multi-service bookings**
4. **Recurring bookings**

This comprehensive backend integration guide covers all the booking system features we've implemented and provides a complete roadmap for building a robust, scalable booking system. 