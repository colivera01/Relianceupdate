# Profile Toggle System

## Overview
The Profile Toggle System allows users to maintain a single account with multiple business personas (customer and vendor). Users can seamlessly switch between profiles without logging out and back in.

## Features

### 🔄 Profile Switching
- **Single Login**: One account, multiple profiles
- **Seamless Toggle**: Switch between customer and vendor dashboards
- **Context Awareness**: Each dashboard shows only relevant information
- **Profile Indicators**: Clear visual distinction of active profile

### 🏢 Vendor Profile Creation
- **Add to Existing Account**: Customers can add vendor profiles
- **Eligibility Check**: System verifies requirements before creation
- **Unified Management**: Single account controls both profiles
- **Data Isolation**: Complete separation between profile types

### 🎯 Smart Profile Detection
- **Auto-Detection**: System recognizes available profile types
- **Conditional Display**: Toggle only shows when multiple profiles exist
- **Default Profile**: Remembers last used profile type

## Components

### ProfileToggle
- **Location**: `src/components/ProfileToggle.tsx`
- **Purpose**: Dropdown component for switching between profiles
- **Features**: 
  - Visual profile indicators
  - Loading states
  - Navigation to appropriate dashboards

### ProfileHeader
- **Location**: `src/components/ProfileHeader.tsx`
- **Purpose**: Header component with profile info and toggle
- **Features**:
  - User avatar and information
  - Profile toggle (when applicable)
  - Settings and logout menu

### AddVendorProfile
- **Location**: `src/components/AddVendorProfile.tsx`
- **Purpose**: Component for adding vendor profiles to customer accounts
- **Features**:
  - Eligibility checking
  - Requirements display
  - Registration flow integration

## API Endpoints

### Profile Toggle
- **POST** `/api/profile/toggle` - Switch between profiles
- **GET** `/api/profile/toggle` - Get profile information

### Vendor Eligibility
- **GET** `/api/profile/check-vendor-eligibility` - Check if user can create vendor profile

## Implementation Details

### Data Structure
```typescript
interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  userType: 'customer' | 'vendor' | 'both';
  availableProfiles: ('customer' | 'vendor')[];
  // Customer fields
  address?: string;
  city?: string;
  state?: string;
  // Vendor fields
  businessName?: string;
  category?: string;
  serviceTypes?: string[];
}
```

### Profile Detection Logic
1. **Customer Profile**: Always available for registered users
2. **Vendor Profile**: Available if user has business data or `userType === 'both'`
3. **Profile Toggle**: Only displayed when multiple profiles exist

### Navigation Flow
1. **Login**: System detects available profiles
2. **Dashboard**: Shows appropriate dashboard based on profile type
3. **Toggle**: User can switch between available profiles
4. **Context**: Each dashboard maintains profile-specific data and navigation

## Usage Examples

### Adding Vendor Profile to Customer Account
1. Customer logs into user dashboard
2. Sees "Add Business Profile" component
3. Clicks "Check Eligibility"
4. System verifies requirements
5. User completes vendor registration
6. Account now has both customer and vendor profiles

### Switching Between Profiles
1. User sees profile toggle in header
2. Clicks toggle to see available profiles
3. Selects desired profile type
4. System navigates to appropriate dashboard
5. All data and navigation updates to profile context

## Security & Permissions

### Access Control
- **Profile Isolation**: Each profile only shows relevant data
- **Unified Authentication**: Single login credentials for all profiles
- **Owner Control**: User maintains full control over all profiles

### Data Privacy
- **Customer Data**: Personal info, bookings, reviews, favorites
- **Vendor Data**: Business details, services, availability, earnings
- **No Cross-Contamination**: Complete separation maintained

## Future Enhancements

### Planned Features
- **Profile Templates**: Pre-configured profile types
- **Role-Based Permissions**: Granular access control
- **Profile Analytics**: Usage statistics across profiles
- **Bulk Operations**: Manage multiple profiles simultaneously

### Scalability
- **Additional Profile Types**: Admin, partner, affiliate profiles
- **Multi-Tenant Support**: Organization-level profile management
- **API Integration**: External system profile synchronization

## Testing

### Test Page
- **URL**: `/test-profile-toggle`
- **Purpose**: Verify profile toggle functionality
- **Components**: All profile toggle components in one place

### Test Scenarios
1. **Single Profile**: Customer-only account
2. **Dual Profile**: Customer + vendor account
3. **Profile Switching**: Toggle between profiles
4. **Vendor Addition**: Add vendor profile to customer account

## Troubleshooting

### Common Issues
1. **Toggle Not Visible**: Check if user has multiple profiles
2. **Profile Data Missing**: Verify profile creation completed
3. **Navigation Errors**: Check profile toggle API responses
4. **Data Persistence**: Ensure profile data properly stored

### Debug Information
- Check browser console for API responses
- Verify `availableProfiles` array in user data
- Confirm profile toggle API endpoints are accessible
- Check user data structure in localStorage

## Configuration

### Environment Variables
- No additional environment variables required
- Uses existing authentication system
- Integrates with current API structure

### Dependencies
- React hooks (useState, useEffect)
- Next.js navigation (useRouter)
- Existing UI components (Button, Card, etc.)
- Lucide React icons

## Deployment

### Requirements
- All components properly imported
- API endpoints accessible
- User data structure updated
- Profile toggle components integrated into layouts

### Integration Points
- User dashboard (`/user-dashboard`)
- Vendor dashboard (`/vendor/dashboard`)
- Vendor layout (`/vendor/layout.tsx`)
- Registration system (`/auth/register`)

## Support

### Documentation
- Component usage examples
- API endpoint specifications
- Data structure definitions
- Troubleshooting guide

### Development
- TypeScript interfaces defined
- Error handling implemented
- Loading states included
- Responsive design supported



