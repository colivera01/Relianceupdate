// scripts/seed-vendor.cjs
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const vendor = await prisma.vendor.create({
    data: {
      firstName: 'Cesar',
      lastName: 'Olivera',
      name: 'Cesar Olivera',
      businessName: 'Sparkle Cleaning Pro',
      businessType: 'Cleaning Service',
      category: 'Deep Cleaning',
      foundedYear: 2020,
      email: 'sparkle@example.com',
      phone: '555-123-4567',
      city: 'Altamonte Springs',
      state: 'FL',
      serviceTypes: 'standard,deep,move-out',
      specializations: 'hospital,office,residential',
      serviceAreas: 'Altamonte Springs,Orlando',
    },
  });
  console.log('Inserted vendor id:', vendor.id);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });




