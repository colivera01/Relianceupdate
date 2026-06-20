import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/resend';
import { sendSms } from '@/lib/sms/twilio';
import { logNotificationEnvWarnings } from '@/lib/env/notification-config';

/**
 * Dev-only: verify Resend + configured SMS provider wiring with explicit targets.
 * POST JSON: { "email"?: string, "phone"?: string }
 * Header: x-notifications-test-secret must match NOTIFICATIONS_TEST_SECRET.
 */
export async function POST(request: NextRequest) {
  logNotificationEnvWarnings();
  const expectedHeaderName = 'x-notifications-test-secret';

  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Not available in production' }, { status: 404 });
  }

  const expected = (process.env.NOTIFICATIONS_TEST_SECRET || '').trim();
  const providedRaw = request.headers.get(expectedHeaderName);
  const provided = String(providedRaw || '').trim();
  if (!expected) {
    return NextResponse.json(
      {
        success: false,
        error: 'Set NOTIFICATIONS_TEST_SECRET in .env.local to enable this route.',
      },
      { status: 503 }
    );
  }

  if (provided !== expected) {
    return NextResponse.json({ success: false, error: 'Invalid or missing x-notifications-test-secret' }, { status: 401 });
  }

  let body: { email?: string; phone?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const email = String(body.email || '').trim();
  const phone = String(body.phone || '').trim();

  if (!email && !phone) {
    return NextResponse.json(
      { success: false, error: 'Provide at least one of email or phone in JSON body' },
      { status: 400 }
    );
  }

  const results: Record<string, unknown> = {};

  if (email) {
    results.email = await sendEmail({
      to: email,
      subject: 'Reliance notification test',
      text: 'This is a Reliance dev-only test email from /api/dev/notifications-test.',
      html: '<p>This is a Reliance dev-only test email from <code>/api/dev/notifications-test</code>.</p>',
    });
  }

  if (phone) {
    results.sms = await sendSms({
      to: phone,
      body: 'Reliance dev test SMS from /api/dev/notifications-test',
    });
  }

  return NextResponse.json({ success: true, results });
}
