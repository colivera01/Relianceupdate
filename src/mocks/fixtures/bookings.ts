export interface MockBooking {
  id: string;
  serviceId: string;
  customerId: string;
  vendorId: string;
  status: 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';
  scheduledDate: string;
  scheduledTime: string;
  totalPrice: number;
  notes: string;
  createdAt: string;
}

export const mockBookings: MockBooking[] = [
  {
    id: '1',
    serviceId: '1',
    customerId: 'customer1',
    vendorId: 'vendor1',
    status: 'confirmed',
    scheduledDate: '2024-01-15',
    scheduledTime: '10:00 AM',
    totalPrice: 49.99,
    notes: 'Customer prefers synthetic oil',
    createdAt: '2024-01-10T08:00:00Z'
  },
  {
    id: '2',
    serviceId: '2',
    customerId: 'customer2',
    vendorId: 'vendor1',
    status: 'in-progress',
    scheduledDate: '2024-01-15',
    scheduledTime: '2:00 PM',
    totalPrice: 29.99,
    notes: 'Front brakes only',
    createdAt: '2024-01-12T14:30:00Z'
  },
  {
    id: '3',
    serviceId: '3',
    customerId: 'customer3',
    vendorId: 'vendor2',
    status: 'pending',
    scheduledDate: '2024-01-16',
    scheduledTime: '9:00 AM',
    totalPrice: 79.99,
    notes: 'AC not cooling properly',
    createdAt: '2024-01-14T16:45:00Z'
  }
];


