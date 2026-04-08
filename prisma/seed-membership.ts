// prisma/seed-membership.ts
// Seed script for vendor invite + membership system

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding membership system...');

  // Create demo vendor
  const vendor = await prisma.vendor.upsert({
    where: { id: 'demo-vendor-1' },
    update: {},
    create: {
      id: 'demo-vendor-1',
      name: 'Demo Vendor',
      businessName: 'Demo Vendor Inc.',
      email: 'demo@vendor.com',
    },
  });

  console.log('Created vendor:', vendor.id);

  // Create manager user
  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@example.com' },
    update: {},
    create: {
      email: 'manager@example.com',
      name: 'Manager User',
      phone: '+1234567890',
    },
  });

  console.log('Created manager user:', managerUser.id);

  // Create manager membership
  const managerMembership = await prisma.vendorMembership.upsert({
    where: {
      vendorId_userId: {
        vendorId: vendor.id,
        userId: managerUser.id,
      },
    },
    update: {},
    create: {
      vendorId: vendor.id,
      userId: managerUser.id,
      role: 'MANAGER',
      status: 'ACTIVE',
      approvedAt: new Date(),
      approvedByUserId: managerUser.id,
    },
  });

  console.log('Created manager membership:', managerMembership.id);
  console.log('✅ Seed completed!');
  console.log('\nYou can now:');
  console.log('1. Log in as manager@example.com');
  console.log('2. Create invites at /dashboard/invites');
  console.log('3. Approve pending memberships at /dashboard/pending');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

