# Backend Integration Guide

## 🆕 **Today's Updates (Latest Changes)**

### **Enhanced Vendor Dashboard - Comprehensive Features**
- **Job/Booking Calendar System:**
  - Interactive calendar with job display on dates
  - Navigation controls (previous/next month)
  - Today indicator and date selection
  - Job details on hover/click with color coding
  - Availability status indicators
  - Daily earnings summary
  - Quick actions (view, edit, contact, delete jobs)
  - Add booking modal with date/time selection
  - Mark days as unavailable functionality
  - Export schedule feature
  - Mobile responsive design

- **Backend Requirements for Calendar:**
  - `GET /api/vendor/calendar/jobs` - Fetch jobs for calendar display
  - `GET /api/vendor/calendar/availability` - Get availability status
  - `POST /api/vendor/calendar/availability` - Mark days unavailable/available
  - `POST /api/vendor/calendar/booking` - Create new booking
  - `GET /api/vendor/calendar/earnings` - Get daily earnings data
  - `POST /api/vendor/calendar/export` - Export schedule
  - `PATCH /api/vendor/jobs/:id` - Update job details
  - `DELETE /api/vendor/jobs/:id` - Delete job

- **Data Contracts for Calendar:**
  - Job: `{ id, title, client, date, time, duration, status, earnings, type, priority, notes }`
  - Availability: `{ date, available, reason, earnings }`
  - Booking: `{ id, clientId, serviceId, date, time, duration, notes, status }`

### **Clients CRM System:**
- **Features Added:**
  - Search and filter functionality
  - Sorting by name, email, status, last contact
  - Add new client modal with validation
  - Edit/delete client actions
  - Bulk selection and actions
  - Clickable email/phone links
  - Pagination with configurable page size
  - Export to CSV functionality
  - Empty state with helpful messaging
  - Responsive design for mobile
  - Status badges and visual indicators
  - Contact history tracking

- **Backend Requirements for Clients CRM:**
  - `GET /api/vendor/clients` - Fetch clients with search/filter/pagination
  - `POST /api/vendor/clients` - Create new client
  - `PATCH /api/vendor/clients/:id` - Update client details
  - `DELETE /api/vendor/clients/:id` - Delete client
  - `POST /api/vendor/clients/bulk` - Bulk actions (delete, export, notify)
  - `GET /api/vendor/clients/:id/history` - Get contact history
  - `POST /api/vendor/clients/:id/contact` - Log contact interaction

- **Data Contracts for Clients:**
  - Client: `{ id, name, email, phone, status, tags, lastContact, totalJobs, totalSpent, notes, createdAt }`
  - ContactHistory: `{ id, type, method, notes, timestamp, outcome }`

### **Team Members Management:**
- **Features Added:**
  - Search and filter team members
  - Add/remove team member functionality
  - View detailed profiles
  - Contact team members (email, phone, SMS, platform)
  - Manage permissions and access levels
  - Bulk actions (remove, export, notify)
  - Status indicators and activity tracking
  - Permission management modal
  - Responsive design

- **Backend Requirements for Team Members:**
  - `GET /api/vendor/team` - Fetch team members with search/filter
  - `POST /api/vendor/team` - Add team member
  - `DELETE /api/vendor/team/:id` - Remove team member
  - `PATCH /api/vendor/team/:id/permissions` - Update permissions
  - `GET /api/vendor/team/:id/profile` - Get detailed profile
  - `POST /api/vendor/team/:id/contact` - Contact team member
  - `POST /api/vendor/team/bulk` - Bulk actions

- **Data Contracts for Team Members:**
  - TeamMember: `{ id, name, email, phone, role, permissions, status, lastActivity, joinDate, avatar }`
  - Permission: `{ id, name, description, category }`

### **Interactive Insights & Recommendations:**
- **Features Added:**
  - Clickable insights with action buttons
  - Dismiss functionality with localStorage persistence
  - Search and filter insights
  - Settings modal for customization
  - Restore dismissed insights
  - Visual indicators for priority and type
  - Action tracking and analytics

- **Backend Requirements for Insights:**
  - `GET /api/vendor/insights` - Fetch insights with filters
  - `POST /api/vendor/insights/:id/dismiss` - Dismiss insight
  - `POST /api/vendor/insights/:id/action` - Track action taken
  - `GET /api/vendor/insights/settings` - Get insight preferences
  - `PATCH /api/vendor/insights/settings` - Update preferences

- **Data Contracts for Insights:**
  - Insight: `{ id, type, title, message, priority, category, actionUrl, dismissible, createdAt }`

### **Enhanced Notifications & Alerts:**
- **Features Added:**
  - Action buttons for notifications
  - Mark as read/unread functionality
  - Search and filter by type
  - Clear all notifications
  - Notification settings modal
  - Priority indicators
  - Bulk actions

- **Backend Requirements for Notifications:**
  - `GET /api/vendor/notifications` - Fetch notifications with filters
  - `PATCH /api/vendor/notifications/:id/read` - Mark as read/unread
  - `DELETE /api/vendor/notifications/:id` - Delete notification
  - `POST /api/vendor/notifications/clear-all` - Clear all notifications
  - `GET /api/vendor/notifications/settings` - Get notification preferences
  - `PATCH /api/vendor/notifications/settings` - Update preferences

- **Data Contracts for Notifications:**
  - Notification: `{ id, type, title, message, priority, read, actionUrl, createdAt }`

### **Performance Metrics Enhancements:**
- **Features Added:**
  - Time period selector (week, month, quarter, year)
  - Trend indicators with visual arrows
  - Historical data comparison
  - Drill-down capability with detailed modal
  - Context and benchmarks
  - Interactive elements
  - Goal setting functionality
  - Export and share options

- **Backend Requirements for Performance:**
  - `GET /api/vendor/performance` - Get performance metrics for period
  - `GET /api/vendor/performance/history` - Get historical data
  - `GET /api/vendor/performance/goals` - Get performance goals
  - `PATCH /api/vendor/performance/goals` - Update goals
  - `POST /api/vendor/performance/export` - Export performance data

- **Data Contracts for Performance:**
  - Performance: `{ period, metrics: { responseTime, completionRate, satisfaction, reviewScore }, trends, goals }`

### **Support System Implementation**
- **New Support Pages Created:**
  - `/vendor/support` - Main support page with Quick Help and Contact Information
  - `/vendor/support/faqs` - Searchable FAQ system with categories
  - `/vendor/support/help-articles` - Article library with filtering and search
  - `/vendor/support/contact` - Support ticket submission form
  - `/vendor/support/chat` - Live chat interface

- **Backend Requirements for Support System:**
  - `GET /api/support/faqs` - Fetch FAQ categories and questions
  - `GET /api/support/articles` - Fetch help articles with filtering
  - `POST /api/support/tickets` - Submit support tickets
  - `GET /api/support/tickets/:id` - Get ticket status
  - `POST /api/support/chat/start` - Initialize chat session
  - `POST /api/support/chat/message` - Send chat message
  - `GET /api/support/chat/history` - Get chat history

- **Data Contracts:**
  - FAQ: `{ id, category, question, answer, tags, helpful, notHelpful }`
  - Article: `{ id, title, category, content, readTime, difficulty, rating, views, tags }`
  - Ticket: `{ id, subject, category, priority, description, status, createdAt, updatedAt }`
  - Chat: `{ id, messages: [{ id, text, sender, timestamp }], status }`

### **Vendor Dashboard Enhancements**
- **Quick Actions Modal System:**
  - Message Client Modal: Client selection + manual contact input
  - Send Invoice Modal: Auto-generated invoices with tax/discount calculations
  - Request Review Modal: 72-hour window restriction with templates

- **Backend Requirements for Quick Actions:**
  - `GET /api/vendor/clients` - Fetch available clients for messaging
  - `POST /api/vendor/message` - Send message to client
  - `POST /api/vendor/invoice` - Create and send invoice
  - `GET /api/vendor/jobs/reviewable` - Get jobs eligible for review requests
  - `POST /api/vendor/review-request` - Send review request

- **Data Contracts:**
  - Client: `{ id, name, email, phone, lastJob, lastContact }`
  - Invoice: `{ id, jobId, amount, taxRate, discount, dueDate, status }`
  - ReviewRequest: `{ id, clientId, jobId, message, reviewTypes, followUpDays }`

### **Profile Completeness System**
- **Features Added:**
  - Progress tracking with dismissible card
  - Clickable incomplete steps with navigation
  - localStorage persistence for dismissal preference
  - Restore functionality for dismissed card

- **Backend Requirements:**
  - `GET /api/vendor/profile/completeness` - Get profile completion status
  - `PATCH /api/vendor/profile/step/:stepId` - Mark step as complete
  - `GET /api/vendor/profile/steps` - Get all profile steps

### **SSR Issues Resolved**
- **ToastProvider SSR Fix:**
  - Created client-only Toaster components
  - Implemented dynamic imports with `ssr: false`
  - Separated toast components into dedicated files
  - Temporarily disabled Toaster usage to prevent hydration errors

- **Technical Changes:**
  - Updated all Toaster components to use client-side rendering
  - Added proper error boundaries for SSR compatibility
  - Implemented conditional rendering for client-only features

### **Navigation Improvements**
- **Back to Dashboard Buttons:**
  - Added consistent navigation across all support pages
  - Implemented breadcrumb-style navigation with separators
  - Used proper Next.js Link components for client-side routing

### **UI/UX Enhancements**
- **Tooltip Positioning:**
  - Moved info icons inside Quick Action buttons
  - Reduced spacing between text and tooltips
  - Added proper positioning with `side="top"` and `sideOffset={5}`

- **Support Page Redesign:**
  - Removed redundant "Support & Resources" section
  - Simplified page structure for better usability
  - Added Quick Help cards for common tasks

---

This guide provides backend requirements for all major features/pages in the Reliance Admin project. Each section includes endpoints, data contracts, business logic, roles, error handling, and future features.

---

## Dashboard
- **Endpoints:**
  - `GET /api/dashboard/stats` — Returns total users, vendors, reviews, growth rate, last updated
  - `GET /api/dashboard/user-growth` — Monthly user growth data
  - `GET /api/dashboard/revenue-trend` — Monthly revenue data
- **Data Contracts:**
  - Stats: `{ totalUsers, totalVendors, totalReviews, growthRate, lastUpdated }`
  - Chart: `{ labels: string[], datasets: { label: string, data: number[] }[] }`
- **Business Logic:**
  - Calculate growth rates, aggregate monthly data
- **Roles:**
  - Admins only
- **Error Handling:**
  - Return 500 for DB errors, 404 for missing data

---

## User Management
- **Endpoints:**
  - `GET /api/users` (filters: search, status, role, vendor, pagination, sort)
  - `POST /api/users` (create new user)
  - `PATCH /api/users/:id` (update user details, status, role, permissions)
  - `DELETE /api/users/:id` (delete/deactivate user)
  - `POST /api/users/import` (bulk import users)
  - `POST /api/users/:id/notify` (send notification to user)
- **Data Contracts:**
  - User: `{ id, name, email, role, status, createdAt, lastLogin, profileImage, vendorId, permissions }`
- **Business Logic:**
  - Batch actions, audit logging
- **Roles:**
  - Only admins or users with `user:manage`
- **Error Handling:**
  - Duplicate emails, invalid roles, permission issues
- **Future Features:**
  - User activity logs, advanced search, export, role-based dashboards

---

## User Management – Bulk Actions (Admin Panel)

All endpoints require admin authentication/authorization. All bulk actions should be logged in the audit trail (who performed, when, what action, which users). For destructive actions (delete, suspend), consider requiring a reason and/or double confirmation. For export, ensure data privacy compliance (GDPR, CCPA, etc.). For notifications, support both email and in-app (if available).

### Bulk Actions Endpoints

1. **Bulk Status Update**
   - `POST /api/admin/users/bulk-update-status`
   - Payload: `{ userIds: number[], status: "active" | "inactive" | "suspended" }`
   - Returns: Success/failure, updated user list

2. **Bulk Delete**
   - `POST /api/admin/users/bulk-delete`
   - Payload: `{ userIds: number[] }`
   - Returns: Success/failure

3. **Bulk Role Assignment**
   - `POST /api/admin/users/bulk-role`
   - Payload: `{ userIds: number[], role: string }`
   - Returns: Success/failure

4. **Bulk Notification**
   - `POST /api/admin/users/bulk-notify`
   - Payload: `{ userIds: number[], message: string }`
   - Returns: Success/failure

5. **Bulk Export**
   - `POST /api/admin/users/bulk-export`
   - Payload: `{ userIds: number[] }`
   - Returns: CSV or file download

6. **Bulk Password Reset**
   - `POST /api/admin/users/bulk-reset-password`
   - Payload: `{ userIds: number[] }`
   - Returns: Success/failure

---

## Vendor Management
- **Endpoints:**
  - `GET /api/vendors` (filters: search, status, approval, pagination, sort)
  - `POST /api/vendors` (create new vendor)
  - `PATCH /api/vendors/:id` (update vendor details, status, approval)
  - `DELETE /api/vendors/:id` (delete/deactivate vendor)
  - `POST /api/vendors/import` (bulk import vendors)
  - `POST /api/vendors/:id/notify` (send notification to vendor)
- **Data Contracts:**
  - Vendor: `{ id, name, contactPerson, email, phone, status, approval, createdAt, services, address, users }`
- **Business Logic:**
  - Batch actions, audit logging
- **Roles:**
  - Only admins or users with `vendor:manage`
- **Error Handling:**
  - Duplicate emails, invalid status, permission issues
- **Future Features:**
  - Vendor analytics, document uploads, external integrations

---

## Review Management
- **Endpoints:**
  - `GET /api/reviews` (filters: search, vendor, status, rating, flagged, public, source, date range, pagination, sort)
  - `POST /api/reviews/import` (bulk import reviews)
  - `POST /api/reviews/:id/flag` (flag/unflag review)
  - `POST /api/reviews/:id/remove` (remove/hide review)
  - `POST /api/reviews/:id/public` (toggle public/private)
  - `POST /api/reviews/:id/note` (add/update admin note)
  - `POST /api/reviews/:id/escalate` (escalate to quality team)
  - `POST /api/reviews/:id/notify` (send notification)
  - `GET /api/vendors` (for vendor filter dropdown)
- **Data Contracts:**
  - Review: `{ id, reviewer, type, media, vendorName, jobId, userType, source, flagged, public, adminNote, status, rating, summary, details, createdAt, expiresAt, submittedAt, auditTrail }`
- **Business Logic:**
  - Batch actions, audit trail, media handling, notifications
- **Roles:**
  - Only users with `review:moderate` or `admin`
- **Error Handling:**
  - Permission issues, invalid data
- **Future Features:**
  - Review analytics, escalation workflow, real-time updates

---

## Activity Monitoring
- **Endpoints:**
  - `GET /api/activity` (filters: user, action, entity, date range, pagination, sort)
  - `POST /api/activity/export` (export activity logs)
  - `GET /api/users` (for user filter dropdown)
- **Data Contracts:**
  - Activity: `{ id, userId, action, entityType, entityId, timestamp, details, ip, location }`
- **Business Logic:**
  - Batch export/delete, audit logging
- **Roles:**
  - Only admins or users with `activity:view`
- **Error Handling:**
  - Invalid filters, permission issues
- **Future Features:**
  - Real-time updates, anomaly detection, alerting, retention policy

---

## Audit Logs
- **Endpoints:**
  - `GET /api/audit-logs` (filters: user, action, entity, date range, pagination, sort)
  - `POST /api/audit-logs/export` (export logs)
  - `GET /api/users` (for user filter dropdown)
- **Data Contracts:**
  - Audit Log: `{ id, userId, action, entityType, entityId, timestamp, details, ip, location }`
- **Business Logic:**
  - Batch export/delete, audit logging
- **Roles:**
  - Only admins or users with `audit:view`
- **Error Handling:**
  - Invalid filters, permission issues
- **Future Features:**
  - Retention policy, drilldown, alerting, SIEM integration

---

## Reports & Analytics
- **Endpoints:**
  - `GET /api/reports/kpis?range=7d` — All key metrics for selected time range
  - `GET /api/reports/growth?type=user|vendor&interval=day|week|month&range=30d` — User/vendor growth
  - `GET /api/reports/churn?type=user|vendor&interval=month&range=12m` — Churn/closure rate
  - `GET /api/reports/cohort?type=user|vendor&range=12m` — Cohort retention
  - `GET /api/reports/geo-reviews?region=state|city&range=30d` — Reviews/jobs by region
  - `GET /api/reports/engagement?by=vendor|user|region&range=30d` — Engagement/quality
  - `GET /api/reports/funnel?range=30d` — Conversion funnel
  - `GET /api/reports/compare?entity=vendor|region&id1=xxx&id2=yyy&range=30d` — Compare entities
  - `GET /api/reports/forecast?metric=users|revenue|jobs&range=90d` — Forecasting
  - `GET /api/reports/anomalies?range=30d` — Anomaly detection
- **Data Contracts:**
  - All events timestamped and geotagged; store churn/closure reasons
- **Business Logic:**
  - All endpoints support time range, segmentation, comparison
- **Roles:**
  - Admins only
- **Error Handling:**
  - Invalid filters, missing data
- **Future Features:**
  - Export/sharing, dashboard links

---

## Profile
- **Endpoints:**
  - `GET /api/profile` — Fetch admin profile
  - `PATCH /api/profile` — Update name/email/avatar
  - `POST /api/profile/change-password` — Change password
  - `POST /api/profile/toggle-2fa` — Enable/disable 2FA
  - `GET /api/profile/activity` — Recent admin activity
- **Data Contracts:**
  - `{ name, email, role, avatar, lastLogin, twoFA, activity: [{ action, timestamp, device, location }] }`
- **Business Logic:**
  - 2FA, password change, activity log
- **Roles:**
  - Admins only
- **Error Handling:**
  - Invalid credentials, permission issues

---

## Settings
- **Endpoints:**
  - `GET /api/settings` — Fetch admin settings
  - `PATCH /api/settings` — Update settings
  - `PATCH /api/user/profile` — Update user profile
- **Data Contracts:**
  - Settings: `{ minPasswordLength, requireUppercase, requireNumbers, passwordExpiryDays, lockoutThreshold, lockoutDuration, autoApproveUsers, autoApproveVendors, notifyNewUser, notifyFlaggedReview, weeklySummary, alertVendorDeactivation, alertFailedLogins, auditLogAccess, theme, fontSize, enablePaidFeatures, paymentMethod, enable2FA, publicProfile, autoLogoutMinutes }`
  - User Profile: `{ displayName, email, passwordOld?, passwordNew? }`
- **Business Logic:**
  - Validation rules, notification triggers
- **Roles:**
  - Admins only
- **Error Handling:**
  - Validation errors, permission issues

---

For any questions or updates, contact the frontend team or check the UI "Backend Developer Notes" on each page for live details. 