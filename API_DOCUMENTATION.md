# API Documentation

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