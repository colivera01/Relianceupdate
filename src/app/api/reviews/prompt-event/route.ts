import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { getUserIdFromRequest } from '@/lib/auth';
import {
  accountStatusErrorBody,
  AccountStatusError,
  ensureUserAccountCanAct,
} from '@/lib/account-status';
import {
  assertReviewWindowActiveForUser,
  isValidPromptEvent,
} from '@/lib/review-capture';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: customer context is required' },
        { status: 401 }
      );
    }
    await ensureUserAccountCanAct(userId);

    const body = await request.json();
    const reviewWindowId = String(body?.reviewWindowId || '').trim();
    const eventType = String(body?.eventType || '').trim();
    const metadata = body?.metadata ?? null;

    if (!reviewWindowId || !eventType) {
      return NextResponse.json(
        { success: false, error: 'reviewWindowId and eventType are required' },
        { status: 400 }
      );
    }
    if (!isValidPromptEvent(eventType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid prompt event type' },
        { status: 400 }
      );
    }

    const state = await assertReviewWindowActiveForUser(reviewWindowId, userId);
    if (!state.ok) {
      return NextResponse.json(
        { success: false, error: state.error },
        { status: state.status }
      );
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
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), {
        status: error.statusCode,
      });
    }
    return NextResponse.json(
      { success: false, error: 'Failed to log prompt event' },
      { status: 500 }
    );
  }
}
