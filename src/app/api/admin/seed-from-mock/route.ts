import { NextRequest, NextResponse } from 'next/server';

// Mock fixtures imports
import { mockEmployees } from '@/mocks/fixtures/employees';
import { mockServices } from '@/mocks/fixtures/services';
import { mockUsers } from '@/mocks/fixtures/users';
import { mockBookings } from '@/mocks/fixtures/bookings';
import { mockReviews } from '@/mocks/fixtures/reviews';

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Seeding not allowed in production' },
      { status: 403 }
    );
  }

  // Check authorization
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${process.env.SEED_SECRET}`;
  
  if (authHeader !== expectedToken) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // TODO: Replace with actual data access code
    // For now, just return the mock data as if it was inserted
    
    const summary = {
      inserted: {
        employees: mockEmployees.length,
        services: mockServices.length,
        users: mockUsers.length,
        bookings: mockBookings.length,
        reviews: mockReviews.length
      }
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Seeding error:', error);
    return NextResponse.json(
      { error: 'Failed to seed data' },
      { status: 500 }
    );
  }
}


