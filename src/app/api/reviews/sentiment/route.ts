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
  isValidSentiment,
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
    const sentiment = String(body?.sentiment || '').trim();

    if (!reviewWindowId || !sentiment) {
      return NextResponse.json(
        { success: false, error: 'reviewWindowId and sentiment are required' },
        { status: 400 }
      );
    }
    if (!isValidSentiment(sentiment)) {
      return NextResponse.json(
        { success: false, error: 'Invalid sentiment value' },
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

    const [record] = await Promise.all([
      (prisma as any).reviewSentiment.create({ data: { reviewWindowId, sentiment } }),
      (prisma as any).reviewPromptEvent.create({
        data: {
          reviewWindowId,
          eventType:
            sentiment === 'positive'
              ? 'clicked_positive'
              : sentiment === 'neutral'
              ? 'clicked_neutral'
              : 'clicked_negative',
          metadata: JSON.stringify({ sentiment }),
        },
      }),
    ]);

    return NextResponse.json({ success: true, sentiment: record });
  } catch (error) {
    console.error('[reviews/sentiment] POST error:', error);
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), {
        status: error.statusCode,
      });
    }
    return NextResponse.json(
      { success: false, error: 'Failed to store sentiment' },
      { status: 500 }
    );
  }
}
