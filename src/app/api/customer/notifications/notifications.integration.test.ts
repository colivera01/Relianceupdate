import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthorizationError, requireRequestActor } from '@/lib/request-actor';
import {
  listCustomerNotificationHistory,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
} from '@/lib/customer-notifications';
import { GET, POST as POST_ALL } from './route';
import { POST as POST_ONE } from './[notificationId]/read/route';

vi.mock('@/server/db', () => ({ prisma: {} }));
vi.mock('@/lib/request-actor', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/request-actor')>();
  return { ...original, requireRequestActor: vi.fn() };
});
vi.mock('@/lib/customer-notifications', () => ({
  listCustomerNotificationHistory: vi.fn(),
  markAllCustomerNotificationsRead: vi.fn(),
  markCustomerNotificationRead: vi.fn(),
}));

describe('customer notification routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRequestActor).mockResolvedValue({ userId: 'customer-1' } as any);
    vi.mocked(listCustomerNotificationHistory).mockResolvedValue({
      notifications: [],
      totalCount: 0,
      unreadCount: 0,
      shownCount: 0,
      shownUnreadCount: 0,
      limit: 100,
    });
    vi.mocked(markAllCustomerNotificationsRead).mockResolvedValue({ changed: 0, readAt: new Date('2026-11-03T12:00:00Z') });
    vi.mocked(markCustomerNotificationRead).mockResolvedValue({ found: true, changed: true, readAt: new Date() });
  });

  it('loads history only for the authenticated actor', async () => {
    const request = new Request('http://localhost/api/customer/notifications');
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(listCustomerNotificationHistory).toHaveBeenCalledWith(expect.anything(), {
      userId: 'customer-1',
      limit: 100,
    });
  });

  it('returns a clean unauthenticated denial', async () => {
    vi.mocked(requireRequestActor).mockRejectedValue(new AuthorizationError('UNAUTHENTICATED', 'Sign in required.', 401));
    const response = await GET(new Request('http://localhost/api/customer/notifications'));
    expect(response.status).toBe(401);
    expect(listCustomerNotificationHistory).not.toHaveBeenCalled();
  });

  it('marks all notifications read for only the authenticated actor', async () => {
    const response = await POST_ALL(new Request('http://localhost/api/customer/notifications', {
      method: 'POST',
      body: JSON.stringify({ action: 'MARK_ALL_READ' }),
    }));
    expect(response.status).toBe(200);
    expect(markAllCustomerNotificationsRead).toHaveBeenCalledWith(expect.anything(), { userId: 'customer-1' });
  });

  it('rejects unknown collection actions', async () => {
    const response = await POST_ALL(new Request('http://localhost/api/customer/notifications', {
      method: 'POST',
      body: JSON.stringify({ action: 'DELETE_ALL' }),
    }));
    expect(response.status).toBe(422);
    expect(markAllCustomerNotificationsRead).not.toHaveBeenCalled();
  });

  it('marks one notification read inside the authenticated actor boundary', async () => {
    const response = await POST_ONE(
      new Request('http://localhost/api/customer/notifications/notice-1/read', { method: 'POST' }),
      { params: Promise.resolve({ notificationId: 'notice-1' }) },
    );
    expect(response.status).toBe(200);
    expect(markCustomerNotificationRead).toHaveBeenCalledWith(expect.anything(), {
      userId: 'customer-1',
      notificationId: 'notice-1',
    });
  });

  it('does not expose a notification outside the actor boundary', async () => {
    vi.mocked(markCustomerNotificationRead).mockResolvedValue({ found: false, changed: false });
    const response = await POST_ONE(
      new Request('http://localhost/api/customer/notifications/other/read', { method: 'POST' }),
      { params: Promise.resolve({ notificationId: 'other' }) },
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'NOTIFICATION_NOT_FOUND' });
  });
});
