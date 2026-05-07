'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown, LogOut, User as UserIcon, Bell } from 'lucide-react';
import ProfileToggle from '@/components/ProfileToggle';
import { useAvailableRoles } from '@/hooks/useAvailableRoles';
import { useAuth } from '@/contexts/AuthContext';

type AdminNavItem = {
  href: string;
  label: string;
  icon: string;
};

const adminNav: AdminNavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/admin/users', label: 'User Management', icon: '👥' },
  { href: '/admin/vendors', label: 'Vendor Management', icon: '🏢' },
  { href: '/admin/publish-management', label: 'Publish Management', icon: '📢' },
  { href: '/admin/media-moderation', label: 'Media Moderation', icon: '🎬' },
  { href: '/admin/reviews', label: 'Review Moderation', icon: '⭐' },
  { href: '/admin/activity', label: 'Activity Monitoring', icon: '📈' },
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: '📋' },
  { href: '/admin/reports', label: 'Reports & Analytics', icon: '📑' },
];

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { availableRoles, userId } = useAvailableRoles('admin');
  const { user } = useAuth();
  const pathname = usePathname() || '';
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const adminName = (user?.name || '').trim() || user?.email || 'Admin';
  const adminEmail = user?.email || '';
  const adminInitials = adminName
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'A';
  const adminAvatar = user?.avatar || null;
  const isAdminRoleReal = availableRoles.includes('admin');

  // Close dropdown when clicking outside or pressing Escape.
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  const handleSignOut = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/logout';
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar — width and structure aligned with vendor sidebar (w-64,
          white logo header + nav area). Bottom identity block intentionally
          removed; identity now lives only in the top-right header. */}
      <aside className="w-64 flex flex-col min-h-screen bg-white border-r border-gray-200">
        {/* Logo area */}
        <div className="flex items-center px-6 py-8 border-b border-gray-200 justify-center">
          <img src="/reliance-logo.png" alt="Reliance Logo" className="w-32 h-32 rounded" />
        </div>

        {/* Nav area */}
        <nav className="flex-1 flex flex-col gap-1 px-4 py-6">
          {adminNav.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-base font-medium transition-colors ${
                  isActive
                    ? 'bg-[#204080] text-white'
                    : 'text-[#204080] hover:bg-[#e6f0fa]'
                }`}
              >
                <span className="text-xl leading-none">{item.icon}</span>
                <span className="flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 pb-4 text-xs text-gray-400">Reliance © 2023</div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="w-full max-w-6xl px-6 pt-10 pb-6">
          {/* Top header — role toggle (primary action, center-right) +
              account chip (secondary, flush-right). The chip is intentionally
              lighter than the toggle so the role switch reads as the
              dominant control. */}
          <div className="mb-6 flex items-center justify-end gap-4">
            {availableRoles.length > 1 ? (
              <ProfileToggle
                currentProfile="admin"
                availableProfiles={availableRoles}
                userId={userId}
              />
            ) : null}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
                onClick={() => setDropdownOpen((open) => !open)}
                className="group flex items-center gap-2 h-9 pl-1 pr-2.5 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                {adminAvatar ? (
                  <img
                    src={adminAvatar}
                    alt=""
                    aria-hidden
                    className="w-7 h-7 rounded-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="w-7 h-7 rounded-full bg-[#e6f0fa] flex items-center justify-center text-[11px] font-semibold text-[#204080]"
                  >
                    {adminInitials}
                  </span>
                )}
                <span className="hidden sm:inline max-w-[120px] truncate text-sm font-medium">
                  {adminName}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-500 transition-transform ${
                    dropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Account dropdown — compact, future-ready. */}
              {dropdownOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg ring-1 ring-black/5 z-20 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      {adminAvatar ? (
                        <img
                          src={adminAvatar}
                          alt=""
                          aria-hidden
                          className="w-9 h-9 rounded-full object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden
                          className="w-9 h-9 rounded-full bg-[#e6f0fa] flex items-center justify-center text-sm font-semibold text-[#204080]"
                        >
                          {adminInitials}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900 truncate">
                            {adminName}
                          </span>
                          {isAdminRoleReal && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded bg-[#e6f0fa] text-[#204080]">
                              Admin
                            </span>
                          )}
                        </div>
                        {adminEmail && (
                          <div className="text-xs text-gray-500 truncate">
                            {adminEmail}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="py-1">
                    {/* Future routes — disabled placeholders for now. */}
                    <button
                      type="button"
                      role="menuitem"
                      disabled
                      className="w-full flex items-center justify-between gap-3 px-4 py-2 text-sm text-gray-400 cursor-not-allowed"
                    >
                      <span className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4" />
                        My Account
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">
                        Soon
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled
                      className="w-full flex items-center justify-between gap-3 px-4 py-2 text-sm text-gray-400 cursor-not-allowed"
                    >
                      <span className="flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        Notifications
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">
                        Soon
                      </span>
                    </button>
                  </div>

                  <div className="border-t border-gray-100 py-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDropdownOpen(false);
                        handleSignOut();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
