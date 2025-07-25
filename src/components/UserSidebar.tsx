'use client';
import React from 'react';
import Link from 'next/link';
import { User, Home, Heart, Settings, LogOut, Users, Briefcase, LayoutDashboard, Star, Calendar, MessageSquare } from 'lucide-react';
import { Button } from './ui/button';

const user = {
  name: 'Jane Doe',
  email: 'jane.doe@email.com',
  avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
};

const navLinks = [
  { label: 'Home', icon: Home, href: '/user-dashboard' },
  { label: 'Discover', icon: LayoutDashboard, href: '/discover' },
  { label: 'My Bookings', icon: Calendar, href: '/my-bookings' },
  { label: 'Favorites', icon: Heart, href: '/favorites' },
  { label: 'Reviews', icon: Star, href: '/my-reviews' },
  { label: 'Messages', icon: MessageSquare, href: '/messages' },
  { label: 'Profile', icon: User, href: '/profile' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

const viewModes = [
  { label: 'User View', icon: User, href: '/user-dashboard', active: true },
  { label: 'Vendor View', icon: Briefcase, href: '/vendor/dashboard', active: false },
  { label: 'Admin View', icon: Users, href: '/admin/dashboard', active: false },
];

export default function UserSidebar() {
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
            <img
              src={user.avatar}
              alt={user.name}
              className="w-16 h-16 rounded-full border-2 border-white/20 shadow-md"
            />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-lg mb-1">{user.name}</div>
            <div className="text-blue-100 text-sm">{user.email}</div>
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
            <Link href="/logout" className="flex items-center gap-3 px-3 py-2 rounded-lg text-white hover:bg-blue-700 transition-colors font-medium">
              <LogOut size={18} />
              Log Out
            </Link>
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
                        ? 'bg-white text-blue-800 hover:bg-gray-100' 
                        : 'border-white/30 text-white hover:bg-white/10 bg-white/5'
                    }`}
                  >
                    <mode.icon size={16} />
                    <span className="font-medium">{mode.label}</span>
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