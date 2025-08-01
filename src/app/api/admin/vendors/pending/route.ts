import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // TODO: Get pending vendors from database with pagination and filters
    // const pendingVendors = await db.vendors.findMany({
    //   where: {
    //     approvalStatus: 'pending',
    //     ...(search && {
    //       OR: [
    //         { businessName: { contains: search, mode: 'insensitive' } },
    //         { email: { contains: search, mode: 'insensitive' } },
    //         { firstName: { contains: search, mode: 'insensitive' } },
    //         { lastName: { contains: search, mode: 'insensitive' } },
    //       ],
    //     }),
    //     ...(category && { category }),
    //   },
    //   orderBy: {
    //     [sortBy]: sortOrder,
    //   },
    //   skip: (page - 1) * limit,
    //   take: limit,
    //   include: {
    //     // Include related data if needed
    //   },
    // });

    // TODO: Get total count for pagination
    // const totalCount = await db.vendors.count({
    //   where: {
    //     approvalStatus: 'pending',
    //     ...(search && {
    //       OR: [
    //         { businessName: { contains: search, mode: 'insensitive' } },
    //         { email: { contains: search, mode: 'insensitive' } },
    //         { firstName: { contains: search, mode: 'insensitive' } },
    //         { lastName: { contains: search, mode: 'insensitive' } },
    //       ],
    //     }),
    //     ...(category && { category }),
    //   },
    // });

    // Mock data for now
    const mockPendingVendors = [
      {
        id: '1',
        businessName: 'CleanCo Services',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@cleanco.com',
        phone: '555-123-4567',
        category: 'Cleaning',
        businessType: 'LLC',
        foundedYear: 2020,
        totalEmployees: 5,
        yearsInBusiness: 4,
        address: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62701',
        createdAt: '2024-01-15T10:30:00Z',
        submittedAt: '2024-01-15T10:30:00Z',
      },
      {
        id: '2',
        businessName: 'PlumbPro Solutions',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@plumbpro.com',
        phone: '555-987-6543',
        category: 'Plumbing',
        businessType: 'Corporation',
        foundedYear: 2018,
        totalEmployees: 12,
        yearsInBusiness: 6,
        address: '456 Oak Ave',
        city: 'Metropolis',
        state: 'NY',
        zipCode: '10001',
        createdAt: '2024-01-14T14:20:00Z',
        submittedAt: '2024-01-14T14:20:00Z',
      },
      {
        id: '3',
        businessName: 'PaintMaster Pro',
        firstName: 'Mike',
        lastName: 'Johnson',
        email: 'mike@paintmaster.com',
        phone: '555-456-7890',
        category: 'Painting',
        businessType: 'Sole Proprietorship',
        foundedYear: 2022,
        totalEmployees: 3,
        yearsInBusiness: 2,
        address: '789 Pine St',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60601',
        createdAt: '2024-01-13T09:15:00Z',
        submittedAt: '2024-01-13T09:15:00Z',
      },
    ];

    // Filter mock data based on search and category
    let filteredVendors = mockPendingVendors;
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredVendors = filteredVendors.filter(vendor =>
        vendor.businessName.toLowerCase().includes(searchLower) ||
        vendor.email.toLowerCase().includes(searchLower) ||
        `${vendor.firstName} ${vendor.lastName}`.toLowerCase().includes(searchLower)
      );
    }

    if (category) {
      filteredVendors = filteredVendors.filter(vendor => vendor.category === category);
    }

    // Sort mock data
    filteredVendors.sort((a, b) => {
      let aValue, bValue;
      switch (sortBy) {
        case 'businessName':
          aValue = a.businessName.toLowerCase();
          bValue = b.businessName.toLowerCase();
          break;
        case 'category':
          aValue = a.category.toLowerCase();
          bValue = b.category.toLowerCase();
          break;
        case 'createdAt':
        default:
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
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
    return NextResponse.json(
      { error: 'Failed to fetch pending vendors. Please try again.' },
      { status: 500 }
    );
  }
} 