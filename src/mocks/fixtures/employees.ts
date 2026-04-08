export interface MockEmployee {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
  hireDate: string;
  department: string;
  performance: {
    rating: number;
    completedJobs: number;
    customerSatisfaction: number;
  };
}

export const mockEmployees: MockEmployee[] = [
  {
    id: '1',
    name: 'John Smith',
    role: 'Senior Technician',
    email: 'john.smith@reliance.com',
    phone: '(555) 123-4567',
    status: 'active',
    hireDate: '2023-01-15',
    department: 'Automotive',
    performance: {
      rating: 4.8,
      completedJobs: 156,
      customerSatisfaction: 4.9
    }
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    role: 'Service Coordinator',
    email: 'sarah.johnson@reliance.com',
    phone: '(555) 234-5678',
    status: 'active',
    hireDate: '2023-03-20',
    department: 'Customer Service',
    performance: {
      rating: 4.6,
      completedJobs: 89,
      customerSatisfaction: 4.7
    }
  },
  {
    id: '3',
    name: 'Mike Davis',
    role: 'Junior Technician',
    email: 'mike.davis@reliance.com',
    phone: '(555) 345-6789',
    status: 'active',
    hireDate: '2023-06-10',
    department: 'HVAC',
    performance: {
      rating: 4.2,
      completedJobs: 67,
      customerSatisfaction: 4.3
    }
  }
];


