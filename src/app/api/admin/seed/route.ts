import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/server/db';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Seeding not allowed in production' },
      { status: 403 }
    );
  }

  // Check authorization
  const authHeader = request.headers.get('authorization');
  const seedSecret = String(process.env.SEED_SECRET || '').trim();
  if (!seedSecret) {
    return NextResponse.json({ error: 'Seed tooling is not configured' }, { status: 503 });
  }
  const expectedToken = `Bearer ${seedSecret}`;
  
  if (authHeader !== expectedToken) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const seedBatchId = uuidv4();

    // Create vendors
    const vendor1 = await prisma.vendor.create({
      data: {
        name: '[DEMO] Sparkle Clean Pro',
        email: 'demo@sparkleclean.test',
        phone: '(555) 123-4567',
        demo: true,
        seedBatchId
      }
    });

    const vendor2 = await prisma.vendor.create({
      data: {
        name: '[DEMO] Quick Fix Plumbing',
        email: 'demo@quickfix.test',
        phone: '(555) 234-5678',
        demo: true,
        seedBatchId
      }
    });

    const vendor3 = await prisma.vendor.create({
      data: {
        name: '[DEMO] Elite Auto Repair',
        email: 'demo@eliteauto.test',
        phone: '(555) 345-6789',
        demo: true,
        seedBatchId
      }
    });

    // Create employees
    const employees = await Promise.all([
      prisma.employee.create({
        data: {
          vendorId: vendor1.id,
          name: 'Sarah Johnson',
          email: 'sarah@sparkleclean.test',
          role: 'MANAGER',
          demo: true,
          seedBatchId
        }
      }),
      prisma.employee.create({
        data: {
          vendorId: vendor1.id,
          name: 'Mike Chen',
          email: 'mike@sparkleclean.test',
          role: 'TECHNICIAN',
          demo: true,
          seedBatchId
        }
      }),
      prisma.employee.create({
        data: {
          vendorId: vendor1.id,
          name: 'Lisa Rodriguez',
          email: 'lisa@sparkleclean.test',
          role: 'TECHNICIAN',
          demo: true,
          seedBatchId
        }
      }),
      prisma.employee.create({
        data: {
          vendorId: vendor2.id,
          name: 'Tom Wilson',
          email: 'tom@quickfix.test',
          role: 'MANAGER',
          demo: true,
          seedBatchId
        }
      }),
      prisma.employee.create({
        data: {
          vendorId: vendor2.id,
          name: 'Carlos Mendez',
          email: 'carlos@quickfix.test',
          role: 'TECHNICIAN',
          demo: true,
          seedBatchId
        }
      }),
      prisma.employee.create({
        data: {
          vendorId: vendor3.id,
          name: 'David Brown',
          email: 'david@eliteauto.test',
          role: 'MANAGER',
          demo: true,
          seedBatchId
        }
      }),
      prisma.employee.create({
        data: {
          vendorId: vendor3.id,
          name: 'Alex Kim',
          email: 'alex@eliteauto.test',
          role: 'TECHNICIAN',
          demo: true,
          seedBatchId
        }
      }),
      prisma.employee.create({
        data: {
          vendorId: vendor3.id,
          name: 'Emma Davis',
          email: 'emma@eliteauto.test',
          role: 'TECHNICIAN',
          demo: true,
          seedBatchId
        }
      })
    ]);

    // Create services
    const services = await Promise.all([
      prisma.service.create({
        data: {
          vendorId: vendor1.id,
          name: 'Residential Cleaning',
          description: 'Standard home cleaning service',
          price: 120,
          demo: true,
          seedBatchId
        }
      }),
      prisma.service.create({
        data: {
          vendorId: vendor1.id,
          name: 'Deep Cleaning',
          description: 'Comprehensive deep cleaning service',
          price: 200,
          demo: true,
          seedBatchId
        }
      }),
      prisma.service.create({
        data: {
          vendorId: vendor2.id,
          name: 'Pipe Repair',
          description: 'Emergency pipe repair service',
          price: 150,
          demo: true,
          seedBatchId
        }
      }),
      prisma.service.create({
        data: {
          vendorId: vendor2.id,
          name: 'Drain Cleaning',
          description: 'Professional drain cleaning',
          price: 100,
          demo: true,
          seedBatchId
        }
      }),
      prisma.service.create({
        data: {
          vendorId: vendor3.id,
          name: 'Oil Change',
          description: 'Quick oil change service',
          price: 45,
          demo: true,
          seedBatchId
        }
      }),
      prisma.service.create({
        data: {
          vendorId: vendor3.id,
          name: 'Brake Service',
          description: 'Complete brake system service',
          price: 180,
          demo: true,
          seedBatchId
        }
      })
    ]);

    // Create users
    const users = await Promise.all([
      prisma.user.create({
        data: {
          name: 'John Smith',
          email: 'demo+1@vendor.test',
          demo: true,
          seedBatchId
        }
      }),
      prisma.user.create({
        data: {
          name: 'Emily Davis',
          email: 'demo+2@vendor.test',
          demo: true,
          seedBatchId
        }
      }),
      prisma.user.create({
        data: {
          name: 'Robert Wilson',
          email: 'demo+3@vendor.test',
          demo: true,
          seedBatchId
        }
      }),
      prisma.user.create({
        data: {
          name: 'Maria Garcia',
          email: 'demo+4@vendor.test',
          demo: true,
          seedBatchId
        }
      })
    ]);

    // Create bookings
    const bookings = await Promise.all([
      prisma.booking.create({
        data: {
          userId: users[0].id,
          serviceId: services[0].id,
          vendorId: vendor1.id,
          status: 'COMPLETED',
          scheduledFor: new Date(Date.now() - 86400000), // Yesterday
          demo: true,
          seedBatchId
        }
      }),
      prisma.booking.create({
        data: {
          userId: users[0].id,
          serviceId: services[1].id,
          vendorId: vendor1.id,
          status: 'CONFIRMED',
          scheduledFor: new Date(Date.now() + 86400000), // Tomorrow
          demo: true,
          seedBatchId
        }
      }),
      prisma.booking.create({
        data: {
          userId: users[1].id,
          serviceId: services[2].id,
          vendorId: vendor2.id,
          status: 'COMPLETED',
          scheduledFor: new Date(Date.now() - 172800000), // 2 days ago
          demo: true,
          seedBatchId
        }
      }),
      prisma.booking.create({
        data: {
          userId: users[1].id,
          serviceId: services[3].id,
          vendorId: vendor2.id,
          status: 'PENDING',
          scheduledFor: new Date(Date.now() + 172800000), // 2 days from now
          demo: true,
          seedBatchId
        }
      }),
      prisma.booking.create({
        data: {
          userId: users[2].id,
          serviceId: services[4].id,
          vendorId: vendor3.id,
          status: 'COMPLETED',
          scheduledFor: new Date(Date.now() - 259200000), // 3 days ago
          demo: true,
          seedBatchId
        }
      }),
      prisma.booking.create({
        data: {
          userId: users[2].id,
          serviceId: services[5].id,
          vendorId: vendor3.id,
          status: 'CONFIRMED',
          scheduledFor: new Date(Date.now() + 259200000), // 3 days from now
          demo: true,
          seedBatchId
        }
      }),
      prisma.booking.create({
        data: {
          userId: users[3].id,
          serviceId: services[0].id,
          vendorId: vendor1.id,
          status: 'COMPLETED',
          scheduledFor: new Date(Date.now() - 345600000), // 4 days ago
          demo: true,
          seedBatchId
        }
      }),
      prisma.booking.create({
        data: {
          userId: users[3].id,
          serviceId: services[2].id,
          vendorId: vendor2.id,
          status: 'PENDING',
          scheduledFor: new Date(Date.now() + 345600000), // 4 days from now
          demo: true,
          seedBatchId
        }
      }),
      prisma.booking.create({
        data: {
          userId: users[0].id,
          serviceId: services[4].id,
          vendorId: vendor3.id,
          status: 'COMPLETED',
          scheduledFor: new Date(Date.now() - 432000000), // 5 days ago
          demo: true,
          seedBatchId
        }
      }),
      prisma.booking.create({
        data: {
          userId: users[1].id,
          serviceId: services[5].id,
          vendorId: vendor3.id,
          status: 'CONFIRMED',
          scheduledFor: new Date(Date.now() + 432000000), // 5 days from now
          demo: true,
          seedBatchId
        }
      })
    ]);

    // Create reviews
    const reviews = await Promise.all([
      prisma.review.create({
        data: {
          userId: users[0].id,
          vendorId: vendor1.id,
          rating: 5,
          comment: 'Excellent service! Very professional and thorough.',
          demo: true,
          seedBatchId
        }
      }),
      prisma.review.create({
        data: {
          userId: users[1].id,
          vendorId: vendor2.id,
          rating: 4,
          comment: 'Good work, fixed the issue quickly.',
          demo: true,
          seedBatchId
        }
      }),
      prisma.review.create({
        data: {
          userId: users[2].id,
          vendorId: vendor3.id,
          rating: 5,
          comment: 'Fast and reliable service. Highly recommend!',
          demo: true,
          seedBatchId
        }
      }),
      prisma.review.create({
        data: {
          userId: users[3].id,
          vendorId: vendor1.id,
          rating: 4,
          comment: 'Great quality work, very satisfied.',
          demo: true,
          seedBatchId
        }
      }),
      prisma.review.create({
        data: {
          userId: users[0].id,
          vendorId: vendor2.id,
          rating: 5,
          comment: 'Professional team, excellent communication.',
          demo: true,
          seedBatchId
        }
      }),
      prisma.review.create({
        data: {
          userId: users[1].id,
          vendorId: vendor3.id,
          rating: 4,
          comment: 'Good service, fair pricing.',
          demo: true,
          seedBatchId
        }
      }),
      prisma.review.create({
        data: {
          userId: users[2].id,
          vendorId: vendor1.id,
          rating: 5,
          comment: 'Outstanding cleaning service!',
          demo: true,
          seedBatchId
        }
      }),
      prisma.review.create({
        data: {
          userId: users[3].id,
          vendorId: vendor2.id,
          rating: 4,
          comment: 'Reliable plumbing service.',
          demo: true,
          seedBatchId
        }
      })
    ]);

    const summary = {
      ok: true,
      seedBatchId,
      inserted: {
        vendors: 3,
        employees: employees.length,
        services: services.length,
        users: users.length,
        bookings: bookings.length,
        reviews: reviews.length
      }
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Seeding error:', error);
    return NextResponse.json(
      { error: 'Failed to seed data' },
      { status: 500 }
    );
  }
}
