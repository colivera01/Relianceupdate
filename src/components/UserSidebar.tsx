'use client';
import React from 'react';
import Link from 'next/link';
import { User, Home, Heart, Settings, LogOut, Users, Briefcase, LayoutDashboard } from 'lucide-react';
import { Button } from './ui/button';

const user = {
  name: 'Jane Doe',
  email: 'jane.doe@email.com',
  avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
};

const navLinks = [
  { label: 'Home', icon: Home, href: '/user-dashboard' },
  { label: 'Discover', icon: LayoutDashboard, href: '/discover' },
  { label: 'My Bookings', icon: Briefcase, href: '/my-bookings' },
  { label: 'Favorites', icon: Heart, href: '/favorites' },
  { label: 'Reviews', icon: Users, href: '/my-reviews' },
  { label: 'Profile', icon: User, href: '/profile' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

const viewModes = [
  { label: 'User View', icon: User, href: '/user-dashboard' },
  { label: 'Vendor View', icon: Briefcase, href: '/vendor/dashboard' },
  { label: 'Admin View', icon: Users, href: '/admin/dashboard' },
];

export default function UserSidebar() {
  return (
    <aside className="h-screen w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm sticky top-0 z-20">
      <div className="flex flex-col items-center py-8">
        <img
          src={user.avatar}
          alt={user.name}
          className="w-16 h-16 rounded-full border-2 border-blue-500 shadow-md mb-2"
        />
        <div className="font-semibold text-lg">{user.name}</div>
        <div className="text-xs text-gray-500">{user.email}</div>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {navLinks.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors font-medium"
          >
            <link.icon size={18} />
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="px-4 mt-4 space-y-2">
        <Button variant="outline" className="w-full flex items-center gap-2">
          <LogOut size={16} />
          Log Out
        </Button>
        <div className="border-t border-gray-200 my-2" />
        <div className="flex flex-col gap-2">
          {viewModes.map((mode) => (
            <Link key={mode.label} href={mode.href}>
              <Button
                variant="secondary"
                className="w-full flex items-center gap-2 justify-center"
              >
                <mode.icon size={16} />
                {mode.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
} 