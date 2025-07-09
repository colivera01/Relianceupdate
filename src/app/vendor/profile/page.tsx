'use client';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// import { Progress } from '@/components/ui/progress'; // Removed because file does not exist
import { Users, HardDrive, Settings, LogOut, HelpCircle, Star, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

// DEVELOPER NOTES (Backend API Requirements)
//
// 1. Device Pairing:
//    - POST /api/pairing/request { employeeId, vendorId } → { code, expiresAt, qrCodeUrl }
//    - POST /api/pairing/confirm { code, deviceId } → { success, employeeId, vendorId, deviceId }
//    - GET /api/devices?vendorId=... → list of paired devices
//    - Devices table: id, employeeId, vendorId, deviceType, lastPaired
//
// 2. Media Upload:
//    - POST /api/media/upload { file, jobId, employeeId, deviceId, vendorId, timestamp }
//    - GET /api/media?jobId=... → media for a job
//
// 3. Jobs:
//    - GET /api/jobs?employeeId=... → jobs assigned to employee
//
// All endpoints require authentication and should validate employee/vendor relationship.
//
// End DEVELOPER NOTES

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
  const [showPairModal, setShowPairModal] = useState(false);
  const [pairedDevices, setPairedDevices] = useState([
    { id: 'dev-1', employeeName: 'Maria Lopez', employeePhoto: 'https://randomuser.me/api/portraits/women/44.jpg', employeeRole: 'Technician', lastPaired: '2024-06-01', deviceInfo: 'iPhone 14, iOS 17' },
    { id: 'dev-2', employeeName: 'James Lee', employeePhoto: 'https://randomuser.me/api/portraits/men/45.jpg', employeeRole: 'Technician', lastPaired: '2024-05-28', deviceInfo: 'Samsung Tablet, Android 13' },
  ]);
  const [countdown, setCountdown] = useState(300); // 5 minutes
  // Countdown effect
  useEffect(() => {
    if (!showPairModal) return;
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [showPairModal, countdown]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => setSaving(false), 1000);
  };

  // Mock pairing code and status
  const pairingCode = 'A1B2C3';
  const pairingStatus = 'Waiting for device to pair...';

  return (
    <div className="min-h-screen">
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
                  <Button variant="outline" size="sm" className="ml-2" type="button" onClick={() => setShowPairModal(true)}>Connect Device</Button>
                </div>
                <Button className="mt-6 w-full" onClick={handleSave} disabled={saving} type="button">
                  {saving ? 'Saving...' : 'Save Profile'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Pair Device Modal */}
          <Dialog open={showPairModal} onOpenChange={setShowPairModal}>
            <DialogContent className="max-w-md" aria-modal="true" aria-labelledby="pairing-title">
              <DialogTitle id="pairing-title">Pair Employee Device</DialogTitle>
              <div className="mt-4 flex flex-col items-center gap-4">
                <div className="text-3xl font-mono tracking-widest bg-gray-100 px-6 py-2 rounded border border-gray-200" aria-label="Pairing Code">{pairingCode}</div>
                {/* QR Code Placeholder */}
                <div className="my-2" aria-label="QR Code Placeholder">
                  <div className="w-24 h-24 bg-gray-200 rounded flex items-center justify-center text-gray-400">QR</div>
                </div>
                <div className="text-gray-700 text-center">Ask your employee to enter this code in their mobile app within 5 minutes to pair their device with your business.</div>
                {/* Countdown Timer */}
                <div className="text-blue-600 font-semibold mt-2" aria-live="polite">Expires in {Math.floor(countdown/60)}:{(countdown%60).toString().padStart(2,'0')}</div>
                {/* Real-time status */}
                <div className="text-green-700 font-medium" aria-live="polite">{pairingStatus}</div>
                <Button variant="outline" onClick={() => setShowPairModal(false)} autoFocus>Close</Button>
              </div>
            </DialogContent>
          </Dialog>
          {/* Device Management Section */}
          <Card className="mt-8" id="devices">
            <CardHeader>
              <CardTitle>Paired Devices</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {pairedDevices.length === 0 ? (
                  <li className="text-gray-500 flex flex-col gap-2">No devices paired.<Button variant='outline' size='sm' className='w-fit mt-2' onClick={() => setShowPairModal(true)}>Pair a new device</Button></li>
                ) : (
                  pairedDevices.map(dev => (
                    <li key={dev.id} className="flex items-center gap-3 justify-between border-b pb-2">
                      <span className="flex items-center gap-3">
                        <img src={dev.employeePhoto} alt={dev.employeeName} className="w-8 h-8 rounded-full border" />
                        <span className="flex flex-col">
                          <span className="font-medium flex items-center gap-2">
                            <a href={`/vendor/employees/${dev.id}`} className="hover:underline text-blue-700" aria-label={`View profile for ${dev.employeeName}`}>{dev.employeeName || 'Unknown Employee'}</a>
                            <span className="text-xs text-gray-500">{dev.employeeRole}</span>
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-2">
                            Last paired: {dev.lastPaired}
                            <span tabIndex="0" aria-label="Device info" className="ml-1 cursor-pointer" title={dev.deviceInfo}>ℹ️</span>
                          </span>
                        </span>
                      </span>
                      <Button variant="destructive" size="sm" aria-label={`Revoke ${dev.employeeName || 'Unknown Employee'}`} onClick={() => setPairedDevices(pairedDevices.filter(d => d.id !== dev.id))}>Revoke</Button>
                    </li>
                  ))
                )}
              </ul>
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
              <div className="mt-2 text-xs text-gray-500">25% left</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>My Paired Employees</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {pairedDevices.length === 0 ? (
                  <li className="text-gray-500 flex flex-col gap-2">No employees have paired devices.<Button variant='outline' size='sm' className='w-fit mt-2' onClick={() => setShowPairModal(true)}>Pair a new device</Button></li>
                ) : (
                  pairedDevices.map(dev => (
                    <li key={dev.id} className="flex items-center gap-3">
                      <img src={dev.employeePhoto} alt={dev.employeeName} className="w-7 h-7 rounded-full border" />
                      <span className="font-medium flex items-center gap-2">
                        <a href={`/vendor/employees/${dev.id}`} className="hover:underline text-blue-700" aria-label={`View profile for ${dev.employeeName}`}>{dev.employeeName || 'Unknown Employee'}</a>
                        <span className="text-xs text-gray-500">{dev.employeeRole}</span>
                      </span>
                      <span className="text-xs text-gray-400 ml-2">Last paired: {dev.lastPaired}</span>
                      <span className={`w-2 h-2 rounded-full ${dev.lastPaired === (new Date()).toISOString().slice(0,10) ? 'bg-green-500' : 'bg-gray-400'}`} title={dev.lastPaired === (new Date()).toISOString().slice(0,10) ? 'Paired today' : 'Paired previously'}></span>
                    </li>
                  ))
                )}
              </ul>
            </CardContent>
          </Card>
        </aside>
      </main>
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
    </div>
  );
} 