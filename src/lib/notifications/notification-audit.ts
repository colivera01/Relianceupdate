import { createAdminAuditLog } from '@/lib/admin-audit';

export type NotificationAuditPayload = {
  channel: 'email' | 'sms';
  recipient: string;
  success: boolean;
  providerMessageId?: string;
  fallbackLink: string;
  errorMessage?: string;
  errorCode?: string;
  /** e.g. consent_link | review_invitation */
  kind: string;
};

/**
 * Persists a low-risk audit row for outbound notification attempts (no message body).
 */
export async function logNotificationAttempt(
  actorUserId: string,
  entityId: string,
  payload: NotificationAuditPayload
): Promise<void> {
  try {
    await createAdminAuditLog({
      actionType: 'notification_attempt',
      entityType: 'notification',
      entityId,
      actorUserId,
      metadata: {
        kind: payload.kind,
        channel: payload.channel,
        recipient: redactRecipient(payload.recipient),
        success: payload.success,
        providerMessageId: payload.providerMessageId ?? null,
        fallbackLink: payload.fallbackLink,
        errorMessage: payload.errorMessage ?? null,
        errorCode: payload.errorCode ?? null,
      },
    });
  } catch (e) {
    console.error('[notification-audit] failed to persist audit row', e);
  }
}

function redactRecipient(value: string): string {
  if (value.includes('@')) return value.replace(/(^.).*(@.*$)/, '$1***$2');
  const d = value.replace(/\D/g, '');
  if (d.length < 6) return '***';
  return `${d.slice(0, 3)}***${d.slice(-2)}`;
}
