"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useState } from 'react';
import { VendorAvailabilityPanel } from '../availability/VendorAvailabilityPanel';
import { VendorPricingPanel } from '../profile/VendorPricingPanel';
import { CalendarDays } from 'lucide-react';
import { CheckCircle, XCircle } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function VendorDashboard() {
  const recentJobs = [
    {
      id: 1,
      title: 'Kitchen Sink Repair',
      status: 'in progress',
      customer: 'Sarah Johnson',
      location: 'Downtown',
      date: '1/14/2024',
      amount: '$120.00',
    },
    {
      id: 2,
      title: 'Bathroom Faucet Installation',
      status: 'completed',
      customer: 'Mike Chen',
      location: 'Westside',
      date: '1/13/2024',
      amount: '$95.00',
    },
    {
      id: 3,
      title: 'Garbage Disposal Repair',
      status: 'pending',
      customer: 'Lisa Rodriguez',
      location: 'Northside',
      date: '1/15/2024',
      amount: '$150.00',
    },
  ];

  const recentReviews = [
    {
      id: 1,
      customer: 'Sarah Johnson',
      job: 'Kitchen Sink Repair',
      rating: 5,
      comment: 'Excellent work! Fixed my sink quickly and professionally.'
    },
    {
      id: 2,
      customer: 'Mike Chen',
      job: 'Bathroom Faucet Installation',
      rating: 5,
      comment: 'Great service, very reliable and clean work.'
    },
  ];

  const pairedUsers = [
    { id: 'dev-1', name: 'Maria Lopez', photo: 'https://randomuser.me/api/portraits/women/44.jpg', role: 'Technician', lastPaired: '2024-06-01' },
    { id: 'dev-2', name: 'James Lee', photo: 'https://randomuser.me/api/portraits/men/45.jpg', role: 'Technician', lastPaired: '2024-05-28' },
  ];

  const notifications = [
    { id: 1, type: 'job', icon: '📝', message: 'New job request: Water Heater Repair', time: '2m ago' },
    { id: 2, type: 'review', icon: '⭐', message: 'New review from Sarah Johnson', time: '1h ago' },
    { id: 3, type: 'payment', icon: '💵', message: 'Payment received: $120.00', time: '3h ago' },
    { id: 4, type: 'approval', icon: '✅', message: 'Job completed: Faucet Installation', time: '1d ago' },
  ];

  const earningsSummary = {
    totalEarnings: 12450.75,
    pendingPayouts: 320.00,
    nextPayoutDate: '2024-06-15',
  };

  // Mock payments enabled status (should be fetched from profile in real app)
  const paymentsEnabled = false; // Set to true to show earnings card

  // Mock job events for the calendar
  const jobEvents = [
    { id: 1, title: 'Kitchen Sink Repair', date: '2024-06-10', color: 'bg-blue-500' },
    { id: 2, title: 'Faucet Installation', date: '2024-06-12', color: 'bg-green-500' },
    { id: 3, title: 'Garbage Disposal Repair', date: '2024-06-15', color: 'bg-yellow-500' },
    { id: 4, title: 'Pipe Leak Fix', date: '2024-06-18', color: 'bg-red-500' },
  ];

  const performanceMetrics = [
    { id: 'response', label: 'Avg. Response Time', value: '1.2h', icon: '⏱️', color: 'text-blue-600' },
    { id: 'completion', label: 'Completion Rate', value: '98%', icon: '✅', color: 'text-green-600' },
    { id: 'satisfaction', label: 'Satisfaction', value: '96%', icon: '😊', color: 'text-yellow-600' },
    { id: 'review', label: 'Review Score', value: '4.8', icon: '⭐', color: 'text-yellow-400' },
  ];

  const profileSteps = [
    { id: 'logo', label: 'Add Business Logo', complete: true },
    { id: 'pricing', label: 'Set Pricing', complete: true },
    { id: 'email', label: 'Verify Email', complete: false },
    { id: 'services', label: 'Add Services', complete: true },
    { id: 'bio', label: 'Add Business Bio', complete: false },
  ];
  const completedSteps = profileSteps.filter(s => s.complete).length;
  const progress = Math.round((completedSteps / profileSteps.length) * 100);

  const [showAvailability, setShowAvailability] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [calendarModal, setCalendarModal] = useState({ open: false, day: null, events: [] });
  const [reminders, setReminders] = useState({ review: true, invoice: false });
  const [showReminderToast, setShowReminderToast] = useState(false);
  function handleSaveReminders() {
    setShowReminderToast(true);
    setTimeout(() => setShowReminderToast(false), 2000);
  }

  const supportLinks = [
    { id: 'faq', label: 'FAQs', href: '/support#faqs', icon: '❓' },
    { id: 'articles', label: 'Help Articles', href: '/support#articles', icon: '📚' },
    { id: 'contact', label: 'Contact Support', href: '/support#contact', icon: '☎️' },
  ];

  const activityFeed = [
    { id: 1, icon: '📝', description: 'Accepted job: Water Heater Repair', time: '5m ago' },
    { id: 2, icon: '⭐', description: 'Received review from Mike Chen', time: '1h ago' },
    { id: 3, icon: '🔄', description: 'Updated business profile', time: '2h ago' },
    { id: 4, icon: '💵', description: 'Payout processed: $320.00', time: '1d ago' },
    { id: 5, icon: '✅', description: 'Completed job: Faucet Installation', time: '2d ago' },
  ];

  const insights = [
    { id: 1, type: 'warning', icon: '⚠️', message: 'You have 3 jobs with overdue invoices.', color: 'bg-yellow-100 text-yellow-800' },
    { id: 2, type: 'success', icon: '💬', message: 'Clients love your fast response time!', color: 'bg-green-100 text-green-800' },
    { id: 3, type: 'info', icon: '📈', message: 'Your job volume is up 15% this month.', color: 'bg-blue-100 text-blue-800' },
  ];

  const clients = [
    { id: 1, name: 'Sarah Johnson', email: 'sarah@email.com', phone: '555-1234', jobs: 5, notes: 'Prefers morning appointments.' },
    { id: 2, name: 'Mike Chen', email: 'mike@email.com', phone: '555-5678', jobs: 3, notes: 'Always pays on time.' },
    { id: 3, name: 'Lisa Rodriguez', email: 'lisa@email.com', phone: '555-8765', jobs: 2, notes: 'Requested eco-friendly products.' },
  ];
  const [clientModal, setClientModal] = useState({ open: false, client: null });

  const earningsData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Earnings ($)',
        data: [1200, 1500, 1100, 1800, 2100, 1950],
        borderColor: 'rgb(37, 99, 235)',
        backgroundColor: 'rgba(37, 99, 235, 0.2)',
        tension: 0.4,
        fill: true,
      },
    ],
  };
  const earningsOptions = {
    responsive: true,
    plugins: {
      legend: { display: true, position: 'top' },
      title: { display: true, text: 'Earnings Trend (Last 6 Months)' },
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: 'Earnings ($)' } },
      x: { title: { display: true, text: 'Month' } },
    },
  };

  const [notificationSettings, setNotificationSettings] = useState({ job: true, review: true, payout: false, support: true });
  const [showNotifToast, setShowNotifToast] = useState(false);
  function handleSaveNotifications() {
    setShowNotifToast(true);
    setTimeout(() => setShowNotifToast(false), 2000);
  }

  const mediaFiles = [
    { id: 1, name: 'before_kitchen.jpg', type: 'image', url: 'https://via.placeholder.com/150', uploaded: '2024-06-01' },
    { id: 2, name: 'after_kitchen.jpg', type: 'image', url: 'https://via.placeholder.com/150', uploaded: '2024-06-02' },
    { id: 3, name: 'invoice_123.pdf', type: 'pdf', url: '#', uploaded: '2024-06-03' },
    { id: 4, name: 'contract.docx', type: 'doc', url: '#', uploaded: '2024-06-04' },
  ];
  const [mediaModal, setMediaModal] = useState({ open: false, file: null });

  return (
    <div className="space-y-8">
      {/* Move the Performance Metrics card to the very top of the dashboard */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-4xl mb-2">⏱️</div>
              <div className="text-2xl font-bold">1.2h</div>
              <div className="text-gray-500 mt-1">Avg. Response Time</div>
            </div>
            <div>
              <div className="text-4xl mb-2">✅</div>
              <div className="text-2xl font-bold">98%</div>
              <div className="text-gray-500 mt-1">Completion Rate</div>
            </div>
            <div>
              <div className="text-4xl mb-2">😊</div>
              <div className="text-2xl font-bold">96%</div>
              <div className="text-gray-500 mt-1">Satisfaction</div>
            </div>
            <div>
              <div className="text-4xl mb-2">⭐</div>
              <div className="text-2xl font-bold">4.8</div>
              <div className="text-gray-500 mt-1">Review Score</div>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Actionable Insights & Recommendations */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Actionable Insights & Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Proactive Insights Section */}
          <div className="space-y-3 mb-6">
            <div className="bg-yellow-100 rounded px-4 py-3 flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <span>You have 3 jobs with overdue invoices.</span>
            </div>
            <div className="bg-green-100 rounded px-4 py-3 flex items-center gap-3">
              <span className="text-xl">💬</span>
              <span>Clients love your fast response time!</span>
            </div>
            <div className="bg-blue-100 rounded px-4 py-3 flex items-center gap-3">
              <span className="text-xl">📈</span>
              <span>Your job volume is up 15% this month.</span>
            </div>
          </div>
          {/* Divider */}
          <div className="border-t my-4"></div>
          {/* Notifications/Alerts Section */}
          <div>
            <div className="font-semibold text-gray-700 mb-2">Recent Notifications & Alerts</div>
            <ul className="space-y-2">
              <li className="flex items-center gap-3 text-gray-800">
                <span className="text-lg">📝</span>
                <span className="flex-1">New job request: Water Heater Repair</span>
                <span className="text-xs text-gray-400 ml-auto">2m ago</span>
              </li>
              <li className="flex items-center gap-3 text-gray-800">
                <span className="text-lg">⭐</span>
                <span className="flex-1">New review from Sarah Johnson</span>
                <span className="text-xs text-gray-400 ml-auto">1h ago</span>
              </li>
              <li className="flex items-center gap-3 text-gray-800">
                <span className="text-lg">💵</span>
                <span className="flex-1">Payment received: $120.00</span>
                <span className="text-xs text-gray-400 ml-auto">3h ago</span>
              </li>
              <li className="flex items-center gap-3 text-gray-800">
                <span className="text-lg">✅</span>
                <span className="flex-1">Job completed: Faucet Installation</span>
                <span className="text-xs text-gray-400 ml-auto">1d ago</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
      {/* Client Management & CRM Lite */}
      <Card>
        <CardHeader>
          <CardTitle>Clients</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm mb-2">
            <thead>
              <tr className="text-left text-gray-500">
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Jobs</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map(client => (
                <tr key={client.id} className="border-b last:border-b-0">
                  <td>{client.name}</td>
                  <td>{client.email}</td>
                  <td>{client.phone}</td>
                  <td>{client.jobs}</td>
                  <td><button className="text-blue-600 hover:underline" onClick={() => setClientModal({ open: true, client })}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Manage Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-700">View, accept, and update your job requests.</p>
            <Link href="/vendor/jobs" passHref legacyBehavior>
              <Button className="w-full" as="a">Go to Jobs</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>View Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-700">See client feedback and performance trends.</p>
            <Link href="/vendor/reviews" passHref legacyBehavior>
              <Button className="w-full" as="a">See Reviews</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Billing & Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-700">Track your payments, invoices, and plans.</p>
            <Link href="/vendor/billing" passHref legacyBehavior>
              <Button className="w-full" as="a">Go to Billing</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile & Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-700">Edit your business info and preferences.</p>
            <Link href="/vendor/profile" passHref legacyBehavior>
              <Button className="w-full" as="a">Go to Profile</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Support & Help</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-700">Get assistance or open a support ticket.</p>
            <Link href="/vendor/support" passHref legacyBehavior>
              <Button className="w-full" as="a">Get Support</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      {/* Paired Users Section */}
      <Card>
        <CardHeader>
          <CardTitle>Paired Users</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {pairedUsers.length === 0 ? (
              <li className="text-gray-500">No users paired.</li>
            ) : (
              pairedUsers.map(user => (
                <li key={user.id} className="flex items-center gap-4 border-b pb-2 last:border-b-0">
                  <img src={user.photo} alt={user.name} className="w-8 h-8 rounded-full border" />
                  <div className="flex flex-col">
                    <span className="font-medium">{user.name}</span>
                    <span className="text-xs text-gray-500">{user.role}</span>
                  </div>
                  <span className="ml-auto text-xs text-gray-400">Last paired: {user.lastPaired}</span>
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>
      {/* Earnings & Payouts Summary */}
      {paymentsEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Earnings & Payouts Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-xs text-gray-500 mb-1">Total Earnings</div>
                <div className="text-2xl font-bold text-green-700">${earningsSummary.totalEarnings.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Pending Payouts</div>
                <div className="text-2xl font-bold text-yellow-700">${earningsSummary.pendingPayouts.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Next Payout Date</div>
                <div className="text-2xl font-bold">{earningsSummary.nextPayoutDate}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Job/Booking Calendar Widget */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <CalendarDays className="w-5 h-5 text-blue-600" />
          <CardTitle>Job/Booking Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <CalendarMonth jobEvents={jobEvents} onDayClick={(day, events) => setCalendarModal({ open: true, day, events })} />
        </CardContent>
      </Card>
      {/* Calendar Day Modal */}
      {calendarModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={() => setCalendarModal({ open: false, day: null, events: [] })}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-lg shadow-lg p-6 min-w-[320px] max-w-[90vw]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Jobs for {calendarModal.day}</h2>
              <button onClick={() => setCalendarModal({ open: false, day: null, events: [] })} className="text-gray-400 hover:text-gray-700 text-2xl">✕</button>
            </div>
            {calendarModal.events.length === 0 ? (
              <div className="text-gray-500">No jobs scheduled for this day.</div>
            ) : (
              <ul className="space-y-3">
                {calendarModal.events.map(ev => (
                  <li key={ev.id} className="flex flex-col gap-1 border-b pb-2 last:border-b-0">
                    <span className="font-semibold">{ev.title}</span>
                    <span className="text-xs text-gray-500">Status: Scheduled</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {/* Quick Actions (Unified) */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button variant="outline" className="justify-start" onClick={() => setShowAvailability(true)}>
            📅 Schedule Availability
          </Button>
          <Button variant="outline" className="justify-start" onClick={() => setShowPricing(true)}>
            💲 Update Pricing
          </Button>
          <Link href="/vendor/support" passHref legacyBehavior>
            <Button variant="outline" className="justify-start" as="a">🆘 Get Support</Button>
          </Link>
          <div className="border-t my-2"></div>
          <Button variant="outline" className="justify-start" onClick={() => alert('Message Client (mock)')}>💬 Message Client</Button>
          <Button variant="outline" className="justify-start" onClick={() => alert('Send Invoice (mock)')}>🧾 Send Invoice</Button>
          <Button variant="outline" className="justify-start" onClick={() => alert('Request Review (mock)')}>⭐ Request Review</Button>
        </CardContent>
      </Card>
      {/* Profile Completeness Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Completeness</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex items-center gap-3">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="bg-blue-600 h-3 rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
            <span className="text-sm font-semibold text-blue-700">{progress}%</span>
          </div>
          <ul className="space-y-2 mt-2">
            {profileSteps.map(step => (
              <li key={step.id} className="flex items-center gap-2">
                {step.complete ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-gray-400" />
                )}
                <span className={step.complete ? 'text-gray-700' : 'text-gray-400'}>{step.label}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {/* Support & Resources Section */}
      <Card>
        <CardHeader>
          <CardTitle>Support & Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 mb-4">
            {supportLinks.map(link => (
              <li key={link.id}>
                <a href={link.href} className="flex items-center gap-2 text-blue-700 hover:underline">
                  <span className="text-lg">{link.icon}</span>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <Button variant="outline" onClick={() => alert('Support chat (mock)')}>💬 Open Support Chat</Button>
        </CardContent>
      </Card>
      {/* Recent Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {activityFeed.length === 0 ? (
              <li className="text-gray-500">No recent activity.</li>
            ) : (
              activityFeed.map(item => (
                <li key={item.id} className="flex items-center gap-3 border-b pb-2 last:border-b-0">
                  <span className="text-xl">{item.icon}</span>
                  <span className="flex-1">{item.description}</span>
                  <span className="text-xs text-gray-400 ml-auto">{item.time}</span>
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>
      {/* Modal overlays for panels */}
      {showAvailability && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={() => setShowAvailability(false)}>
          <div onClick={e => e.stopPropagation()}>
            <VendorAvailabilityPanel onClose={() => setShowAvailability(false)} />
          </div>
        </div>
      )}
      {showPricing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={() => setShowPricing(false)}>
          <div onClick={e => e.stopPropagation()}>
            <VendorPricingPanel onClose={() => setShowPricing(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarMonth({ jobEvents, onDayClick }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const eventMap = jobEvents.reduce((acc, ev) => {
    const d = new Date(ev.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      acc[d.getDate()] = acc[d.getDate()] || [];
      acc[d.getDate()].push(ev);
    }
    return acc;
  }, {});
  const weeks = [];
  let week = [];
  for (let i = 0; i < firstDay; i++) week.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) while (week.length < 7) week.push(null);
  if (week.length) weeks.push(week);
  const monthName = today.toLocaleString('default', { month: 'long' });
  return (
    <div className="overflow-x-auto">
      <div className="flex justify-center items-center mb-2">
        <span className="text-lg font-semibold">{monthName} {year}</span>
      </div>
      <table className="w-full text-center border-collapse select-none">
        <thead>
          <tr className="text-xs text-gray-500">
            <th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, i) => (
            <tr key={i}>
              {week.map((day, j) => (
                <td key={j} className={`h-12 w-12 border ${day ? 'bg-white cursor-pointer hover:bg-blue-50' : 'bg-gray-50'}`}
                  onClick={day ? () => onDayClick(day, eventMap[day] || []) : undefined}>
                  {day && (
                    <div className="relative flex flex-col items-center justify-center">
                      <span className={`font-semibold ${day === today.getDate() ? 'text-blue-600' : ''}`}>{day}</span>
                      <div className="flex gap-1 mt-1">
                        {(eventMap[day] || []).map(ev => (
                          <span key={ev.id} className={`w-2 h-2 rounded-full ${ev.color}`} title={ev.title}></span>
                        ))}
                      </div>
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-3 mt-4 text-xs">
        {jobEvents.map(ev => (
          <span key={ev.id} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${ev.color}`}></span>{ev.title}</span>
        ))}
      </div>
    </div>
  );
} 