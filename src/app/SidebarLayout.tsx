'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Bell,
  ChevronDown,
  Clapperboard,
  ClipboardList,
  Home,
  KeyRound,
  LogOut,
  MapPinned,
  Megaphone,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  User as UserIcon,
  Users,
  type LucideIcon,
} from 'lucide-react';
import ProfileToggle from '@/components/ProfileToggle';
import { useAvailableRoles } from '@/hooks/useAvailableRoles';
import { useAuth } from '@/contexts/AuthContext';
import { RelianceLogo } from '@/components/public/RelianceLogo';

type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  iconClassName: string;
};

const adminNav: AdminNavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: Home, iconClassName: 'text-blue-200' },
  { href: '/admin/accounts', label: 'All Accounts', icon: Users, iconClassName: 'text-emerald-200' },
  { href: '/admin/publish-management', label: 'Publish Management', icon: Megaphone, iconClassName: 'text-sky-200' },
  { href: '/admin/promoted-listings', label: 'Featured Proof', icon: MapPinned, iconClassName: 'text-orange-200' },
  { href: '/admin/media-moderation', label: 'Media Moderation', icon: Clapperboard, iconClassName: 'text-cyan-200' },
  { href: '/admin/reviews', label: 'Review Moderation', icon: Star, iconClassName: 'text-amber-200' },
  { href: '/admin/review-audit', label: 'Review Audit', icon: Search, iconClassName: 'text-yellow-200' },
  { href: '/admin/reported-content', label: 'Reported Content', icon: ShieldAlert, iconClassName: 'text-rose-200' },
  { href: '/admin/ai-review-queue', label: 'AI Review Queue', icon: Sparkles, iconClassName: 'text-violet-200' },
  { href: '/admin/reports', label: 'Reports & Analytics', icon: BarChart3, iconClassName: 'text-teal-200' },
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: ClipboardList, iconClassName: 'text-slate-200' },
  { href: '/admin/permission-audit', label: 'Permission Audit', icon: ShieldCheck, iconClassName: 'text-cyan-200' },
  { href: '/admin/activity', label: 'Activity Monitoring', icon: Activity, iconClassName: 'text-lime-200' },
  { href: '/admin/security', label: 'Admin Security', icon: KeyRound, iconClassName: 'text-red-200' },
  { href: '/admin/settings', label: 'Admin Settings', icon: Settings, iconClassName: 'text-indigo-200' },
];

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { availableRoles, userId } = useAvailableRoles('admin');
  const { user, logout } = useAuth();
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
    void logout();
  };
  const mobileAdminNav = [
    adminNav[0],
    adminNav[1],
    adminNav[2],
    adminNav[4],
    adminNav[8],
  ];

  return (
    <div className="reliance-operator-shell reliance-grid-lines flex min-h-screen">
      <aside className="reliance-operator-sidebar hidden w-72 min-h-screen flex-col md:flex">
        <div className="reliance-operator-sidebar-header flex items-center justify-center px-6 py-7">
          <RelianceLogo
            tone="light"
            blend
            compact
            className="justify-center"
            frameClassName="h-16 w-16"
          />
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-4 py-6">
          {adminNav.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`reliance-operator-nav-link flex items-center gap-3 rounded-2xl px-3 py-2.5 text-base font-medium transition-colors ${
                  isActive ? 'reliance-operator-nav-link-active' : ''
                }`}
              >
                <item.icon className={`h-5 w-5 shrink-0 ${item.iconClassName}`} />
                <span className="flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 pb-4 text-center text-xs text-white/42">
          Reliance Copyright 2026
        </div>
      </aside>

      <main className="reliance-operator-main min-w-0 flex-1 overflow-auto">
        <div className="w-full max-w-6xl px-4 pt-6 pb-28 sm:px-6 sm:pt-10 md:pb-6">
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
                className="group flex h-10 items-center gap-2 rounded-full border border-white/12 bg-white/6 pl-1 pr-2.5 text-white/84 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white"
              >
                {adminAvatar ? (
                  <img
                    src={adminAvatar}
                    alt=""
                    aria-hidden
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(36,107,255,0.22)] text-[11px] font-semibold text-white"
                  >
                    {adminInitials}
                  </span>
                )}
                <span className="hidden max-w-[120px] truncate text-sm font-medium sm:inline">
                  {adminName}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-white/54 transition-transform ${
                    dropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {dropdownOpen ? (
                <div
                  role="menu"
                  className="reliance-operator-surface absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl"
                >
                  <div className="border-b border-white/8 px-4 py-3">
                    <div className="flex items-center gap-3">
                      {adminAvatar ? (
                        <img
                          src={adminAvatar}
                          alt=""
                          aria-hidden
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(36,107,255,0.2)] text-sm font-semibold text-white"
                        >
                          {adminInitials}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-white">
                            {adminName}
                          </span>
                          {isAdminRoleReal ? (
                            <span className="rounded-full bg-[rgba(36,107,255,0.16)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--reliance-blue-soft)]">
                              Admin
                            </span>
                          ) : null}
                        </div>
                        {adminEmail ? (
                          <div className="truncate text-xs text-white/62">
                            {adminEmail}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      role="menuitem"
                      disabled
                      className="flex w-full cursor-not-allowed items-center justify-between gap-3 px-4 py-2 text-sm text-white/40"
                    >
                      <span className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4" />
                        My Account
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-white/34">
                        Soon
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled
                      className="flex w-full cursor-not-allowed items-center justify-between gap-3 px-4 py-2 text-sm text-white/40"
                    >
                      <span className="flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        Notifications
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-white/34">
                        Soon
                      </span>
                    </button>
                  </div>

                  <div className="border-t border-white/8 py-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDropdownOpen(false);
                        handleSignOut();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-white/82 hover:bg-white/6"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          {children}
        </div>
      </main>
      <nav
        aria-label="Admin mobile navigation"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#050a13]/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-18px_45px_rgba(2,6,14,0.42)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {mobileAdminNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-semibold leading-tight transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-[0_10px_28px_rgba(36,107,255,0.32)]'
                    : 'text-blue-100/72 hover:bg-white/8 hover:text-white'
                }`}
              >
                <item.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-white' : item.iconClassName}`} />
                <span className="max-w-full truncate">
                  {item.label.replace('Publish Management', 'Publish').replace('Media Moderation', 'Media').replace('AI Review Queue', 'AI Queue')}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
