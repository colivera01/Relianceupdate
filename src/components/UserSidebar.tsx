'use client';
import React from 'react';
import Link from 'next/link';
import { User, Home, Heart, Settings, LogOut, Users, Briefcase, LayoutDashboard, Star, Calendar, MessageSquare, Globe } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '@/contexts/AuthContext';

type SidebarUser = { name: string; email: string; avatar: string | null };

// Default user data (fallback when not signed in)
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

const viewModes = [
  { label: 'Home Page', icon: Globe, href: '/', active: false },
  { label: 'User View', icon: User, href: '/user-dashboard', active: true },
  { label: 'Vendor View', icon: Briefcase, href: '/vendor/dashboard', active: false },
  { label: 'Admin View', icon: Users, href: '/admin/dashboard', active: false },
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
  const [currentUser, setCurrentUser] = React.useState<SidebarUser>(defaultUser);

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
      try {
        // Try to use auth context if available
        // await logout();
        // Fallback to direct logout
        window.location.href = '/logout';
      } catch (error) {
        console.error('Logout failed:', error);
        // Fallback to direct logout
        window.location.href = '/logout';
      }
    }
  };

  return (
    <aside className="w-72 flex flex-col min-h-screen">
      {/* Logo area - white background */}
      <div className="bg-white flex items-center px-6 py-8 border-b border-gray-200 justify-center">
        <img src="/reliance-logo.png" alt="Reliance Logo" className="w-32 h-32 rounded" />
      </div>
      
      {/* Blue navigation area */}
      <div className="flex-1 bg-blue-800 text-white flex flex-col py-8 px-4">
        {/* User Profile Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-16 h-16 rounded-full border-2 border-white/20 shadow-md"
              />
            ) : (
              <div className="w-16 h-16 rounded-full border-2 border-white/20 shadow-md bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                {currentUser.name.split(' ').map(n => n[0]).join('')}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-lg mb-1">{currentUser.name}</div>
            <div className="text-blue-100 text-sm">{currentUser.email}</div>
            <div className="mt-2">
              <span className="px-2 py-1 bg-white/20 text-white text-xs rounded-full">
                Premium Member
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1">
          <div className="text-xs font-semibold text-blue-200 uppercase tracking-wider mb-4 px-3">
            Navigation
          </div>
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-white hover:bg-blue-700 transition-colors font-medium"
            >
              <link.icon size={18} />
              {link.label}
            </Link>
          ))}
          
          {/* Log Out Button - moved here to match navigation style */}
          <div className="mt-4 pt-4 border-t border-white/20">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-white hover:bg-blue-700 transition-colors font-medium w-full text-left"
            >
              <LogOut size={18} />
              Log Out
            </button>
          </div>
        </nav>

        {/* Bottom Section */}
        <div className="space-y-3">
          {/* View Mode Switcher */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-blue-200 uppercase tracking-wider">
              Switch View
            </div>
            <div className="flex flex-col gap-2">
              {viewModes.map((mode) => (
                <Link key={mode.label} href={mode.href}>
                  <Button
                    variant={mode.active ? "default" : "outline"}
                    className={`w-full flex items-center gap-2 py-2 justify-start transition-colors font-medium ${
                      mode.active 
                        ? "bg-white text-blue-800 hover:bg-gray-100" 
                        : "text-white border-white/20 hover:bg-blue-700"
                    }`}
                  >
                    <mode.icon size={16} />
                    {mode.label}
                  </Button>
                </Link>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-white/20">
            <div className="text-center">
              <div className="text-xs text-blue-200 mb-1">Reliance</div>
              <div className="text-xs text-blue-300">© 2024 All rights reserved</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
} 