'use client';
// DEVELOPER NOTES (Backend API Requirements)
//
// 1. Manager-only Access:
//    - Restrict this page to vendor managers only. Provide a way to check user role (e.g., /api/auth/me or include role in session/user object).
//
// 2. Performance Overview & Analytics:
//    - GET /api/vendor/reviews/overview
//      Returns: { averageRating: number, totalReviews: number, trend: number, highlights: Array<{ type: 'celebration'|'concern'|'opportunity', text: string }> }
//    - GET /api/vendor/reviews/analytics
//      Returns: {
//        monthlyAverages: Array<{ month: string, avg: number }>,
//        employeeAverages: Array<{ id: number, name: string, avg: number }>,
//        repeatIssues: string[],
//        commonThemes: string[],
//      }
//
// 3. Employee Analytics:
//    - GET /api/vendor/employees/with-reviews
//      Returns: Array<{ id: number, name: string, email: string, role: string, photo: string, avgRating: number, reviewCount: number, recent: string, fiveStarCount: number }>
//
// 4. Review Feed:
//    - GET /api/vendor/reviews?rating=number&employeeId=number&jobType=string&search=string
//      Returns: Array<{
//        id: number,
//        reviewer: string,
//        date: string,
//        rating: number,
//        text: string,
//        employeeId: number,
//        jobType: string,
//        customerEmail: string,
//        mediaUrl?: string,
//        flagged?: boolean
//      }>
//    - Supports filtering by rating, employeeId, jobType, and search (query params)
//    - Supports bulk actions (flag, export): POST /api/vendor/reviews/bulk-action { ids: number[], action: 'flag'|'export' }
//
// 5. Internal Notes:
//    - POST /api/vendor/reviews/:id/note { note: string }
//    - GET /api/vendor/reviews/:id/notes
//      Returns: Array<{ id: string, note: string, author: string, date: string }>
//
// 6. Task Creation:
//    - POST /api/vendor/reviews/:id/task { description: string }
//    - GET /api/vendor/reviews/:id/tasks
//      Returns: Array<{ id: string, description: string, status: string, created: string }>
//
// 7. Customer Insights:
//    - GET /api/vendor/customers/:customerId/reviews
//      Returns: Array<Review> (see above)
//    - GET /api/vendor/customers/:customerId/contact
//      Returns: { email: string, phone?: string }
//
// 8. Media Viewing:
//    - Reviews may include mediaUrl (photo/video). Provide secure, signed URLs if private.
//
// 9. All endpoints should validate that the requesting user is a manager for the vendor.
//
// End DEVELOPER NOTES

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Star, ArrowUpRight, ArrowDownRight, AlertTriangle, PartyPopper, Lightbulb, Trophy, ThumbsUp, ThumbsDown, Sparkles, Info, BarChart2, LineChart, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import SimpleTooltip from '@/components/ui/tooltip';
// TODO: Import authentication/role utilities as needed

// Placeholder: Only managers can access
const isManager = true; // Replace with real role check

export default function VendorReviewsPage() {
  if (!isManager) {
    return <div className="p-8 text-center text-red-600 font-semibold">Access denied. Only managers can view reviews.</div>;
  }

  // Mock data for demonstration
  const averageRating = 4.6;
  const totalReviews = 128;
  const trend = 0.2; // positive trend
  const highlights = [
    { type: "celebration", icon: <PartyPopper className="inline w-5 h-5 text-green-500 mr-1" />, text: "10 five-star reviews this month!" },
    { type: "concern", icon: <AlertTriangle className="inline w-5 h-5 text-red-500 mr-1" />, text: "2 reviews mentioned slow response time." },
    { type: "opportunity", icon: <Lightbulb className="inline w-5 h-5 text-yellow-500 mr-1" />, text: "Customers suggested adding weekend support." },
  ];

  // Mock employees (from vendor/employees/page.tsx)
  const employees = [
    { id: 1, name: 'Maria Lopez', email: 'maria@vendor.com', role: 'Technician', photo: 'https://randomuser.me/api/portraits/women/44.jpg' },
    { id: 2, name: 'James Lee', email: 'james@vendor.com', role: 'Technician', photo: 'https://randomuser.me/api/portraits/men/45.jpg' },
  ];
  // Mock review stats for each employee
  const employeeReviews = [
    { employeeId: 1, avgRating: 4.8, reviewCount: 32, recent: 'Maria was very professional and quick.' },
    { employeeId: 2, avgRating: 4.2, reviewCount: 21, recent: 'James did a great job, but arrived late.' },
  ];

  // Mock job types for reviews
  const jobTypes = ['Plumbing', 'Electrical', 'HVAC'];
  // Add jobType and customerEmail to reviewFeed
  const reviewFeed = [
    { id: 1, reviewer: 'John Smith', date: '2024-06-01', rating: 5, text: 'Excellent service, very satisfied!', employeeId: 1, jobType: 'Plumbing', customerEmail: 'john@example.com' },
    { id: 2, reviewer: 'Alice Brown', date: '2024-05-28', rating: 5, text: 'Maria was great, but the job took longer than expected.', employeeId: 1, jobType: 'Electrical', customerEmail: 'alice@example.com' },
    { id: 3, reviewer: 'Carlos Rivera', date: '2024-05-25', rating: 4, text: 'James was friendly, but there was a delay.', employeeId: 2, jobType: 'HVAC', customerEmail: 'carlos@example.com' },
    { id: 4, reviewer: 'Samantha Lee', date: '2024-05-20', rating: 5, text: 'Outstanding work by James!', employeeId: 2, jobType: 'Plumbing', customerEmail: 'samantha@example.com' },
    { id: 5, reviewer: 'Anonymous', date: '2024-05-18', rating: 2, text: 'Not happy with the response time.', employeeId: 1, jobType: 'Electrical', customerEmail: '' },
  ];
  // Job type filter
  const [jobTypeFilter, setJobTypeFilter] = useState('all');
  // Bulk selection state
  const [selectedReviews, setSelectedReviews] = useState([]);
  // Internal notes state
  const [internalNotes, setInternalNotes] = useState({});
  // Customer history modal state
  const [openCustomerModal, setOpenCustomerModal] = useState(false);
  const [modalCustomer, setModalCustomer] = useState(null);
  // Task creation state (mocked)
  const [createdTasks, setCreatedTasks] = useState([]);
  // Filter state
  const [ratingFilter, setRatingFilter] = React.useState('all');
  const [employeeFilter, setEmployeeFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');
  // Filtered reviews with job type
  const filteredReviews = reviewFeed.filter(r =>
    (ratingFilter === 'all' || r.rating === Number(ratingFilter)) &&
    (employeeFilter === 'all' || r.employeeId === Number(employeeFilter)) &&
    (jobTypeFilter === 'all' || r.jobType === jobTypeFilter)
  );
  // Repeat issues (mocked)
  const repeatIssues = ['slow response'];
  // Time-based trends (mocked data)
  const trendsData = [
    { month: 'Feb', avg: 4.2 },
    { month: 'Mar', avg: 4.4 },
    { month: 'Apr', avg: 4.5 },
    { month: 'May', avg: 4.6 },
    { month: 'Jun', avg: 4.7 },
  ];
  // Employee comparison (mocked)
  const employeeComparison = employees.map(emp => ({ name: emp.name, avg: employeeReviews.find(r => r.employeeId === emp.id)?.avgRating ?? 0 }));

  // Actionable Insights: Sentiment and Themes (mocked)
  const positiveReviews = reviewFeed.filter(r => r.rating >= 4).length;
  const negativeReviews = reviewFeed.filter(r => r.rating <= 2).length;
  const sentimentTrend = positiveReviews - negativeReviews;
  const commonThemes = ['professional', 'quick', 'friendly', 'late'];

  // Mock all reviews for each employee (now with date and rating)
  const allEmployeeReviews = {
    1: [
      { text: 'Maria was very professional and quick.', date: '2024-06-01', rating: 5 },
      { text: 'Great attention to detail.', date: '2024-05-28', rating: 5 },
      { text: 'Would hire again.', date: '2024-05-20', rating: 4 },
    ],
    2: [
      { text: 'James did a great job, but arrived late.', date: '2024-05-25', rating: 4 },
      { text: 'Friendly and helpful.', date: '2024-05-22', rating: 5 },
      { text: 'Resolved the issue efficiently.', date: '2024-05-18', rating: 5 },
    ],
  };

  // Performance Badges: Employees with 2+ five-star reviews
  const employeeBadges = {};
  Object.entries(allEmployeeReviews).forEach(([empId, reviews]) => {
    const fiveStars = reviews.filter(r => r.rating === 5).length;
    if (fiveStars >= 2) employeeBadges[empId] = { badge: 'Top Performer', count: fiveStars };
  });

  // State for employee review modal
  const [openEmpModal, setOpenEmpModal] = React.useState(false);
  const [modalEmp, setModalEmp] = React.useState(null);

  return (
    <div className="p-8 space-y-8">
      {/* Back to Dashboard Button */}
      <div className="mb-4">
        <a href="/vendor" className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 font-medium shadow-sm transition">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </a>
      </div>
      <h1 className="text-2xl font-bold mb-4">Business & Employee Reviews</h1>
      {/* Performance Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-8 items-center mb-6">
            {/* Average Rating */}
            <div className="flex items-center text-3xl font-bold">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`w-7 h-7 ${i < Math.floor(averageRating) ? 'text-yellow-400' : 'text-gray-300'}`} fill={i < Math.round(averageRating) ? '#facc15' : 'none'} />
              ))}
              <span className="ml-2 text-2xl text-gray-700">{averageRating.toFixed(1)}</span>
            </div>
            {/* Total Reviews */}
            <div className="text-lg text-gray-600">
              <span className="font-semibold text-2xl text-blue-700">{totalReviews}</span> total reviews
            </div>
            {/* Trend */}
            <div className="flex items-center text-lg">
              {trend >= 0 ? (
                <ArrowUpRight className="w-6 h-6 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="w-6 h-6 text-red-500 mr-1" />
              )}
              <span className={trend >= 0 ? "text-green-600" : "text-red-600"}>{Math.abs(trend).toFixed(2)}</span>
              <span className="ml-1 text-gray-500">since last month</span>
            </div>
          </div>
          {/* Highlights */}
          <div className="flex flex-wrap gap-6 mt-4">
            {highlights.map((h, idx) => (
              <div key={idx} className="flex items-center bg-gray-50 border rounded px-4 py-2 text-sm shadow-sm">
                {h.icon}
                <span>{h.text}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {/* Employee Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Celebration Banner for Top Performers */}
          {Object.keys(employeeBadges).length > 0 && (
            <div className="mb-4 flex flex-wrap gap-4 items-center bg-green-50 border border-green-200 rounded p-3">
              <Sparkles className="w-6 h-6 text-green-500" />
              <span className="font-semibold text-green-700">Congratulations! {Object.entries(employeeBadges).map(([empId, b]) => employees.find(e => e.id === Number(empId))?.name).join(', ')} received {Object.entries(employeeBadges).map(([_, b]) => b.count).join(', ')} five-star reviews!</span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border rounded">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left font-semibold">Photo</th>
                  <th className="p-2 text-left font-semibold">Name</th>
                  <th className="p-2 text-left font-semibold">Role</th>
                  <th className="p-2 text-left font-semibold">Avg. Rating</th>
                  <th className="p-2 text-left font-semibold">Reviews</th>
                  <th className="p-2 text-left font-semibold">Recent Feedback</th>
                  <th className="p-2 text-left font-semibold"></th>
                  <th className="p-2 text-left font-semibold">Badges</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const stats = employeeReviews.find(r => r.employeeId === emp.id);
                  const reviews = allEmployeeReviews[emp.id] || [];
                  return (
                    <tr key={emp.id} className="border-b">
                      <td className="p-2"><img src={emp.photo} alt={emp.name} className="w-10 h-10 rounded-full border" /></td>
                      <td className="p-2 font-medium">{emp.name}</td>
                      <td className="p-2 text-gray-500">{emp.role}</td>
                      <td className="p-2">
                        <span className="font-semibold text-yellow-600 flex items-center gap-1">{stats?.avgRating ?? '-'}<Star className="w-4 h-4 text-yellow-400 inline" fill="#facc15" /> </span>
                      </td>
                      <td className="p-2">{stats?.reviewCount ?? 0}</td>
                      <td className="p-2 text-gray-600">
                        {reviews[0] ? (
                          <span className="flex items-center gap-2">
                            <span>{reviews[0].text}</span>
                            <span className="text-xs text-gray-400">({reviews[0].date})</span>
                            <span className="flex items-center text-yellow-500">{Array.from({ length: reviews[0].rating }).map((_, i) => <Star className="w-3 h-3" key={i} fill="#facc15" />)}</span>
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-2">
                        {reviews.length > 1 && (
                          <button className="text-blue-600 underline text-xs" onClick={() => { setModalEmp(emp); setOpenEmpModal(true); }}>View All</button>
                        )}
                      </td>
                      <td className="p-2">
                        {employeeBadges[emp.id] && (
                          <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-semibold">
                            <Trophy className="w-4 h-4 text-yellow-500" /> {employeeBadges[emp.id].badge}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Employee Review Modal */}
          <Dialog open={openEmpModal} onOpenChange={setOpenEmpModal}>
            <DialogContent className="max-w-md">
              <div className="flex items-center gap-3 mb-2">
                {modalEmp && <img src={modalEmp.photo} alt={modalEmp.name} className="w-10 h-10 rounded-full border" />}
                <DialogTitle>All Reviews for {modalEmp?.name}</DialogTitle>
              </div>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                {(modalEmp && allEmployeeReviews[modalEmp.id]) ? allEmployeeReviews[modalEmp.id].map((rev, idx) => (
                  <li key={idx} className="text-gray-700 flex flex-col gap-1">
                    <span>{rev.text}</span>
                    <span className="text-xs text-gray-400">{rev.date}</span>
                    <span className="flex items-center text-yellow-500">{Array.from({ length: rev.rating }).map((_, i) => <Star className="w-3 h-3" key={i} fill="#facc15" />)}</span>
                  </li>
                )) : <li>No reviews found.</li>}
              </ul>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
      {/* Review Feed */}
      <Card className="shadow-lg rounded-xl border border-gray-200 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <BarChart2 className="w-6 h-6 text-blue-600" /> Review Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Average Rating by Month Bar Chart */}
          <div className="mb-8 p-4 bg-gray-50 rounded-lg shadow-sm">
            <div className="flex flex-col items-center mb-4">
              <div className="flex items-center gap-2 font-semibold text-lg">
                <BarChart2 className="w-5 h-5 text-blue-600" />
                <span>Average Rating by Month</span>
                <SimpleTooltip content="Shows the average review rating for each month. Helps track performance trends over time."><Info className="w-4 h-4 text-gray-400 cursor-pointer" /></SimpleTooltip>
              </div>
            </div>
            <div className="flex gap-8 items-end h-40 w-full">
              {trendsData.map((d, i) => (
                <div key={d.month} className="flex flex-col items-center w-16">
                  <div className="rounded-t w-10 shadow-md" style={{ height: `${d.avg * 30}px`, background: '#3b82f6' }}></div>
                  <span className="text-xs mt-2 font-semibold text-gray-700">{d.month}</span>
                  <span className="text-xs text-blue-700 font-bold">{d.avg.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Employee Comparison Bar Chart */}
          <div className="mb-8 p-4 bg-gray-50 rounded-lg shadow-sm">
            <div className="flex flex-col items-center mb-4">
              <div className="flex items-center gap-2 font-semibold text-lg">
                <BarChart2 className="w-5 h-5 text-blue-600" />
                <span>Employee Rating Comparison</span>
                <SimpleTooltip content="Compares the average review rating for each employee. Helps identify top and low performers."><Info className="w-4 h-4 text-gray-400 cursor-pointer" /></SimpleTooltip>
              </div>
            </div>
            <div className="flex gap-8 items-end h-40 w-full">
              {employeeComparison.map((e, i) => (
                <div key={e.name} className="flex flex-col items-center w-24">
                  <div className="rounded-t w-10 shadow-md" style={{ height: `${e.avg * 30}px`, background: '#60a5fa' }}></div>
                  <span className="text-xs mt-2 font-semibold text-gray-700">{e.name}</span>
                  <span className="text-xs text-blue-700 font-bold">{e.avg.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Repeat Issues */}
          {repeatIssues.length > 0 && (
            <div className="mb-6 flex items-center gap-2 bg-red-50 border border-red-200 rounded px-3 py-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="text-red-700 font-semibold flex items-center gap-1">
                Repeat issues
                <SimpleTooltip content="These are recurring negative comments from recent reviews. Addressing them can improve your ratings."><Info className="w-4 h-4 text-gray-400 cursor-pointer" /></SimpleTooltip>:
              </span>
              {repeatIssues.map((issue, idx) => (
                <span key={idx} className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs ml-1">{issue}</span>
              ))}
            </div>
          )}
          {/* Sticky Search Bar and Filters */}
          <div className="mb-4 flex flex-wrap gap-4 items-center sticky top-0 bg-white z-10 py-2 border-b">
            <input
              type="text"
              className="border rounded px-3 py-1 w-64"
              placeholder="Search reviews..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <label className="text-sm">Filter by rating:
              <select className="ml-2 border rounded px-2 py-1 pr-6" value={ratingFilter} onChange={e => setRatingFilter(e.target.value)}>
                <option value="all">All</option>
                {[5,4,3,2,1].map(r => <option key={r} value={r}>{r}★</option>)}
              </select>
            </label>
            <label className="text-sm">Filter by employee:
              <select className="ml-2 border rounded px-2 py-1 pr-6" value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)}>
                <option value="all">All</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
            </label>
            <label className="text-sm">Filter by job type:
              <select className="ml-2 border rounded px-2 py-1 pr-6" value={jobTypeFilter} onChange={e => setJobTypeFilter(e.target.value)}>
                <option value="all">All</option>
                {jobTypes.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </label>
            {/* Bulk Action Bar */}
            {selectedReviews.length > 0 && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded px-3 py-1 ml-4">
                <span className="text-blue-700 font-semibold">{selectedReviews.length} selected</span>
                <button className="text-xs text-blue-600 underline" onClick={() => setSelectedReviews([])}>Clear</button>
                <button className="text-xs text-green-600 underline" onClick={() => alert('Exported!')}>Export</button>
                <button className="text-xs text-red-600 underline" onClick={() => alert('Flagged!')}>Flag</button>
              </div>
            )}
          </div>
          {/* Review List */}
          <div className="space-y-4">
            {filteredReviews.length === 0 ? (
              <div className="text-gray-500 flex flex-col items-center py-8">
                <span className="text-2xl mb-2">📝</span>
                <span>No reviews found for selected filters or search.</span>
              </div>
            ) : (
              filteredReviews
                .filter(r => search === '' || r.text.toLowerCase().includes(search.toLowerCase()))
                .map(r => {
                  const emp = employees.find(e => e.id === r.employeeId);
                  const isSelected = selectedReviews.includes(r.id);
                  const customerReviews = reviewFeed.filter(rev => rev.reviewer === r.reviewer);
                  return (
                    <div key={r.id} className="border rounded p-4 bg-white shadow-sm flex flex-col md:flex-row md:items-center md:gap-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => {
                          setSelectedReviews(prev => e.target.checked ? [...prev, r.id] : prev.filter(id => id !== r.id));
                        }}
                        className="mr-2 accent-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <button
                            className="font-semibold text-blue-700 hover:underline"
                            onClick={() => { setModalCustomer(r); setOpenCustomerModal(true); }}
                          >
                            {r.reviewer}
                          </button>
                          <span className="text-xs text-gray-400 ml-2">{r.date}</span>
                          <span className="ml-4 flex items-center text-yellow-600 font-bold">
                            {Array.from({ length: r.rating }).map((_, i) => <Star className="w-4 h-4" key={i} fill="#facc15" />)}
                          </span>
                          <span className="ml-4 text-xs text-gray-500">{r.jobType}</span>
                        </div>
                        <div className="text-gray-700 mb-1">{r.text}</div>
                        {emp && <div className="text-xs text-gray-500">Employee: {emp.name}</div>}
                        {/* Internal Notes */}
                        <div className="mt-2 flex flex-col md:flex-row md:items-center md:gap-2">
                          <input
                            type="text"
                            className="border rounded px-2 py-1 text-xs w-full md:w-64"
                            placeholder="Add internal note..."
                            value={internalNotes[r.id] || ''}
                            onChange={e => setInternalNotes({ ...internalNotes, [r.id]: e.target.value })}
                          />
                          <button
                            className="text-xs text-green-600 underline mt-1 md:mt-0"
                            onClick={() => alert('Note saved!')}
                          >Save Note</button>
                          <button
                            className="text-xs text-purple-600 underline mt-1 md:mt-0"
                            onClick={() => setCreatedTasks([...createdTasks, r.id])}
                            disabled={createdTasks.includes(r.id)}
                          >{createdTasks.includes(r.id) ? 'Task Created' : 'Create Task'}</button>
                          {r.customerEmail && (
                            <button
                              className="text-xs text-blue-600 underline mt-1 md:mt-0"
                              onClick={() => alert(`Contacting ${r.customerEmail}`)}
                            >Contact Customer</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
          {/* Customer History Modal */}
          <Dialog open={openCustomerModal} onOpenChange={setOpenCustomerModal}>
            <DialogContent className="max-w-md">
              <DialogTitle>All Reviews from {modalCustomer?.reviewer}</DialogTitle>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                {modalCustomer && reviewFeed.filter(rev => rev.reviewer === modalCustomer.reviewer).map((rev, idx) => (
                  <li key={idx} className="text-gray-700 flex flex-col gap-1">
                    <span>{rev.text}</span>
                    <span className="text-xs text-gray-400">{rev.date}</span>
                    <span className="flex items-center text-yellow-500">{Array.from({ length: rev.rating }).map((_, i) => <Star className="w-3 h-3" key={i} fill="#facc15" />)}</span>
                  </li>
                ))}
              </ul>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
} 