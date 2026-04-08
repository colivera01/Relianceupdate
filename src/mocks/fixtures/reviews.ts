export interface MockReview {
  id: string;
  serviceId: string;
  customerId: string;
  vendorId: string;
  rating: number;
  comment: string;
  createdAt: string;
  isVerified: boolean;
}

export const mockReviews: MockReview[] = [
  {
    id: '1',
    serviceId: '1',
    customerId: 'customer1',
    vendorId: 'vendor1',
    rating: 5,
    comment: 'Excellent service! Very professional and quick.',
    createdAt: '2024-01-12T10:00:00Z',
    isVerified: true
  },
  {
    id: '2',
    serviceId: '2',
    customerId: 'customer2',
    vendorId: 'vendor1',
    rating: 4,
    comment: 'Good work on the brakes. Would recommend.',
    createdAt: '2024-01-13T15:30:00Z',
    isVerified: true
  },
  {
    id: '3',
    serviceId: '3',
    customerId: 'customer3',
    vendorId: 'vendor2',
    rating: 5,
    comment: 'AC is working perfectly now. Great service!',
    createdAt: '2024-01-14T11:15:00Z',
    isVerified: false
  }
];


