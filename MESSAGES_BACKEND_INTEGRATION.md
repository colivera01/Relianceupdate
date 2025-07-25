# Messages Backend Integration Guide

## Overview
This document outlines the backend integration requirements for the Messages functionality, including API endpoints, database schema, and integration points with vendor and admin pages.

## Database Schema

### Tables

#### 1. `conversations`
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  vendor_id UUID REFERENCES vendors(id), -- NULL for support/system conversations
  conversation_type VARCHAR(20) NOT NULL CHECK (conversation_type IN ('vendor', 'support', 'system')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_message_at TIMESTAMP DEFAULT NOW(),
  is_archived BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, vendor_id, conversation_type)
);
```

#### 2. `messages`
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('user', 'vendor', 'support', 'system')),
  sender_id UUID NOT NULL, -- user_id, vendor_id, or support_id
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  attachment_url VARCHAR(500), -- for images/files
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  delivered_at TIMESTAMP,
  INDEX idx_conversation_created (conversation_id, created_at)
);
```

#### 3. `message_attachments`
```sql
CREATE TABLE message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 4. `conversation_participants`
```sql
CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  vendor_id UUID REFERENCES vendors(id),
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'vendor', 'support')),
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(conversation_id, user_id, vendor_id)
);
```

## API Endpoints

### User Messages API

#### 1. Get User Conversations
```http
GET /api/user/messages/conversations
Authorization: Bearer <user_token>

Response:
{
  "conversations": [
    {
      "id": "uuid",
      "type": "vendor|support|system",
      "name": "Vendor Name or Support",
      "avatar": "avatar_url",
      "lastMessage": "Last message content",
      "timestamp": "2024-01-15T10:30:00Z",
      "unreadCount": 2,
      "isOnline": true,
      "vendorId": "vendor_uuid" // null for support/system
    }
  ]
}
```

#### 2. Get Conversation Messages
```http
GET /api/user/messages/conversations/:conversationId
Authorization: Bearer <user_token>
Query: ?limit=50&before=timestamp

Response:
{
  "conversation": {
    "id": "uuid",
    "type": "vendor",
    "name": "Vendor Name",
    "avatar": "avatar_url",
    "isOnline": true
  },
  "messages": [
    {
      "id": "uuid",
      "sender": "user|vendor|support",
      "content": "Message content",
      "timestamp": "2024-01-15T10:30:00Z",
      "isRead": true,
      "attachments": []
    }
  ],
  "hasMore": true
}
```

#### 3. Send Message
```http
POST /api/user/messages/conversations/:conversationId
Authorization: Bearer <user_token>
Content-Type: application/json

Body:
{
  "content": "Message content",
  "attachments": ["file_urls"] // optional
}

Response:
{
  "message": {
    "id": "uuid",
    "sender": "user",
    "content": "Message content",
    "timestamp": "2024-01-15T10:30:00Z",
    "isRead": false
  }
}
```

#### 4. Mark Messages as Read
```http
PUT /api/user/messages/conversations/:conversationId/read
Authorization: Bearer <user_token>

Response:
{
  "success": true,
  "readCount": 5
}
```

#### 5. Create New Conversation
```http
POST /api/user/messages/conversations
Authorization: Bearer <user_token>
Content-Type: application/json

Body:
{
  "vendorId": "vendor_uuid", // for vendor conversations
  "type": "vendor|support",
  "initialMessage": "Hello, I have a question" // optional
}

Response:
{
  "conversation": {
    "id": "uuid",
    "type": "vendor",
    "name": "Vendor Name",
    "avatar": "avatar_url"
  },
  "message": {
    "id": "uuid",
    "content": "Hello, I have a question",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Vendor Messages API

#### 1. Get Vendor Conversations
```http
GET /api/vendor/messages/conversations
Authorization: Bearer <vendor_token>

Response:
{
  "conversations": [
    {
      "id": "uuid",
      "userId": "user_uuid",
      "userName": "User Name",
      "userAvatar": "avatar_url",
      "lastMessage": "Last message content",
      "timestamp": "2024-01-15T10:30:00Z",
      "unreadCount": 1,
      "isOnline": true,
      "bookingId": "booking_uuid" // if related to booking
    }
  ]
}
```

#### 2. Send Message as Vendor
```http
POST /api/vendor/messages/conversations/:conversationId
Authorization: Bearer <vendor_token>
Content-Type: application/json

Body:
{
  "content": "Message content",
  "attachments": ["file_urls"] // optional
}
```

### Admin Messages API

#### 1. Get Support Conversations
```http
GET /api/admin/messages/support
Authorization: Bearer <admin_token>

Response:
{
  "conversations": [
    {
      "id": "uuid",
      "userId": "user_uuid",
      "userName": "User Name",
      "userEmail": "user@email.com",
      "issueType": "billing|technical|general",
      "priority": "low|medium|high",
      "status": "open|in_progress|resolved",
      "lastMessage": "Last message content",
      "timestamp": "2024-01-15T10:30:00Z",
      "unreadCount": 3
    }
  ]
}
```

#### 2. Assign Support Ticket
```http
PUT /api/admin/messages/support/:conversationId/assign
Authorization: Bearer <admin_token>
Content-Type: application/json

Body:
{
  "adminId": "admin_uuid",
  "priority": "high"
}
```

## Real-time Messaging (WebSocket)

### WebSocket Connection
```javascript
// Connect to WebSocket
const ws = new WebSocket('wss://api.reliance.com/ws/messages');

// Authentication
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: userToken
  }));
};
```

### Message Events
```javascript
// Listen for new messages
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'new_message':
      // Update conversation list and current chat
      break;
    case 'typing_indicator':
      // Show typing indicator
      break;
    case 'message_read':
      // Update read receipts
      break;
    case 'user_online':
      // Update online status
      break;
  }
};
```

## Integration Points

### Vendor Dashboard Integration

#### 1. Messages Notification Badge
```javascript
// In vendor dashboard header
const [unreadMessages, setUnreadMessages] = useState(0);

useEffect(() => {
  // Fetch unread message count
  fetch('/api/vendor/messages/unread-count')
    .then(res => res.json())
    .then(data => setUnreadMessages(data.count));
}, []);
```

#### 2. Quick Reply from Job Management
```javascript
// In vendor jobs page - when customer requests changes
const handleQuickReply = async (jobId, message) => {
  // Find or create conversation with customer
  const conversation = await findOrCreateConversation(jobId);
  
  // Send quick reply
  await sendMessage(conversation.id, message);
};
```

### Admin Dashboard Integration

#### 1. Support Queue Dashboard
```javascript
// In admin dashboard
const [supportQueue, setSupportQueue] = useState([]);

useEffect(() => {
  // Fetch support conversations
  fetch('/api/admin/messages/support/queue')
    .then(res => res.json())
    .then(data => setSupportQueue(data.conversations));
}, []);
```

#### 2. Customer Service Metrics
```javascript
// Support response time tracking
const [metrics, setMetrics] = useState({
  avgResponseTime: 0,
  openTickets: 0,
  resolvedToday: 0
});
```

### User Dashboard Integration

#### 1. Booking Communication
```javascript
// When user books a service
const createBookingConversation = async (bookingId, vendorId) => {
  await fetch('/api/user/messages/conversations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    body: JSON.stringify({
      vendorId,
      type: 'vendor',
      bookingId,
      initialMessage: `Hi! I've booked your service for ${bookingDate}`
    })
  });
};
```

#### 2. Review Request Messages
```javascript
// After service completion
const sendReviewRequest = async (bookingId) => {
  await fetch('/api/user/messages/system/review-request', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    body: JSON.stringify({ bookingId })
  });
};
```

## File Upload Integration

### Message Attachments
```javascript
// Upload file for message
const uploadAttachment = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/messages/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    body: formData
  });
  
  return response.json();
};
```

## Notification Integration

### Push Notifications
```javascript
// Send push notification for new message
const sendMessageNotification = async (userId, message) => {
  await fetch('/api/notifications/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      type: 'new_message',
      title: 'New Message',
      body: message.preview,
      data: { conversationId: message.conversationId }
    })
  });
};
```

## Security Considerations

### Message Encryption
- All messages should be encrypted at rest
- Use end-to-end encryption for sensitive conversations
- Implement message retention policies

### Rate Limiting
```javascript
// Rate limiting for message sending
const rateLimit = {
  messages: 10, // per minute
  attachments: 5, // per hour
  conversations: 20 // per day
};
```

### Access Control
- Users can only access their own conversations
- Vendors can only access conversations with their customers
- Admins can access support conversations and system messages

## Error Handling

### Common Error Responses
```javascript
// 400 - Bad Request
{
  "error": "Invalid message content",
  "code": "INVALID_CONTENT"
}

// 403 - Forbidden
{
  "error": "Cannot access this conversation",
  "code": "ACCESS_DENIED"
}

// 404 - Not Found
{
  "error": "Conversation not found",
  "code": "CONVERSATION_NOT_FOUND"
}

// 429 - Too Many Requests
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

## Testing Endpoints

### Test Data Setup
```sql
-- Insert test conversations
INSERT INTO conversations (user_id, vendor_id, conversation_type) 
VALUES 
  ('user_uuid', 'vendor_uuid', 'vendor'),
  ('user_uuid', NULL, 'support');

-- Insert test messages
INSERT INTO messages (conversation_id, sender_type, sender_id, content)
VALUES 
  ('conversation_uuid', 'user', 'user_uuid', 'Hello vendor'),
  ('conversation_uuid', 'vendor', 'vendor_uuid', 'Hi there!');
```

This integration guide provides all the necessary endpoints and database structure to implement a complete messaging system that integrates seamlessly with the existing vendor and admin functionality. 