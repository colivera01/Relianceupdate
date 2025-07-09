'use client';
import { Users, HardDrive, Star, Briefcase, DollarSign, HelpCircle, LogOut, AlertTriangle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const sidebarLinks = [
  { label: 'Dashboard', icon: Home, href: '/vendor' },
  { label: 'Profile & Settings', icon: Users, href: '/vendor/profile' },
  { label: 'View Reviews', icon: Star, href: '/vendor/reviews' },
  { label: 'Pending Approvals', icon: AlertTriangle, href: '/vendor/approvals', badge: 2, alert: true },
  { label: 'Manage Jobs', icon: Briefcase, href: '/vendor/jobs' },
  { label: 'Employees', icon: Users, href: '/vendor/employees' },
  { label: 'Billing & Earnings', icon: DollarSign, href: '/vendor/billing' },
  { label: 'Support & Help', icon: HelpCircle, href: '/vendor/support' },
  { label: 'Logout', icon: LogOut, href: '/logout' },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col min-h-screen">
        {/* Logo area - white background */}
        <div className="bg-white flex items-center px-6 py-8 border-b border-gray-200 justify-center">
          <img src="/reliance-logo.png" alt="Reliance Logo" className="w-32 h-32 rounded" />
        </div>
        {/* Blue navigation area */}
        <div className="flex-1 bg-blue-800 text-white flex flex-col py-8 px-4">
          <nav className="flex-1 space-y-1">
            {sidebarLinks.map((link, idx) => (
              <div key={link.label} className="relative">
                {link.href ? (
                  <Link href={link.href}>
                    <Button 
                      variant="ghost" 
                      className={`w-full justify-start text-white hover:bg-blue-700 rounded-lg px-3 py-2 text-base font-medium ${
                        link.alert ? 'bg-red-600 hover:bg-red-700 animate-pulse' : ''
                      }`}
                    >
                      <link.icon className="w-5 h-5 mr-3" />
                      {link.label}
                      {link.badge && (
                        <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                          {link.badge}
                        </span>
                      )}
                    </Button>
                  </Link>
                ) : (
                  <Button 
                    variant="ghost" 
                    className={`w-full justify-start text-white hover:bg-blue-700 rounded-lg px-3 py-2 text-base font-medium ${
                      link.alert ? 'bg-red-600 hover:bg-red-700 animate-pulse' : ''
                    }`}
                  >
                    <link.icon className="w-5 h-5 mr-3" />
                    {link.label}
                    {link.badge && (
                      <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                        {link.badge}
                      </span>
                    )}
                  </Button>
                )}
                {/* Insert toggles directly after Logout button */}
                {link.label === 'Logout' && (
                  <div className="flex flex-col gap-2 mt-4">
                    <button
                      className="flex items-center gap-2 border border-yellow-400 text-yellow-400 px-3 py-2 rounded hover:bg-yellow-50 hover:text-blue-800 transition-colors font-medium"
                      onClick={() => window.location.href = '/'}
                    >
                      <span className="w-4 h-4 inline-block">🏛️</span>
                      Switch to Admin View
                    </button>
                    <button
                      className="flex items-center gap-2 border border-green-400 text-green-400 px-3 py-2 rounded hover:bg-green-50 hover:text-blue-800 transition-colors font-medium"
                      onClick={() => window.location.href = '/users'}
                    >
                      <span className="w-4 h-4 inline-block">👤</span>
                      Switch to User View
                    </button>
                  </div>
                )}
              </div>
            ))}
          </nav>
          <div className="mt-auto text-xs text-blue-200 px-2 mb-4">Reliance © 2023</div>
        </div>
      </aside>
      <main className="flex-1 px-4 md:px-8 py-8">{children}</main>
    </div>
  );
} 