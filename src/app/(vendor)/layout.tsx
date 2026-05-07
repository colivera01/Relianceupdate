'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { User, Home, Settings, LogOut, Users, Briefcase, LayoutDashboard, Star, Calendar, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();

  const vendor = {
    name: 'John Smith',
    email: 'john@techsolutions.com',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
  };

  const navLinks = [
    { label: 'Dashboard', icon: Home, href: '/vendor/dashboard' },
    { label: 'Bookings', icon: Calendar, href: '/vendor/bookings' },
    { label: 'Reviews', icon: Star, href: '/vendor/reviews' },
    { label: 'Messages', icon: MessageSquare, href: '/vendor/messages' },
    { label: 'Profile', icon: User, href: '/vendor/profile' },
    { label: 'Settings', icon: Settings, href: '/vendor/settings' },
  ];

  const viewModes = [
    { label: 'User View', icon: User, href: '/user-dashboard' },
    { label: 'Vendor View', icon: Briefcase, href: '/vendor/dashboard' },
    { label: 'Admin View', icon: Users, href: '/admin/dashboard' },
  ];

  // Placeholder sign-out function
  const handleSignOut = () => {
    // TODO: Connect to backend sign-out logic
    // For now, just redirect to login page
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="h-screen w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm sticky top-0 z-20">
        <div className="flex flex-col items-center py-8">
          <img
            src={vendor.avatar}
            alt={vendor.name}
            className="w-16 h-16 rounded-full border-2 border-green-500 shadow-md mb-2"
          />
          <div className="font-semibold text-lg">{vendor.name}</div>
          <div className="text-xs text-gray-500 break-all">{vendor.email}</div>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors font-medium"
            >
              <link.icon size={18} />
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 mt-4 space-y-2">
          <Button variant="outline" className="w-full flex items-center gap-2" onClick={handleSignOut}>
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

      {/* Main Content */}
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
} 