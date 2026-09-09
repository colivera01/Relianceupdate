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
      businessType: 'Sole Proprietorship',
      category: 'Home cleaners',
      foundedYear: 2020,
      email: 'sparkle@example.com',
      phone: '555-123-4567',
      city: 'Altamonte Springs',
      state: 'FL',
      serviceTypes: 'Regular Cleaning,Deep Cleaning,Move-in/Move-out Cleaning',
      specializations: 'hospital,office,residential',
      serviceAreas: 'Altamonte Springs,Orlando',
      demo: true,
      seedBatchId: 'scripts-seed-vendor',
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




