import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';

export async function GET() {
  try {
    // Test 1: Check if DATABASE_URL is set
    const dbUrl = process.env.DATABASE_URL;
    console.log('[test-db] DATABASE_URL exists:', !!dbUrl);
    console.log('[test-db] DATABASE_URL length:', dbUrl?.length);
    console.log('[test-db] DATABASE_URL preview:', dbUrl?.substring(0, 50) + '...');

    // Test 2: Try to connect and query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('[test-db] Raw query result:', result);

    // Test 3: Try to count vendors
    const vendorCount = await prisma.vendor.count();
    console.log('[test-db] Vendor count:', vendorCount);

    // Test 4: Try to find the specific vendor
    const vendorId = 'cmipm4d6v0000sosgqvb8tp63';
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    return NextResponse.json({
      success: true,
      dbUrlExists: !!dbUrl,
      dbUrlLength: dbUrl?.length,
      rawQueryWorks: true,
      vendorCount,
      vendorFound: !!vendor,
      vendorId: vendor?.id || null,
      vendorName: vendor?.name || vendor?.businessName || null,
    });
  } catch (error: any) {
    console.error('[test-db] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      name: error.name,
    }, { status: 500 });
  }
}



