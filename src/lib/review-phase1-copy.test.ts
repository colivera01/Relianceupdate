import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const activeReviewFiles = [
  'src/app/(user)/my-bookings/[bookingId]/page.tsx',
  'src/app/(user)/reviews/page.tsx',
  'src/app/admin/review-audit/page.tsx',
  'src/app/api/reviews/window/start/route.ts',
  'src/app/api/reviews/window/expire/route.ts',
  'src/app/reviews/ReviewCard.tsx',
  'src/components/reviews/ExitIntentPrompt.tsx',
  'src/components/reviews/SmartVideoPlayer.tsx',
  'src/lib/notifications/send-review-invitation.ts',
];

const obsoleteReviewCopy = [
  /72[ -]?hours?/i,
  /review (?:window )?expires?/i,
  /review countdown/i,
  /automatic(?:ally)? (?:review|rating)/i,
  /auto (?:review|rating)/i,
  /five[- ]star automatically/i,
  /reopened (?:review )?window/i,
];

describe('Phase 1 optional review copy', () => {
  it.each(activeReviewFiles)('%s contains no deadline or automatic-outcome wording', (relativePath) => {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

    for (const forbiddenPattern of obsoleteReviewCopy) {
      expect(source).not.toMatch(forbiddenPattern);
    }
  });

  it('does not retain deadline-reminder or expiration-notice notification modules', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'src/lib/notifications/send-review-reminder.ts'))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'src/lib/notifications/send-review-expired.ts'))).toBe(false);
  });
});
