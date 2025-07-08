# Backend Integration Guide

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