export interface MockAvailability {
  id: string;
  vendorId: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  maxBookings: number;
  currentBookings: number;
}

export const mockAvailability: MockAvailability[] = [
  {
    id: '1',
    vendorId: 'vendor1',
    dayOfWeek: 1, // Monday
    startTime: '08:00',
    endTime: '17:00',
    isAvailable: true,
    maxBookings: 8,
    currentBookings: 3
  },
  {
    id: '2',
    vendorId: 'vendor1',
    dayOfWeek: 2, // Tuesday
    startTime: '08:00',
    endTime: '17:00',
    isAvailable: true,
    maxBookings: 8,
    currentBookings: 5
  },
  {
    id: '3',
    vendorId: 'vendor1',
    dayOfWeek: 3, // Wednesday
    startTime: '08:00',
    endTime: '17:00',
    isAvailable: true,
    maxBookings: 8,
    currentBookings: 2
  },
  {
    id: '4',
    vendorId: 'vendor2',
    dayOfWeek: 1, // Monday
    startTime: '09:00',
    endTime: '18:00',
    isAvailable: true,
    maxBookings: 6,
    currentBookings: 4
  }
];


