// src/app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const mode = process.env.NEXT_PUBLIC_API_MODE || 'live';
  return NextResponse.json({
    ok: true,
    mode,
    build: {
      sourceCommit: process.env.RELIANCE_BUILD_SOURCE_COMMIT || 'UNSET',
      packageName: process.env.RELIANCE_BUILD_PACKAGE_NAME || 'UNSET',
    },
    timestamp: new Date().toISOString(),
  });
}
