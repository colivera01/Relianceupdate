import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/lib/admin-auth';
import { trySetVendorApprovalStatus } from '@/lib/vendor-status';

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json();
    const { vendorIds } = body;

    // Validate required fields
    if (!vendorIds || !Array.isArray(vendorIds) || vendorIds.length === 0) {
      return NextResponse.json(
        { error: 'Vendor IDs array is required' },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];

    // Process each vendor
    for (const vendorId of vendorIds) {
      try {
        const result = await (prisma as any).$transaction(async (tx: any) => {
          const vendor = await tx.vendor.findUnique({
            where: { id: String(vendorId) },
            select: { id: true },
          });
          if (!vendor) return { ok: false, reason: 'Vendor not found' };

          const pendingManagerMembership = await tx.vendorMembership.findFirst({
            where: {
              vendorId: String(vendorId),
              role: 'MANAGER',
              status: 'PENDING',
            },
            orderBy: [{ requestedAt: 'desc' }],
          });
          if (!pendingManagerMembership) {
            return { ok: false, reason: 'No pending manager membership found' };
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

          return { ok: true, membershipId: String(membership.id) };
        });

        if (!result.ok) {
          errors.push({
            vendorId,
            error: result.reason,
          });
          continue;
        }

        await trySetVendorApprovalStatus(String(vendorId), 'APPROVED');

        results.push({
          vendorId,
          status: 'approved',
          approvedBy: admin.userId,
          approvalDate: new Date().toISOString(),
          membershipId: (result as any).membershipId,
        });
      } catch (error) {
        console.error(`Error approving vendor ${vendorId}:`, error);
        errors.push({
          vendorId,
          error: error instanceof Error ? error.message : 'Failed to approve vendor',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Bulk approval completed. ${results.length} vendors approved, ${errors.length} failed.`,
      results,
      errors,
      totalProcessed: vendorIds.length,
      successfulApprovals: results.length,
      failedApprovals: errors.length,
    });

  } catch (error) {
    console.error('Bulk vendor approval error:', error);
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Failed to process bulk approval. Please try again.' },
      { status: 500 }
    );
  }
} 