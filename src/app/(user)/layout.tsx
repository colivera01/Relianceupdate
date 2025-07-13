'use client';
import UserSidebar from '@/src/components/UserSidebar';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <UserSidebar />
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
} 