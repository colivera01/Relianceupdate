import crypto from 'crypto';

export const CONSENT_TYPES = new Set([
  'video_access',
  'electronic_records',
  'communications_email',
  'communications_sms',
  'review_flow_acknowledgment',
]);

export const CONSENT_STATUSES = new Set(['requested', 'accepted', 'declined', 'expired', 'revoked']);

export const CURRENT_TERMS_VERSION = 'terms-2026-07';
export const CURRENT_PRIVACY_VERSION = 'privacy-2026-07';

export function generateConsentToken() {
  return crypto.randomBytes(24).toString('hex');
}

export function hashConsentDocument(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}
