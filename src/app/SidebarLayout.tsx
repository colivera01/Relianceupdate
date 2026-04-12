'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';
import { Briefcase } from 'lucide-react';

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();

  // Placeholder sign-out function
  const handleSignOut = () => {
    // TODO: Connect to backend sign-out logic
    // For now, just redirect to login page
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white text-[#204080] flex flex-col border-r border-gray-200">
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <div className="p-8 flex items-center justify-center">
              <Image 
                src="/reliance-logo.png" 
                alt="Reliance Logo" 
                width={120} 
                height={60} 
                priority 
                className="drop-shadow-none"
              />
            </div>
            <nav className="flex flex-col gap-2 px-4">
              <SidebarLink href="/admin/dashboard" label="Dashboard" icon="📊" />
              <SidebarLink href="/admin/users" label="User Management" icon="👥" />
              <SidebarLink href="/admin/vendors" label="Vendor Management" icon="🏢" />
              <SidebarLink href="/admin/publish-management" label="Publish Management" icon="📢" />
              <SidebarLink href="/admin/media-moderation" label="Media Moderation" icon="🎬" />
              <SidebarLink href="/admin/reviews" label="Review Moderation" icon="⭐" />
              <SidebarLink href="/admin/activity" label="Activity Monitoring" icon="📈" />
              <SidebarLink href="/admin/audit-logs" label="Audit Logs" icon="📋" />
              <SidebarLink href="/admin/reports" label="Reports & Analytics" icon="📑" />
              {/* Toggle buttons below Reports & Analytics */}
              <div className="flex flex-col gap-2 mt-4">
                <button
                  className="flex items-center gap-2 border border-blue-700 text-blue-700 px-3 py-2 rounded hover:bg-blue-50 transition-colors font-medium"
                  onClick={() => router.push('/vendor/dashboard')}
                >
                  <Briefcase className="w-4 h-4" />
                  Switch to Vendor View
                </button>
                <button
                  className="flex items-center gap-2 border border-green-700 text-green-700 px-3 py-2 rounded hover:bg-green-50 transition-colors font-medium"
                  onClick={() => router.push('/user-dashboard')}
                >
                  <span className="w-4 h-4 inline-block">👤</span>
                  Switch to User View
                </button>
              </div>
            </nav>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-lg font-bold text-[#204080]">N</div>
              <div>
                <div className="font-semibold">Admin User</div>
                <div className="text-xs text-gray-400">admin</div>
              </div>
            </div>
          </div>
          <div className="px-4 pb-2 text-xs text-gray-400">Reliance © 2023</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1">
        <div className="flex justify-end items-center mb-8">
          <div className="relative">
            <button
              className="flex items-center gap-2 bg-gray-200 px-4 py-2 rounded-full"
              onClick={() => setDropdownOpen((open) => !open)}
            >
              <span className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center text-lg font-bold text-[#232946]">AU</span>
              <span>Admin User</span>
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
            </button>
            {/* Dropdown */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded shadow-lg z-10">
                <div className="px-4 py-2 text-gray-800 font-semibold">Admin User</div>
                <div className="px-4 py-2 text-gray-500 text-sm">admin@reliance.com</div>
                <hr />
                <Link href="/profile" className="block px-4 py-2 hover:bg-gray-100" onClick={() => setDropdownOpen(false)}>
                  Your Profile
                </Link>
                <Link href="/settings" className="block px-4 py-2 hover:bg-gray-100" onClick={() => setDropdownOpen(false)}>
                  Settings
                </Link>
                <button
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  onClick={() => {
                    setDropdownOpen(false);
                    handleSignOut();
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

function SidebarLink({ href, label, icon, badge }: any) {
  return (
    <Link href={href} className={`flex items-center gap-3 px-3 py-2 rounded hover:bg-[#e6f0fa] hover:text-[#204080] transition-colors`}>
      <span className="text-xl">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">{badge}</span>
      )}
    </Link>
  );
}
