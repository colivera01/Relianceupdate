export interface MockService {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  duration: string;
  vendorId: string;
  rating: number;
  reviewCount: number;
  isActive: boolean;
}

export const mockServices: MockService[] = [
  {
    id: '1',
    name: 'Oil Change & Filter',
    category: 'Automotive',
    description: 'Complete oil change with premium filter replacement',
    price: 49.99,
    duration: '30 min',
    vendorId: 'vendor1',
    rating: 4.8,
    reviewCount: 127,
    isActive: true
  },
  {
    id: '2',
    name: 'Brake Inspection',
    category: 'Automotive',
    description: 'Comprehensive brake system inspection and assessment',
    price: 29.99,
    duration: '45 min',
    vendorId: 'vendor1',
    rating: 4.6,
    reviewCount: 89,
    isActive: true
  },
  {
    id: '3',
    name: 'AC System Check',
    category: 'HVAC',
    description: 'Full AC system diagnostic and performance check',
    price: 79.99,
    duration: '60 min',
    vendorId: 'vendor2',
    rating: 4.7,
    reviewCount: 156,
    isActive: true
  }
];


