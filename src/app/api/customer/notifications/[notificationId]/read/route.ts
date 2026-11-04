import { NextResponse } from 'next/server';

import { markCustomerNotificationRead } from '@/lib/customer-notifications';
import { authorizationErrorResponse, requireRequestActor } from '@/lib/request-actor';
import { prisma } from '@/server/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  try {
    const actor = await requireRequestActor(request);
    const { notificationId } = await params;
    const result = await markCustomerNotificationRead(prisma as any, {
      userId: actor.userId,
      notificationId,
    });
    if (!result.found) {
      return NextResponse.json(
        { success: false, code: 'NOTIFICATION_NOT_FOUND', error: 'This notification is not available in your account.' },
        { status: 404 },
      );
    }
    return NextResponse.json({
      success: true,
      changed: result.changed,
      readAt: result.readAt instanceof Date ? result.readAt.toISOString() : result.readAt,
    });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    console.error('[customer/notifications] mark read failed', error);
    return NextResponse.json(
      { success: false, code: 'NOTIFICATION_UPDATE_FAILED', error: 'The notification could not be updated. Try again.' },
      { status: 500 },
    );
  }
}
