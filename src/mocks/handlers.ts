import { http, HttpResponse } from 'msw';
import { mockEmployees } from './fixtures/employees';
import { mockServices } from './fixtures/services';
import { mockBookings } from './fixtures/bookings';
import { mockReviews } from './fixtures/reviews';
import { mockAvailability } from './fixtures/availability';
import { mockUsers } from './fixtures/users';

export const handlers = [
  // --- Health (always safe to call) ---
  http.get('/api/health', () =>
    HttpResponse.json({
      ok: true,
      mode: 'mock',
      timestamp: new Date().toISOString(),
    })
  ),

  // Employee handlers
  http.get('/api/employees', () => {
    return HttpResponse.json({
      success: true,
      data: mockEmployees,
      pagination: {
        page: 1,
        limit: 10,
        total: mockEmployees.length,
        totalPages: 1
      }
    });
  }),

  http.get('/api/employees/:id', ({ params }) => {
    const employee = mockEmployees.find(emp => emp.id === params.id);
    if (!employee) {
      return HttpResponse.json(
        { success: false, message: 'Employee not found' },
        { status: 404 }
      );
    }
    return HttpResponse.json({ success: true, data: employee });
  }),

  http.post('/api/employees', async ({ request }) => {
    const newEmployee = await request.json();
    const employee = {
      ...newEmployee,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    mockEmployees.push(employee);
    return HttpResponse.json({ success: true, data: employee });
  }),

  http.put('/api/employees/:id', async ({ params, request }) => {
    const updates = await request.json();
    const index = mockEmployees.findIndex(emp => emp.id === params.id);
    if (index === -1) {
      return HttpResponse.json(
        { success: false, message: 'Employee not found' },
        { status: 404 }
      );
    }
    mockEmployees[index] = { ...mockEmployees[index], ...updates };
    return HttpResponse.json({ success: true, data: mockEmployees[index] });
  }),

  http.delete('/api/employees/:id', ({ params }) => {
    const index = mockEmployees.findIndex(emp => emp.id === params.id);
    if (index === -1) {
      return HttpResponse.json(
        { success: false, message: 'Employee not found' },
        { status: 404 }
      );
    }
    mockEmployees.splice(index, 1);
    return HttpResponse.json({ success: true, message: 'Employee deleted' });
  }),

  // Service handlers
  http.get('/api/services', () => {
    return HttpResponse.json({
      success: true,
      data: mockServices,
      pagination: {
        page: 1,
        limit: 10,
        total: mockServices.length,
        totalPages: 1
      }
    });
  }),

  http.get('/api/services/:id', ({ params }) => {
    const service = mockServices.find(svc => svc.id === params.id);
    if (!service) {
      return HttpResponse.json(
        { success: false, message: 'Service not found' },
        { status: 404 }
      );
    }
    return HttpResponse.json({ success: true, data: service });
  }),

  http.post('/api/services', async ({ request }) => {
    const newService = await request.json();
    const service = {
      ...newService,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    mockServices.push(service);
    return HttpResponse.json({ success: true, data: service });
  }),

  // Booking handlers
  http.get('/api/bookings', () => {
    return HttpResponse.json({
      success: true,
      data: mockBookings,
      pagination: {
        page: 1,
        limit: 10,
        total: mockBookings.length,
        totalPages: 1
      }
    });
  }),

  http.get('/api/bookings/:id', ({ params }) => {
    const booking = mockBookings.find(bk => bk.id === params.id);
    if (!booking) {
      return HttpResponse.json(
        { success: false, message: 'Booking not found' },
        { status: 404 }
      );
    }
    return HttpResponse.json({ success: true, data: booking });
  }),

  http.post('/api/bookings', async ({ request }) => {
    const newBooking = await request.json();
    const booking = {
      ...newBooking,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    mockBookings.push(booking);
    return HttpResponse.json({ success: true, data: booking });
  }),

  // Review handlers
  http.get('/api/reviews', () => {
    return HttpResponse.json({
      success: true,
      data: mockReviews,
      pagination: {
        page: 1,
        limit: 10,
        total: mockReviews.length,
        totalPages: 1
      }
    });
  }),

  http.get('/api/reviews/:id', ({ params }) => {
    const review = mockReviews.find(rev => rev.id === params.id);
    if (!review) {
      return HttpResponse.json(
        { success: false, message: 'Review not found' },
        { status: 404 }
      );
    }
    return HttpResponse.json({ success: true, data: review });
  }),

  http.post('/api/reviews', async ({ request }) => {
    const newReview = await request.json();
    const review = {
      ...newReview,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    mockReviews.push(review);
    return HttpResponse.json({ success: true, data: review });
  }),

  // Availability handlers
  http.get('/api/availability/:vendorId', ({ params }) => {
    const availability = mockAvailability.filter(av => av.vendorId === params.vendorId);
    return HttpResponse.json({
      success: true,
      data: availability
    });
  }),

  http.put('/api/availability/:vendorId', async ({ params, request }) => {
    const updates = await request.json();
    const index = mockAvailability.findIndex(av => av.vendorId === params.vendorId);
    if (index === -1) {
      return HttpResponse.json(
        { success: false, message: 'Availability not found' },
        { status: 404 }
      );
    }
    mockAvailability[index] = { ...mockAvailability[index], ...updates };
    return HttpResponse.json({ success: true, data: mockAvailability[index] });
  }),

  // User handlers
  http.get('/api/users', () => {
    return HttpResponse.json({
      success: true,
      data: mockUsers,
      pagination: {
        page: 1,
        limit: 10,
        total: mockUsers.length,
        totalPages: 1
      }
    });
  }),

  http.get('/api/users/:id', ({ params }) => {
    const user = mockUsers.find(u => u.id === params.id);
    if (!user) {
      return HttpResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }
    return HttpResponse.json({ success: true, data: user });
  }),

  http.put('/api/users/:id', async ({ params, request }) => {
    const updates = await request.json();
    const index = mockUsers.findIndex(u => u.id === params.id);
    if (index === -1) {
      return HttpResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }
    mockUsers[index] = { ...mockUsers[index], ...updates };
    return HttpResponse.json({ success: true, data: mockUsers[index] });
  }),

  // Auth handlers (keeping existing functionality)
  http.post('/api/auth/login', async ({ request }) => {
    const { email, password } = await request.json();
    // Mock login logic
    return HttpResponse.json({
      success: true,
      data: {
        user: { id: 'user1', email, name: 'Test User' },
        token: 'mock-jwt-token'
      }
    });
  }),

  http.post('/api/auth/register', async ({ request }) => {
    const userData = await request.json();
    // Mock registration logic
    return HttpResponse.json({
      success: true,
      data: {
        user: { ...userData, id: Date.now().toString() },
        message: 'User registered successfully'
      }
    });
  })
];
