export interface MockUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  userType: 'customer' | 'vendor' | 'both';
  isActive: boolean;
  createdAt: string;
  lastLogin: string;
}

export const mockUsers: MockUser[] = [
  {
    id: 'customer1',
    name: 'Alice Johnson',
    email: 'alice.johnson@email.com',
    phone: '(555) 111-2222',
    userType: 'customer',
    isActive: true,
    createdAt: '2023-12-01T10:00:00Z',
    lastLogin: '2024-01-15T08:30:00Z'
  },
  {
    id: 'customer2',
    name: 'Bob Smith',
    email: 'bob.smith@email.com',
    phone: '(555) 222-3333',
    userType: 'customer',
    isActive: true,
    createdAt: '2023-12-05T14:00:00Z',
    lastLogin: '2024-01-14T16:45:00Z'
  },
  {
    id: 'vendor1',
    name: 'Mike\'s Auto Repair',
    email: 'mike@autorepair.com',
    phone: '(555) 333-4444',
    userType: 'vendor',
    isActive: true,
    createdAt: '2023-11-15T09:00:00Z',
    lastLogin: '2024-01-15T07:15:00Z'
  },
  {
    id: 'vendor2',
    name: 'Cool Air HVAC',
    email: 'service@coolairhvac.com',
    phone: '(555) 444-5555',
    userType: 'vendor',
    isActive: true,
    createdAt: '2023-11-20T11:00:00Z',
    lastLogin: '2024-01-14T18:20:00Z'
  }
];


