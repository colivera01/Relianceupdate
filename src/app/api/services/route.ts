import { NextRequest, NextResponse } from 'next/server';

// TODO: Import your database models
// import { ServiceModel } from '@/lib/models/Service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const vendorId = searchParams.get('vendorId');
    const priceMin = searchParams.get('priceMin');
    const priceMax = searchParams.get('priceMax');
    const location = searchParams.get('location');
    const rating = searchParams.get('rating');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // TODO: Replace with actual database query
    // const services = await ServiceModel.findMany({
    //   where: {
    //     ...(search && {
    //       OR: [
    //         { name: { contains: search, mode: 'insensitive' } },
    //         { description: { contains: search, mode: 'insensitive' } },
    //       ],
    //     }),
    //     ...(category && { category }),
    //     ...(vendorId && { vendor_id: parseInt(vendorId) }),
    //     ...(priceMin && { price: { gte: parseFloat(priceMin) } }),
    //     ...(priceMax && { price: { lte: parseFloat(priceMax) } }),
    //     ...(rating && { rating: { gte: parseFloat(rating) } }),
    //   },
    //   include: {
    //     vendor: {
    //       select: {
    //         id: true,
    //         name: true,
    //         rating: true,
    //         review_count: true,
    //         verified: true,
    //         location: true,
    //       },
    //     },
    //   },
    //   orderBy: {
    //     [sortBy]: sortOrder,
    //   },
    //   skip: (page - 1) * limit,
    //   take: limit,
    // });

    // Mock services data
    const mockServices = [
      {
        id: 1,
        name: 'Deep House Cleaning',
        description: 'Complete house cleaning service including kitchen, bathrooms, and living areas. Professional cleaning with eco-friendly products.',
        category: 'Cleaning',
        price: 120,
        original_price: 150,
        discount: 20,
        duration: '3-4 hours',
        rating: 4.9,
        review_count: 127,
        vendor: {
          id: 1,
          name: 'Sparkle Clean Pro',
          rating: 4.9,
          review_count: 127,
          verified: true,
          location: 'Springfield, IL',
        },
        features: ['Kitchen deep clean', 'Bathroom sanitization', 'Dusting', 'Vacuuming'],
        inclusions: ['Cleaning supplies', 'Equipment', 'Insurance'],
        images: [
          'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
          'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop',
        ],
        available: true,
        created_at: '2024-01-10T10:30:00Z',
      },
      {
        id: 2,
        name: 'Plumbing Repair',
        description: 'Professional plumbing repair services for all types of issues. Emergency service available 24/7.',
        category: 'Plumbing',
        price: 85,
        original_price: 100,
        discount: 15,
        duration: '1-2 hours',
        rating: 4.7,
        review_count: 89,
        vendor: {
          id: 2,
          name: 'Quick Fix Plumbing',
          rating: 4.7,
          review_count: 89,
          verified: true,
          location: 'Springfield, IL',
        },
        features: ['Leak repair', 'Pipe replacement', 'Fixture installation', 'Emergency service'],
        inclusions: ['Parts warranty', 'Labor guarantee', 'Emergency response'],
        images: [
          'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&h=300&fit=crop',
        ],
        available: true,
        created_at: '2024-01-12T14:20:00Z',
      },
      {
        id: 3,
        name: 'Landscape Design',
        description: 'Professional landscape design and installation services. Create your dream outdoor space.',
        category: 'Landscaping',
        price: 200,
        original_price: 250,
        discount: 20,
        duration: '4-6 hours',
        rating: 4.8,
        review_count: 56,
        vendor: {
          id: 3,
          name: 'Green Thumb Gardens',
          rating: 4.8,
          review_count: 56,
          verified: true,
          location: 'Springfield, IL',
        },
        features: ['Design consultation', 'Plant selection', 'Installation', 'Maintenance plan'],
        inclusions: ['Design drawings', 'Plant warranty', 'Follow-up care'],
        images: [
          'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=300&fit=crop',
        ],
        available: true,
        created_at: '2024-01-08T09:15:00Z',
      },
    ];

    // Filter mock data based on search parameters
    let filteredServices = mockServices;

    if (search) {
      filteredServices = filteredServices.filter(service =>
        service.name.toLowerCase().includes(search.toLowerCase()) ||
        service.description.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (category) {
      filteredServices = filteredServices.filter(service =>
        service.category.toLowerCase() === category.toLowerCase()
      );
    }

    if (priceMin) {
      filteredServices = filteredServices.filter(service =>
        service.price >= parseFloat(priceMin)
      );
    }

    if (priceMax) {
      filteredServices = filteredServices.filter(service =>
        service.price <= parseFloat(priceMax)
      );
    }

    if (rating) {
      filteredServices = filteredServices.filter(service =>
        service.rating >= parseFloat(rating)
      );
    }

    // Sort services
    filteredServices.sort((a, b) => {
      if (sortBy === 'price') {
        return sortOrder === 'asc' ? a.price - b.price : b.price - a.price;
      }
      if (sortBy === 'rating') {
        return sortOrder === 'asc' ? a.rating - b.rating : b.rating - a.rating;
      }
      return sortOrder === 'asc' 
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedServices = filteredServices.slice(startIndex, endIndex);

    return NextResponse.json({
      services: paginatedServices,
      pagination: {
        page,
        limit,
        total: filteredServices.length,
        totalPages: Math.ceil(filteredServices.length / limit),
      },
      filters: {
        search,
        category,
        priceMin,
        priceMax,
        rating,
      },
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      category,
      price,
      duration,
      features,
      inclusions,
      images,
      vendor_id,
    } = body;

    // Validate required fields
    if (!name || !description || !category || !price || !vendor_id) {
      return NextResponse.json(
        { error: 'Name, description, category, price, and vendor ID are required' },
        { status: 400 }
      );
    }

    // TODO: Validate vendor exists and user has permission
    // const vendor = await VendorModel.findById(vendor_id);
    // if (!vendor) {
    //   return NextResponse.json(
    //     { error: 'Vendor not found' },
    //     { status: 404 }
    //   );
    // }

    // TODO: Create service in database
    // const service = await ServiceModel.create({
    //   name,
    //   description,
    //   category,
    //   price: parseFloat(price),
    //   duration,
    //   features: features || [],
    //   inclusions: inclusions || [],
    //   images: images || [],
    //   vendor_id: parseInt(vendor_id),
    //   status: 'active',
    // });

    // Mock service creation
    const mockService = {
      id: Math.floor(Math.random() * 1000) + 1,
      name,
      description,
      category,
      price: parseFloat(price),
      duration,
      features: features || [],
      inclusions: inclusions || [],
      images: images || [],
      vendor_id: parseInt(vendor_id),
      status: 'active',
      created_at: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      service: mockService,
      message: 'Service created successfully',
    });
  } catch (error) {
    console.error('Error creating service:', error);
    return NextResponse.json(
      { error: 'Failed to create service' },
      { status: 500 }
    );
  }
} 