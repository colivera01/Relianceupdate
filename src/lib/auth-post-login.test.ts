import { describe, expect, it, vi } from 'vitest';
import { completeLoginWithFreshServerNavigation } from './auth-post-login';

describe('post-login server navigation', () => {
  it('uses a full document replacement so protected server boundaries are reevaluated', () => {
    const replace = vi.fn();

    completeLoginWithFreshServerNavigation('/vendor/jobs/job-1?tab=video', { replace });

    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith('/vendor/jobs/job-1?tab=video');
  });
});
