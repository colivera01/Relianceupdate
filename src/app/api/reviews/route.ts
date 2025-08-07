import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');
    const vendorId = searchParams.get('vendorId');
    const userId = searchParams.get('userId');
    const rating = searchParams.get('rating');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // TODO: Replace with actual database query
    // const reviews = await ReviewModel.findMany({
    //   where: {
    //     ...(serviceId && { service_id: parseInt(serviceId) }),
    //     ...(vendorId && { vendor_id: parseInt(vendorId) }),
    //     ...(userId && { user_id: parseInt(userId) }),
    //     ...(rating && { rating: parseInt(rating) }),
    //   },
    //   include: {
    //     user: {
    //       select: {
    //         id: true,
    //         first_name: true,
    //         last_name: true,
    //         avatar: true,
    //       },
    //     },
    //     service: {
    //       select: {
    //         id: true,
    //         name: true,
    //       },
    //     },
    //     vendor: {
    //       select: {
    //         id: true,
    //         name: true,
    //       },
    //     },
    //   },
    //   orderBy: {
    //     [sortBy]: sortOrder,
    //   },
    //   skip: (page - 1) * limit,
    //   take: limit,
    // });

    // Mock reviews data
    const mockReviews = [
      {
        id: 1,
        user: {
          id: 1,
          first_name: 'Sarah',
          last_name: 'Johnson',
          avatar: 'https://randomuser.me/api/portraits/women/1.jpg',
        },
        service: {
          id: 1,
          name: 'Deep House Cleaning',
        },
        vendor: {
          id: 1,
          name: 'Sparkle Clean Pro',
        },
        rating: 5,
        title: 'Excellent cleaning service!',
        comment: 'The team was professional, thorough, and did an amazing job. My house has never been cleaner. Highly recommend!',
        type: 'written',
        media_url: null,
        helpful_count: 12,
        created_at: '2024-01-15T10:30:00Z',
      },
      {
        id: 2,
        user: {
          id: 2,
          first_name: 'Mike',
          last_name: 'Davis',
          avatar: 'https://randomuser.me/api/portraits/men/2.jpg',
        },
        service: {
          id: 2,
          name: 'Plumbing Repair',
        },
        vendor: {
          id: 2,
          name: 'Quick Fix Plumbing',
        },
        rating: 4,
        title: 'Good plumbing work',
        comment: 'Fixed my leaky faucet quickly and efficiently. Fair pricing and professional service.',
        type: 'video',
        media_url: 'https://example.com/review-video.mp4',
        helpful_count: 8,
        created_at: '2024-01-14T14:20:00Z',
      },
      {
        id: 3,
        user: {
          id: 3,
          first_name: 'Lisa',
          last_name: 'Wilson',
          avatar: 'https://randomuser.me/api/portraits/women/3.jpg',
        },
        service: {
          id: 3,
          name: 'Landscape Design',
        },
        vendor: {
          id: 3,
          name: 'Green Thumb Gardens',
        },
        rating: 5,
        title: 'Beautiful landscape transformation',
        comment: 'Amazing work! They transformed our backyard into a beautiful garden. Very creative and professional.',
        type: 'photo',
        media_url: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=300&fit=crop',
        helpful_count: 15,
        created_at: '2024-01-13T09:15:00Z',
      },
    ];

    // Filter mock data based on parameters
    let filteredReviews = mockReviews;

    if (serviceId) {
      filteredReviews = filteredReviews.filter(review => review.service.id === parseInt(serviceId));
    }

    if (vendorId) {
      filteredReviews = filteredReviews.filter(review => review.vendor.id === parseInt(vendorId));
    }

    if (rating) {
      filteredReviews = filteredReviews.filter(review => review.rating === parseInt(rating));
    }

    // Sort reviews
    filteredReviews.sort((a, b) => {
      if (sortBy === 'rating') {
        return sortOrder === 'asc' ? a.rating - b.rating : b.rating - a.rating;
      }
      if (sortBy === 'helpful_count') {
        return sortOrder === 'asc' ? a.helpful_count - b.helpful_count : b.helpful_count - a.helpful_count;
      }
      return sortOrder === 'asc' 
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedReviews = filteredReviews.slice(startIndex, endIndex);

    return NextResponse.json({
      reviews: paginatedReviews,
      pagination: {
        page,
        limit,
        total: filteredReviews.length,
        totalPages: Math.ceil(filteredReviews.length / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      service_id,
      vendor_id,
      booking_id,
      rating,
      title,
      comment,
      type = 'written',
      media_url,
    } = body;

    // TODO: Get current user from session/token
    // const user = await getCurrentUser(request);
    // if (!user) {
    //   return NextResponse.json(
    //     { error: 'Authentication required' },
    //     { status: 401 }
    //   );
    // }

    // Validate required fields
    if (!rating || !title || !comment) {
      return NextResponse.json(
        { error: 'Rating, title, and comment are required' },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // TODO: Validate booking exists and belongs to user
    // if (booking_id) {
    //   const booking = await BookingModel.findById(booking_id);
    //   if (!booking || booking.user_id !== user.id) {
    //     return NextResponse.json(
    //       { error: 'Invalid booking' },
    //       { status: 404 }
    //     );
    //   }
    // }

    // TODO: Check if review already exists for this booking
    // if (booking_id) {
    //   const existingReview = await ReviewModel.findFirst({
    //     where: { booking_id },
    //   });
    //   if (existingReview) {
    //     return NextResponse.json(
    //       { error: 'Review already exists for this booking' },
    //       { status: 400 }
    //     );
    //   }
    // }

    // TODO: Create review in database
    // const review = await ReviewModel.create({
    //   user_id: user.id,
    //   service_id,
    //   vendor_id,
    //   booking_id,
    //   rating,
    //   title,
    //   comment,
    //   type,
    //   media_url,
    // });

    // Mock review creation
    const mockReview = {
      id: Math.floor(Math.random() * 1000) + 1,
      service_id,
      vendor_id,
      booking_id,
      rating,
      title,
      comment,
      type,
      media_url,
      helpful_count: 0,
      created_at: new Date().toISOString(),
    };

    // TODO: Update vendor/service rating averages
    // await updateVendorRating(vendor_id);
    // if (service_id) {
    //   await updateServiceRating(service_id);
    // }

    return NextResponse.json({
      success: true,
      review: mockReview,
      message: 'Review submitted successfully',
    });
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500 }
    );
  }
} 