import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';

// Guard against production
if (process.env.NODE_ENV === 'production') {
  throw new Error('Reset not allowed in production');
}

export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const { seedBatchId } = body;

    let deleteCriteria = 'all demo data';
    let whereClause = { demo: true };

    if (seedBatchId) {
      deleteCriteria = `seedBatchId: ${seedBatchId}`;
      whereClause = { seedBatchId };
    }

    // Delete in reverse order due to foreign key constraints
    const deletedReviews = await prisma.review.deleteMany({ where: whereClause });
    const deletedBookings = await prisma.booking.deleteMany({ where: whereClause });
    const deletedServices = await prisma.service.deleteMany({ where: whereClause });
    const deletedEmployees = await prisma.employee.deleteMany({ where: whereClause });
    const deletedUsers = await prisma.user.deleteMany({ where: whereClause });
    const deletedVendors = await prisma.vendor.deleteMany({ where: whereClause });

    const summary = {
      ok: true,
      deleted: {
        reviews: deletedReviews.count,
        bookings: deletedBookings.count,
        services: deletedServices.count,
        employees: deletedEmployees.count,
        users: deletedUsers.count,
        vendors: deletedVendors.count
      },
      criteria: deleteCriteria
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset data' },
      { status: 500 }
    );
  }
}
