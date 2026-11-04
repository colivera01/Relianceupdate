import { NextResponse } from 'next/server';

import {
  listCustomerNotificationHistory,
  markAllCustomerNotificationsRead,
} from '@/lib/customer-notifications';
import { authorizationErrorResponse, requireRequestActor } from '@/lib/request-actor';
import { prisma } from '@/server/db';

export async function GET(request: Request) {
  try {
    const actor = await requireRequestActor(request);
    const result = await listCustomerNotificationHistory(prisma as any, {
      userId: actor.userId,
      limit: 100,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    console.error('[customer/notifications] history failed', error);
    return NextResponse.json(
      { success: false, code: 'NOTIFICATIONS_UNAVAILABLE', error: 'Notifications could not be loaded. Try again.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRequestActor(request);
    const body = await request.json().catch(() => ({}));
    if (String(body?.action || '').toUpperCase() !== 'MARK_ALL_READ') {
      return NextResponse.json(
        { success: false, code: 'NOTIFICATION_ACTION_INVALID', error: 'Choose a supported notification action.' },
        { status: 422 },
      );
    }
    const result = await markAllCustomerNotificationsRead(prisma as any, { userId: actor.userId });
    return NextResponse.json({
      success: true,
      changed: result.changed,
      readAt: result.readAt.toISOString(),
    });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    console.error('[customer/notifications] mark all read failed', error);
    return NextResponse.json(
      { success: false, code: 'NOTIFICATION_UPDATE_FAILED', error: 'Notifications could not be updated. Try again.' },
      { status: 500 },
    );
  }
}
