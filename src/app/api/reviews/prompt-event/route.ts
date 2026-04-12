import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { assertReviewWindowActive, isValidPromptEvent } from '@/lib/review-capture';

// TODO(server-hardening): Optionally require auth + booking ownership via reviewWindow → booking (see REVIEW_ROUTE_SERVER_HARDENING_AUDIT.md).

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const reviewWindowId = String(body?.reviewWindowId || '').trim();
    const eventType = String(body?.eventType || '').trim();
    const metadata = body?.metadata ?? null;

    if (!reviewWindowId || !eventType) {
      return NextResponse.json({ success: false, error: 'reviewWindowId and eventType are required' }, { status: 400 });
    }
    if (!isValidPromptEvent(eventType)) {
      return NextResponse.json({ success: false, error: 'Invalid prompt event type' }, { status: 400 });
    }

    const state = await assertReviewWindowActive(reviewWindowId);
    if (!state.ok) {
      return NextResponse.json({ success: false, error: state.error }, { status: state.status });
    }

    const event = await (prisma as any).reviewPromptEvent.create({
      data: {
        reviewWindowId,
        eventType,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error('[reviews/prompt-event] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to log prompt event' }, { status: 500 });
  }
}
