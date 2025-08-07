import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const serviceId = parseInt(params.id);

    if (isNaN(serviceId)) {
      return NextResponse.json(
        { error: 'Invalid service ID' },
        { status: 400 }
      );
    }

    // TODO: Replace with actual database query
    // const service = await ServiceModel.findById(serviceId, {
    //   include: {
    //     vendor: {
    //       select: {
    //         id: true,
    //         name: true,
    //         rating: true,
    //         review_count: true,
    //         verified: true,
    //         location: true,
    //         phone: true,
    //         email: true,
    //         address: true,
    //         years_in_business: true,
    //         insurance_status: true,
    //         bonding_status: true,
    //       },
    //     },
    //     reviews: {
    //       include: {
    //         user: {
    //           select: {
    //             name: true,
    //             avatar: true,
    //           },
    //         },
    //       },
    //       orderBy: { created_at: 'desc' },
    //       take: 10,
    //     },
    //   },
    // });

    // Mock service data
    const mockService = {
      id: serviceId,
      name: 'Deep House Cleaning',
      description: 'Complete house cleaning service including kitchen, bathrooms, and living areas. Professional cleaning with eco-friendly products. Our team is fully insured and bonded for your peace of mind.',
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
        phone: '(555) 123-4567',
        email: 'contact@sparklecleanpro.com',
        address: '123 Main St, Springfield, IL 62701',
        years_in_business: 8,
        insurance_status: true,
        bonding_status: true,
      },
      features: [
        'Kitchen deep clean',
        'Bathroom sanitization',
        'Dusting and vacuuming',
        'Window cleaning',
        'Baseboard cleaning',
        'Cabinet organization',
      ],
      inclusions: [
        'Professional cleaning supplies',
        'All equipment provided',
        'Fully insured service',
        'Satisfaction guarantee',
        'Eco-friendly products',
        'Follow-up inspection',
      ],
      exclusions: [
        'Moving heavy furniture',
        'Hazardous material disposal',
        'Pet waste removal',
        'Exterior window cleaning',
      ],
      images: [
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop',
        'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop',
      ],
      videos: [
        'https://example.com/video1.mp4',
      ],
      availability: {
        response_time: '30-60 minutes',
        available_now: true,
        available_today: true,
        available_this_week: true,
        next_available: '2024-01-20T14:00:00Z',
      },
      reviews: [
        {
          id: 1,
          user: {
            name: 'Sarah Johnson',
            avatar: 'https://randomuser.me/api/portraits/women/1.jpg',
          },
          rating: 5,
          comment: 'Excellent service! The team was professional and thorough. My house has never been cleaner.',
          created_at: '2024-01-15T10:30:00Z',
        },
        {
          id: 2,
          user: {
            name: 'Mike Davis',
            avatar: 'https://randomuser.me/api/portraits/men/2.jpg',
          },
          rating: 4,
          comment: 'Great cleaning service. Very reliable and did a good job.',
          created_at: '2024-01-14T14:20:00Z',
        },
      ],
      status: 'active',
      created_at: '2024-01-10T10:30:00Z',
      updated_at: '2024-01-15T10:30:00Z',
    };

    if (!mockService) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ service: mockService });
  } catch (error) {
    console.error('Error fetching service:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const serviceId = parseInt(params.id);
    const body = await request.json();
    const {
      name,
      description,
      category,
      price,
      duration,
      features,
      inclusions,
      exclusions,
      images,
      videos,
    } = body;

    if (isNaN(serviceId)) {
      return NextResponse.json(
        { error: 'Invalid service ID' },
        { status: 400 }
      );
    }

    // TODO: Validate service exists and user has permission
    // const service = await ServiceModel.findById(serviceId);
    // if (!service) {
    //   return NextResponse.json(
    //     { error: 'Service not found' },
    //     { status: 404 }
    //   );
    // }

    // TODO: Update service in database
    // const updatedService = await ServiceModel.update(serviceId, {
    //   name,
    //   description,
    //   category,
    //   price: parseFloat(price),
    //   duration,
    //   features,
    //   inclusions,
    //   exclusions,
    //   images,
    //   videos,
    //   updated_at: new Date(),
    // });

    // Mock update
    const mockUpdatedService = {
      id: serviceId,
      name,
      description,
      category,
      price: parseFloat(price),
      duration,
      features,
      inclusions,
      exclusions,
      images,
      videos,
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      service: mockUpdatedService,
      message: 'Service updated successfully',
    });
  } catch (error) {
    console.error('Error updating service:', error);
    return NextResponse.json(
      { error: 'Failed to update service' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const serviceId = parseInt(params.id);

    if (isNaN(serviceId)) {
      return NextResponse.json(
        { error: 'Invalid service ID' },
        { status: 400 }
      );
    }

    // TODO: Validate service exists and user has permission
    // const service = await ServiceModel.findById(serviceId);
    // if (!service) {
    //   return NextResponse.json(
    //     { error: 'Service not found' },
    //     { status: 404 }
    //   );
    // }

    // TODO: Soft delete or mark as inactive
    // await ServiceModel.update(serviceId, {
    //   status: 'inactive',
    //   deleted_at: new Date(),
    // });

    return NextResponse.json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting service:', error);
    return NextResponse.json(
      { error: 'Failed to delete service' },
      { status: 500 }
    );
  }
} 