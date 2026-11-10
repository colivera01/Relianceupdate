import { describe, expect, it, vi } from 'vitest';

import {
  isCustomerFacingNotificationKind,
  listCustomerNotificationHistory,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
  shapeCustomerNotification,
} from './customer-notifications';

describe('customer notification history', () => {
  it('allows only clearly customer-facing notification kinds', () => {
    expect(isCustomerFacingNotificationKind('SERVICE_REQUEST_ACCEPTED_CUSTOMER_V1:key:customer')).toBe(true);
    expect(isCustomerFacingNotificationKind('PRIVATE_PROOF_READY_ADMIN_AUDIT_V1')).toBe(true);
    expect(isCustomerFacingNotificationKind('CUSTOMER_PERMISSION_REQUEST:consent-1')).toBe(true);
    expect(isCustomerFacingNotificationKind('CUSTOMER_CONSENT_REQUEST')).toBe(true);
    expect(isCustomerFacingNotificationKind('CUSTOMER_PERMISSION_REQUEST')).toBe(true);
    expect(isCustomerFacingNotificationKind('CUSTOMER_RECORDING_NOTICE')).toBe(true);
    expect(isCustomerFacingNotificationKind('SERVICE_REQUEST_NEW_REQUEST_VENDOR_V1:key:manager')).toBe(false);
    expect(isCustomerFacingNotificationKind('CUSTOMER_PERMISSION_OTP:challenge-1')).toBe(false);
    expect(isCustomerFacingNotificationKind('ADMIN_AUDIT_READY')).toBe(false);
  });

  it('does not fail the response when a stored delivery date is invalid', () => {
    const item = shapeCustomerNotification({
      id: 'notice-invalid-date',
      bookingId: 'booking-1',
      kind: 'CUSTOMER_RECORDING_NOTICE',
      createdAt: 'not-a-date',
      customerReadAt: 'also-not-a-date',
      booking: { service: { name: 'Outlet Installation' }, vendor: { businessName: 'Electro LLC' } },
    });
    expect(item.createdAt).toBe('');
    expect(item.readAt).toBeNull();
    expect(item.read).toBe(false);
    expect(item.title).toBe('Service Video recording notice');
  });

  it('returns customer-safe copy without provider or destination metadata', () => {
    const item = shapeCustomerNotification({
      id: 'notice-1',
      bookingId: 'booking-1',
      kind: 'SERVICE_REQUEST_ACCEPTED_CUSTOMER_V1:key:customer-1',
      createdAt: new Date('2026-11-03T12:00:00Z'),
      customerReadAt: null,
      channelsJson: JSON.stringify({
        payload: {
          subject: 'Electro LLC accepted your service request',
          bodyText: 'Your appointment is scheduled.',
          recipient: { email: 'private@example.com', phone: '+14070000000' },
        },
        delivery: [{ providerMessageId: 'provider-secret', errorMessage: 'internal-error' }],
      }),
      booking: {
        title: 'Outlet Installation',
        service: { name: 'Outlet Installation' },
        vendor: { name: 'Electro LLC', businessName: 'Electro LLC' },
      },
    });

    expect(item).toMatchObject({
      id: 'notice-1',
      serviceOrderId: 'booking-1',
      title: 'Electro LLC accepted your service request',
      message: 'Your appointment is scheduled.',
      read: false,
      href: '/my-bookings/booking-1',
    });
    const serialized = JSON.stringify(item);
    expect(serialized).not.toContain('private@example.com');
    expect(serialized).not.toContain('provider-secret');
    expect(serialized).not.toContain('internal-error');
  });

  it('keeps delegated recording permission copy neutral and sends decisions to the secure recipient link', () => {
    const item = shapeCustomerNotification({
      id: 'notice-2',
      bookingId: 'booking-2',
      kind: 'CUSTOMER_PERMISSION_REQUEST:consent-2',
      createdAt: new Date('2026-11-03T12:00:00Z'),
      customerReadAt: null,
      booking: {
        title: 'Outlet Installation',
        service: { name: 'Outlet Installation' },
        vendor: { businessName: 'Electro LLC' },
      },
    });
    expect(item.title).toBe('Recording permission required');
    expect(item.message).toContain('The authorized recipient must use the secure link sent directly to them.');
    expect(item.message).toContain('Service Record shows the current permission status.');
    expect(item.message).not.toMatch(/your recording decision/i);
  });

  it('scopes list and unread totals through the signed-in booking owner', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValueOnce(12).mockResolvedValueOnce(2);
    const result = await listCustomerNotificationHistory({ bookingNotification: { findMany, count } }, {
      userId: 'customer-1',
      limit: 500,
    });

    expect(result).toEqual({
      notifications: [],
      totalCount: 12,
      unreadCount: 2,
      shownCount: 0,
      shownUnreadCount: 0,
      limit: 100,
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 100,
      where: expect.objectContaining({ booking: { userId: 'customer-1' } }),
    }));
    expect(count).toHaveBeenNthCalledWith(1, {
      where: expect.objectContaining({ booking: { userId: 'customer-1' } }),
    });
    expect(count).toHaveBeenNthCalledWith(2, {
      where: expect.objectContaining({ booking: { userId: 'customer-1' }, customerReadAt: null }),
    });
  });

  it('marks only an owned customer-facing notification read', async () => {
    const findFirst = vi.fn();
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const result = await markCustomerNotificationRead({ bookingNotification: { findFirst, updateMany } }, {
      userId: 'customer-1',
      notificationId: 'notice-1',
    });

    expect(result).toMatchObject({ found: true, changed: true });
    expect(updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'notice-1',
        booking: { userId: 'customer-1' },
        customerReadAt: null,
      }),
      data: { customerReadAt: expect.any(Date) },
    });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('does not reveal whether another customer owns an unavailable notification', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const result = await markCustomerNotificationRead({
      bookingNotification: { findFirst: vi.fn().mockResolvedValue(null), updateMany },
    }, { userId: 'customer-1', notificationId: 'other-customer-notice' });
    expect(result).toEqual({ found: false, changed: false });
    expect(updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'other-customer-notice',
        booking: { userId: 'customer-1' },
        customerReadAt: null,
      }),
      data: { customerReadAt: expect.any(Date) },
    });
  });

  it('returns the existing server timestamp when a notification is already read', async () => {
    const readAt = new Date('2026-11-03T12:00:00Z');
    const result = await markCustomerNotificationRead({
      bookingNotification: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue({ id: 'notice-1', customerReadAt: readAt }),
      },
    }, { userId: 'customer-1', notificationId: 'notice-1' });
    expect(result).toEqual({ found: true, changed: false, readAt });
  });

  it('marks all read only inside the signed-in customer boundary', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 3 });
    await expect(markAllCustomerNotificationsRead({ bookingNotification: { updateMany } }, {
      userId: 'customer-1',
    })).resolves.toEqual({ changed: 3, readAt: expect.any(Date) });
    expect(updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ booking: { userId: 'customer-1' }, customerReadAt: null }),
      data: { customerReadAt: expect.any(Date) },
    });
  });
});
