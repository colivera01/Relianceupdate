import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Construct connection string programmatically to avoid parsing issues
function getDatabaseUrl(): string {
  const dbUrl = process.env.DATABASE_URL;
  
  if (dbUrl) {
    // Log the actual connection string (first 80 chars for security)
    console.log('[db.ts] DATABASE_URL from env, length:', dbUrl.length);
    console.log('[db.ts] DATABASE_URL preview:', dbUrl.substring(0, 80) + '...');
    
    // Check if it contains the problematic encoding
    if (dbUrl.includes('%2320') || dbUrl.includes('%23')) {
      console.warn('[db.ts] WARNING: Connection string contains %23 (#) encoding - this may cause issues');
    }
    
    return dbUrl;
  }
  
  // Fallback: construct from individual env vars if needed
  // This is just for testing - you should use DATABASE_URL
  throw new Error('DATABASE_URL environment variable is not set');
}

let prisma: PrismaClient;

try {
  const connectionString = getDatabaseUrl();
  
  // Try creating PrismaClient with explicit connection string
  prisma = globalForPrisma.prisma ?? new PrismaClient({
    datasources: {
      db: {
        url: connectionString,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
  }
} catch (error: any) {
  console.error('[db.ts] ERROR creating PrismaClient:', error.message);
  console.error('[db.ts] Error name:', error.name);
  if (error.stack) {
    console.error('[db.ts] Error stack:', error.stack);
  }
  throw error;
}

export { prisma };


