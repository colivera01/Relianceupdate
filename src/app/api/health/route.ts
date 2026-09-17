// src/app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const mode = process.env.NEXT_PUBLIC_API_MODE || 'live';
  return NextResponse.json({
    ok: true,
    mode,
    timestamp: new Date().toISOString(),
  });
}
