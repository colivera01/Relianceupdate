import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('Test API called');
  return NextResponse.json({
    message: 'Test API is working',
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  console.log('Test POST API called');
  const body = await request.json();
  console.log('Test POST body:', body);
  
  return NextResponse.json({
    message: 'Test POST API is working',
    receivedData: body,
    timestamp: new Date().toISOString()
  });
} 