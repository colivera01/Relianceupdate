import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('customer support contact contract', () => {
  const customerSupportPage = source('src/app/(user)/customer/support/page.tsx');
  const publicHelpPage = source('src/app/help/page.tsx');
  const smsPolicyPage = source('src/app/sms-policy/page.tsx');
  const forgotPasswordPage = source('src/app/auth/forgot-password/page.tsx');
  const publicFooter = source('src/components/public/PublicSiteFooter.tsx');
  const reportDialog = source('src/components/reports/ReportContentDialog.tsx');

  it('uses the canonical support resolver across current customer-facing surfaces', () => {
    for (const currentSurface of [
      customerSupportPage,
      publicHelpPage,
      smsPolicyPage,
      forgotPasswordPage,
      publicFooter,
      reportDialog,
    ]) {
      expect(currentSurface).toContain("@/lib/support");
    }
  });

  it('keeps durable video reporting separate from general email support', () => {
    expect(customerSupportPage).toContain('use Report a problem with this video');
    expect(customerSupportPage).toContain('If reporting itself is unavailable');
    expect(reportDialog).toContain('/api/reports/content');
    expect(reportDialog).toContain('LAUNCH_SUPPORT_EMAIL');
  });

  it('removes obsolete playback-consent and Final Result-only review guidance', () => {
    const currentCustomerGuidance = [
      source('src/app/(user)/my-bookings/page.tsx'),
      source('src/app/(user)/reviews/page.tsx'),
      source('src/app/(user)/user-dashboard/page.tsx'),
      source('src/lib/customer-reviews.ts'),
      source('src/lib/review-window-lifecycle.ts'),
      source('src/lib/reviews-hub-state.ts'),
      source('src/lib/user-guidance.ts'),
    ].join('\n');

    expect(currentCustomerGuidance).not.toMatch(/Approve video access|confirm consent before playback/i);
    expect(currentCustomerGuidance).not.toMatch(/customer-visible approved final-result video/i);
    expect(currentCustomerGuidance).not.toContain('Private team performance');
  });
});
