import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Reset not allowed in production" },
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
    const body = await request.json();
    const { seedBatchId } = body;

    let deleteCriteria = "all demo data";
    const whereClause =
      seedBatchId != null && seedBatchId !== ""
        ? { seedBatchId: String(seedBatchId) }
        : { demo: true };

    if (seedBatchId != null && seedBatchId !== "") {
      deleteCriteria = `seedBatchId: ${seedBatchId}`;
    }

    const w = whereClause as Prisma.ReviewWhereInput;

    // Delete in reverse order due to foreign key constraints
    const deletedReviews = await prisma.review.deleteMany({ where: w });
    const deletedBookings = await prisma.booking.deleteMany({
      where: w as Prisma.BookingWhereInput,
    });
    const deletedServices = await prisma.service.deleteMany({
      where: w as Prisma.ServiceWhereInput,
    });
    const deletedEmployees = await prisma.employee.deleteMany({
      where: w as Prisma.EmployeeWhereInput,
    });
    const deletedUsers = await prisma.user.deleteMany({
      where: w as Prisma.UserWhereInput,
    });
    const deletedVendors = await prisma.vendor.deleteMany({
      where: w as Prisma.VendorWhereInput,
    });

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
