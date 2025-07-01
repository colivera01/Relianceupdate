'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, HardDrive, Settings, LogOut, HelpCircle, Star, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// BACKEND DEVELOPER NOTES:
// - Fetch vendor profile from GET /api/vendor/profile
// - Update profile via PUT /api/vendor/profile
// - Device pairing should POST/PUT to /api/vendor/devices
// - Fetch business stats from GET /api/vendor/stats
// - All actions should be authenticated as vendor

const sidebarLinks = [
  { label: 'Profile', icon: Users },
  { label: 'Media', icon: HardDrive },
  { label: 'Reviews', icon: Star },
  { label: 'Connected Devices', icon: Settings },
  { label: 'Support', icon: HelpCircle },
  { label: 'Logout', icon: LogOut },
];

export default function VendorProfilePage() {
  const [profile, setProfile] = useState({
    businessName: 'Tech Solutions Inc.',
    address: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    totalEmployees: 12,
    pairedDevice: true,
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => setSaving(false), 1000);
  };

  return (
    <div className="min-h-screen flex bg-blue-900/95">
      {/* Sidebar */}
      <aside className="w-64 bg-blue-900 text-white flex flex-col py-8 px-4 space-y-6">
        <div className="mb-8 flex items-center space-x-2">
          <img src="/reliance-logo.png" alt="Reliance Logo" className="w-10 h-10 rounded" />
          <span className="text-2xl font-bold tracking-wide">RELIANCE</span>
        </div>
        <nav className="flex-1 space-y-2">
          {sidebarLinks.map((link) => (
            <Button key={link.label} variant="ghost" className="w-full justify-start text-white hover:bg-blue-800">
              <link.icon className="w-5 h-5 mr-3" />
              {link.label}
            </Button>
          ))}
        </nav>
        <div className="mt-auto text-xs text-blue-200">Reliance © 2023</div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-slate-50 p-10 flex gap-8">
        {/* Profile Form */}
        <section className="flex-1 max-w-2xl">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/vendor">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Vendor Profile Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1">Business Name</label>
                  <Input name="businessName" value={profile.businessName} onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Business Address</label>
                  <Input name="address" value={profile.address} onChange={handleChange} />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">City</label>
                    <Input name="city" value={profile.city} onChange={handleChange} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">State</label>
                    <Input name="state" value={profile.state} onChange={handleChange} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Total Employees</label>
                  <Input name="totalEmployees" type="number" value={profile.totalEmployees} onChange={handleChange} />
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <span className="font-medium">Device Pairing:</span>
                  {profile.pairedDevice ? (
                    <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-4 h-4 mr-1 inline" /> Paired</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700"><XCircle className="w-4 h-4 mr-1 inline" /> Not Paired</Badge>
                  )}
                  <Button variant="outline" size="sm" className="ml-2">Connect Device</Button>
                </div>
                <Button className="mt-6 w-full" onClick={handleSave} disabled={saving} type="button">
                  {saving ? 'Saving...' : 'Save Profile'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Business Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Business Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Total Jobs</div>
                  <div className="text-2xl font-bold">156</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Average Rating</div>
                  <div className="flex items-center gap-1 text-2xl font-bold">
                    4.8 <Star className="w-5 h-5 text-yellow-400" />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Active Employees</div>
                  <div className="text-2xl font-bold">12</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Response Rate</div>
                  <div className="text-2xl font-bold">94%</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Right Panel */}
        <aside className="w-80 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Storage Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2 text-sm">75 GB of 100 GB used</div>
              <Progress value={75} className="h-2" />
              <div className="mt-2 text-xs text-gray-500">25% left</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>My Active Employees Today</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center gap-2"><Users className="w-4 h-4 text-blue-600" /> James Brown <Badge className="bg-green-100 text-green-700 ml-2">Active</Badge></li>
                <li className="flex items-center gap-2"><Users className="w-4 h-4 text-blue-600" /> Jenny Craig <Badge className="bg-green-100 text-green-700 ml-2">Active</Badge></li>
                <li className="flex items-center gap-2"><Users className="w-4 h-4 text-blue-600" /> Chris Evans <Badge className="bg-green-100 text-green-700 ml-2">Active</Badge></li>
              </ul>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
    {/* Backend Developer Notes Section */}
    <div className="mt-10 max-w-5xl mx-auto">
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded shadow-sm">
        <h3 className="font-bold text-yellow-800 mb-2">Backend Developer Notes</h3>
        <ul className="text-sm text-yellow-900 list-disc pl-5 space-y-1">
          <li>Fetch vendor profile from <b>GET /api/vendor/profile</b></li>
          <li>Update profile via <b>PUT /api/vendor/profile</b></li>
          <li>Device pairing should <b>POST/PUT</b> to <b>/api/vendor/devices</b></li>
          <li>Fetch business stats from <b>GET /api/vendor/stats</b></li>
          <li>All actions should be authenticated as vendor</li>
        </ul>
      </div>
    </div>
  );
} 