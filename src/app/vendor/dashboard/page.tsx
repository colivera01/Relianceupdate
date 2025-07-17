"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { VendorAvailabilityPanel } from '../availability/VendorAvailabilityPanel';
import { VendorPricingPanel } from '../profile/VendorPricingPanel';
import { CalendarDays } from 'lucide-react';
import { CheckCircle, XCircle, Info } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import dynamic from 'next/dynamic';

// Temporarily disable Toaster to avoid SSR issues
// const Toaster = dynamic(() => import('@/components/ui/toaster').then(mod => ({ default: mod.Toaster })), {
//   ssr: false,
// });
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
    { id: 'logo', label: 'Add Business Logo', complete: true, section: 'profile' },
    { id: 'pricing', label: 'Set Pricing', complete: true, section: 'pricing' },
    { id: 'email', label: 'Verify Email', complete: false, section: 'profile' },
    { id: 'services', label: 'Add Services', complete: true, section: 'services' },
    { id: 'bio', label: 'Add Business Bio', complete: false, section: 'profile' },
  ];
  const completedSteps = profileSteps.filter(s => s.complete).length;
  const progress = Math.round((completedSteps / profileSteps.length) * 100);
  
  // State for profile completeness card visibility
  const [showProfileCard, setShowProfileCard] = useState(true);
  const [dismissedProfileCard, setDismissedProfileCard] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    const isDismissed = localStorage.getItem('profileCardDismissed') === 'true';
    if (isDismissed) {
      setDismissedProfileCard(true);
      setShowProfileCard(false);
    }
  }, []);

  const [showAvailability, setShowAvailability] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [calendarModal, setCalendarModal] = useState({ open: false, day: null, events: [] });
  const [reminders, setReminders] = useState({ review: true, invoice: false });
  const [showReminderToast, setShowReminderToast] = useState(false);
  
  // New state for quick action modals
  const [messageModal, setMessageModal] = useState({ open: false, client: null, mode: 'client' });
  const [invoiceModal, setInvoiceModal] = useState({ open: false, job: null });
  const [reviewModal, setReviewModal] = useState({ open: false, client: null, mode: 'client' });
  
  // State for review request form
  const [reviewData, setReviewData] = useState({
    reviewTypes: ['overall'],
    message: '',
    sendEmail: true,
    sendSMS: false,
    followUpDays: 7,
    includeRating: true
  });
  const [reviewErrors, setReviewErrors] = useState({});
  
  // State for invoice form
  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: '',
    dueDate: '',
    taxRate: 0,
    discount: 0,
    notes: '',
    paymentTerms: 'Net 30'
  });
  const [invoiceErrors, setInvoiceErrors] = useState({});
  
  // State for manual contact form
  const [manualContact, setManualContact] = useState({ email: '', phone: '', name: '' });
  const [messageText, setMessageText] = useState('');
  const [contactErrors, setContactErrors] = useState({ email: '', phone: '' });
  
  // Mock data for quick actions
  const availableClients = [
    { id: 1, name: 'Sarah Johnson', email: 'sarah@email.com', phone: '555-1234', lastJob: 'Kitchen Sink Repair' },
    { id: 2, name: 'Mike Chen', email: 'mike@email.com', phone: '555-5678', lastJob: 'Bathroom Faucet Installation' },
    { id: 3, name: 'Lisa Rodriguez', email: 'lisa@email.com', phone: '555-8765', lastJob: 'Garbage Disposal Repair' },
  ];
  
  const pendingJobs = [
    { id: 1, title: 'Kitchen Sink Repair', client: 'Sarah Johnson', amount: 120.00, status: 'completed', completedDate: '2024-01-10', reviewWindowOpen: true },
    { id: 2, title: 'Bathroom Faucet Installation', client: 'Mike Chen', amount: 95.00, status: 'completed', completedDate: '2024-01-08', reviewWindowOpen: false },
    { id: 3, title: 'Garbage Disposal Repair', client: 'Lisa Rodriguez', amount: 150.00, status: 'in progress', completedDate: null, reviewWindowOpen: false },
  ];

  // Review types and templates for our platform
  const reviewTypes = [
    { id: 'service', name: 'Service Quality', icon: '🔧', description: 'How well the service was performed' },
    { id: 'communication', name: 'Communication', icon: '💬', description: 'How well the vendor communicated' },
    { id: 'timeliness', name: 'Timeliness', icon: '⏰', description: 'How punctual and efficient the service was' },
    { id: 'value', name: 'Value for Money', icon: '💰', description: 'Whether the service was worth the cost' },
    { id: 'overall', name: 'Overall Experience', icon: '⭐', description: 'Complete experience rating' }
  ];

  const reviewTemplates = [
    {
      id: 'friendly',
      name: 'Friendly & Professional',
      message: 'Hi [Client Name]! We hope you\'re happy with the [Service] we completed. If you had a great experience, we\'d really appreciate a review on our platform. Your feedback helps other customers find reliable services and helps us improve. Thank you!'
    },
    {
      id: 'direct',
      name: 'Direct & Simple',
      message: 'Thank you for choosing us for your [Service]! If you\'re satisfied with our work, please leave us a review on our platform. Your feedback means a lot to us.'
    },
    {
      id: 'detailed',
      name: 'Detailed & Personal',
      message: 'Dear [Client Name], we\'re so glad we could help with your [Service]. We strive to provide excellent service and would love to hear about your experience. A review on our platform would be greatly appreciated and helps us continue serving our community. Thank you for your business!'
    },
    {
      id: 'platform',
      name: 'Platform-Focused',
      message: 'Hi [Client Name]! We just completed your [Service] and hope you\'re satisfied. Could you take a moment to share your experience on our platform? Your review helps build trust in our community and helps other customers make informed decisions. Thank you!'
    }
  ];

  function handleSaveReminders() {
    setShowReminderToast(true);
    setTimeout(() => setShowReminderToast(false), 2000);
  }

  // Quick action handlers
  function handleMessageClient() {
    setMessageModal({ open: true, client: null, mode: 'client' });
    setManualContact({ email: '', phone: '', name: '' });
    setMessageText('');
    setContactErrors({ email: '', phone: '' });
  }

  function handleSendInvoice() {
    setInvoiceModal({ open: true, job: null });
    // Generate invoice number
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    setInvoiceData({
      invoiceNumber,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      taxRate: 0,
      discount: 0,
      notes: '',
      paymentTerms: 'Net 30'
    });
    setInvoiceErrors({});
  }

  function handleRequestReview() {
    setReviewModal({ open: true, client: null, mode: 'client' });
    setReviewData({
      reviewTypes: ['overall'],
      message: '',
      sendEmail: true,
      sendSMS: false,
      followUpDays: 7,
      includeRating: true
    });
    setReviewErrors({});
  }

  function handleSendMessage(clientId, message, manualContactData = null) {
    // Mock API call to send message
    if (manualContactData) {
      console.log('Sending message to manual contact:', manualContactData, message);
      const contactInfo = manualContactData.email || manualContactData.phone;
      const contactType = manualContactData.email ? 'email' : 'phone';
      alert(`Message sent successfully to ${contactInfo} via ${contactType}!`);
    } else {
      console.log('Sending message to client:', clientId, message);
      alert('Message sent successfully!');
    }
    setMessageModal({ open: false, client: null, mode: 'client' });
    setManualContact({ email: '', phone: '', name: '' });
    setMessageText('');
  }

  function handleSendInvoiceAction(jobId, invoiceData) {
    // Mock API call to send invoice
    console.log('Sending invoice for job:', jobId, invoiceData);
    setInvoiceModal({ open: false, job: null });
    // Show success toast
    alert('Invoice sent successfully!');
  }

  function handleRequestReviewAction(clientId, reviewData) {
    // Mock API call to request review
    console.log('Requesting review from client:', clientId, reviewData);
    setReviewModal({ open: false, client: null, mode: 'client' });
    // Show success toast
    alert('Review request sent successfully!');
  }

  // Review-specific functions
  function getCompletedJobsForClient(clientId) {
    return pendingJobs.filter(job => 
      job.client === clientId && 
      job.status === 'completed' && 
      job.completedDate
    );
  }

  function getReviewableJobsForClient(clientId) {
    return pendingJobs.filter(job => 
      job.client === clientId && 
      job.status === 'completed' && 
      job.completedDate &&
      job.reviewWindowOpen
    );
  }

  function calculateReviewWindowStatus(completedDate) {
    if (!completedDate) return { isOpen: false, timeRemaining: 0 };
    
    const completed = new Date(completedDate);
    const now = new Date();
    const timeDiff = now.getTime() - completed.getTime();
    const hoursRemaining = 72 - (timeDiff / (1000 * 60 * 60));
    
    return {
      isOpen: hoursRemaining > 0,
      timeRemaining: Math.max(0, hoursRemaining)
    };
  }

  function formatTimeRemaining(hours) {
    if (hours <= 0) return 'Expired';
    
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    
    if (days > 0) {
      return `${days}d ${remainingHours}h remaining`;
    } else {
      return `${remainingHours}h remaining`;
    }
  }

  function formatReviewMessage(template, clientName, serviceName) {
    return template
      .replace('[Client Name]', clientName)
      .replace('[Service]', serviceName);
  }

  function validateReviewData() {
    const errors = {};
    
    if (reviewData.reviewTypes.length === 0) {
      errors.reviewTypes = 'Please select at least one review type';
    }
    
    if (!reviewData.message.trim()) {
      errors.message = 'Please enter a message or select a template';
    }
    
    if (!reviewData.sendEmail && !reviewData.sendSMS) {
      errors.notification = 'Please select at least one notification method';
    }
    
    setReviewErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleTemplateSelect(templateId) {
    const template = reviewTemplates.find(t => t.id === templateId);
    if (template && reviewModal.client) {
      const reviewableJobs = getReviewableJobsForClient(reviewModal.client);
      const latestJob = reviewableJobs[0]; // Most recent reviewable job
      
      const message = formatReviewMessage(
        template.message,
        reviewModal.client,
        latestJob?.title || 'service'
      );
      
      setReviewData({ ...reviewData, message });
    }
  }

  // Profile completeness functions
  function handleProfileStepClick(step) {
    if (!step.complete) {
      // Navigate to the appropriate section
      switch (step.section) {
        case 'profile':
          window.location.href = '/vendor/profile';
          break;
        case 'pricing':
          window.location.href = '/vendor/profile/pricing';
          break;
        case 'services':
          window.location.href = '/vendor/services';
          break;
        default:
          window.location.href = '/vendor/profile';
      }
    }
  }

  function handleDismissProfileCard() {
    setDismissedProfileCard(true);
    setShowProfileCard(false);
    // In a real app, you'd save this preference to localStorage or database
    localStorage.setItem('profileCardDismissed', 'true');
  }

  function handleShowProfileCard() {
    setDismissedProfileCard(false);
    setShowProfileCard(true);
    localStorage.removeItem('profileCardDismissed');
  }

  // Invoice calculation functions
  function calculateInvoiceTotals(jobAmount, taxRate, discount) {
    const subtotal = jobAmount;
    const discountAmount = (subtotal * discount) / 100;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = (taxableAmount * taxRate) / 100;
    const total = taxableAmount + taxAmount;
    
    return {
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      total
    };
  }

  function validateInvoiceData() {
    const errors = {};
    
    if (!invoiceData.invoiceNumber.trim()) {
      errors.invoiceNumber = 'Invoice number is required';
    }
    
    if (!invoiceData.dueDate) {
      errors.dueDate = 'Due date is required';
    } else {
      const dueDate = new Date(invoiceData.dueDate);
      const today = new Date();
      if (dueDate < today) {
        errors.dueDate = 'Due date cannot be in the past';
      }
    }
    
    if (invoiceData.taxRate < 0 || invoiceData.taxRate > 100) {
      errors.taxRate = 'Tax rate must be between 0 and 100';
    }
    
    if (invoiceData.discount < 0 || invoiceData.discount > 100) {
      errors.discount = 'Discount must be between 0 and 100';
    }
    
    setInvoiceErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Validation functions
  function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function validatePhone(phone) {
    // Remove all non-digit characters for validation
    const digitsOnly = phone.replace(/\D/g, '');
    
    // Check if it's a valid US phone number (10 digits)
    if (digitsOnly.length === 10) {
      return true;
    }
    
    // Check if it's a valid US phone number with country code (11 digits starting with 1)
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      return true;
    }
    
    return false;
  }

  function formatPhoneNumber(phone) {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX for 10 digits
    if (digitsOnly.length === 10) {
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    }
    
    // Format as +1 (XXX) XXX-XXXX for 11 digits starting with 1
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      return `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
    }
    
    // Return original if not a standard format
    return phone;
  }

  function handleContactChange(field, value) {
    setManualContact({ ...manualContact, [field]: value });
    
    // Clear error when user starts typing
    if (contactErrors[field]) {
      setContactErrors({ ...contactErrors, [field]: '' });
    }
    
    // Validate on blur or when field is complete
    if (field === 'email' && value) {
      if (!validateEmail(value)) {
        setContactErrors({ ...contactErrors, email: 'Please enter a valid email address' });
      }
    }
    
    if (field === 'phone' && value) {
      if (!validatePhone(value)) {
        setContactErrors({ ...contactErrors, phone: 'Please enter a valid 10-digit phone number' });
      }
    }
  }



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
          <Button variant="outline" className="justify-start w-full" onClick={() => setShowAvailability(true)}>
            <div className="flex items-center justify-between w-full">
              <span>📅 Schedule Availability</span>
              <UITooltip>
                <TooltipTrigger asChild>
                  <button className="ml-2 p-1 text-gray-400 hover:text-gray-600">
                    <Info className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={5}>
                  <p>Set your working hours and availability for client bookings</p>
                </TooltipContent>
              </UITooltip>
            </div>
          </Button>
          
          <Button variant="outline" className="justify-start w-full" onClick={() => setShowPricing(true)}>
            <div className="flex items-center justify-between w-full">
              <span>💲 Update Pricing</span>
              <UITooltip>
                <TooltipTrigger asChild>
                  <button className="ml-2 p-1 text-gray-400 hover:text-gray-600">
                    <Info className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={5}>
                  <p>Modify your service rates and pricing structure</p>
                </TooltipContent>
              </UITooltip>
            </div>
          </Button>
          
          <Link href="/vendor/support" passHref legacyBehavior>
            <Button variant="outline" className="justify-start w-full" as="a">
              <div className="flex items-center justify-between w-full">
                <span>🆘 Get Support</span>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <button className="ml-2 p-1 text-gray-400 hover:text-gray-600">
                      <Info className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={5}>
                    <p>Access help articles, FAQs, and contact support team</p>
                  </TooltipContent>
                </UITooltip>
              </div>
            </Button>
          </Link>
          
          <div className="border-t my-2"></div>
          
          <Button variant="outline" className="justify-start w-full" onClick={handleMessageClient}>
            <div className="flex items-center justify-between w-full">
              <span>💬 Message Client</span>
              <UITooltip>
                <TooltipTrigger asChild>
                  <button className="ml-2 p-1 text-gray-400 hover:text-gray-600">
                    <Info className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={5}>
                  <p>Send messages to clients or new contacts via email or phone</p>
                </TooltipContent>
              </UITooltip>
            </div>
          </Button>
          
          <Button variant="outline" className="justify-start w-full" onClick={handleSendInvoice}>
            <div className="flex items-center justify-between w-full">
              <span>🧾 Send Invoice</span>
              <UITooltip>
                <TooltipTrigger asChild>
                  <button className="ml-2 p-1 text-gray-400 hover:text-gray-600">
                    <Info className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={5}>
                  <p>Create and send professional invoices for completed jobs</p>
                </TooltipContent>
              </UITooltip>
            </div>
          </Button>
          
          <Button variant="outline" className="justify-start w-full" onClick={handleRequestReview}>
            <div className="flex items-center justify-between w-full">
              <span>⭐ Request Review</span>
              <UITooltip>
                <TooltipTrigger asChild>
                  <button className="ml-2 p-1 text-gray-400 hover:text-gray-600">
                    <Info className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={5}>
                  <p>Ask clients for reviews on jobs completed within 72 hours</p>
                </TooltipContent>
              </UITooltip>
            </div>
          </Button>
        </CardContent>
      </Card>
      {/* Profile Completeness Progress */}
      {showProfileCard && progress < 100 && !dismissedProfileCard && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Profile Completeness</CardTitle>
              <div className="flex gap-2">
                <button
                  onClick={handleDismissProfileCard}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                >
                  Don't show again
                </button>
                <button
                  onClick={() => setShowProfileCard(false)}
                  className="text-gray-400 hover:text-gray-700 text-lg"
                >
                  ×
                </button>
              </div>
            </div>
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
                  <button
                    onClick={() => handleProfileStepClick(step)}
                    className={`flex items-center gap-2 w-full text-left transition-colors ${
                      step.complete 
                        ? 'text-gray-700 cursor-default' 
                        : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded -ml-2'
                    }`}
                    disabled={step.complete}
                  >
                    <span>{step.label}</span>
                    {!step.complete && (
                      <span className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to complete →
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {progress < 100 && (
              <div className="mt-4 pt-3 border-t">
                <p className="text-sm text-gray-600 mb-2">
                  Complete your profile to improve your visibility and build trust with clients.
                </p>
                <Button 
                  size="sm" 
                  onClick={() => window.location.href = '/vendor/profile'}
                  className="w-full"
                >
                  Complete Profile
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Show Profile Card Button (when dismissed) */}
      {dismissedProfileCard && progress < 100 && (
        <Card className="border-dashed border-gray-300">
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">Profile is {progress}% complete</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleShowProfileCard}
              >
                Show Profile Completeness
              </Button>
            </div>
          </CardContent>
        </Card>
      )}


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

      {/* Message Client Modal */}
      {messageModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={() => setMessageModal({ open: false, client: null, mode: 'client' })}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-lg shadow-lg p-6 min-w-[500px] max-w-[90vw] max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Message Client</h2>
              <button onClick={() => setMessageModal({ open: false, client: null, mode: 'client' })} className="text-gray-400 hover:text-gray-700 text-2xl">✕</button>
            </div>
            <div className="space-y-4">
              {/* Contact Method Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact Method</label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    className={`px-3 py-2 text-sm border rounded-md font-medium ${
                      messageModal.mode === 'client' 
                        ? 'bg-blue-50 border-blue-200 text-blue-700' 
                        : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                    onClick={() => setMessageModal({ ...messageModal, mode: 'client', client: null })}
                  >
                    Select from Clients
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-2 text-sm border rounded-md font-medium ${
                      messageModal.mode === 'manual' 
                        ? 'bg-blue-50 border-blue-200 text-blue-700' 
                        : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                    onClick={() => setMessageModal({ ...messageModal, mode: 'manual', client: null })}
                  >
                    Manual Contact
                  </button>
                </div>
              </div>

              {/* Client Selection */}
              {messageModal.mode === 'client' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Client</label>
                  <select 
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onChange={(e) => setMessageModal({ ...messageModal, client: availableClients.find(c => c.id === parseInt(e.target.value)) })}
                  >
                    <option value="">Choose a client...</option>
                    {availableClients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name} - {client.lastJob}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Manual Contact Input */}
              {messageModal.mode === 'manual' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contact Information</label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <input
                          type="email"
                          placeholder="Email address"
                          className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            contactErrors.email ? 'border-red-500' : 'border-gray-300'
                          }`}
                          value={manualContact.email}
                          onChange={(e) => handleContactChange('email', e.target.value)}
                          onBlur={(e) => {
                            if (e.target.value && !validateEmail(e.target.value)) {
                              setContactErrors({ ...contactErrors, email: 'Please enter a valid email address' });
                            }
                          }}
                        />
                        {contactErrors.email && (
                          <p className="text-xs text-red-500 mt-1">{contactErrors.email}</p>
                        )}
                      </div>
                      <span className="text-gray-500 self-center">or</span>
                      <div className="flex-1">
                        <input
                          type="tel"
                          placeholder="(555) 123-4567"
                          className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            contactErrors.phone ? 'border-red-500' : 'border-gray-300'
                          }`}
                          value={manualContact.phone}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Allow only digits, spaces, parentheses, dashes, and plus
                            const cleaned = value.replace(/[^\d\s\(\)\-\+]/g, '');
                            handleContactChange('phone', cleaned);
                          }}
                          onBlur={(e) => {
                            if (e.target.value && !validatePhone(e.target.value)) {
                              setContactErrors({ ...contactErrors, phone: 'Please enter a valid 10-digit phone number' });
                            }
                          }}
                        />
                        {contactErrors.phone && (
                          <p className="text-xs text-red-500 mt-1">{contactErrors.phone}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Enter either email or phone number</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Phone format: (555) 123-4567 or 555-123-4567
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Client Name (Optional)</label>
                    <input
                      type="text"
                      placeholder="Client name for reference"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={manualContact.name}
                      onChange={(e) => setManualContact({ ...manualContact, name: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Message Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                <textarea 
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder="Type your message here..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                ></textarea>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setMessageModal({ open: false, client: null, mode: 'client' })}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => {
                    if (messageModal.mode === 'manual') {
                      // Manual contact mode
                      const hasValidEmail = manualContact.email && validateEmail(manualContact.email);
                      const hasValidPhone = manualContact.phone && validatePhone(manualContact.phone);
                      
                      if ((hasValidEmail || hasValidPhone) && messageText) {
                        // Format phone number if it's valid
                        const formattedContact = {
                          ...manualContact,
                          phone: hasValidPhone ? formatPhoneNumber(manualContact.phone) : manualContact.phone
                        };
                        handleSendMessage(null, messageText, formattedContact);
                      }
                    } else {
                      // Client selection mode
                      if (messageModal.client && messageText) {
                        handleSendMessage(messageModal.client.id, messageText);
                      }
                    }
                  }}
                  disabled={
                    messageModal.mode === 'manual' 
                      ? !messageText || 
                        (!manualContact.email && !manualContact.phone) ||
                        (manualContact.email && contactErrors.email) ||
                        (manualContact.phone && contactErrors.phone)
                      : !messageText || !messageModal.client
                  }
                >
                  Send Message
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Invoice Modal */}
      {invoiceModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={() => setInvoiceModal({ open: false, job: null })}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-lg shadow-lg p-6 min-w-[700px] max-w-[90vw] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Create & Send Invoice</h2>
              <button onClick={() => setInvoiceModal({ open: false, job: null })} className="text-gray-400 hover:text-gray-700 text-2xl">✕</button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Job Selection & Invoice Details */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Job</label>
                  <select 
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onChange={(e) => setInvoiceModal({ ...invoiceModal, job: pendingJobs.find(j => j.id === parseInt(e.target.value)) })}
                  >
                    <option value="">Choose a job...</option>
                    {pendingJobs.filter(job => job.status === 'completed').map(job => (
                      <option key={job.id} value={job.id}>
                        {job.title} - {job.client} (${job.amount})
                      </option>
                    ))}
                  </select>
                </div>

                {invoiceModal.job && (
                  <div className="bg-gray-50 p-4 rounded-md">
                    <h3 className="font-semibold text-lg mb-2">{invoiceModal.job.title}</h3>
                    <div className="space-y-1 text-sm">
                      <p><span className="font-medium">Client:</span> {invoiceModal.job.client}</p>
                      <p><span className="font-medium">Job Amount:</span> ${invoiceModal.job.amount}</p>
                      <p><span className="font-medium">Status:</span> <span className="text-green-600">Completed</span></p>
                    </div>
                  </div>
                )}

                {/* Invoice Details */}
                {invoiceModal.job && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Number</label>
                      <input
                        type="text"
                        className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          invoiceErrors.invoiceNumber ? 'border-red-500' : 'border-gray-300'
                        }`}
                        value={invoiceData.invoiceNumber}
                        onChange={(e) => setInvoiceData({ ...invoiceData, invoiceNumber: e.target.value })}
                        placeholder="INV-123456"
                      />
                      {invoiceErrors.invoiceNumber && (
                        <p className="text-xs text-red-500 mt-1">{invoiceErrors.invoiceNumber}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                      <input
                        type="date"
                        className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          invoiceErrors.dueDate ? 'border-red-500' : 'border-gray-300'
                        }`}
                        value={invoiceData.dueDate}
                        onChange={(e) => setInvoiceData({ ...invoiceData, dueDate: e.target.value })}
                      />
                      {invoiceErrors.dueDate && (
                        <p className="text-xs text-red-500 mt-1">{invoiceErrors.dueDate}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Payment Terms</label>
                      <select
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={invoiceData.paymentTerms}
                        onChange={(e) => setInvoiceData({ ...invoiceData, paymentTerms: e.target.value })}
                      >
                        <option value="Due on receipt">Due on receipt</option>
                        <option value="Net 7">Net 7</option>
                        <option value="Net 15">Net 15</option>
                        <option value="Net 30">Net 30</option>
                        <option value="Net 60">Net 60</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tax Rate (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            invoiceErrors.taxRate ? 'border-red-500' : 'border-gray-300'
                          }`}
                          value={invoiceData.taxRate}
                          onChange={(e) => setInvoiceData({ ...invoiceData, taxRate: parseFloat(e.target.value) || 0 })}
                          placeholder="0.00"
                        />
                        {invoiceErrors.taxRate && (
                          <p className="text-xs text-red-500 mt-1">{invoiceErrors.taxRate}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Discount (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            invoiceErrors.discount ? 'border-red-500' : 'border-gray-300'
                          }`}
                          value={invoiceData.discount}
                          onChange={(e) => setInvoiceData({ ...invoiceData, discount: parseFloat(e.target.value) || 0 })}
                          placeholder="0.00"
                        />
                        {invoiceErrors.discount && (
                          <p className="text-xs text-red-500 mt-1">{invoiceErrors.discount}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                      <textarea 
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={3}
                        placeholder="Add any additional notes to the invoice..."
                        value={invoiceData.notes}
                        onChange={(e) => setInvoiceData({ ...invoiceData, notes: e.target.value })}
                      ></textarea>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Invoice Preview */}
              {invoiceModal.job && (
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="font-semibold text-lg mb-4">Invoice Preview</h3>
                  
                  <div className="bg-white p-4 rounded-md shadow-sm">
                    <div className="border-b pb-3 mb-4">
                      <h4 className="font-bold text-lg">{invoiceData.invoiceNumber || 'INV-XXXXXX'}</h4>
                      <p className="text-sm text-gray-600">Due: {invoiceData.dueDate || 'Not set'}</p>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>${invoiceModal.job.amount}</span>
                      </div>
                      
                      {invoiceData.discount > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Discount ({invoiceData.discount}%):</span>
                          <span>-${calculateInvoiceTotals(invoiceModal.job.amount, invoiceData.taxRate, invoiceData.discount).discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      
                      {invoiceData.taxRate > 0 && (
                        <div className="flex justify-between">
                          <span>Tax ({invoiceData.taxRate}%):</span>
                          <span>${calculateInvoiceTotals(invoiceModal.job.amount, invoiceData.taxRate, invoiceData.discount).taxAmount.toFixed(2)}</span>
                        </div>
                      )}
                      
                      <div className="border-t pt-2 flex justify-between font-bold text-lg">
                        <span>Total:</span>
                        <span>${calculateInvoiceTotals(invoiceModal.job.amount, invoiceData.taxRate, invoiceData.discount).total.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500">
                      <p><strong>Payment Terms:</strong> {invoiceData.paymentTerms}</p>
                      {invoiceData.notes && (
                        <p className="mt-2"><strong>Notes:</strong> {invoiceData.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setInvoiceModal({ open: false, job: null })}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (validateInvoiceData() && invoiceModal.job) {
                    const totals = calculateInvoiceTotals(invoiceModal.job.amount, invoiceData.taxRate, invoiceData.discount);
                    handleSendInvoiceAction(invoiceModal.job.id, { 
                      ...invoiceData, 
                      ...totals,
                      jobDetails: invoiceModal.job 
                    });
                  }
                }}
                disabled={!invoiceModal.job}
              >
                Send Invoice
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Request Review Modal */}
      {reviewModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={() => setReviewModal({ open: false, client: null, mode: 'client' })}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-lg shadow-lg p-6 min-w-[700px] max-w-[90vw] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Request Customer Review</h2>
              <button onClick={() => setReviewModal({ open: false, client: null, mode: 'client' })} className="text-gray-400 hover:text-gray-700 text-2xl">✕</button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Client Selection & Review Setup */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Client with Reviewable Jobs</label>
                  <select 
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onChange={(e) => setReviewModal({ ...reviewModal, client: availableClients.find(c => c.id === parseInt(e.target.value)) })}
                  >
                    <option value="">Choose a client...</option>
                    {availableClients.map(client => {
                      const reviewableJobs = getReviewableJobsForClient(client);
                      const hasReviewableJobs = reviewableJobs.length > 0;
                      
                      return (
                        <option key={client.id} value={client.id} disabled={!hasReviewableJobs}>
                          {client.name} - {client.lastJob} {hasReviewableJobs ? `(${reviewableJobs.length} reviewable)` : '(No reviewable jobs)'}
                        </option>
                      );
                    })}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Only clients with jobs completed within the last 72 hours are shown</p>
                  
                  {/* Warning if no reviewable jobs */}
                  {(() => {
                    const totalReviewableJobs = availableClients.reduce((total, client) => {
                      return total + getReviewableJobsForClient(client).length;
                    }, 0);
                    
                    if (totalReviewableJobs === 0) {
                      return (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                          <div className="flex items-center gap-2">
                            <span className="text-yellow-600">⚠️</span>
                            <div>
                              <p className="text-sm font-medium text-yellow-800">No Reviewable Jobs</p>
                              <p className="text-xs text-yellow-700">All completed jobs are outside the 72-hour review window. Reviews can only be requested within 72 hours of job completion.</p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                                  {reviewModal.client && (
                    <div className="bg-gray-50 p-4 rounded-md">
                      <h3 className="font-semibold text-lg mb-2">{reviewModal.client.name}</h3>
                      <div className="space-y-1 text-sm">
                        <p><span className="font-medium">Last Job:</span> {reviewModal.client.lastJob}</p>
                        <p><span className="font-medium">Reviewable Jobs:</span> {getReviewableJobsForClient(reviewModal.client).length}</p>
                        <p><span className="font-medium">Contact:</span> {reviewModal.client.email}</p>
                      </div>
                      
                      {/* Reviewable Jobs List */}
                      {(() => {
                        const reviewableJobs = getReviewableJobsForClient(reviewModal.client);
                        if (reviewableJobs.length > 0) {
                          return (
                            <div className="mt-3 pt-3 border-t">
                              <p className="font-medium text-sm mb-2">Reviewable Jobs:</p>
                              <div className="space-y-2">
                                {reviewableJobs.map(job => {
                                  const windowStatus = calculateReviewWindowStatus(job.completedDate);
                                  return (
                                    <div key={job.id} className="bg-white p-2 rounded border">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <p className="font-medium text-sm">{job.title}</p>
                                          <p className="text-xs text-gray-600">Completed: {new Date(job.completedDate).toLocaleDateString()}</p>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded ${
                                          windowStatus.isOpen 
                                            ? 'bg-green-100 text-green-800' 
                                            : 'bg-red-100 text-red-800'
                                        }`}>
                                          {formatTimeRemaining(windowStatus.timeRemaining)}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}

                {/* Review Types Selection */}
                {reviewModal.client && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Review Categories</label>
                      <p className="text-xs text-gray-500 mb-3">Select which aspects you'd like the client to review</p>
                      <div className="space-y-2">
                        {reviewTypes.map(type => (
                          <label key={type.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={reviewData.reviewTypes.includes(type.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setReviewData({
                                    ...reviewData,
                                    reviewTypes: [...reviewData.reviewTypes, type.id]
                                  });
                                } else {
                                  setReviewData({
                                    ...reviewData,
                                    reviewTypes: reviewData.reviewTypes.filter(t => t !== type.id)
                                  });
                                }
                              }}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{type.icon}</span>
                                <span className="font-medium text-sm">{type.name}</span>
                              </div>
                              <p className="text-xs text-gray-600 mt-1">{type.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                      {reviewErrors.reviewTypes && (
                        <p className="text-xs text-red-500 mt-1">{reviewErrors.reviewTypes}</p>
                      )}
                    </div>

                    {/* Message Templates */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Message Template</label>
                      <select
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        onChange={(e) => handleTemplateSelect(e.target.value)}
                      >
                        <option value="">Choose a template or write custom message...</option>
                        {reviewTemplates.map(template => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Custom Message */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                      <textarea 
                        className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          reviewErrors.message ? 'border-red-500' : 'border-gray-300'
                        }`}
                        rows={4}
                        placeholder="Write your review request message..."
                        value={reviewData.message}
                        onChange={(e) => setReviewData({ ...reviewData, message: e.target.value })}
                      ></textarea>
                      {reviewErrors.message && (
                        <p className="text-xs text-red-500 mt-1">{reviewErrors.message}</p>
                      )}
                    </div>

                    {/* Notification Options */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Notification Method</label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={reviewData.sendEmail}
                            onChange={(e) => setReviewData({ ...reviewData, sendEmail: e.target.checked })}
                          />
                          <span className="text-sm">Send email notification</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={reviewData.sendSMS}
                            onChange={(e) => setReviewData({ ...reviewData, sendSMS: e.target.checked })}
                          />
                          <span className="text-sm">Send SMS notification</span>
                        </label>
                      </div>
                      {reviewErrors.notification && (
                        <p className="text-xs text-red-500 mt-1">{reviewErrors.notification}</p>
                      )}
                    </div>

                    {/* Additional Options */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Follow-up Reminder</label>
                        <select
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={reviewData.followUpDays}
                          onChange={(e) => setReviewData({ ...reviewData, followUpDays: parseInt(e.target.value) })}
                        >
                          <option value={0}>No follow-up</option>
                          <option value={3}>3 days</option>
                          <option value={7}>7 days</option>
                          <option value={14}>14 days</option>
                          <option value={30}>30 days</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={reviewData.includeRating}
                            onChange={(e) => setReviewData({ ...reviewData, includeRating: e.target.checked })}
                          />
                          <span className="text-sm">Include star rating request</span>
                        </label>
                        <p className="text-xs text-gray-500 mt-1">Ask clients to provide a star rating along with their review</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Preview */}
              {reviewModal.client && (
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="font-semibold text-lg mb-4">Review Request Preview</h3>
                  
                  <div className="bg-white p-4 rounded-md shadow-sm space-y-4">
                    <div className="border-b pb-3">
                      <h4 className="font-semibold">To: {reviewModal.client.name}</h4>
                      <p className="text-sm text-gray-600">{reviewModal.client.email}</p>
                    </div>

                    <div>
                      <h5 className="font-medium text-sm text-gray-700 mb-2">Review Categories:</h5>
                      <div className="space-y-1">
                        {reviewData.reviewTypes.map(typeId => {
                          const type = reviewTypes.find(t => t.id === typeId);
                          return (
                            <div key={typeId} className="flex items-center gap-2">
                              <span className="text-sm">{type?.icon}</span>
                              <span className="text-sm">{type?.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h5 className="font-medium text-sm text-gray-700 mb-2">Message:</h5>
                      <div className="bg-gray-50 p-3 rounded text-sm">
                        {reviewData.message || 'No message entered yet...'}
                      </div>
                    </div>

                    <div>
                      <h5 className="font-medium text-sm text-gray-700 mb-2">Notification:</h5>
                                           <div className="text-sm space-y-1">
                       {reviewData.sendEmail && <p>✓ Email notification</p>}
                       {reviewData.sendSMS && <p>✓ SMS notification</p>}
                       {reviewData.includeRating && <p>✓ Star rating request</p>}
                       {reviewData.followUpDays > 0 && (
                         <p>✓ Follow-up reminder in {reviewData.followUpDays} days</p>
                       )}
                     </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setReviewModal({ open: false, client: null, mode: 'client' })}>
                Cancel
              </Button>
              <Button 
                                  onClick={() => {
                    if (validateReviewData() && reviewModal.client) {
                      handleRequestReviewAction(reviewModal.client.id, {
                        ...reviewData,
                        client: reviewModal.client,
                        reviewTypes: reviewData.reviewTypes.map(typeId => reviewTypes.find(t => t.id === typeId))
                      });
                    }
                  }}
                                  disabled={!reviewModal.client || getReviewableJobsForClient(reviewModal.client).length === 0}
              >
                Send Review Request
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Toaster temporarily disabled to avoid SSR issues */}
      {/* <Toaster /> */}
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