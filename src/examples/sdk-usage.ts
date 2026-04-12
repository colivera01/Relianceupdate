// SDK Usage Examples
// This file demonstrates how to use the new typed API client and SDK

import {
  // SDK functions
  login,
  register,
  getCustomerProfile,
  getVendorProfile,
  listServices,
  createBooking,
  searchServices,
  
  // React Query hooks
  useLogin,
  useListServices,
  useCreateBooking,
  useDiscoverServices,
  useCreateService,

  // Types
  type LoginRequest,
  type CreateServiceDTO,
  type CreateBookingDTO,
  type SearchParams,
  type Service,
} from '../sdk';

// Example 1: Direct SDK usage (for non-React contexts)
export async function exampleDirectSDKUsage() {
  try {
    // Login
    const loginResponse = await login({
      email: 'user@example.com',
      password: 'password123'
    });
    
    console.log('Login successful:', loginResponse.user);
    
    // Get customer profile
    const profileResponse = await getCustomerProfile();
    console.log('Customer profile:', profileResponse.profile);
    
    // List services
    const servicesResponse = await listServices({
      category: 'Cleaning',
      priceMin: 50,
      priceMax: 200
    });
    
    console.log('Services found:', servicesResponse.services.length);
    
    // Search services
    const searchResponse = await searchServices('house cleaning', {
      location: 'Orlando, FL',
      rating: 4.5
    });
    
    console.log('Search results:', searchResponse.results.length);
    
  } catch (error) {
    console.error('Error in SDK usage:', error);
  }
}

// Example 2: React Query hooks usage
export function exampleReactQueryUsage() {
  // Login mutation
  const loginMutation = useLogin();
  
  // Services query
  const servicesQuery = useListServices({
    category: 'Cleaning',
    page: 1,
    limit: 20
  });
  
  const discoverQuery = useDiscoverServices({
    q: 'house cleaning',
    limit: 20,
  });

  const createBookingMutation = useCreateBooking();
  const createServiceMutation = useCreateService();
  
  // Handle login
  const handleLogin = async (credentials: LoginRequest) => {
    try {
      const result = await loginMutation.mutateAsync(credentials);
      console.log('Login successful:', result.user);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };
  
  // Handle service creation
  const handleCreateService = async (
    serviceData: CreateServiceDTO & { vendorId?: string | number; vendor_id?: string | number }
  ) => {
    try {
      const result = await createServiceMutation.mutateAsync(serviceData);
      console.log('Service created:', result.service);
    } catch (error) {
      console.error('Service creation failed:', error);
    }
  };
  
  // Handle booking creation
  const handleCreateBooking = async (bookingData: CreateBookingDTO) => {
    try {
      const result = await createBookingMutation.mutateAsync(bookingData);
      console.log('Booking created:', result.booking);
    } catch (error) {
      console.error('Booking creation failed:', error);
    }
  };
  
  return {
    // State
    services: servicesQuery.data?.services || [],
    searchResults: discoverQuery.data?.results || [],
    isLoading: servicesQuery.isLoading || discoverQuery.isLoading,
    isError: servicesQuery.isError || discoverQuery.isError,
    
    // Actions
    handleLogin,
    handleCreateService,
    handleCreateBooking,
    
    // Mutations
    loginMutation,
    createBookingMutation,
    createServiceMutation,
  };
}

// Example 3: Error handling and loading states
export function exampleWithErrorHandling() {
  const servicesQuery = useListServices();
  const createServiceMutation = useCreateService();
  
  if (servicesQuery.isLoading) {
    return <div>Loading services...</div>;
  }
  
  if (servicesQuery.isError) {
    return (
      <div>
        <h3>Error loading services</h3>
        <p>{servicesQuery.error?.message}</p>
        <button onClick={() => servicesQuery.refetch()}>
          Retry
        </button>
      </div>
    );
  }
  
  if (createServiceMutation.isPending) {
    return <div>Creating service...</div>;
  }
  
  if (createServiceMutation.isError) {
    return (
      <div>
        <h3>Error creating service</h3>
        <p>{createServiceMutation.error?.message}</p>
      </div>
    );
  }
  
  return (
    <div>
      <h2>Services ({servicesQuery.data?.services.length})</h2>
      {servicesQuery.data?.services.map(service => (
        <div key={service.id}>
          <h3>{service.name}</h3>
          <p>{service.description}</p>
          <p>Price: ${service.price}</p>
        </div>
      ))}
    </div>
  );
}

// Example 4: Optimistic updates
export function exampleOptimisticUpdates() {
  const queryClient = useQueryClient();
  const updateServiceMutation = useUpdateService();
  
  const handleUpdateService = async (id: string, updates: Partial<Service>) => {
    // Optimistically update the UI
    queryClient.setQueryData(['services', id], (oldData: Service | undefined) => {
      if (!oldData) return oldData;
      return { ...oldData, ...updates };
    });
    
    try {
      await updateServiceMutation.mutateAsync({ id, data: updates });
    } catch (error) {
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['services', id] });
      console.error('Update failed:', error);
    }
  };
  
  return { handleUpdateService };
}


