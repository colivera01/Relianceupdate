import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { accountStatusErrorBody, AccountStatusError, ensureUserAccountCanAct } from '@/lib/account-status';
import {
  changeCustomerServiceRecordOrganization,
  normalizeCustomerOrganizationAction,
} from '@/lib/customer-service-record-organization';
import { prisma } from '@/server/db';

function errorResponse(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : 'CUSTOMER_ORGANIZATION_FAILED';
  if (code === 'CUSTOMER_SERVICE_RECORD_NOT_FOUND') {
    return NextResponse.json({ error: 'Service Record not found.', code }, { status: 404 });
  }
  if (code === 'CUSTOMER_SERVICE_RECORD_FORBIDDEN') {
    return NextResponse.json({ error: 'This Service Record does not belong to your account.', code }, { status: 403 });
  }
  if (code === 'CUSTOMER_ORGANIZATION_IDEMPOTENCY_CONFLICT') {
    return NextResponse.json({ error: 'This organization request conflicts with an earlier request.', code }, { status: 409 });
  }
  if (code === 'CUSTOMER_ORGANIZATION_CONCURRENCY_FAILED') {
    return NextResponse.json({ error: 'This Service Record changed while the request was being processed. Try again.', code }, { status: 409 });
  }
  if (code === 'LEGACY_ARCHIVE_RESTORE_UNAVAILABLE') {
    return NextResponse.json({
      error: 'This historical archived record cannot be safely restored because its prior lifecycle is unavailable. Contact Support for help.',
      code,
    }, { status: 409 });
  }
  if (code === 'CUSTOMER_ARCHIVE_LIFECYCLE_NOT_ELIGIBLE') {
    return NextResponse.json({ error: 'Only completed or cancelled Service Records can be archived.', code }, { status: 409 });
  }
  if (code === 'CUSTOMER_RESTORE_LIFECYCLE_NOT_ELIGIBLE') {
    return NextResponse.json({ error: 'This Service Record cannot be safely restored.', code }, { status: 409 });
  }
  console.error('[customer-service-record-organization]', error);
  return NextResponse.json({ error: 'Unable to update this Service Record organization.', code: 'CUSTOMER_ORGANIZATION_FAILED' }, { status: 500 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const customerUserId = await getUserIdFromRequest(request);
    if (!customerUserId) {
      return NextResponse.json({ error: 'Unauthorized: customer context is required' }, { status: 401 });
    }
    await ensureUserAccountCanAct(customerUserId);
    const { id: bookingId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = normalizeCustomerOrganizationAction(body?.action);
    const requestId = String(body?.requestId || '').trim();
    if (!action) {
      return NextResponse.json({ error: 'Archive or Restore action is required.', code: 'INVALID_ORGANIZATION_ACTION' }, { status: 422 });
    }
    if (!requestId || requestId.length > 255) {
      return NextResponse.json({ error: 'A valid request ID is required.', code: 'INVALID_ORGANIZATION_REQUEST_ID' }, { status: 422 });
    }

    const result = await changeCustomerServiceRecordOrganization({
      db: prisma,
      bookingId,
      customerUserId,
      action,
      requestId,
    });
    return NextResponse.json({
      success: true,
      idempotent: result.idempotent,
      organization: action === 'ARCHIVE' ? 'ARCHIVED' : 'ACTIVE',
      eventId: result.event?.id || null,
      message: action === 'ARCHIVE'
        ? 'Service Record moved to Archived.'
        : 'Service Record restored to My Service Records.',
    });
  } catch (error) {
    if (error instanceof AccountStatusError) {
      return NextResponse.json(accountStatusErrorBody(error), { status: error.statusCode });
    }
    return errorResponse(error);
  }
}
