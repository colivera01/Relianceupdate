'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  User,
  Home,
  Heart,
  LogOut,
  LayoutDashboard,
  Star,
  Calendar,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// TODO Future mobile: convert this sidebar into a bottom nav or slide-out
// drawer for an app-like experience on small screens. For now the sidebar
// is hidden on `< md` so primary content takes the full viewport, and a
// future commit should introduce a responsive trigger + drawer.

type SidebarUser = { name: string; email: string; avatar: string | null };

const defaultUser: SidebarUser = {
  name: 'Cesar Olivera',
  email: 'colivera080124@gmail.com',
  avatar: null,
};

const navLinks = [
  { label: 'Home', icon: Home, href: '/user-dashboard' },
  { label: 'Discover', icon: LayoutDashboard, href: '/discover' },
  { label: 'My Services', icon: Calendar, href: '/my-bookings' },
  { label: 'Favorites', icon: Heart, href: '/favorites' },
  { label: 'Reviews', icon: Star, href: '/reviews' },
  { label: 'Messages', icon: MessageSquare, href: '/messages' },
  { label: 'Profile & Settings', icon: User, href: '/profile-settings' },
];

function displayNameFromStoredUser(parsed: Record<string, unknown>): string {
  if (typeof parsed.name === 'string' && parsed.name.trim()) return parsed.name.trim();
  const fn = typeof parsed.firstName === 'string' ? parsed.firstName : '';
  const ln = typeof parsed.lastName === 'string' ? parsed.lastName : '';
  const combined = `${fn} ${ln}`.trim();
  if (combined) return combined;
  if (typeof parsed.email === 'string' && parsed.email) return parsed.email;
  return defaultUser.name;
}

export default function UserSidebar() {
  const { user, isLoading } = useAuth();
  const pathname = usePathname() || '';
  const [currentUser, setCurrentUser] = React.useState<SidebarUser>(defaultUser);
  const isSignedIn = Boolean(user);

  React.useEffect(() => {
    if (user) {
      setCurrentUser({
        name: user.name || user.email || defaultUser.name,
        email: user.email || defaultUser.email,
        avatar: user.avatar || null,
      });
      return;
    }
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const parsed = JSON.parse(userData) as Record<string, unknown>;
        setCurrentUser({
          name: displayNameFromStoredUser(parsed),
          email: typeof parsed.email === 'string' ? parsed.email : defaultUser.email,
          avatar:
            (typeof parsed.avatar === 'string' && parsed.avatar) ||
            (typeof parsed.profilePhoto === 'string' && parsed.profilePhoto) ||
            null,
        });
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    } else if (!isLoading) {
      setCurrentUser(defaultUser);
    }
  }, [user, isLoading]);

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out?')) {
      window.location.href = '/logout';
    }
  };

  const initials = currentUser.name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  return (
    <aside className="hidden md:flex w-64 flex-col min-h-screen">
      {/* Logo area */}
      <div className="bg-white flex items-center px-6 py-8 border-b border-gray-200 justify-center">
        <img src="/reliance-logo.png" alt="Reliance Logo" className="w-32 h-32 rounded" />
      </div>

      {/* Navigation area */}
      <div className="flex-1 bg-blue-800 text-white flex flex-col py-8 px-4">
        {/* Identity block */}
        <div className="flex flex-col items-center mb-8 px-2">
          <div className="relative mb-4">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-16 h-16 rounded-full border-2 border-white/20 shadow-md object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full border-2 border-white/20 shadow-md bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                {initials}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
            </div>
          </div>
          <div className="text-center min-w-0 w-full">
            <div className="font-semibold text-lg mb-1 truncate">{currentUser.name}</div>
            <div className="text-blue-100 text-sm break-all">{currentUser.email}</div>
            {isSignedIn && (
              <div className="mt-2">
                <span className="px-2 py-1 bg-white/20 text-white text-xs rounded-full">
                  Customer
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-1">
          <div className="text-xs font-semibold text-blue-200 uppercase tracking-wider mb-4 px-3">
            Navigation
          </div>
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== '/' && pathname.startsWith(`${link.href}/`));
            return (
              <Link
                key={link.label}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-base font-medium transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white hover:bg-blue-700'
                }`}
              >
                <link.icon size={18} />
                <span className="flex-1 truncate">{link.label}</span>
              </Link>
            );
          })}

          <div className="mt-4 pt-4 border-t border-white/20">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-white hover:bg-blue-700 transition-colors text-base font-medium w-full text-left"
            >
              <LogOut size={18} />
              Log Out
            </button>
          </div>
        </nav>

        {/* Footer */}
        <div className="pt-4 mt-4 border-t border-white/20 text-center">
          <div className="text-xs text-blue-200">Reliance</div>
          <div className="text-xs text-blue-300">© 2024 All rights reserved</div>
        </div>
      </div>
    </aside>
  );
}
