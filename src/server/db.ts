import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Construct connection string programmatically to avoid parsing issues
function getDatabaseUrl(): string {
  const dbUrl = process.env.DATABASE_URL;
  
  if (dbUrl) {
    // Safe diagnostics only (never log secrets)
    const urlMatch = dbUrl.match(/^sqlserver:\/\/([^;/?]+)/i);
    const hostPort = urlMatch?.[1] || 'unknown-host';
    const host = hostPort.split(':')[0] || hostPort;
    const dbMatch = dbUrl.match(/(?:^|;)database=([^;]+)/i);
    const databaseName = dbMatch?.[1] || 'unknown-db';
    console.log('[db.ts] DATABASE_URL present:', true);
    console.log('[db.ts] DATABASE_URL host:', host);
    console.log('[db.ts] DATABASE_URL database:', databaseName);
    
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
let prismaInitError: Error | null = null;

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
  const message = error?.message || 'Unknown Prisma initialization error';
  const isConnectivityError =
    typeof message === 'string' &&
    (message.includes("Can't reach database server") ||
      message.includes('ECONNREFUSED') ||
      message.includes('ETIMEDOUT'));
  console.error('[db.ts] ERROR creating PrismaClient:', message);
  console.error('[db.ts] Connection failure type:', isConnectivityError ? 'connectivity/network' : 'non-connectivity');
  console.error('[db.ts] Error name:', error.name);
  prismaInitError = error instanceof Error ? error : new Error(String(message));
  prisma = new Proxy(
    {},
    {
      get() {
        throw prismaInitError || new Error('Database unavailable: Prisma client not initialized');
      },
    }
  ) as PrismaClient;
}

export { prisma };
export const getPrismaInitError = () => prismaInitError;


