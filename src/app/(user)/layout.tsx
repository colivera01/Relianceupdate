'use client';
import { useEffect, useState } from 'react';
import UserSidebar from '@/components/UserSidebar';
import ProfileToggle from '@/components/ProfileToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useAvailableRoles } from '@/hooks/useAvailableRoles';
import { getClientSessionHeaders } from '@/lib/client-session';
import { usePathname } from 'next/navigation';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [restrictedMessage, setRestrictedMessage] = useState<string | null>(null);
  const pathname = usePathname() || '';
  // The customer shell should identify itself as "customer" even when the
  // signed-in identity also has admin/vendor access. Role toggles should
  // reflect the current shell, not the highest-privilege account type.
  const currentProfile = 'customer' as const;
  const { availableRoles, userId } = useAvailableRoles(currentProfile);
  const isPublicServiceRoute = pathname.startsWith('/service/');

  useEffect(() => {
    let cancelled = false;
    async function checkCustomerStatus() {
      if (!user?.id || isPublicServiceRoute) {
        setRestrictedMessage(null);
        return;
      }
      try {
        const response = await fetch('/api/customer/profile', {
          method: 'GET',
          headers: getClientSessionHeaders(user.id),
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({}));
        if (!cancelled && response.status === 403 && payload?.code === 'USER_ACCOUNT_RESTRICTED') {
          setRestrictedMessage(
            String(payload?.message || payload?.error || 'Customer account restricted. Contact support for help.')
          );
        } else if (!cancelled) {
          setRestrictedMessage(null);
        }
      } catch {
        if (!cancelled) setRestrictedMessage(null);
      }
    }
    void checkCustomerStatus();
    return () => {
      cancelled = true;
    };
  }, [isPublicServiceRoute, user?.id]);

  if (isPublicServiceRoute) {
    return <>{children}</>;
  }

  const content = restrictedMessage ? (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
      <h1 className="text-2xl font-semibold text-amber-950">Account restricted</h1>
      <p className="mt-2 text-sm">{restrictedMessage}</p>
      <p className="mt-4 text-sm">Protected customer actions are unavailable until this account is active again.</p>
    </div>
  ) : (
    children
  );

  // TODO Future mobile: when the sidebar is hidden below `md`, replace it
  // with a slide-out drawer or bottom-tab nav so the customer surface feels
  // app-like on phones. Today the main column simply takes the full viewport.
  return (
    <div className="reliance-operator-shell reliance-grid-lines flex min-h-screen">
      <UserSidebar />
      <main className="reliance-operator-main flex-1 overflow-auto">
        <div className="w-full max-w-6xl px-4 pt-10 pb-6 sm:px-6">
          {availableRoles.length > 1 ? (
            <div className="mb-6 flex items-center justify-end">
              <ProfileToggle
                currentProfile={currentProfile}
                availableProfiles={availableRoles}
                userId={userId}
              />
            </div>
          ) : null}
          {content}
        </div>
      </main>
    </div>
  );
} 
