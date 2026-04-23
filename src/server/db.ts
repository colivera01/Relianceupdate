import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaDevProbeStarted: boolean | undefined;
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

type DbFailureCategory =
  | 'network_unreachable'
  | 'auth_or_credentials'
  | 'pool_timeout_or_pressure'
  | 'query_timeout'
  | 'unknown';

function classifyPrismaError(error: any): DbFailureCategory {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();

  if (
    code === 'P1001' ||
    message.includes('prisma connect probe timeout') ||
    message.includes("can't reach database server") ||
    message.includes('econnrefused') ||
    message.includes('etimedout')
  ) {
    return 'network_unreachable';
  }
  if (code === 'P1000' || message.includes('authentication failed') || message.includes('login failed')) {
    return 'auth_or_credentials';
  }
  if (
    code === 'P2024' ||
    message.includes('timed out fetching a new connection from the connection pool') ||
    message.includes('connection pool')
  ) {
    return 'pool_timeout_or_pressure';
  }
  if (message.includes('query timeout')) {
    return 'query_timeout';
  }
  return 'unknown';
}

async function runPrismaDevConnectivityProbe(client: PrismaClient) {
  if (process.env.NODE_ENV === 'production') return;
  if (globalForPrisma.prismaDevProbeStarted) return;
  globalForPrisma.prismaDevProbeStarted = true;

  const startedAt = Date.now();
  console.info('[db.ts] Prisma dev probe start');

  try {
    await Promise.race([
      client.$connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Prisma connect probe timeout after 8000ms')), 8000)
      ),
    ]);

    await Promise.race([
      client.$queryRaw`SELECT 1 AS ok`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Prisma first-query probe timeout after 8000ms')), 8000)
      ),
    ]);

    console.info('[db.ts] Prisma dev probe success', {
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error: any) {
    const category = classifyPrismaError(error);
    console.error('[db.ts] Prisma dev probe failed', {
      category,
      code: error?.code || null,
      name: error?.name || null,
      message: error?.message || String(error),
      elapsedMs: Date.now() - startedAt,
    });
  }
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

  // Non-blocking startup diagnostics for local connectivity triage.
  void runPrismaDevConnectivityProbe(prisma);
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


