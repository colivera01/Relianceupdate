import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const category = searchParams.get('category');
    const location = searchParams.get('location');
    const priceMin = searchParams.get('priceMin');
    const priceMax = searchParams.get('priceMax');
    const rating = searchParams.get('rating');
    const type = searchParams.get('type'); // 'service' or 'vendor'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'relevance';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    if (!query && !category && !location) {
      return NextResponse.json(
        { error: 'Search query, category, or location is required' },
        { status: 400 }
      );
    }

    // TODO: Replace with actual database search
    // const searchResults = await performSearch({
    //   query,
    //   category,
    //   location,
    //   priceMin: priceMin ? parseFloat(priceMin) : null,
    //   priceMax: priceMax ? parseFloat(priceMax) : null,
    //   rating: rating ? parseFloat(rating) : null,
    //   type,
    //   page,
    //   limit,
    //   sortBy,
    //   sortOrder,
    // });

    // Mock search results
    const mockSearchResults = {
      services: [
        {
          id: 1,
          name: 'Deep House Cleaning',
          description: 'Complete house cleaning service including kitchen, bathrooms, and living areas.',
          category: 'Cleaning',
          price: 120,
          rating: 4.9,
          vendor: {
            id: 1,
            name: 'Sparkle Clean Pro',
            rating: 4.9,
            verified: true,
            location: 'Springfield, IL',
            distance: 2.3,
          },
          relevance_score: 0.95,
        },
        {
          id: 2,
          name: 'Plumbing Repair',
          description: 'Professional plumbing repair services for all types of issues.',
          category: 'Plumbing',
          price: 85,
          rating: 4.7,
          vendor: {
            id: 2,
            name: 'Quick Fix Plumbing',
            rating: 4.7,
            verified: true,
            location: 'Springfield, IL',
            distance: 1.8,
          },
          relevance_score: 0.88,
        },
        {
          id: 3,
          name: 'Landscape Design',
          description: 'Professional landscape design and installation services.',
          category: 'Landscaping',
          price: 200,
          rating: 4.8,
          vendor: {
            id: 3,
            name: 'Green Thumb Gardens',
            rating: 4.8,
            verified: true,
            location: 'Springfield, IL',
            distance: 3.1,
          },
          relevance_score: 0.82,
        },
      ],
      vendors: [
        {
          id: 1,
          name: 'Sparkle Clean Pro',
          category: 'Cleaning',
          rating: 4.9,
          review_count: 127,
          verified: true,
          location: 'Springfield, IL',
          distance: 2.3,
          services_count: 5,
          years_in_business: 8,
        },
        {
          id: 2,
          name: 'Quick Fix Plumbing',
          category: 'Plumbing',
          rating: 4.7,
          review_count: 89,
          verified: true,
          location: 'Springfield, IL',
          distance: 1.8,
          services_count: 3,
          years_in_business: 6,
        },
      ],
      suggestions: [
        'house cleaning',
        'deep cleaning',
        'move out cleaning',
        'plumbing repair',
        'landscape design',
        'garden maintenance',
      ],
      filters: {
        categories: [
          { name: 'Cleaning', count: 12 },
          { name: 'Plumbing', count: 8 },
          { name: 'Landscaping', count: 6 },
          { name: 'Electrical', count: 4 },
          { name: 'HVAC', count: 3 },
        ],
        price_ranges: [
          { min: 0, max: 50, count: 5 },
          { min: 50, max: 100, count: 8 },
          { min: 100, max: 200, count: 12 },
          { min: 200, max: 500, count: 6 },
          { min: 500, max: null, count: 2 },
        ],
        ratings: [
          { rating: 5, count: 15 },
          { rating: 4, count: 12 },
          { rating: 3, count: 5 },
          { rating: 2, count: 2 },
          { rating: 1, count: 1 },
        ],
      },
      pagination: {
        page,
        limit,
        total: 33,
        totalPages: Math.ceil(33 / limit),
      },
    };

    // Filter results based on search parameters
    let filteredServices = mockSearchResults.services;
    let filteredVendors = mockSearchResults.vendors;

    if (query) {
      const searchTerm = query.toLowerCase();
      filteredServices = filteredServices.filter(service =>
        service.name.toLowerCase().includes(searchTerm) ||
        service.description.toLowerCase().includes(searchTerm) ||
        service.category.toLowerCase().includes(searchTerm)
      );
      filteredVendors = filteredVendors.filter(vendor =>
        vendor.name.toLowerCase().includes(searchTerm) ||
        vendor.category.toLowerCase().includes(searchTerm)
      );
    }

    if (category) {
      filteredServices = filteredServices.filter(service =>
        service.category.toLowerCase() === category.toLowerCase()
      );
      filteredVendors = filteredVendors.filter(vendor =>
        vendor.category.toLowerCase() === category.toLowerCase()
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
      filteredVendors = filteredVendors.filter(vendor =>
        vendor.rating >= parseFloat(rating)
      );
    }

    // Sort results
    if (sortBy === 'price') {
      filteredServices.sort((a, b) =>
        sortOrder === 'asc' ? a.price - b.price : b.price - a.price
      );
    } else if (sortBy === 'rating') {
      filteredServices.sort((a, b) =>
        sortOrder === 'asc' ? a.rating - b.rating : b.rating - a.rating
      );
      filteredVendors.sort((a, b) =>
        sortOrder === 'asc' ? a.rating - b.rating : b.rating - a.rating
      );
    } else if (sortBy === 'distance') {
      filteredServices.sort((a, b) =>
        sortOrder === 'asc' ? a.vendor.distance - b.vendor.distance : b.vendor.distance - a.vendor.distance
      );
      filteredVendors.sort((a, b) =>
        sortOrder === 'asc' ? a.distance - b.distance : b.distance - a.distance
      );
    } else {
      // Default: sort by relevance
      filteredServices.sort((a, b) =>
        sortOrder === 'asc' ? a.relevance_score - b.relevance_score : b.relevance_score - a.relevance_score
      );
    }

    // Return only requested type if specified
    const results = {
      services: type === 'vendor' ? [] : filteredServices,
      vendors: type === 'service' ? [] : filteredVendors,
      suggestions: mockSearchResults.suggestions,
      filters: mockSearchResults.filters,
      pagination: {
        page,
        limit,
        total: filteredServices.length + filteredVendors.length,
        totalPages: Math.ceil((filteredServices.length + filteredVendors.length) / limit),
      },
    };

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error performing search:', error);
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    );
  }
} 