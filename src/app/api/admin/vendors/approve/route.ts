import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/lib/admin-auth';
import { trySetVendorApprovalStatus } from '@/lib/vendor-status';

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json();
    const { vendorId } = body;

    // Validate required fields
    if (!vendorId) {
      return NextResponse.json(
        { error: 'Vendor ID is required' },
        { status: 400 }
      );
    }

    const approvalResult = await (prisma as any).$transaction(async (tx: any) => {
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
          status: 'ACTIVE',
          approvedAt: new Date(),
          approvedByUserId: admin.userId,
          deniedAt: null,
          deniedByUserId: null,
          revokedAt: null,
          revokedByUserId: null,
        },
      });

      return { notFound: false, noPendingMembership: false, membership };
    });

    if (approvalResult.notFound) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }
    if (approvalResult.noPendingMembership) {
      return NextResponse.json(
        { error: 'No pending manager membership found for this vendor' },
        { status: 422 }
      );
    }

    await trySetVendorApprovalStatus(String(vendorId), 'APPROVED');

    return NextResponse.json({
      success: true,
      message: 'Vendor approved successfully',
      vendorId,
      approvedBy: admin.userId,
      approvalDate: new Date().toISOString(),
      membershipId: String((approvalResult as any).membership.id),
    });

  } catch (error) {
    console.error('Vendor approval error:', error);
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Failed to approve vendor. Please try again.' },
      { status: 500 }
    );
  }
} 