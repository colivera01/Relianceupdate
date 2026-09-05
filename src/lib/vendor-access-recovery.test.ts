import { describe, expect, it } from 'vitest';
import {
  isVendorManagerWorkflowPath,
  vendorManagerRecoveryCopy,
} from './vendor-access-recovery';

describe('Vendor Manager notification-link recovery', () => {
  it('recognizes exact job links without treating the general dashboard as a review link', () => {
    expect(isVendorManagerWorkflowPath('/vendor/jobs')).toBe(false);
    expect(isVendorManagerWorkflowPath('/vendor/jobs/job-1')).toBe(true);
    expect(isVendorManagerWorkflowPath('/vendor/dashboard')).toBe(false);
    expect(isVendorManagerWorkflowPath('/vendor/register')).toBe(false);
  });

  it('asks a signed-out visitor to sign in without offering registration', () => {
    expect(vendorManagerRecoveryCopy(false)).toEqual({
      heading: 'Sign in to review this package',
      description:
        'Sign in with an authorized Vendor Manager account. Reliance will return you to this exact Service Record after sign-in.',
      mode: 'sign-in',
    });
  });

  it('asks the wrong signed-in account to switch accounts', () => {
    const copy = vendorManagerRecoveryCopy(true);

    expect(copy.heading).toBe('Switch account to review this package');
    expect(copy.mode).toBe('switch-account');
    expect(JSON.stringify(copy)).not.toContain('Register as a vendor');
    expect(JSON.stringify(copy)).not.toContain('customer dashboard');
  });
});
