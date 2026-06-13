import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/lib/admin-auth';
import { isStaleApprovalQueueFixture } from '@/lib/launch-content-cleanup';
import { isAiFeatureEnabled } from '@/lib/ai/feature-flags';
import {
  buildVendorApprovalContextResolutionFromPendingSource,
  generateVendorApprovalAiStoredResult,
  getLatestVendorApprovalAiStoredResults,
  serializeVendorApprovalAiStoredResult,
  VENDOR_APPROVAL_AI_SYSTEM_ACTOR,
} from '@/lib/ai/vendor-approval-review-store';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const pendingMemberships = await (prisma as any).vendorMembership.findMany({
      where: {
        status: 'PENDING',
        role: 'MANAGER',
      },
      include: {
        vendor: {
          include: {
            services: {
              select: {
                id: true,
                isPublished: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            authCredential: {
              select: {
                id: true,
                emailVerifiedAt: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    const searchLower = search.toLowerCase();
    let filteredVendorRows = pendingMemberships
      .map((membership: any) => {
        const vendor = membership.vendor;
        const user = membership.user;
        const firstName = String(user?.name || '').split(' ').slice(0, 1).join('') || '';
        const lastName = String(user?.name || '').split(' ').slice(1).join(' ') || '';
        const foundedYear = vendor?.foundedYear || null;
        const yearsInBusiness =
          foundedYear && Number.isFinite(foundedYear) ? Math.max(0, new Date().getFullYear() - foundedYear) : 0;

        return {
          summary: {
            id: String(vendor.id),
            membershipId: String(membership.id),
            businessName: String(vendor.businessName || vendor.name || 'Unnamed Vendor'),
            firstName,
            lastName,
            email: String(vendor.email || user?.email || ''),
            phone: String(vendor.phone || user?.phone || ''),
            category: String(vendor.category || vendor.businessType || 'General'),
            businessType: String(vendor.businessType || 'Unknown'),
            foundedYear: foundedYear || null,
            totalEmployees: 0,
            yearsInBusiness,
            address: String(vendor.address || ''),
            city: String(vendor.city || ''),
            state: String(vendor.state || ''),
            zipCode: String(vendor.zipCode || ''),
            createdAt: membership.requestedAt?.toISOString() || vendor.createdAt?.toISOString(),
            submittedAt: membership.requestedAt?.toISOString() || vendor.createdAt?.toISOString(),
          },
          source: {
            vendor,
            membership: {
              ...membership,
              user,
            },
          },
        };
      })
      .filter((row: any) => {
        const vendor = row.summary;
        if (isStaleApprovalQueueFixture(vendor)) return false;
        const matchesSearch =
          !searchLower ||
          vendor.businessName.toLowerCase().includes(searchLower) ||
          vendor.email.toLowerCase().includes(searchLower) ||
          `${vendor.firstName} ${vendor.lastName}`.toLowerCase().includes(searchLower);
        const matchesCategory = !category || category === 'all' || vendor.category === category;
        return matchesSearch && matchesCategory;
      });

    filteredVendorRows.sort((a: any, b: any) => {
      const left = a.summary;
      const right = b.summary;
      const direction = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'businessName') {
        return left.businessName.localeCompare(right.businessName) * direction;
      }
      if (sortBy === 'category') {
        return left.category.localeCompare(right.category) * direction;
      }
      const aTime = new Date(left.createdAt).getTime();
      const bTime = new Date(right.createdAt).getTime();
      return (aTime - bTime) * direction;
    });

    const availableCategories = Array.from(
      new Set<string>(
        filteredVendorRows
          .map((row: any) => String(row.summary.category || "").trim())
          .filter((value: string) => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b));

    // Paginate filtered data
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedVendorRows = filteredVendorRows.slice(startIndex, endIndex);
    const paginatedVendors = paginatedVendorRows.map((row: any) => row.summary);

    const aiEnabled = isAiFeatureEnabled('vendor_approval_assistant');
    const aiRecommendationsByVendorId = aiEnabled
      ? await (async () => {
          const existingByVendorId = await getLatestVendorApprovalAiStoredResults(
            paginatedVendors.map((vendor: any) => String(vendor.id))
          );
          const entries = await Promise.all(
            paginatedVendorRows.map(async (row: any) => {
              const vendorId = String(row.summary.id);
              const resolution = buildVendorApprovalContextResolutionFromPendingSource(row.source);
              if (resolution.status !== 'ok') {
                return [vendorId, existingByVendorId[vendorId] || null] as const;
              }
              const existing = existingByVendorId[vendorId] || null;
              const existingMatchesCurrent =
                existing &&
                existing.fingerprint === resolution.fingerprint &&
                existing.applicationSnapshot.submittedAt ===
                  resolution.applicationSnapshot.submittedAt;

              if (existingMatchesCurrent) {
                return [vendorId, existing] as const;
              }

              try {
                const generated = await generateVendorApprovalAiStoredResult(vendorId, {
                  actorUserId: VENDOR_APPROVAL_AI_SYSTEM_ACTOR,
                  source: 'admin_vendor_approval_queue_autorun',
                  resolution,
                });
                return [vendorId, generated || existing] as const;
              } catch (aiError) {
                console.error(`Auto-run vendor approval AI review failed for ${vendorId}:`, aiError);
                return [vendorId, existing] as const;
              }
            })
          );

          return Object.fromEntries(entries);
        })()
      : {};

    const paginatedVendorsWithAi = paginatedVendors.map((vendor: any) => ({
      ...vendor,
      aiRecommendation: serializeVendorApprovalAiStoredResult(
        aiRecommendationsByVendorId[String(vendor.id)]
      ),
    }));

    return NextResponse.json({
      success: true,
      data: {
        vendors: paginatedVendorsWithAi,
        pagination: {
          page,
          limit,
          total: filteredVendorRows.length,
          totalPages: Math.ceil(filteredVendorRows.length / limit),
          hasNextPage: endIndex < filteredVendorRows.length,
          hasPrevPage: page > 1,
        },
        categories: availableCategories,
        filters: {
          search,
          category,
          sortBy,
          sortOrder,
        },
      },
    });

  } catch (error) {
    console.error('Get pending vendors error:', error);
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch pending vendors. Please try again.' },
      { status: 500 }
    );
  }
} 
