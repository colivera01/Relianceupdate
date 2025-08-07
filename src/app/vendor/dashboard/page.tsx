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
  const [vendorData, setVendorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch vendor profile data on component mount
  useEffect(() => {
    const fetchVendorData = async () => {
      try {
        const response = await fetch('/api/vendor/profile', {
          headers: {
            'Authorization': 'Bearer temp-jwt-token'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setVendorData(data.profile);
        } else {
          setError('Failed to fetch vendor data');
        }
      } catch (error) {
        console.error('Error fetching vendor data:', error);
        setError('Failed to fetch vendor data');
      } finally {
        setLoading(false);
      }
    };

    fetchVendorData();
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Display vendor registration data at the top
  const renderVendorInfo = () => {
    if (!vendorData) return null;

    return (
      <div className="mb-8">
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Welcome, {vendorData.firstName} {vendorData.lastName}!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <h4 className="font-semibold text-gray-700">Business Information</h4>
                <p className="text-sm text-gray-600">Business: {vendorData.businessName}</p>
                <p className="text-sm text-gray-600">Type: {vendorData.businessType}</p>
                <p className="text-sm text-gray-600">Category: {vendorData.category}</p>
                <p className="text-sm text-gray-600">Founded: {vendorData.foundedYear}</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700">Contact Information</h4>
                <p className="text-sm text-gray-600">Email: {vendorData.email}</p>
                <p className="text-sm text-gray-600">Phone: {vendorData.phone}</p>
                <p className="text-sm text-gray-600">Location: {vendorData.city}, {vendorData.state}</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700">Services</h4>
                <p className="text-sm text-gray-600">
                  Service Types: {Array.isArray(vendorData.serviceTypes) ? vendorData.serviceTypes.join(', ') : vendorData.serviceTypes}
                </p>
                <p className="text-sm text-gray-600">
                  Specializations: {Array.isArray(vendorData.specializations) ? vendorData.specializations.join(', ') : vendorData.specializations}
                </p>
                <p className="text-sm text-gray-600">
                  Service Areas: {Array.isArray(vendorData.serviceAreas) ? vendorData.serviceAreas.join(', ') : vendorData.serviceAreas}
                </p>
              </div>
            </div>
            {vendorData.businessBio && (
              <div className="mt-4">
                <h4 className="font-semibold text-gray-700">Business Description</h4>
                <p className="text-sm text-gray-600">{vendorData.businessBio}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

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
    { 
      id: 'dev-1', 
      name: 'Maria Lopez', 
      photo: 'https://randomuser.me/api/portraits/women/44.jpg', 
      role: 'Technician', 
      lastPaired: '2024-06-01',
      status: 'active',
      permissions: 'full-access',
      email: 'maria@vendor.com',
      phone: '555-0101',
      sharedJobs: 12,
      lastActivity: '2 hours ago',
      pairingDate: '2024-01-15',
      isOnline: true
    },
    { 
      id: 'dev-2', 
      name: 'James Lee', 
      photo: 'https://randomuser.me/api/portraits/men/45.jpg', 
      role: 'Technician', 
      lastPaired: '2024-05-28',
      status: 'inactive',
      permissions: 'read-only',
      email: 'james@vendor.com',
      phone: '555-0102',
      sharedJobs: 8,
      lastActivity: '3 days ago',
      pairingDate: '2024-02-01',
      isOnline: false
    },
  ];



  const earningsSummary = {
    totalEarnings: 12450.75,
    pendingPayouts: 320.00,
    nextPayoutDate: '2024-06-15',
  };

  // Mock payments enabled status (should be fetched from profile in real app)
  const paymentsEnabled = false; // Set to true to show earnings card

  // Enhanced job events for the calendar with more details
  const jobEvents = [
    { 
      id: 1, 
      title: 'Kitchen Sink Repair', 
      date: '2024-06-10', 
      color: 'bg-blue-500',
      client: 'Sarah Johnson',
      time: '09:00',
      duration: 90,
      status: 'scheduled',
      amount: 120.00,
      notes: 'Leaky faucet, needs replacement parts'
    },
    { 
      id: 2, 
      title: 'Faucet Installation', 
      date: '2024-06-12', 
      color: 'bg-green-500',
      client: 'Mike Chen',
      time: '14:00',
      duration: 60,
      status: 'scheduled',
      amount: 95.00,
      notes: 'New bathroom faucet installation'
    },
    { 
      id: 3, 
      title: 'Garbage Disposal Repair', 
      date: '2024-06-15', 
      color: 'bg-yellow-500',
      client: 'Lisa Rodriguez',
      time: '10:30',
      duration: 120,
      status: 'in-progress',
      amount: 150.00,
      notes: 'Disposal not working, possible motor issue'
    },
    { 
      id: 4, 
      title: 'Pipe Leak Fix', 
      date: '2024-06-18', 
      color: 'bg-red-500',
      client: 'David Wilson',
      time: '08:00',
      duration: 180,
      status: 'scheduled',
      amount: 200.00,
      notes: 'Emergency repair - water damage in basement'
    },
    { 
      id: 5, 
      title: 'Kitchen Sink Repair', 
      date: '2024-06-10', 
      color: 'bg-blue-500',
      client: 'Emily Brown',
      time: '15:00',
      duration: 60,
      status: 'completed',
      amount: 110.00,
      notes: 'Minor clog, cleared successfully'
    },
    { 
      id: 6, 
      title: 'Faucet Installation', 
      date: '2024-06-12', 
      color: 'bg-green-500',
      client: 'John Smith',
      time: '11:00',
      duration: 90,
      status: 'scheduled',
      amount: 85.00,
      notes: 'Kitchen faucet replacement'
    },
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [unavailableDays, setUnavailableDays] = useState(new Set());
  
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



  // Enhanced clients data with more fields
  const [clients, setClients] = useState([
    { 
      id: 1, 
      name: 'Sarah Johnson', 
      email: 'sarah@email.com', 
      phone: '555-1234', 
      jobs: 5, 
      totalValue: 850,
      status: 'active',
      lastContact: '2024-06-15',
      notes: 'Prefers morning appointments.',
      tags: ['VIP', 'Regular'],
      avatar: 'https://randomuser.me/api/portraits/women/44.jpg'
    },
    { 
      id: 2, 
      name: 'Mike Chen', 
      email: 'mike@email.com', 
      phone: '555-5678', 
      jobs: 3, 
      totalValue: 420,
      status: 'active',
      lastContact: '2024-06-10',
      notes: 'Always pays on time.',
      tags: ['Punctual'],
      avatar: 'https://randomuser.me/api/portraits/men/45.jpg'
    },
    { 
      id: 3, 
      name: 'Lisa Rodriguez', 
      email: 'lisa@email.com', 
      phone: '555-8765', 
      jobs: 2, 
      totalValue: 280,
      status: 'active',
      lastContact: '2024-06-12',
      notes: 'Requested eco-friendly products.',
      tags: ['Eco-friendly'],
      avatar: 'https://randomuser.me/api/portraits/women/46.jpg'
    },
    { 
      id: 4, 
      name: 'David Wilson', 
      email: 'david@email.com', 
      phone: '555-4321', 
      jobs: 1, 
      totalValue: 150,
      status: 'inactive',
      lastContact: '2024-05-20',
      notes: 'New client, first job completed.',
      tags: ['New'],
      avatar: 'https://randomuser.me/api/portraits/men/47.jpg'
    },
    { 
      id: 5, 
      name: 'Emily Brown', 
      email: 'emily@email.com', 
      phone: '555-9876', 
      jobs: 4, 
      totalValue: 620,
      status: 'active',
      lastContact: '2024-06-14',
      notes: 'Lives in downtown area.',
      tags: ['Downtown', 'Regular'],
      avatar: 'https://randomuser.me/api/portraits/women/48.jpg'
    }
  ]);

  // Client management state
  const [clientModal, setClientModal] = useState({ open: false, client: null });
  const [showAddClient, setShowAddClient] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [selectedClients, setSelectedClients] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    phone: '',
    notes: '',
    tags: []
  });

  // Team Members Management State
  const [pairedUsersList, setPairedUsersList] = useState(pairedUsers);
  const [showAddPairing, setShowAddPairing] = useState(false);
  const [selectedPairedUsers, setSelectedPairedUsers] = useState(new Set());
  const [pairedUserSearch, setPairedUserSearch] = useState('');
  const [pairedUserFilter, setPairedUserFilter] = useState('all');
  const [pairedUserModal, setPairedUserModal] = useState({ open: false, user: null, mode: null });
  const [newPairing, setNewPairing] = useState({
    name: '',
    email: '',
    role: 'Technician',
    permissions: 'read-only'
  });

  // Enhanced Insights & Notifications State
  const [insights, setInsights] = useState([
    { 
      id: 1, 
      type: 'warning', 
      icon: '⚠️', 
      message: 'You have 3 jobs with overdue invoices.', 
      action: 'view-invoices',
      dismissed: false,
      priority: 'high'
    },
    { 
      id: 2, 
      type: 'positive', 
      icon: '💬', 
      message: 'Clients love your fast response time!', 
      action: 'view-reviews',
      dismissed: false,
      priority: 'medium'
    },
    { 
      id: 3, 
      type: 'info', 
      icon: '📈', 
      message: 'Your job volume is up 15% this month.', 
      action: 'view-analytics',
      dismissed: false,
      priority: 'low'
    },
    { 
      id: 4, 
      type: 'warning', 
      icon: '📅', 
      message: 'You have 2 upcoming license renewals.', 
      action: 'view-licenses',
      dismissed: false,
      priority: 'medium'
    },
    { 
      id: 5, 
      type: 'info', 
      icon: '🎯', 
      message: 'Kitchen Sink Repair is your top performing service.', 
      action: 'view-services',
      dismissed: false,
      priority: 'low'
    }
  ]);

  const [notifications, setNotifications] = useState([
    { 
      id: 1, 
      type: 'job', 
      icon: '📝', 
      message: 'New job request: Water Heater Repair', 
      time: '2m ago',
      read: false,
      actions: ['view', 'accept', 'decline'],
      data: { jobId: 123, clientName: 'John Smith', amount: 150 }
    },
    { 
      id: 2, 
      type: 'review', 
      icon: '⭐', 
      message: 'New review from Sarah Johnson', 
      time: '1h ago',
      read: false,
      actions: ['view', 'reply'],
      data: { reviewId: 456, rating: 5, clientName: 'Sarah Johnson' }
    },
    { 
      id: 3, 
      type: 'payment', 
      icon: '💵', 
      message: 'Payment received: $120.00', 
      time: '3h ago',
      read: true,
      actions: ['view-invoice', 'mark-processed'],
      data: { invoiceId: 789, amount: 120, clientName: 'Mike Chen' }
    },
    { 
      id: 4, 
      type: 'completion', 
      icon: '✅', 
      message: 'Job completed: Faucet Installation', 
      time: '1d ago',
      read: true,
      actions: ['view-job', 'send-invoice', 'request-review'],
      data: { jobId: 101, clientName: 'Lisa Rodriguez', amount: 95 }
    },
    { 
      id: 5, 
      type: 'reminder', 
      icon: '⏰', 
      message: 'Follow up with David Wilson for quote', 
      time: '2d ago',
      read: false,
      actions: ['view-client', 'send-message'],
      data: { clientId: 202, clientName: 'David Wilson' }
    }
  ]);

  const [notificationFilter, setNotificationFilter] = useState('all');
  const [notificationSearch, setNotificationSearch] = useState('');
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);

  // Helper functions for client management
  const filteredClients = clients.filter(client => {
    const matchesSearch = !searchQuery || 
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone.includes(searchQuery);
    
    const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const sortedClients = [...filteredClients].sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];
    
    if (sortBy === 'totalValue' || sortBy === 'jobs') {
      aValue = Number(aValue);
      bValue = Number(bValue);
    }
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const paginatedClients = sortedClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleEditClient = (client) => {
    setNewClient({
      name: client.name,
      email: client.email,
      phone: client.phone,
      notes: client.notes || '',
      tags: client.tags || []
    });
    setClientModal({ open: true, client, mode: 'edit' });
  };

  const handleContactClient = (client) => {
    setClientModal({ open: true, client, mode: 'contact' });
  };

  const handleViewClient = (client) => {
    setClientModal({ open: true, client, mode: 'view' });
  };

  const handleSaveClientEdit = () => {
    if (newClient.name && newClient.email) {
      setClients(clients.map(c => 
        c.id === clientModal.client.id 
          ? { ...c, ...newClient }
          : c
      ));
      setClientModal({ open: false, client: null, mode: null });
      setNewClient({ name: '', email: '', phone: '', notes: '', tags: [] });
      console.log('Updated client:', clientModal.client.name);
    } else {
      alert('Please fill in at least name and email');
    }
  };

  const handleSendEmail = (client) => {
    window.open(`mailto:${client.email}?subject=Service Inquiry`, '_blank');
  };

  const handleCallClient = (client) => {
    window.open(`tel:${client.phone}`, '_blank');
  };

  const handleSendSMS = (client) => {
    window.open(`sms:${client.phone}`, '_blank');
  };

  // Team Members Management Functions
  const handleRemovePairing = (userId) => {
    if (confirm('Are you sure you want to remove this team member?')) {
      setPairedUsersList(pairedUsersList.filter(user => user.id !== userId));
      console.log('Removed team member:', userId);
    }
  };

  const handleUpdatePairingPermissions = (userId, permissions) => {
    setPairedUsersList(pairedUsersList.map(user => 
      user.id === userId ? { ...user, permissions } : user
    ));
    console.log('Updated permissions for:', userId, 'to:', permissions);
  };

  const handleContactPairedUser = (user) => {
    setPairedUserModal({ open: true, user, mode: 'contact' });
  };

  const handleViewPairedUser = (user) => {
    setPairedUserModal({ open: true, user, mode: 'view' });
  };

  const handleAddNewPairing = () => {
    if (newPairing.name && newPairing.email) {
      const newUser = {
        id: `dev-${Date.now()}`,
        name: newPairing.name,
        email: newPairing.email,
        photo: `https://randomuser.me/api/portraits/${Math.random() > 0.5 ? 'men' : 'women'}/${Math.floor(Math.random() * 50)}.jpg`,
        role: newPairing.role,
        status: 'active',
        permissions: newPairing.permissions,
        phone: '555-0000',
        sharedJobs: 0,
        lastActivity: 'Just now',
        pairingDate: new Date().toISOString().split('T')[0],
        lastPaired: new Date().toISOString().split('T')[0],
        isOnline: false
      };
      setPairedUsersList([...pairedUsersList, newUser]);
      setNewPairing({ name: '', email: '', role: 'Technician', permissions: 'read-only' });
      setShowAddPairing(false);
      console.log('Added new team member:', newUser);
    } else {
      alert('Please fill in name and email');
    }
  };

  const handleBulkRemovePairings = () => {
    if (confirm(`Are you sure you want to remove ${selectedPairedUsers.size} team member(s)?`)) {
      setPairedUsersList(pairedUsersList.filter(user => !selectedPairedUsers.has(user.id)));
      setSelectedPairedUsers(new Set());
      console.log('Removed team members:', Array.from(selectedPairedUsers));
    }
  };

  // Enhanced online/offline status logic
  const getOnlineStatus = (user) => {
    // If user has isOnline property, use it
    if (user.hasOwnProperty('isOnline')) {
      return user.isOnline;
    }
    
    // Otherwise, determine based on pairing and activity
    const lastActivity = user.lastActivity;
    const lastPaired = user.lastPaired;
    
    // Check if last activity is recent (within last 30 minutes)
    const isRecentlyActive = lastActivity && (
      lastActivity.includes('Just now') || 
      lastActivity.includes('minutes ago') ||
      (lastActivity.includes('hour') && parseInt(lastActivity) <= 1)
    );
    
    // Check if paired recently (within last 24 hours)
    const isRecentlyPaired = lastPaired && (
      lastPaired === new Date().toISOString().split('T')[0] ||
      new Date(lastPaired) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );
    
    return isRecentlyActive || isRecentlyPaired;
  };

  // Filter and search team members
  const filteredPairedUsers = pairedUsersList.filter(user => {
    const matchesSearch = !pairedUserSearch || 
      user.name.toLowerCase().includes(pairedUserSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(pairedUserSearch.toLowerCase());
    
    const matchesFilter = pairedUserFilter === 'all' || user.status === pairedUserFilter;
    
    return matchesSearch && matchesFilter;
  });

  // Insights & Notifications Management Functions
  const handleInsightAction = (insight) => {
    console.log('Insight action:', insight.action, insight);
    switch (insight.action) {
      case 'view-invoices':
        alert('Navigating to overdue invoices...');
        break;
      case 'view-reviews':
        alert('Navigating to reviews...');
        break;
      case 'view-analytics':
        alert('Navigating to analytics...');
        break;
      case 'view-licenses':
        alert('Navigating to license management...');
        break;
      case 'view-services':
        alert('Navigating to services...');
        break;
      default:
        console.log('Unknown insight action:', insight.action);
    }
  };

  const handleDismissInsight = (insightId) => {
    setInsights(insights.map(insight => 
      insight.id === insightId ? { ...insight, dismissed: true } : insight
    ));
    console.log('Dismissed insight:', insightId);
  };

  const handleNotificationAction = (notification, action) => {
    console.log('Notification action:', action, notification);
    switch (action) {
      case 'view':
        alert(`Viewing ${notification.type}: ${notification.message}`);
        break;
      case 'accept':
        alert(`Accepting job: ${notification.data.jobId}`);
        break;
      case 'decline':
        alert(`Declining job: ${notification.data.jobId}`);
        break;
      case 'reply':
        alert(`Replying to review from ${notification.data.clientName}`);
        break;
      case 'view-invoice':
        alert(`Viewing invoice: ${notification.data.invoiceId}`);
        break;
      case 'mark-processed':
        alert(`Marking payment as processed: ${notification.data.invoiceId}`);
        break;
      case 'view-job':
        alert(`Viewing job: ${notification.data.jobId}`);
        break;
      case 'send-invoice':
        alert(`Sending invoice for job: ${notification.data.jobId}`);
        break;
      case 'request-review':
        alert(`Requesting review from ${notification.data.clientName}`);
        break;
      case 'view-client':
        alert(`Viewing client: ${notification.data.clientName}`);
        break;
      case 'send-message':
        alert(`Sending message to ${notification.data.clientName}`);
        break;
      default:
        console.log('Unknown notification action:', action);
    }
  };

  const handleMarkNotificationRead = (notificationId) => {
    setNotifications(notifications.map(notification => 
      notification.id === notificationId ? { ...notification, read: true } : notification
    ));
    console.log('Marked notification as read:', notificationId);
  };

  const handleClearAllNotifications = () => {
    if (confirm('Are you sure you want to clear all notifications?')) {
      setNotifications([]);
      console.log('Cleared all notifications');
    }
  };

  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map(notification => ({ ...notification, read: true })));
    console.log('Marked all notifications as read');
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch = !notificationSearch || 
      notification.message.toLowerCase().includes(notificationSearch.toLowerCase()) ||
      notification.data?.clientName?.toLowerCase().includes(notificationSearch.toLowerCase());
    
    const matchesFilter = notificationFilter === 'all' || notification.type === notificationFilter;
    
    return matchesSearch && matchesFilter;
  });

  // Filter insights (show only non-dismissed)
  const activeInsights = insights.filter(insight => !insight.dismissed);

  const handleBulkExport = () => {
    const selectedClientData = clients.filter(c => selectedClients.has(c.id));
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Jobs', 'Total Value', 'Status', 'Last Contact', 'Notes'],
      ...selectedClientData.map(client => [
        client.name,
        client.email,
        client.phone,
        client.jobs,
        client.totalValue,
        client.status,
        client.lastContact,
        client.notes
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clients-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    console.log('Exported clients:', selectedClientData);
  };

  const handleBulkMessage = () => {
    const selectedClientData = clients.filter(c => selectedClients.has(c.id));
    console.log('Sending bulk message to:', selectedClientData);
    alert(`Sending message to ${selectedClientData.length} clients`);
  };

  const handleBulkDelete = () => {
    if (confirm(`Are you sure you want to delete ${selectedClients.size} client(s)?`)) {
      setClients(clients.filter(c => !selectedClients.has(c.id)));
      setSelectedClients(new Set());
      console.log('Deleted clients:', Array.from(selectedClients));
    }
  };

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
      {/* Display vendor registration data */}
      {renderVendorInfo()}
      
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
      {/* Enhanced Actionable Insights & Recommendations */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Actionable Insights & Recommendations</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowNotificationSettings(true)}
            >
              Settings
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Proactive Insights Section */}
          <div className="space-y-3 mb-6">
            {activeInsights.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                No active insights at the moment.
              </div>
            ) : (
              activeInsights.map(insight => (
                <div 
                  key={insight.id} 
                  className={`rounded-lg px-4 py-3 flex items-center justify-between transition-all hover:shadow-md ${
                    insight.type === 'warning' ? 'bg-yellow-100 border-l-4 border-yellow-500' :
                    insight.type === 'positive' ? 'bg-green-100 border-l-4 border-green-500' :
                    'bg-blue-100 border-l-4 border-blue-500'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-xl">{insight.icon}</span>
                    <span className="font-medium">{insight.message}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleInsightAction(insight)}
                    >
                      Take Action
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handleDismissInsight(insight.id)}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Divider */}
          <div className="border-t my-4"></div>

          {/* Enhanced Notifications Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-gray-700">Recent Notifications & Alerts</div>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleMarkAllAsRead}
                >
                  Mark All Read
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleClearAllNotifications}
                >
                  Clear All
                </Button>
              </div>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search notifications..."
                  value={notificationSearch}
                  onChange={(e) => setNotificationSearch(e.target.value)}
                  className="w-full p-2 border rounded-md text-sm"
                />
              </div>
              <select
                value={notificationFilter}
                onChange={(e) => setNotificationFilter(e.target.value)}
                className="px-3 py-2 border rounded-md bg-white text-sm"
              >
                <option value="all">All Types</option>
                <option value="job">Jobs</option>
                <option value="review">Reviews</option>
                <option value="payment">Payments</option>
                <option value="completion">Completions</option>
                <option value="reminder">Reminders</option>
              </select>
            </div>

            {/* Notifications List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📭</div>
                  <div>No notifications found</div>
                </div>
              ) : (
                filteredNotifications.map(notification => (
                  <div 
                    key={notification.id} 
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all hover:bg-gray-50 ${
                      !notification.read ? 'bg-blue-50 border-blue-200' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-lg">{notification.icon}</span>
                      <div className="flex-1">
                        <div className={`font-medium ${!notification.read ? 'text-blue-900' : 'text-gray-800'}`}>
                          {notification.message}
                        </div>
                        <div className="text-xs text-gray-500">{notification.time}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {notification.actions.map(action => (
                        <Button 
                          key={action}
                          size="sm" 
                          variant="outline"
                          onClick={() => handleNotificationAction(notification, action)}
                          className="text-xs"
                        >
                          {action.charAt(0).toUpperCase() + action.slice(1).replace('-', ' ')}
                        </Button>
                      ))}
                      {!notification.read && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleMarkNotificationRead(notification.id)}
                          className="text-xs"
                        >
                          Mark Read
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Enhanced Client Management & CRM */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle>Clients</CardTitle>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full">
                  <span className="text-blue-600 font-medium">Total:</span>
                  <span className="text-blue-800 font-bold">{clients.length}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full">
                  <span className="text-green-600 font-medium">Active:</span>
                  <span className="text-green-800 font-bold">{clients.filter(c => c.status === 'active').length}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full">
                  <span className="text-gray-600 font-medium">Inactive:</span>
                  <span className="text-gray-800 font-bold">{clients.filter(c => c.status === 'inactive').length}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowBulkActions(!showBulkActions)}
                disabled={selectedClients.size === 0}
              >
                Bulk Actions ({selectedClients.size})
              </Button>
              <Button 
                size="sm"
                onClick={() => setShowAddClient(true)}
              >
                Add Client
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Client Statistics Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-blue-800">{clients.length}</div>
                  <div className="text-sm text-blue-600">Total Clients</div>
                </div>
                <div className="w-10 h-10 bg-blue-200 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 text-lg">👥</span>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-800">{clients.filter(c => c.status === 'active').length}</div>
                  <div className="text-sm text-green-600">Active Clients</div>
                </div>
                <div className="w-10 h-10 bg-green-200 rounded-lg flex items-center justify-center">
                  <span className="text-green-600 text-lg">✅</span>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-purple-800">{clients.reduce((sum, c) => sum + c.jobs, 0)}</div>
                  <div className="text-sm text-purple-600">Total Jobs</div>
                </div>
                <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center">
                  <span className="text-purple-600 text-lg">📋</span>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-orange-800">${clients.reduce((sum, c) => sum + c.totalValue, 0).toLocaleString()}</div>
                  <div className="text-sm text-orange-600">Total Value</div>
                </div>
                <div className="w-10 h-10 bg-orange-200 rounded-lg flex items-center justify-center">
                  <span className="text-orange-600 text-lg">💰</span>
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search clients by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 border rounded-md"
              />
            </div>
            <div className="flex items-center gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-md bg-white min-w-[120px]"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border rounded-md bg-white min-w-[140px]"
              >
                <option value="name">Sort by Name</option>
                <option value="jobs">Sort by Jobs</option>
                <option value="totalValue">Sort by Value</option>
                <option value="lastContact">Sort by Last Contact</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-2"
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </Button>
            </div>
          </div>

          {/* Bulk Actions */}
          {showBulkActions && selectedClients.size > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{selectedClients.size} client(s) selected</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleBulkExport()}>
                    Export Selected
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleBulkMessage()}>
                    Send Message
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleBulkDelete()}>
                    Delete Selected
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedClients.size === filteredClients.length && filteredClients.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedClients(new Set(filteredClients.map(c => c.id)));
                        } else {
                          setSelectedClients(new Set());
                        }
                      }}
                    />
                  </th>
                  <th className="p-3">Client</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Jobs</th>
                  <th className="p-3">Total Value</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Last Contact</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedClients.map(client => (
                  <tr key={client.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedClients.has(client.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedClients);
                          if (e.target.checked) {
                            newSelected.add(client.id);
                          } else {
                            newSelected.delete(client.id);
                          }
                          setSelectedClients(newSelected);
                        }}
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img 
                          src={client.avatar} 
                          alt={client.name} 
                          className="w-10 h-10 rounded-full border"
                        />
                        <div>
                          <div className="font-medium">{client.name}</div>
                          <div className="flex gap-1 mt-1">
                            {client.tags.map(tag => (
                              <span key={tag} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div>
                        <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline block">
                          {client.email}
                        </a>
                        <a href={`tel:${client.phone}`} className="text-gray-600 hover:text-blue-600 block">
                          {client.phone}
                        </a>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{client.jobs}</div>
                      <div className="text-xs text-gray-500">Total jobs</div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-green-600">${client.totalValue}</div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        client.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {client.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="text-sm">{new Date(client.lastContact).toLocaleDateString()}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleViewClient(client)}
                        >
                          View
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleEditClient(client)}
                        >
                          Edit
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleContactClient(client)}
                        >
                          Contact
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredClients.length)} of {filteredClients.length} clients
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="px-3 py-2 text-sm">
                Page {currentPage} of {Math.ceil(filteredClients.length / itemsPerPage)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(Math.ceil(filteredClients.length / itemsPerPage), currentPage + 1))}
                disabled={currentPage >= Math.ceil(filteredClients.length / itemsPerPage)}
              >
                Next
              </Button>
            </div>
          </div>

          {/* Empty State */}
          {filteredClients.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 text-6xl mb-4">👥</div>
              <div className="text-gray-500 mb-2">No clients found</div>
              <Button onClick={() => setShowAddClient(true)}>
                Add Your First Client
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Enhanced Team Members Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle>Team Members</CardTitle>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full">
                  <span className="text-blue-600 font-medium">Total:</span>
                  <span className="text-blue-800 font-bold">{pairedUsersList.length}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full">
                  <span className="text-green-600 font-medium">Online:</span>
                  <span className="text-green-800 font-bold">{pairedUsersList.filter(u => getOnlineStatus(u)).length}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full">
                  <span className="text-gray-600 font-medium">Offline:</span>
                  <span className="text-gray-800 font-bold">{pairedUsersList.filter(u => !getOnlineStatus(u)).length}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedPairedUsers(new Set())}
                disabled={selectedPairedUsers.size === 0}
              >
                Bulk Actions ({selectedPairedUsers.size})
              </Button>
                              <Button 
                  size="sm"
                  onClick={() => setShowAddPairing(true)}
                >
                  Add Team Member
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Team Members Statistics Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-blue-800">{pairedUsersList.length}</div>
                  <div className="text-sm text-blue-600">Total Team Members</div>
                </div>
                <div className="w-10 h-10 bg-blue-200 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 text-lg">👥</span>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-800">{pairedUsersList.filter(u => getOnlineStatus(u)).length}</div>
                  <div className="text-sm text-green-600">Currently Online</div>
                </div>
                <div className="w-10 h-10 bg-green-200 rounded-lg flex items-center justify-center">
                  <span className="text-green-600 text-lg">🟢</span>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-purple-800">{pairedUsersList.filter(u => u.permissions === 'full-access').length}</div>
                  <div className="text-sm text-purple-600">Full Access</div>
                </div>
                <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center">
                  <span className="text-purple-600 text-lg">🔓</span>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-orange-800">{pairedUsersList.reduce((sum, u) => sum + u.sharedJobs, 0)}</div>
                  <div className="text-sm text-orange-600">Total Shared Jobs</div>
                </div>
                <div className="w-10 h-10 bg-orange-200 rounded-lg flex items-center justify-center">
                  <span className="text-orange-600 text-lg">📋</span>
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search team members by name or email..."
                value={pairedUserSearch}
                onChange={(e) => setPairedUserSearch(e.target.value)}
                className="w-full p-2 border rounded-md"
              />
            </div>
            <div className="flex items-center gap-3">
              <select
                value={pairedUserFilter}
                onChange={(e) => setPairedUserFilter(e.target.value)}
                className="px-3 py-2 border rounded-md bg-white min-w-[120px]"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedPairedUsers.size > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{selectedPairedUsers.size} team member(s) selected</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={handleBulkRemovePairings}>
                    Remove Selected
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Team Members List */}
          <div className="space-y-3">
            {filteredPairedUsers.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-6xl mb-4">👥</div>
                <div className="text-gray-500 mb-2">No team members found</div>
                <Button onClick={() => setShowAddPairing(true)}>
                  Add Your First Team Member
                </Button>
              </div>
            ) : (
              filteredPairedUsers.map(user => (
                <div key={user.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedPairedUsers.has(user.id)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedPairedUsers);
                      if (e.target.checked) {
                        newSelected.add(user.id);
                      } else {
                        newSelected.delete(user.id);
                      }
                      setSelectedPairedUsers(newSelected);
                    }}
                    className="mr-2"
                  />
                  
                  <div className="relative">
                    <img src={user.photo} alt={user.name} className="w-12 h-12 rounded-full border" />
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                      getOnlineStatus(user) ? 'bg-green-500' : 'bg-gray-400'
                    }`} title={getOnlineStatus(user) ? 'Online' : 'Offline'}></div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{user.name}</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        user.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.status}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        user.permissions === 'full-access' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {user.permissions}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-1">{user.role}</div>
                    <div className="text-xs text-gray-500">
                      {user.sharedJobs} shared jobs • Last activity: {user.lastActivity}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleViewPairedUser(user)}
                    >
                      View
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleContactPairedUser(user)}
                    >
                      Contact
                    </Button>
                    <select
                      value={user.permissions}
                      onChange={(e) => handleUpdatePairingPermissions(user.id, e.target.value)}
                      className="px-3 py-2 text-xs border rounded-md bg-white min-w-[100px]"
                    >
                      <option value="read-only">Read Only</option>
                      <option value="full-access">Full Access</option>
                    </select>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleRemovePairing(user.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
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
          {/* Calendar Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {jobEvents.filter(ev => new Date(ev.date) >= new Date()).length}
              </div>
              <div className="text-sm text-gray-600">Upcoming Jobs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                ${jobEvents.reduce((sum, ev) => sum + (ev.amount || 0), 0).toFixed(0)}
              </div>
              <div className="text-sm text-gray-600">Total Value</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {jobEvents.filter(ev => ev.status === 'in-progress').length}
              </div>
              <div className="text-sm text-gray-600">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {new Set(jobEvents.map(ev => ev.client)).size}
              </div>
              <div className="text-sm text-gray-600">Active Clients</div>
            </div>
          </div>
          
          <CalendarMonth 
            jobEvents={jobEvents} 
            onDayClick={(day, events) => setCalendarModal({ open: true, day, events })}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            unavailableDays={unavailableDays}
            setUnavailableDays={setUnavailableDays}
          />
        </CardContent>
      </Card>
      {/* Client Modal - View/Edit/Contact */}
      {clientModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {clientModal.mode === 'view' && `Client Profile - ${clientModal.client.name}`}
                {clientModal.mode === 'edit' && `Edit Client - ${clientModal.client.name}`}
                {clientModal.mode === 'contact' && `Contact ${clientModal.client.name}`}
              </h3>
              <button 
                onClick={() => setClientModal({ open: false, client: null, mode: null })}
                className="text-gray-400 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            
            {/* View Mode */}
            {clientModal.mode === 'view' && (
              <div className="space-y-6">
                {/* Client Info */}
                <div className="flex items-start gap-4">
                  <img 
                    src={clientModal.client.avatar} 
                    alt={clientModal.client.name} 
                    className="w-16 h-16 rounded-full border"
                  />
                  <div className="flex-1">
                    <h4 className="text-xl font-semibold">{clientModal.client.name}</h4>
                    <div className="flex gap-2 mt-2">
                      {clientModal.client.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        clientModal.client.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {clientModal.client.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <a href={`mailto:${clientModal.client.email}`} className="text-blue-600 hover:underline">
                      {clientModal.client.email}
                    </a>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <a href={`tel:${clientModal.client.phone}`} className="text-blue-600 hover:underline">
                      {clientModal.client.phone}
                    </a>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{clientModal.client.jobs}</div>
                    <div className="text-sm text-gray-600">Total Jobs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">${clientModal.client.totalValue}</div>
                    <div className="text-sm text-gray-600">Total Value</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600">Last Contact</div>
                    <div className="text-sm font-medium">{new Date(clientModal.client.lastContact).toLocaleDateString()}</div>
                  </div>
                </div>

                {/* Notes */}
                {clientModal.client.notes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <div className="p-3 bg-gray-50 rounded-md text-sm">
                      {clientModal.client.notes}
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={() => setClientModal({ ...clientModal, mode: 'edit' })}>
                    Edit Client
                  </Button>
                  <Button onClick={() => setClientModal({ ...clientModal, mode: 'contact' })}>
                    Contact Client
                  </Button>
                  <Button variant="outline" onClick={() => setClientModal({ open: false, client: null, mode: null })}>
                    Close
                  </Button>
                </div>
              </div>
            )}

            {/* Edit Mode */}
            {clientModal.mode === 'edit' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={newClient.name}
                    onChange={(e) => setNewClient({...newClient, name: e.target.value})}
                    className="w-full p-2 border rounded-md"
                    placeholder="Enter client name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({...newClient, email: e.target.value})}
                    className="w-full p-2 border rounded-md"
                    placeholder="Enter email address"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                    className="w-full p-2 border rounded-md"
                    placeholder="Enter phone number"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    value={newClient.notes}
                    onChange={(e) => setNewClient({...newClient, notes: e.target.value})}
                    className="w-full p-2 border rounded-md"
                    rows="3"
                    placeholder="Additional notes..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={newClient.status || clientModal.client.status}
                    onChange={(e) => setNewClient({...newClient, status: e.target.value})}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setClientModal({ open: false, client: null, mode: null })}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveClientEdit}
                    disabled={!newClient.name || !newClient.email}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            )}

            {/* Contact Mode */}
            {clientModal.mode === 'contact' && (
              <div className="space-y-6">
                <div className="text-center">
                  <img 
                    src={clientModal.client.avatar} 
                    alt={clientModal.client.name} 
                    className="w-16 h-16 rounded-full border mx-auto mb-3"
                  />
                  <h4 className="text-lg font-semibold">{clientModal.client.name}</h4>
                  <p className="text-gray-600">{clientModal.client.email}</p>
                  <p className="text-gray-600">{clientModal.client.phone}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Button 
                    onClick={() => handleSendEmail(clientModal.client)}
                    className="flex flex-col items-center p-4 h-auto"
                  >
                    <span className="text-2xl mb-2">📧</span>
                    <span className="text-sm">Send Email</span>
                  </Button>
                  
                  <Button 
                    onClick={() => handleCallClient(clientModal.client)}
                    className="flex flex-col items-center p-4 h-auto"
                  >
                    <span className="text-2xl mb-2">📞</span>
                    <span className="text-sm">Call Client</span>
                  </Button>
                  
                  <Button 
                    onClick={() => handleSendSMS(clientModal.client)}
                    className="flex flex-col items-center p-4 h-auto"
                  >
                    <span className="text-2xl mb-2">💬</span>
                    <span className="text-sm">Send SMS</span>
                  </Button>
                </div>

                <div className="pt-4 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => setMessageModal({ open: true, client: clientModal.client, mode: 'client' })}
                    className="w-full"
                  >
                    Send Platform Message
                  </Button>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setClientModal({ open: false, client: null, mode: null })}
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Team Member Modal */}
      {showAddPairing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add New Team Member</h3>
              <button 
                onClick={() => setShowAddPairing(false)}
                className="text-gray-400 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={newPairing.name}
                  onChange={(e) => setNewPairing({...newPairing, name: e.target.value})}
                  className="w-full p-2 border rounded-md"
                  placeholder="Enter user name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={newPairing.email}
                  onChange={(e) => setNewPairing({...newPairing, email: e.target.value})}
                  className="w-full p-2 border rounded-md"
                  placeholder="Enter email address"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={newPairing.role}
                  onChange={(e) => setNewPairing({...newPairing, role: e.target.value})}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="Technician">Technician</option>
                  <option value="Assistant">Assistant</option>
                  <option value="Manager">Manager</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Permissions</label>
                <select
                  value={newPairing.permissions}
                  onChange={(e) => setNewPairing({...newPairing, permissions: e.target.value})}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="read-only">Read Only</option>
                  <option value="full-access">Full Access</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowAddPairing(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddNewPairing}
                disabled={!newPairing.name || !newPairing.email}
              >
                Add Team Member
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Team Member Modal - View/Contact */}
      {pairedUserModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {pairedUserModal.mode === 'view' && `User Profile - ${pairedUserModal.user.name}`}
                {pairedUserModal.mode === 'contact' && `Contact ${pairedUserModal.user.name}`}
              </h3>
              <button 
                onClick={() => setPairedUserModal({ open: false, user: null, mode: null })}
                className="text-gray-400 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            
            {/* View Mode */}
            {pairedUserModal.mode === 'view' && (
              <div className="space-y-6">
                {/* User Info */}
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <img 
                      src={pairedUserModal.user.photo} 
                      alt={pairedUserModal.user.name} 
                      className="w-16 h-16 rounded-full border"
                    />
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${
                      getOnlineStatus(pairedUserModal.user) ? 'bg-green-500' : 'bg-gray-400'
                    }`} title={getOnlineStatus(pairedUserModal.user) ? 'Online' : 'Offline'}></div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-semibold">{pairedUserModal.user.name}</h4>
                    <div className="flex gap-2 mt-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        pairedUserModal.user.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {pairedUserModal.user.status}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        pairedUserModal.user.permissions === 'full-access' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {pairedUserModal.user.permissions}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <a href={`mailto:${pairedUserModal.user.email}`} className="text-blue-600 hover:underline">
                      {pairedUserModal.user.email}
                    </a>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <a href={`tel:${pairedUserModal.user.phone}`} className="text-blue-600 hover:underline">
                      {pairedUserModal.user.phone}
                    </a>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{pairedUserModal.user.sharedJobs}</div>
                    <div className="text-sm text-gray-600">Shared Jobs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600">Role</div>
                    <div className="text-sm font-medium">{pairedUserModal.user.role}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600">Last Activity</div>
                    <div className="text-sm font-medium">{pairedUserModal.user.lastActivity}</div>
                  </div>
                </div>

                {/* Team Member Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Join Date</label>
                    <div className="text-sm">{pairedUserModal.user.pairingDate}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Active</label>
                    <div className="text-sm">{pairedUserModal.user.lastPaired}</div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={() => setPairedUserModal({ ...pairedUserModal, mode: 'contact' })}>
                    Contact User
                  </Button>
                  <Button variant="outline" onClick={() => setPairedUserModal({ open: false, user: null, mode: null })}>
                    Close
                  </Button>
                </div>
              </div>
            )}

            {/* Contact Mode */}
            {pairedUserModal.mode === 'contact' && (
              <div className="space-y-6">
                <div className="text-center">
                  <img 
                    src={pairedUserModal.user.photo} 
                    alt={pairedUserModal.user.name} 
                    className="w-16 h-16 rounded-full border mx-auto mb-3"
                  />
                  <h4 className="text-lg font-semibold">{pairedUserModal.user.name}</h4>
                  <p className="text-gray-600">{pairedUserModal.user.email}</p>
                  <p className="text-gray-600">{pairedUserModal.user.phone}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Button 
                    onClick={() => window.open(`mailto:${pairedUserModal.user.email}`, '_blank')}
                    className="flex flex-col items-center p-4 h-auto"
                  >
                    <span className="text-2xl mb-2">📧</span>
                    <span className="text-sm">Send Email</span>
                  </Button>
                  
                  <Button 
                    onClick={() => window.open(`tel:${pairedUserModal.user.phone}`, '_blank')}
                    className="flex flex-col items-center p-4 h-auto"
                  >
                    <span className="text-2xl mb-2">📞</span>
                    <span className="text-sm">Call User</span>
                  </Button>
                  
                  <Button 
                    onClick={() => window.open(`sms:${pairedUserModal.user.phone}`, '_blank')}
                    className="flex flex-col items-center p-4 h-auto"
                  >
                    <span className="text-2xl mb-2">💬</span>
                    <span className="text-sm">Send SMS</span>
                  </Button>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setPairedUserModal({ open: false, user: null, mode: null })}
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notification Settings Modal */}
      {showNotificationSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Notification Settings</h3>
              <button 
                onClick={() => setShowNotificationSettings(false)}
                className="text-gray-400 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={notificationSettings.job}
                    onChange={(e) => setNotificationSettings({...notificationSettings, job: e.target.checked})}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Job Notifications</span>
                </label>
                <p className="text-xs text-gray-500 ml-6">New job requests, updates, and completions</p>
              </div>
              
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={notificationSettings.review}
                    onChange={(e) => setNotificationSettings({...notificationSettings, review: e.target.checked})}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Review Notifications</span>
                </label>
                <p className="text-xs text-gray-500 ml-6">New reviews and rating updates</p>
              </div>
              
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={notificationSettings.payout}
                    onChange={(e) => setNotificationSettings({...notificationSettings, payout: e.target.checked})}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Payment Notifications</span>
                </label>
                <p className="text-xs text-gray-500 ml-6">Payment received and payout updates</p>
              </div>
              
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={notificationSettings.support}
                    onChange={(e) => setNotificationSettings({...notificationSettings, support: e.target.checked})}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Support Notifications</span>
                </label>
                <p className="text-xs text-gray-500 ml-6">Support tickets and system updates</p>
              </div>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowNotificationSettings(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  handleSaveNotifications();
                  setShowNotificationSettings(false);
                }}
              >
                Save Settings
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {showAddClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add New Client</h3>
              <button 
                onClick={() => setShowAddClient(false)}
                className="text-gray-400 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={newClient.name}
                  onChange={(e) => setNewClient({...newClient, name: e.target.value})}
                  className="w-full p-2 border rounded-md"
                  placeholder="Enter client name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient({...newClient, email: e.target.value})}
                  className="w-full p-2 border rounded-md"
                  placeholder="Enter email address"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                  className="w-full p-2 border rounded-md"
                  placeholder="Enter phone number"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={newClient.notes}
                  onChange={(e) => setNewClient({...newClient, notes: e.target.value})}
                  className="w-full p-2 border rounded-md"
                  rows="3"
                  placeholder="Additional notes..."
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowAddClient(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (newClient.name && newClient.email) {
                    const client = {
                      ...newClient,
                      id: Date.now(),
                      jobs: 0,
                      totalValue: 0,
                      status: 'active',
                      lastContact: new Date().toISOString().split('T')[0],
                      tags: [],
                      avatar: `https://randomuser.me/api/portraits/${Math.random() > 0.5 ? 'men' : 'women'}/${Math.floor(Math.random() * 50)}.jpg`
                    };
                    setClients([...clients, client]);
                    setNewClient({ name: '', email: '', phone: '', notes: '', tags: [] });
                    setShowAddClient(false);
                    console.log('Added new client:', client);
                  } else {
                    alert('Please fill in at least name and email');
                  }
                }}
                disabled={!newClient.name || !newClient.email}
              >
                Add Client
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Calendar Day Modal */}
      {calendarModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={() => setCalendarModal({ open: false, day: null, events: [] })}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-lg shadow-lg p-6 min-w-[400px] max-w-[90vw] max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold">
                  Jobs for {new Date(currentDate.getFullYear(), currentDate.getMonth(), calendarModal.day).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </h2>
                <p className="text-sm text-gray-600">
                  {calendarModal.events.length} job{calendarModal.events.length !== 1 ? 's' : ''} scheduled
                </p>
              </div>
              <button onClick={() => setCalendarModal({ open: false, day: null, events: [] })} className="text-gray-400 hover:text-gray-700 text-2xl">✕</button>
            </div>
            
            {calendarModal.events.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-6xl mb-4">📅</div>
                <div className="text-gray-500 mb-2">No jobs scheduled for this day</div>
                <Button 
                  size="sm" 
                  onClick={() => {
                    setCalendarModal({ open: false, day: null, events: [] });
                    // Trigger the add booking modal in the calendar component
                    setTimeout(() => {
                      const event = new CustomEvent('openAddBooking', { 
                        detail: { day: calendarModal.day } 
                      });
                      window.dispatchEvent(event);
                    }, 100);
                  }}
                >
                  Add First Booking
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Daily Summary */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total Earnings:</span>
                      <div className="font-semibold text-green-600">
                        ${calendarModal.events.reduce((sum, ev) => sum + (ev.amount || 0), 0).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Hours:</span>
                      <div className="font-semibold">
                        {calendarModal.events.reduce((sum, ev) => sum + (ev.duration || 0), 0) / 60} hours
                      </div>
                    </div>
                  </div>
                </div>

                {/* Jobs List */}
                <div className="space-y-3">
                  {calendarModal.events.map(ev => (
                    <div key={ev.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${ev.color}`}></div>
                          <h3 className="font-semibold text-lg">{ev.title}</h3>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-600">${ev.amount?.toFixed(2) || '0.00'}</div>
                          <div className="text-xs text-gray-500">{ev.duration} min</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-600">Client:</span>
                          <div className="font-medium">{ev.client}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Time:</span>
                          <div className="font-medium">{ev.time}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Status:</span>
                          <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            ev.status === 'completed' ? 'bg-green-100 text-green-800' :
                            ev.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                            ev.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {ev.status?.replace('-', ' ') || 'scheduled'}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600">Duration:</span>
                          <div className="font-medium">{ev.duration} minutes</div>
                        </div>
                      </div>
                      
                      {ev.notes && (
                        <div className="mb-3">
                          <span className="text-gray-600 text-sm">Notes:</span>
                          <div className="text-sm bg-gray-50 p-2 rounded mt-1">{ev.notes}</div>
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            console.log('Viewing details for job:', ev);
                            // In a real app, this would open a detailed job view
                            alert(`Viewing details for: ${ev.title}\nClient: ${ev.client}\nTime: ${ev.time}\nAmount: $${ev.amount}`);
                          }}
                        >
                          View Details
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            console.log('Editing job:', ev);
                            // In a real app, this would open an edit form
                            alert(`Editing job: ${ev.title}`);
                          }}
                        >
                          Edit
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            console.log('Contacting client for job:', ev);
                            // In a real app, this would open a contact form
                            alert(`Contacting client: ${ev.client}\nPhone/Email would be shown here`);
                          }}
                        >
                          Contact Client
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Quick Actions */}
            <div className="flex gap-2 mt-6 pt-4 border-t">
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setCalendarModal({ open: false, day: null, events: [] });
                  setTimeout(() => {
                    const event = new CustomEvent('openAddBooking', { 
                      detail: { day: calendarModal.day } 
                    });
                    window.dispatchEvent(event);
                  }, 100);
                }}
              >
                Add New Booking
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  const dayKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(calendarModal.day).padStart(2, '0')}`;
                  const newUnavailableDays = new Set(unavailableDays);
                  
                  if (newUnavailableDays.has(dayKey)) {
                    newUnavailableDays.delete(dayKey);
                    setUnavailableDays(newUnavailableDays);
                    alert(`Day ${calendarModal.day} marked as available again`);
                  } else {
                    newUnavailableDays.add(dayKey);
                    setUnavailableDays(newUnavailableDays);
                    alert(`Day ${calendarModal.day} marked as unavailable`);
                  }
                  
                  setCalendarModal({ open: false, day: null, events: [] });
                  // In a real app, this would be saved to the backend
                  console.log('Updated unavailable days:', Array.from(newUnavailableDays));
                }}
              >
                {unavailableDays.has(`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(calendarModal.day).padStart(2, '0')}`) 
                  ? 'Mark Day Available' 
                  : 'Mark Day Unavailable'
                }
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  // Export day schedule
                  const dayData = {
                    date: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(calendarModal.day).padStart(2, '0')}`,
                    jobs: calendarModal.events,
                    totalEarnings: calendarModal.events.reduce((sum, ev) => sum + (ev.amount || 0), 0),
                    totalHours: calendarModal.events.reduce((sum, ev) => sum + (ev.duration || 0), 0) / 60
                  };
                  
                  // Create and download CSV
                  const csvContent = [
                    ['Date', 'Time', 'Service', 'Client', 'Duration', 'Amount', 'Status', 'Notes'],
                    ...calendarModal.events.map(ev => [
                      dayData.date,
                      ev.time,
                      ev.title,
                      ev.client,
                      `${ev.duration} min`,
                      `$${ev.amount?.toFixed(2) || '0.00'}`,
                      ev.status,
                      ev.notes || ''
                    ])
                  ].map(row => row.join(',')).join('\n');
                  
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `schedule-${dayData.date}.csv`;
                  a.click();
                  window.URL.revokeObjectURL(url);
                  
                  setCalendarModal({ open: false, day: null, events: [] });
                }}
              >
                Export Day
              </Button>
            </div>
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
                  <div className="ml-2 p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
                    <Info className="w-4 h-4" />
                  </div>
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
                  <div className="ml-2 p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
                    <Info className="w-4 h-4" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={5}>
                  <p>Modify your service rates and pricing structure</p>
                </TooltipContent>
              </UITooltip>
            </div>
          </Button>
          
          <Link href="/vendor/support">
            <Button variant="outline" className="justify-start w-full">
              <div className="flex items-center justify-between w-full">
                <span>🆘 Get Support</span>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <div className="ml-2 p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
                      <Info className="w-4 h-4" />
                    </div>
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
                  <div className="ml-2 p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
                    <Info className="w-4 h-4" />
                  </div>
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
                  <div className="ml-2 p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
                    <Info className="w-4 h-4" />
                  </div>
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
                  <div className="ml-2 p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
                    <Info className="w-4 h-4" />
                  </div>
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

function CalendarMonth({ jobEvents, onDayClick, currentDate, setCurrentDate, unavailableDays, setUnavailableDays }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [showAddBooking, setShowAddBooking] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newBooking, setNewBooking] = useState({
    title: '',
    client: '',
    time: '09:00',
    duration: '60',
    type: 'Kitchen Sink Repair',
    notes: ''
  });

  // Listen for external add booking requests
  useEffect(() => {
    const handleOpenAddBooking = (event) => {
      if (event.detail?.day) {
        setSelectedDate(event.detail.day);
        setShowAddBooking(true);
      }
    };

    window.addEventListener('openAddBooking', handleOpenAddBooking);
    return () => window.removeEventListener('openAddBooking', handleOpenAddBooking);
  }, []);

  const today = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  
  // Enhanced job events with more details
  const enhancedJobEvents = jobEvents.map(ev => ({
    ...ev,
    client: ev.client || 'Unknown Client',
    time: ev.time || '09:00',
    duration: ev.duration || 60,
    status: ev.status || 'scheduled',
    amount: ev.amount || 0,
    notes: ev.notes || ''
  }));

  // Filter jobs based on current filters
  const filteredEvents = enhancedJobEvents.filter(ev => {
    const matchesType = filterType === 'all' || ev.title.includes(filterType);
    const matchesStatus = filterStatus === 'all' || ev.status === filterStatus;
    const matchesSearch = !searchQuery || 
      ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.client.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesStatus && matchesSearch;
  });

  const eventMap = filteredEvents.reduce((acc, ev) => {
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

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const yearNum = currentDate.getFullYear();

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const handleDayClick = (day) => {
    setSelectedDate(day);
    const events = eventMap[day] || [];
    onDayClick(day, events);
  };

  const handleAddBooking = () => {
    if (newBooking.title && newBooking.client && selectedDate) {
      const newEvent = {
        id: Date.now(),
        title: newBooking.title,
        client: newBooking.client,
        date: `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`,
        time: newBooking.time,
        duration: parseInt(newBooking.duration),
        type: newBooking.type,
        status: 'scheduled',
        amount: 0,
        notes: newBooking.notes,
        color: getColorForType(newBooking.type)
      };
      // In a real app, this would be saved to the backend
      console.log('New booking:', newEvent);
      setShowAddBooking(false);
      setNewBooking({
        title: '',
        client: '',
        time: '09:00',
        duration: '60',
        type: 'Kitchen Sink Repair',
        notes: ''
      });
    }
  };

  const getColorForType = (type) => {
    const colors = {
      'Kitchen Sink Repair': 'bg-blue-500',
      'Faucet Installation': 'bg-green-500',
      'Garbage Disposal Repair': 'bg-yellow-500',
      'Pipe Leak Fix': 'bg-red-500'
    };
    return colors[type] || 'bg-gray-500';
  };

  const getStatusColor = (status) => {
    const colors = {
      'scheduled': 'bg-blue-100 text-blue-800',
      'in-progress': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const calculateDailyEarnings = (day) => {
    const events = eventMap[day] || [];
    return events.reduce((total, ev) => total + (ev.amount || 0), 0);
  };

  const getAvailabilityStatus = (day) => {
    const dayKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Check if day is marked as unavailable
    if (unavailableDays.has(dayKey)) {
      return { status: 'unavailable', text: 'Unavailable', color: 'bg-gray-200' };
    }
    
    const events = eventMap[day] || [];
    const totalSlots = 8; // Assuming 8 hours of work
    const bookedSlots = events.length;
    const availableSlots = totalSlots - bookedSlots;
    
    if (availableSlots === 0) return { status: 'full', text: 'Fully Booked', color: 'bg-red-50' };
    if (availableSlots <= 2) return { status: 'limited', text: `${availableSlots} slots left`, color: 'bg-yellow-50' };
    return { status: 'available', text: `${availableSlots} slots available`, color: 'bg-green-50' };
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header with Navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth(-1)}
            className="p-1"
          >
            ←
          </Button>
          <h2 className="text-xl font-semibold">{monthName} {yearNum}</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth(1)}
            className="p-1"
          >
            →
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            Filter
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Today
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Service Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full p-2 border rounded-md text-sm"
              >
                <option value="all">All Types</option>
                <option value="Kitchen Sink Repair">Kitchen Sink Repair</option>
                <option value="Faucet Installation">Faucet Installation</option>
                <option value="Garbage Disposal Repair">Garbage Disposal Repair</option>
                <option value="Pipe Leak Fix">Pipe Leak Fix</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full p-2 border rounded-md text-sm"
              >
                <option value="all">All Status</option>
                <option value="scheduled">Scheduled</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Search</label>
              <input
                type="text"
                placeholder="Search jobs or clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 border rounded-md text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-center border-collapse select-none">
          <thead>
            <tr className="text-xs text-gray-500 border-b">
              <th className="p-2">Sun</th>
              <th className="p-2">Mon</th>
              <th className="p-2">Tue</th>
              <th className="p-2">Wed</th>
              <th className="p-2">Thu</th>
              <th className="p-2">Fri</th>
              <th className="p-2">Sat</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, i) => (
              <tr key={i} className="border-b">
                {week.map((day, j) => {
                  const isToday = day === today.getDate() && 
                    month === today.getMonth() && 
                    year === today.getFullYear();
                  const isSelected = day === selectedDate;
                  const events = eventMap[day] || [];
                  const availability = getAvailabilityStatus(day);
                  const dailyEarnings = calculateDailyEarnings(day);
                  
                  const dayKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isUnavailable = unavailableDays.has(dayKey);
                  
                  return (
                    <td 
                      key={j} 
                      className={`h-24 w-24 border-r border-b relative ${
                        day 
                          ? `${availability.color} ${isUnavailable ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-blue-50'} transition-colors ${
                              isToday ? 'ring-2 ring-blue-500' : ''
                            } ${
                              isSelected ? 'bg-blue-100' : ''
                            }` 
                          : 'bg-gray-50'
                      }`}
                      onClick={day && !isUnavailable ? () => handleDayClick(day) : undefined}
                    >
                      {day && (
                        <div className="p-1 h-full flex flex-col">
                          {/* Date Number */}
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm font-semibold ${
                              isToday ? 'text-blue-600 bg-blue-100 px-1 rounded' : ''
                            }`}>
                              {day}
                            </span>
                            {isToday && (
                              <span className="text-xs text-blue-600 font-medium">TODAY</span>
                            )}
                          </div>

                          {/* Job Indicators */}
                          <div className="flex flex-wrap gap-1 mb-1">
                            {events.slice(0, 3).map((ev, idx) => (
                              <div
                                key={ev.id}
                                className={`w-2 h-2 rounded-full ${ev.color} cursor-pointer`}
                                title={`${ev.title} - ${ev.client} (${ev.time})`}
                              />
                            ))}
                            {events.length > 3 && (
                              <span className="text-xs text-gray-500">+{events.length - 3}</span>
                            )}
                          </div>

                          {/* Availability Status */}
                          <div className="text-xs text-gray-600 mb-1">
                            {availability.text}
                          </div>

                          {/* Daily Earnings */}
                          {dailyEarnings > 0 && (
                            <div className="text-xs font-medium text-green-600">
                              ${dailyEarnings}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500"></span>
          <span className="text-sm">Kitchen Sink Repair</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500"></span>
          <span className="text-sm">Faucet Installation</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
          <span className="text-sm">Garbage Disposal Repair</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500"></span>
          <span className="text-sm">Pipe Leak Fix</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mt-4">
        <Button
          size="sm"
          onClick={() => setShowAddBooking(true)}
          disabled={!selectedDate}
        >
          Add Booking
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (selectedDate) {
              const dayKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`;
              const newUnavailableDays = new Set(unavailableDays);
              
              if (newUnavailableDays.has(dayKey)) {
                newUnavailableDays.delete(dayKey);
                setUnavailableDays(newUnavailableDays);
                alert(`Day ${selectedDate} marked as available again`);
              } else {
                newUnavailableDays.add(dayKey);
                setUnavailableDays(newUnavailableDays);
                alert(`Day ${selectedDate} marked as unavailable`);
              }
              
              // In a real app, this would be saved to the backend
              console.log('Updated unavailable days:', Array.from(newUnavailableDays));
            } else {
              alert('Please select a date first');
            }
          }}
        >
          {selectedDate && unavailableDays.has(`${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`) 
            ? 'Mark Available' 
            : 'Mark Unavailable'
          }
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            console.log('Viewing week view');
            alert('Week view would show a detailed weekly schedule');
          }}
        >
          View Week
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Export current month schedule
            const monthData = {
              month: monthName,
              year: yearNum,
              jobs: enhancedJobEvents.filter(ev => {
                const d = new Date(ev.date);
                return d.getFullYear() === year && d.getMonth() === month;
              })
            };
            
            // Create and download CSV
            const csvContent = [
              ['Date', 'Time', 'Service', 'Client', 'Duration', 'Amount', 'Status', 'Notes'],
              ...monthData.jobs.map(ev => [
                ev.date,
                ev.time,
                ev.title,
                ev.client,
                `${ev.duration} min`,
                `$${ev.amount?.toFixed(2) || '0.00'}`,
                ev.status,
                ev.notes || ''
              ])
            ].map(row => row.join(',')).join('\n');
            
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `schedule-${monthName}-${yearNum}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
            
            console.log('Exported schedule for:', monthData);
          }}
        >
          Export Schedule
        </Button>
      </div>

      {/* Add Booking Modal */}
      {showAddBooking && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Add Booking for {new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDate).toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </h3>
              <button 
                onClick={() => setShowAddBooking(false)}
                className="text-gray-400 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Service Title</label>
                <input
                  type="text"
                  value={newBooking.title}
                  onChange={(e) => setNewBooking({...newBooking, title: e.target.value})}
                  className="w-full p-2 border rounded-md"
                  placeholder="Enter service title"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Service Type</label>
                <select
                  value={newBooking.type}
                  onChange={(e) => setNewBooking({...newBooking, type: e.target.value})}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="Kitchen Sink Repair">Kitchen Sink Repair</option>
                  <option value="Faucet Installation">Faucet Installation</option>
                  <option value="Garbage Disposal Repair">Garbage Disposal Repair</option>
                  <option value="Pipe Leak Fix">Pipe Leak Fix</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Client Name</label>
                <input
                  type="text"
                  value={newBooking.client}
                  onChange={(e) => setNewBooking({...newBooking, client: e.target.value})}
                  className="w-full p-2 border rounded-md"
                  placeholder="Enter client name"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Time</label>
                  <input
                    type="time"
                    value={newBooking.time}
                    onChange={(e) => setNewBooking({...newBooking, time: e.target.value})}
                    className="w-full p-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Duration (min)</label>
                  <select
                    value={newBooking.duration}
                    onChange={(e) => setNewBooking({...newBooking, duration: e.target.value})}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="30">30 min</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                    <option value="120">2 hours</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={newBooking.notes}
                  onChange={(e) => setNewBooking({...newBooking, notes: e.target.value})}
                  className="w-full p-2 border rounded-md"
                  rows="3"
                  placeholder="Additional notes..."
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowAddBooking(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddBooking}
                disabled={!newBooking.title || !newBooking.client}
              >
                Add Booking
              </Button>
            </div>
          </div>
        </div>
      )}



    </div>
  );
} 