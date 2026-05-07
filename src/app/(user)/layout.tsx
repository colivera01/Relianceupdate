'use client';
import { useMemo } from 'react';
import UserSidebar from '@/components/UserSidebar';
import ProfileToggle from '@/components/ProfileToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useAvailableRoles } from '@/hooks/useAvailableRoles';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userType = String(user?.userType || '').toLowerCase();
  const currentProfile = useMemo(() => {
    if (userType === 'vendor') return 'vendor' as const;
    if (userType === 'admin') return 'admin' as const;
    return 'customer' as const;
  }, [userType]);
  const { availableRoles, userId } = useAvailableRoles(currentProfile);

  // TODO Future mobile: when the sidebar is hidden below `md`, replace it
  // with a slide-out drawer or bottom-tab nav so the customer surface feels
  // app-like on phones. Today the main column simply takes the full viewport.
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-blue-100/20">
      <UserSidebar />
      <main className="flex-1 overflow-auto">
        <div className="w-full max-w-6xl px-4 sm:px-6 pt-10 pb-6">
          {availableRoles.length > 1 ? (
            <div className="mb-6 flex items-center justify-end">
              <ProfileToggle
                currentProfile={currentProfile}
                availableProfiles={availableRoles}
                userId={userId}
              />
            </div>
          ) : null}
          {children}
        </div>
      </main>
    </div>
  );
} 