# 🚀 Reliance API SDK & React Query Hooks

A comprehensive, typed API client and SDK for the Reliance platform, built with TypeScript and React Query.

## ✨ Features

- **🔒 Type Safety**: Full TypeScript support with strict typing
- **🌐 HTTP Client**: Centralized fetch wrapper with error handling
- **📱 React Query**: Built-in React Query hooks for state management
- **🔄 Auto-caching**: Intelligent caching and invalidation
- **🛡️ Error Handling**: Comprehensive error handling and retry logic
- **📊 DevTools**: React Query DevTools for debugging

## 📦 Installation

The SDK is already included in the project. If you need to install React Query manually:

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

## 🏗️ Project Structure

```
src/
├── lib/
│   └── api.ts              # HTTP client and configuration
├── types/
│   └── api.ts              # TypeScript type definitions
├── sdk/
│   ├── index.ts            # Main SDK exports
│   ├── auth.ts             # Authentication operations
│   ├── bookings.ts         # Booking management
│   ├── services.ts         # Service management
│   ├── availability.ts     # Vendor availability
│   ├── reviews.ts          # Review system
│   ├── search.ts           # Search functionality
│   └── users.ts            # User management
├── hooks/
│   ├── index.ts            # React Query hooks exports
│   ├── useAuth.ts          # Authentication hooks
│   ├── useBookings.ts      # Booking hooks
│   └── useServices.ts      # Service hooks
└── providers/
    └── QueryProvider.tsx   # React Query provider
```

## 🚀 Quick Start

### 1. Setup Query Provider

Wrap your app with the QueryProvider:

```tsx
// src/app/layout.tsx
import { QueryProvider } from '../providers/QueryProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
```

### 2. Use SDK Functions

```tsx
import { login, listServices, createBooking } from '../sdk';

// Direct SDK usage
const handleLogin = async () => {
  try {
    const response = await login({
      email: 'user@example.com',
      password: 'password123'
    });
    console.log('Logged in:', response.user);
  } catch (error) {
    console.error('Login failed:', error);
  }
};
```

### 3. Use React Query Hooks

```tsx
import { useListServices, useCreateBooking } from '../hooks';

function ServicesList() {
  const { data, isLoading, error } = useListServices({
    category: 'Cleaning',
    page: 1,
    limit: 20
  });
  
  const createBookingMutation = useCreateBooking();
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      {data?.services.map(service => (
        <div key={service.id}>
          <h3>{service.name}</h3>
          <p>{service.description}</p>
          <button onClick={() => createBookingMutation.mutate({
            serviceId: service.id,
            vendorId: service.vendor.id,
            bookingDate: '2024-01-30',
            bookingTime: '10:00'
          })}>
            Book Now
          </button>
        </div>
      ))}
    </div>
  );
}
```

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

### API Base URL

The SDK automatically uses the environment variable or defaults to `http://localhost:3000`.

## 📚 API Reference

### Authentication

```tsx
import { 
  login, 
  register, 
  getCustomerProfile, 
  getVendorProfile,
  toggleProfile 
} from '../sdk';

// Login
const response = await login({ email, password });

// Register
const response = await register(userData);

// Get profiles
const customerProfile = await getCustomerProfile();
const vendorProfile = await getVendorProfile();

// Toggle between profiles
const response = await toggleProfile({ targetProfile: 'vendor' });
```

### Services

```tsx
import { 
  listServices, 
  getService, 
  createService, 
  updateService,
  deleteService 
} from '../sdk';

// List services with filters
const services = await listServices({
  category: 'Cleaning',
  priceMin: 50,
  priceMax: 200,
  location: 'Orlando, FL'
});

// Get single service
const service = await getService('service-id');

// Create service
const newService = await createService(serviceData);

// Update service
const updatedService = await updateService('service-id', updates);

// Delete service
await deleteService('service-id');
```

### Bookings

```tsx
import { 
  listBookings, 
  getBooking, 
  createBooking, 
  updateBooking,
  cancelBooking 
} from '../sdk';

// List bookings
const bookings = await listBookings({
  userId: 'user-id',
  status: 'confirmed'
});

// Create booking
const booking = await createBooking({
  serviceId: 1,
  vendorId: 1,
  bookingDate: '2024-01-30',
  bookingTime: '10:00'
});

// Cancel booking
await cancelBooking('booking-id');
```

### Search

```tsx
import { search, searchServices, searchVendors } from '../sdk';

// General search
const results = await search({
  q: 'house cleaning',
  category: 'Cleaning',
  location: 'Orlando, FL'
});

// Service search
const services = await searchServices('house cleaning', {
  priceRange: { min: 50, max: 200 },
  rating: 4.5
});

// Vendor search
const vendors = await searchVendors('cleaning', {
  verified: true,
  rating: 4.0
});
```

## 🎣 React Query Hooks

### Authentication Hooks

```tsx
import { 
  useLogin, 
  useRegister, 
  useCustomerProfile, 
  useVendorProfile 
} from '../hooks';

function LoginForm() {
  const loginMutation = useLogin();
  
  const handleSubmit = async (credentials) => {
    try {
      await loginMutation.mutateAsync(credentials);
      // Redirect or update UI
    } catch (error) {
      // Handle error
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button disabled={loginMutation.isPending}>
        {loginMutation.isPending ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

### Service Hooks

```tsx
import { 
  useListServices, 
  useGetService, 
  useCreateService 
} from '../hooks';

function ServicesPage() {
  const { data, isLoading, error } = useListServices({
    category: 'Cleaning'
  });
  
  const createServiceMutation = useCreateService();
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      {data?.services.map(service => (
        <ServiceCard key={service.id} service={service} />
      ))}
    </div>
  );
}
```

### Booking Hooks

```tsx
import { 
  useListBookings, 
  useCreateBooking, 
  useCancelBooking 
} from '../hooks';

function BookingsPage() {
  const { data: bookings } = useListBookings();
  const createBookingMutation = useCreateBooking();
  const cancelBookingMutation = useCancelBooking();
  
  const handleCreateBooking = async (bookingData) => {
    try {
      await createBookingMutation.mutateAsync(bookingData);
      // Show success message
    } catch (error) {
      // Handle error
    }
  };
  
  return (
    <div>
      {bookings?.bookings.map(booking => (
        <BookingCard 
          key={booking.id} 
          booking={booking}
          onCancel={() => cancelBookingMutation.mutate(booking.id)}
        />
      ))}
    </div>
  );
}
```

## 🔄 Query Keys & Caching

The SDK uses consistent query keys for efficient caching:

```tsx
// Service keys
['services', 'list', { category: 'Cleaning', page: 1 }]
['services', 'detail', 'service-id']

// Booking keys
['bookings', 'list', { userId: 'user-id', status: 'confirmed' }]
['bookings', 'detail', 'booking-id']

// User keys
['auth', 'profile', 'customer']
['auth', 'profile', 'vendor']
```

## 🛠️ Error Handling

The SDK provides comprehensive error handling:

```tsx
try {
  const result = await createService(serviceData);
  console.log('Success:', result);
} catch (error) {
  if (error.message.includes('401')) {
    // Handle unauthorized
  } else if (error.message.includes('400')) {
    // Handle validation error
  } else {
    // Handle other errors
  }
}
```

## 🧪 Testing

The SDK is designed to be easily testable:

```tsx
// Mock the API client
jest.mock('../lib/api', () => ({
  api: {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  }
}));

// Test SDK functions
test('createService calls API correctly', async () => {
  const mockApi = require('../lib/api').api;
  mockApi.post.mockResolvedValue({ success: true, service: mockService });
  
  const result = await createService(serviceData);
  expect(mockApi.post).toHaveBeenCalledWith('/api/services', serviceData);
  expect(result.success).toBe(true);
});
```

## 🚀 Migration Guide

### From Direct Fetch Calls

**Before:**
```tsx
const response = await fetch('/api/services');
const services = await response.json();
```

**After:**
```tsx
import { listServices } from '../sdk';
const { services } = await listServices();
```

### From Custom Hooks

**Before:**
```tsx
const [services, setServices] = useState([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  const fetchServices = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/services');
      const data = await response.json();
      setServices(data.services);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  fetchServices();
}, []);
```

**After:**
```tsx
import { useListServices } from '../hooks';
const { data, isLoading, error } = useListServices();
```

## 🔮 Future Enhancements

- [ ] **Real-time Updates**: WebSocket integration for live data
- [ ] **Offline Support**: Service worker for offline functionality
- [ ] **Batch Operations**: Bulk API operations
- [ ] **Rate Limiting**: Client-side rate limiting
- [ ] **Request Deduplication**: Prevent duplicate requests
- [ ] **Background Sync**: Sync data when online

## 🤝 Contributing

1. Follow the existing code structure
2. Add proper TypeScript types
3. Include error handling
4. Add React Query hooks for new endpoints
5. Update documentation

## 📝 License

This SDK is part of the Reliance platform and follows the same license terms.


