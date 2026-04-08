# MSW Dual-Mode & Repository Pattern Implementation

## Overview
This implementation adds MSW (Mock Service Worker) dual-mode capabilities and introduces a repository pattern for the Employees module, with the ability to extend to other modules.

## Files Created/Modified

### 1. Mock Fixtures (`src/mocks/fixtures/`)
- **`employees.ts`** - Mock employee data with interfaces
- **`services.ts`** - Mock service data with interfaces  
- **`bookings.ts`** - Mock booking data with interfaces
- **`reviews.ts`** - Mock review data with interfaces
- **`availability.ts`** - Mock availability data with interfaces
- **`users.ts`** - Mock user data with interfaces

### 2. MSW Setup
- **`src/mocks/handlers.ts`** - MSW handlers for all API endpoints
- **`src/mocks/browser.ts`** - MSW browser setup (only starts when `NEXT_PUBLIC_API_MODE=mock`)
- **`public/mockServiceWorker.js`** - MSW service worker (auto-generated)

### 3. Repository Pattern
- **`src/data/employeesRepo.ts`** - Employee repository interface and types
- **`src/data/http/HttpEmployeesRepo.ts`** - HTTP implementation using SDK
- **`src/data/mock/MockEmployeesRepo.ts`** - Mock implementation using fixtures
- **`src/data/factory.ts`** - Repository factory for selecting implementation

### 4. React Query Hooks
- **`src/hooks/useEmployees.ts`** - React Query hooks for employees using repository pattern

### 5. Example Components
- **`src/components/EmployeeList.tsx`** - Example component demonstrating repository usage
- **`src/app/test-msw/page.tsx`** - Test page for MSW and repository functionality

### 6. Integration Updates
- **`src/app/layout.tsx`** - Added MSW browser import
- **`src/hooks/index.ts`** - Added employees hooks export
- **`src/sdk/index.ts`** - Added repository exports

## Environment Configuration

### For Mock Mode:
```bash
# .env.mock
NEXT_PUBLIC_API_MODE=mock
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NODE_ENV=development
```

### For Live Mode:
```bash
# .env.local
NEXT_PUBLIC_API_MODE=live
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NODE_ENV=development
```

## Key Features

### MSW Dual-Mode
- **Automatic Detection**: MSW only starts when `NEXT_PUBLIC_API_MODE=mock`
- **API Interception**: All SDK calls are intercepted in mock mode
- **Realistic Responses**: Mock data includes proper pagination, error handling
- **No UI Changes**: Existing UI works unchanged in both modes

### Repository Pattern
- **Interface-Based**: Strict TypeScript interfaces for all operations
- **Dual Implementation**: HTTP (SDK) and Mock implementations
- **Factory Pattern**: Automatic selection based on environment
- **Extensible**: Easy to add new modules (Services, Bookings, etc.)

### React Query Integration
- **Repository-Based**: Hooks use repository pattern internally
- **Automatic Caching**: React Query handles caching and invalidation
- **Optimistic Updates**: Built-in support for optimistic UI updates
- **Error Handling**: Proper error handling and loading states

## Usage Examples

### Using the Repository Directly
```typescript
import { repositoryFactory } from '@/sdk';

const employeesRepo = repositoryFactory.getEmployeesRepository();
const employees = await employeesRepo.listEmployees();
```

### Using React Query Hooks
```typescript
import { useListEmployees, useCreateEmployee } from '@/hooks';

function MyComponent() {
  const { data: employees, isLoading } = useListEmployees();
  const createEmployee = useCreateEmployee();
  
  const handleCreate = (data) => {
    createEmployee.mutate(data);
  };
}
```

### Switching Between Modes
1. **Mock Mode**: Set `NEXT_PUBLIC_API_MODE=mock` in environment
2. **Live Mode**: Set `NEXT_PUBLIC_API_MODE=live` or remove the variable
3. **Restart**: Restart the development server after changing environment

## API Endpoints Mocked

- `GET /api/employees` - List all employees
- `GET /api/employees/:id` - Get specific employee
- `POST /api/employees` - Create new employee
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee
- `GET /api/services` - List all services
- `GET /api/bookings` - List all bookings
- `GET /api/reviews` - List all reviews
- `GET /api/availability/:vendorId` - Get vendor availability
- `GET /api/users` - List all users
- `POST /api/auth/login` - Mock login
- `POST /api/auth/register` - Mock registration

## Testing the Implementation

1. **Visit `/test-msw`** to see the test page
2. **Check Environment**: Verify the mode badge shows correct status
3. **Test CRUD Operations**: Use the EmployeeList component to test create/delete
4. **Network Tab**: In mock mode, see MSW intercepting requests
5. **Console**: Check for MSW startup messages in mock mode

## Benefits

### For Development
- **Fast Iteration**: No backend dependency for frontend development
- **Consistent Data**: Predictable mock data for testing
- **Offline Development**: Work without internet or backend services

### For Testing
- **Reliable Mocks**: MSW provides realistic HTTP behavior
- **Easy Switching**: Toggle between mock and live modes
- **Consistent Behavior**: Same code path in both modes

### For Production
- **Clean Separation**: Mock code doesn't affect production builds
- **Type Safety**: Full TypeScript support across all implementations
- **Performance**: No unnecessary mock overhead in production

## Future Enhancements

1. **Extend to Other Modules**: Services, Bookings, Reviews, etc.
2. **Dynamic Mock Data**: Generate realistic data based on patterns
3. **Mock Scenarios**: Different mock states (loading, error, empty)
4. **Performance Testing**: Mock slow responses for testing loading states
5. **Integration Testing**: Use MSW for integration test scenarios

## Troubleshooting

### MSW Not Starting
- Check `NEXT_PUBLIC_API_MODE=mock` in environment
- Verify `public/mockServiceWorker.js` exists
- Check browser console for MSW messages

### Repository Not Working
- Verify environment variables are set correctly
- Check that repository factory is properly imported
- Ensure MSW handlers match expected API endpoints

### Type Errors
- Verify all interfaces are properly exported
- Check that mock data matches interface definitions
- Ensure repository implementations match interfaces exactly


