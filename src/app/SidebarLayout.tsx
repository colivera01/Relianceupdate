'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
      <aside className="w-64 bg-[#232946] text-white flex flex-col justify-between">
        <div>
          <div className="p-6 text-2xl font-bold tracking-wide">Reliance</div>
          <nav className="flex flex-col gap-2 px-4">
            <SidebarLink href="/" label="Dashboard" icon="📊" />
            <SidebarLink href="/users" label="User Management" icon="👥" />
            <SidebarLink href="/vendors" label="Vendor Management" icon="🏢" />
            <SidebarLink href="/reviews" label="Review Management" icon="⭐" badge="23" />
            <SidebarLink href="/activity" label="Activity Monitoring" icon="📈" />
            <SidebarLink href="/audit-logs" label="Audit Logs" icon="📋" />
            <SidebarLink href="/reports" label="Reports & Analytics" icon="📑" />
          </nav>
        </div>
        <div className="p-4 flex items-center gap-3 border-t border-[#2a2d3e]">
          <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-lg font-bold text-[#232946]">N</div>
          <div>
            <div className="font-semibold">Admin User</div>
            <div className="text-xs text-gray-300">admin</div>
          </div>
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
    <Link href={href} className={`flex items-center gap-3 px-3 py-2 rounded hover:bg-[#2a2d3e]`}>
      <span className="text-xl">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">{badge}</span>
      )}
    </Link>
  );
}
