import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

export function customerLoadError(error: unknown, context: string, message: string, status = 500) {
  const correlationId = randomUUID();
  console.error(`[${context}]`, { correlationId, error });
  return NextResponse.json({ success: false, code: status === 503 ? 'DB_UNAVAILABLE' : 'CUSTOMER_LOAD_FAILED', message, error: message, correlationId }, { status });
}
