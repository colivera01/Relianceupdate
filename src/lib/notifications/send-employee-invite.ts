import { readNotificationEnv } from '@/lib/env/notification-config';
import { sendEmail } from '@/lib/email/resend';
import { sendSms } from '@/lib/sms/twilio';
import { logNotificationAttempt } from '@/lib/notifications/notification-audit';

export type EmployeeInviteNotificationInput = {
  inviteId: string;
  actorUserId: string;
  inviteLink: string;
  vendorName: string;
  inviteeName?: string | null;
  inviteeEmail?: string | null;
  inviteePhone?: string | null;
};

export type EmployeeInviteNotificationResult = {
  anySuccess: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  phoneNumberUsed: string | null;
  channels: Array<{
    channel: 'email' | 'sms';
    attempted: boolean;
    success: boolean;
    providerMessageId?: string;
    errorMessage?: string;
    errorCode?: string;
    trialRestriction?: boolean;
  }>;
};

function normalizeE164ish(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const t = phone.trim();
  if (!t) return null;
  if (t.startsWith('+')) return t;
  const digits = t.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

export async function sendEmployeeInviteNotification(
  input: EmployeeInviteNotificationInput
): Promise<EmployeeInviteNotificationResult> {
  const env = readNotificationEnv();
  const channels: EmployeeInviteNotificationResult['channels'] = [];
  const inviteeName = String(input.inviteeName || '').trim();
  const vendorName = String(input.vendorName || 'Reliance Vendor').trim();
  const email = String(input.inviteeEmail || '').trim();
  const phone = normalizeE164ish(input.inviteePhone);

  if (env.emailEnabled && email) {
    const subject = `You're invited to join ${vendorName} on Reliance`;
    const text = [
      `Hi${inviteeName ? ` ${inviteeName}` : ''},`,
      '',
      `${vendorName} has invited you to join their team on Reliance as an employee.`,
      '',
      'Reliance is used to manage jobs, track service progress, and capture service videos for completed work.',
      '',
      'Accept your invite:',
      `${input.inviteLink}`,
      '',
      'Or copy and paste this link into your browser:',
      `${input.inviteLink}`,
      '',
      'What happens next:',
      '- Create or confirm your account',
      '- Access your assigned jobs',
      '- Start completing and uploading service video stages',
      '',
      'This invite may expire, so we recommend accepting it as soon as possible.',
      '',
      "If you weren't expecting this, you can safely ignore this email.",
      '',
      '- Reliance Team',
    ].join('\n');
    const html = `
      <p>Hi${inviteeName ? ` ${inviteeName}` : ''},</p>
      <p>${vendorName} has invited you to join their team on Reliance as an employee.</p>
      <p>Reliance is used to manage jobs, track service progress, and capture service videos for completed work.</p>
      <p><strong>Accept your invite:</strong><br/><a href="${input.inviteLink}">${input.inviteLink}</a></p>
      <p>Or copy and paste this link into your browser:<br/><code>${input.inviteLink}</code></p>
      <p><strong>What happens next:</strong><br/>
      - Create or confirm your account<br/>
      - Access your assigned jobs<br/>
      - Start completing and uploading service video stages</p>
      <p>This invite may expire, so we recommend accepting it as soon as possible.</p>
      <p>If you were not expecting this, you can safely ignore this email.</p>
      <p>- Reliance Team</p>
    `.trim();
    const r = await sendEmail({ to: email, subject, text, html });
    channels.push({
      channel: 'email',
      attempted: true,
      success: r.ok,
      providerMessageId: r.providerMessageId,
      errorMessage: r.errorMessage,
    });
    await logNotificationAttempt(input.actorUserId, input.inviteId, {
      kind: 'employee_invite',
      channel: 'email',
      recipient: email,
      success: r.ok,
      providerMessageId: r.providerMessageId,
      fallbackLink: input.inviteLink,
      errorMessage: r.errorMessage,
    });
  } else {
    channels.push({
      channel: 'email',
      attempted: false,
      success: false,
      errorMessage: !email ? 'no_invitee_email' : 'email_disabled',
    });
  }

  if (env.smsEnabled && phone) {
    const body = `${vendorName} via Reliance: employee invite to join their team. Accept here: ${input.inviteLink} Reply STOP to opt out.`;
    const r = await sendSms({ to: phone, body });
    channels.push({
      channel: 'sms',
      attempted: true,
      success: r.ok,
      providerMessageId: r.providerMessageId,
      errorMessage: r.errorMessage,
      errorCode: r.errorCode,
      trialRestriction: r.trialRestriction,
    });
    await logNotificationAttempt(input.actorUserId, input.inviteId, {
      kind: 'employee_invite',
      channel: 'sms',
      recipient: phone,
      success: r.ok,
      providerMessageId: r.providerMessageId,
      fallbackLink: input.inviteLink,
      errorMessage: r.errorMessage,
      errorCode: r.errorCode,
    });
  } else {
    channels.push({
      channel: 'sms',
      attempted: false,
      success: false,
      errorMessage: !phone ? 'no_invitee_phone' : 'sms_disabled',
    });
  }

  return {
    anySuccess: channels.some((c) => c.attempted && c.success),
    smsEnabled: env.smsEnabled,
    emailEnabled: env.emailEnabled,
    phoneNumberUsed: phone,
    channels,
  };
}
