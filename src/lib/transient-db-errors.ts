export const PUBLIC_DB_UNAVAILABLE_CODE = 'DB_UNAVAILABLE';

export const PUBLIC_DB_UNAVAILABLE_MESSAGE =
  'This page is temporarily unavailable because Reliance cannot reach the service database. Please try again in a moment.';

export function isTransientDbConnectivityError(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || '').toUpperCase()
      : '';
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message || '')
      : typeof error === 'string'
      ? error
      : '';

  return (
    code === 'P1001' ||
    message.includes("Can't reach database server") ||
    message.includes('PrismaClientInitializationError') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.toLowerCase().includes('prisma connect probe timeout')
  );
}

export async function withTransientDbRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isTransientDbConnectivityError(error)) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
    return operation();
  }
}
