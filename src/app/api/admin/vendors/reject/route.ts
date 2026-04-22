import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/lib/admin-auth';
import { trySetVendorApprovalStatus } from '@/lib/vendor-status';

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json();
    const { vendorId, rejectionReason } = body;

    // Validate required fields
    if (!vendorId || !rejectionReason) {
      return NextResponse.json(
        { error: 'Vendor ID and rejection reason are required' },
        { status: 400 }
      );
    }

    const rejectionResult = await (prisma as any).$transaction(async (tx: any) => {
      const vendor = await tx.vendor.findUnique({
        where: { id: String(vendorId) },
        select: { id: true },
      });
      if (!vendor) {
        return { notFound: true };
      }

      const pendingManagerMembership = await tx.vendorMembership.findFirst({
        where: {
          vendorId: String(vendorId),
          role: 'MANAGER',
          status: 'PENDING',
        },
        orderBy: [{ requestedAt: 'desc' }],
      });

      if (!pendingManagerMembership) {
        return { notFound: false, noPendingMembership: true };
      }

      const membership = await tx.vendorMembership.update({
        where: { id: pendingManagerMembership.id },
        data: {
          status: 'DENIED',
          deniedAt: new Date(),
          deniedByUserId: admin.userId,
          approvedAt: null,
          approvedByUserId: null,
        },
      });

      return { notFound: false, noPendingMembership: false, membership };
    });

    if (rejectionResult.notFound) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }
    if (rejectionResult.noPendingMembership) {
      return NextResponse.json(
        { error: 'No pending manager membership found for this vendor' },
        { status: 422 }
      );
    }

    await trySetVendorApprovalStatus(String(vendorId), 'REJECTED');

    return NextResponse.json({
      success: true,
      message: 'Vendor rejected successfully',
      vendorId,
      rejectedBy: admin.userId,
      rejectionDate: new Date().toISOString(),
      rejectionReason,
      membershipId: String((rejectionResult as any).membership.id),
    });

  } catch (error) {
    console.error('Vendor rejection error:', error);
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Failed to reject vendor. Please try again.' },
      { status: 500 }
    );
  }
} 