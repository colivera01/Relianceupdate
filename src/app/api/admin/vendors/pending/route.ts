import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/lib/admin-auth';

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
        vendor: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    const searchLower = search.toLowerCase();
    let filteredVendors = pendingMemberships
      .map((membership: any) => {
        const vendor = membership.vendor;
        const user = membership.user;
        const firstName = String(user?.name || '').split(' ').slice(0, 1).join('') || '';
        const lastName = String(user?.name || '').split(' ').slice(1).join(' ') || '';
        const foundedYear = vendor?.foundedYear || null;
        const yearsInBusiness =
          foundedYear && Number.isFinite(foundedYear) ? Math.max(0, new Date().getFullYear() - foundedYear) : 0;

        return {
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
        };
      })
      .filter((vendor: any) => {
        const matchesSearch =
          !searchLower ||
          vendor.businessName.toLowerCase().includes(searchLower) ||
          vendor.email.toLowerCase().includes(searchLower) ||
          `${vendor.firstName} ${vendor.lastName}`.toLowerCase().includes(searchLower);
        const matchesCategory = !category || category === 'all' || vendor.category === category;
        return matchesSearch && matchesCategory;
      });

    filteredVendors.sort((a: any, b: any) => {
      const direction = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'businessName') {
        return a.businessName.localeCompare(b.businessName) * direction;
      }
      if (sortBy === 'category') {
        return a.category.localeCompare(b.category) * direction;
      }
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return (aTime - bTime) * direction;
    });

    // Paginate mock data
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedVendors = filteredVendors.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      data: {
        vendors: paginatedVendors,
        pagination: {
          page,
          limit,
          total: filteredVendors.length,
          totalPages: Math.ceil(filteredVendors.length / limit),
          hasNextPage: endIndex < filteredVendors.length,
          hasPrevPage: page > 1,
        },
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