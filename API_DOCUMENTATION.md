# API Documentation

## 🆕 **New Vendor Dashboard Endpoints**

### Calendar & Job Management

#### Get Calendar Jobs
```typescript
GET /api/vendor/calendar/jobs?month=2024-01&year=2024

Response:
{
  jobs: Job[];
  total: number;
}

interface Job {
  id: number;
  title: string;
  client: string;
  date: string;
  time: string;
  duration: number;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  earnings: number;
  type: string;
  priority: 'low' | 'medium' | 'high';
  notes?: string;
}
```

#### Get Calendar Availability
```typescript
GET /api/vendor/calendar/availability?startDate=2024-01-01&endDate=2024-01-31

Response:
{
  availability: Availability[];
}

interface Availability {
  date: string;
  available: boolean;
  reason?: string;
  earnings: number;
}
```

#### Update Availability
```typescript
POST /api/vendor/calendar/availability

Request:
{
  date: string;
  available: boolean;
  reason?: string;
}
```

#### Create Booking
```typescript
POST /api/vendor/calendar/booking

Request:
{
  clientId: number;
  serviceId: number;
  date: string;
  time: string;
  duration: number;
  notes?: string;
}

Response:
{
  booking: Booking;
  message: string;
}

interface Booking {
  id: number;
  clientId: number;
  serviceId: number;
  date: string;
  time: string;
  duration: number;
  notes?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
}
```

#### Get Daily Earnings
```typescript
GET /api/vendor/calendar/earnings?date=2024-01-15

Response:
{
  date: string;
  earnings: number;
  jobCount: number;
  averageJobValue: number;
}
```

#### Export Schedule
```typescript
POST /api/vendor/calendar/export

Request:
{
  startDate: string;
  endDate: string;
  format: 'csv' | 'pdf' | 'ical';
}

Response:
{
  downloadUrl: string;
  expiresAt: string;
}
```

### Clients CRM

#### Get Clients
```typescript
GET /api/vendor/clients?search=john&status=active&page=1&limit=10&sort=name&order=asc

Response:
{
  clients: Client[];
  total: number;
  page: number;
  totalPages: number;
}

interface Client {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive' | 'prospect';
  tags: string[];
  lastContact: string;
  totalJobs: number;
  totalSpent: number;
  notes?: string;
  createdAt: string;
}
```

#### Create Client
```typescript
POST /api/vendor/clients

Request:
{
  name: string;
  email: string;
  phone?: string;
  tags?: string[];
  notes?: string;
}

Response:
{
  client: Client;
  message: string;
}
```

#### Update Client
```typescript
PATCH /api/vendor/clients/{clientId}

Request:
{
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
  tags?: string[];
  notes?: string;
}
```

#### Delete Client
```typescript
DELETE /api/vendor/clients/{clientId}

Response:
{
  message: string;
}
```

#### Bulk Client Actions
```typescript
POST /api/vendor/clients/bulk

Request:
{
  action: 'delete' | 'export' | 'notify';
  clientIds: number[];
  data?: any; // Additional data for specific actions
}
```

#### Get Client History
```typescript
GET /api/vendor/clients/{clientId}/history

Response:
{
  history: ContactHistory[];
}

interface ContactHistory {
  id: number;
  type: 'email' | 'phone' | 'sms' | 'meeting';
  method: string;
  notes: string;
  timestamp: string;
  outcome: string;
}
```

#### Log Contact Interaction
```typescript
POST /api/vendor/clients/{clientId}/contact

Request:
{
  type: 'email' | 'phone' | 'sms' | 'meeting';
  method: string;
  notes: string;
  outcome: string;
}
```

### Team Members Management

#### Get Team Members
```typescript
GET /api/vendor/team?search=john&role=technician&page=1&limit=10

Response:
{
  teamMembers: TeamMember[];
  total: number;
  page: number;
  totalPages: number;
}

interface TeamMember {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  permissions: Permission[];
  status: 'active' | 'inactive' | 'pending';
  lastActivity: string;
  joinDate: string;
  avatar?: string;
}
```

#### Add Team Member
```typescript
POST /api/vendor/team

Request:
{
  name: string;
  email: string;
  phone?: string;
  role: string;
  permissions: number[];
}

Response:
{
  teamMember: TeamMember;
  message: string;
}
```

#### Remove Team Member
```typescript
DELETE /api/vendor/team/{memberId}

Response:
{
  message: string;
}
```

#### Update Permissions
```typescript
PATCH /api/vendor/team/{memberId}/permissions

Request:
{
  permissions: number[];
}
```

#### Get Team Member Profile
```typescript
GET /api/vendor/team/{memberId}/profile

Response:
{
  profile: TeamMemberProfile;
}

interface TeamMemberProfile extends TeamMember {
  jobHistory: JobSummary[];
  performance: PerformanceMetrics;
  availability: AvailabilitySchedule;
}
```

#### Contact Team Member
```typescript
POST /api/vendor/team/{memberId}/contact

Request:
{
  method: 'email' | 'phone' | 'sms' | 'platform';
  message: string;
  priority: 'low' | 'medium' | 'high';
}
```

### Insights & Recommendations

#### Get Insights
```typescript
GET /api/vendor/insights?type=warning&priority=high&page=1&limit=10

Response:
{
  insights: Insight[];
  total: number;
  page: number;
}

interface Insight {
  id: number;
  type: 'warning' | 'success' | 'info' | 'recommendation';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  actionUrl?: string;
  dismissible: boolean;
  createdAt: string;
}
```

#### Dismiss Insight
```typescript
POST /api/vendor/insights/{insightId}/dismiss

Response:
{
  message: string;
}
```

#### Track Action Taken
```typescript
POST /api/vendor/insights/{insightId}/action

Request:
{
  action: string;
  notes?: string;
}
```

#### Get Insight Settings
```typescript
GET /api/vendor/insights/settings

Response:
{
  preferences: InsightPreferences;
}

interface InsightPreferences {
  enabledTypes: string[];
  priorityLevels: string[];
  autoDismiss: boolean;
  notificationEnabled: boolean;
}
```

#### Update Insight Settings
```typescript
PATCH /api/vendor/insights/settings

Request:
{
  enabledTypes?: string[];
  priorityLevels?: string[];
  autoDismiss?: boolean;
  notificationEnabled?: boolean;
}
```

### Notifications & Alerts

#### Get Notifications
```typescript
GET /api/vendor/notifications?type=job&read=false&page=1&limit=10

Response:
{
  notifications: Notification[];
  total: number;
  unreadCount: number;
  page: number;
}

interface Notification {
  id: number;
  type: 'job' | 'client' | 'payment' | 'system' | 'review';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}
```

#### Mark Notification as Read
```typescript
PATCH /api/vendor/notifications/{notificationId}/read

Request:
{
  read: boolean;
}
```

#### Delete Notification
```typescript
DELETE /api/vendor/notifications/{notificationId}

Response:
{
  message: string;
}
```

#### Clear All Notifications
```typescript
POST /api/vendor/notifications/clear-all

Request:
{
  type?: string;
  read?: boolean;
}

Response:
{
  message: string;
  clearedCount: number;
}
```

#### Get Notification Settings
```typescript
GET /api/vendor/notifications/settings

Response:
{
  settings: NotificationSettings;
}

interface NotificationSettings {
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  types: NotificationTypeSettings[];
}

interface NotificationTypeSettings {
  type: string;
  email: boolean;
  push: boolean;
  sms: boolean;
}
```

#### Update Notification Settings
```typescript
PATCH /api/vendor/notifications/settings

Request:
{
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  smsEnabled?: boolean;
  types?: NotificationTypeSettings[];
}
```

### Performance Metrics

#### Get Performance Metrics
```typescript
GET /api/vendor/performance?period=month&startDate=2024-01-01&endDate=2024-01-31

Response:
{
  period: string;
  metrics: PerformanceMetrics;
  trends: PerformanceTrends;
  goals: PerformanceGoals;
}

interface PerformanceMetrics {
  responseTime: number;
  completionRate: number;
  satisfaction: number;
  reviewScore: number;
}

interface PerformanceTrends {
  responseTime: 'up' | 'down' | 'stable';
  completionRate: 'up' | 'down' | 'stable';
  satisfaction: 'up' | 'down' | 'stable';
  reviewScore: 'up' | 'down' | 'stable';
}

interface PerformanceGoals {
  responseTime: number;
  completionRate: number;
  satisfaction: number;
  reviewScore: number;
}
```

#### Get Historical Performance
```typescript
GET /api/vendor/performance/history?period=month&months=12

Response:
{
  history: HistoricalPerformance[];
}

interface HistoricalPerformance {
  period: string;
  metrics: PerformanceMetrics;
  date: string;
}
```

#### Update Performance Goals
```typescript
PATCH /api/vendor/performance/goals

Request:
{
  responseTime?: number;
  completionRate?: number;
  satisfaction?: number;
  reviewScore?: number;
}
```

#### Export Performance Data
```typescript
POST /api/vendor/performance/export

Request:
{
  startDate: string;
  endDate: string;
  format: 'csv' | 'pdf' | 'json';
  includeHistory: boolean;
}

Response:
{
  downloadUrl: string;
  expiresAt: string;
}
```

## Endpoints

### User Management

#### Get Users
```typescript
GET /api/users

Response:
{
  users: User[];
  total: number;
  page: number;
}
```

#### Update User
```typescript
PATCH /api/users/{userId}

Request:
{
  status?: string;
  verificationStatus?: string;
  adminPrivileges?: AdminPrivileges;
}
```

#### Verify Documents
```typescript
POST /api/users/{userId}/verify-documents

Request:
{
  documentIds: string[];
  verificationResult: 'approved' | 'rejected';
  notes?: string;
}
```

### Content Moderation

#### Review Content
```typescript
POST /api/users/{userId}/review-content

Request:
{
  contentIds: string[];
  status: 'approved' | 'flagged' | 'removed';
  reason?: string;
}
```

### User Actions

#### Send Warning
```typescript
POST /api/users/{userId}/warning

Request:
{
  reason: string;
  warningLevel: 'mild' | 'severe';
  actionRequired?: string;
}
```

#### Suspend Account
```typescript
POST /api/users/{userId}/suspend

Request:
{
  reason: string;
  duration: number; // in days
  immediate: boolean;
}
```

## Data Models

### User
```typescript
interface User {
  id: number;
  name: string;
  email: string;
  status: string;
  tier: string;
  userType: string;
  verificationStatus: string;
  contentStatus: string;
  adminPrivileges?: AdminPrivileges;
  adminActivity?: AdminActivity;
  billing: Billing;
}
```

### AdminPrivileges
```typescript
interface AdminPrivileges {
  accessLevel: 'full' | 'limited' | 'read-only';
  departmentAccess: string[];
  canReviewContent: boolean;
  canDeleteContent: boolean;
  canFlagUsers: boolean;
  canSuspendAccounts: boolean;
}
```

## Authentication
- JWT token-based authentication required
- Include token in Authorization header
- Token expiration: 24 hours

## Rate Limiting
- 100 requests per minute per IP
- 1000 requests per hour per user

## Error Responses
```typescript
{
  error: string;
  code: string;
  details?: any;
}
```

## Business Rules
1. Only users with appropriate admin privileges can:
   - Modify user statuses
   - Review content
   - Send warnings
   - Suspend accounts
2. All admin actions must be logged
3. Certain actions require dual authorization
4. Automated notifications for status changes 