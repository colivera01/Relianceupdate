'use client';
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Info, Edit, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Vendor {
  id: string
  name: string
  contactPerson: string
  email: string
  phone: string
  businessAddress: string
  status: 'Active' | 'Inactive'
  approvalStatus: 'pending' | 'approved' | 'rejected'
}

const mockVendors: Vendor[] = [
  {
    id: '1',
    name: 'Tech Solutions Inc.',
    contactPerson: 'John Doe',
    email: 'john@techsolutions.com',
    phone: '123-456-7890',
    businessAddress: '123 Main St, Springfield, IL',
    status: 'Active',
    approvalStatus: 'approved',
  },
  {
    id: '2',
    name: 'Global Supplies Ltd.',
    contactPerson: 'Jane Smith',
    email: 'jane@globalsupplies.com',
    phone: '987-654-3210',
    businessAddress: '456 Market Ave, Metropolis, NY',
    status: 'Active',
    approvalStatus: 'pending',
  },
]

// Service Catalog Data Model (starter list)
const initialServiceCatalog = [
  'Automotive Repair',
  'Automotive Detailing',
  'Adjuster',
  'Barber',
  'Body Shop',
  'Car Wash',
  'Contractors',
  'Dealership',
  'Electrician',
  'Electronic Device Repair',
  'HVAC Heating and Air Conditioning',
  'Home cleaners',
  'Hair/Nail Salon',
  'Landscaping',
  'Locksmith',
  'Medical Services',
  'Moving Services',
  'Pool Cleaning Services',
  'Pet Grooming',
  'Plumbing',
  'Painting Services',
  'Pest/Exterminating Services',
  'Security Installation',
  'Roofing Services',
  'Towing',
  'Tree Services',
  'Other',
];

export function VendorManagement() {
  const [vendors, setVendors] = useState<Vendor[]>(mockVendors)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false)
  const [newVendor, setNewVendor] = useState<Partial<Vendor>>({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    businessAddress: '',
  })
  const [showApprovalQueue, setShowApprovalQueue] = useState(false)
  // Mocked auto-approve toggle (should come from settings)
  const [autoApproveVendors, setAutoApproveVendors] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [selectedVendors, setSelectedVendors] = useState<string[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [approvalFilter, setApprovalFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [registrationDateFilter, setRegistrationDateFilter] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: 'reject' | 'deactivate', vendor: Vendor } | null>(null)
  const [vendorAnalytics, setVendorAnalytics] = useState({
    totalVendors: 0,
    activeVendors: 0,
    pendingApproval: 0,
    suspendedVendors: 0,
    newVendorsThisWeek: 0,
    newVendorsThisMonth: 0,
    vendorGrowthRate: 0,
    topCategories: [] as Array<{category: string, count: number}>,
    recentActivity: [] as Array<{action: string, timestamp: string, vendor: string}>
  });
  const [isLoadingVendorAnalytics, setIsLoadingVendorAnalytics] = useState(true);
  const [quickViewVendor, setQuickViewVendor] = useState<any | null>(null);
  const [showQuickView, setShowQuickView] = useState(false);
  const [vendorAuditTrail, setVendorAuditTrail] = useState<Array<{id: string, action: string, timestamp: string, admin: string, details: string}>>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [vendorNotes, setVendorNotes] = useState<Array<{id: string, text: string, author: string, date: string}>>([]);
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [vendorJobs, setVendorJobs] = useState<Array<any>>([]);
  const [jobDetails, setJobDetails] = useState<any | null>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [showImpersonateConfirm, setShowImpersonateConfirm] = useState(false);
  const [vendorToImpersonate, setVendorToImpersonate] = useState<any | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const [serviceCatalog, setServiceCatalog] = useState<string[]>(initialServiceCatalog);
  const [pendingBusinessRequests, setPendingBusinessRequests] = useState<Array<{id: string, name: string, submittedBy: string, date: string, status: 'pending' | 'approved' | 'rejected'}>>([
    // Example pending request
    // { id: '101', name: 'Custom Service Example', submittedBy: 'Vendor X', date: '2024-06-10', status: 'pending' },
  ]);
  const [editingBusiness, setEditingBusiness] = useState<{id: string, name: string, submittedBy: string, date: string} | null>(null);
  const [adminNotifications, setAdminNotifications] = useState<Array<{id: string, type: string, message: string, date: string, resolved: boolean}>>([]);

  useEffect(() => {
    // Simulate loading analytics data
    setIsLoadingVendorAnalytics(true);
    setTimeout(() => {
      // Replace with real vendor data logic
      const totalVendors = 42;
      const activeVendors = 30;
      const pendingApproval = 5;
      const suspendedVendors = 2;
      const newVendorsThisWeek = 3;
      const newVendorsThisMonth = 8;
      const vendorGrowthRate = ((newVendorsThisMonth - 6) / 6 * 100).toFixed(1);
      const topCategories = [
        { category: 'Cleaning', count: 15 },
        { category: 'Plumbing', count: 10 },
        { category: 'Painting', count: 7 }
      ];
      const recentActivity = [
        { action: 'New vendor registered', timestamp: '1 hour ago', vendor: 'CleanCo' },
        { action: 'Vendor approved', timestamp: '3 hours ago', vendor: 'PlumbPro' },
        { action: 'Vendor suspended', timestamp: '5 hours ago', vendor: 'PaintMaster' },
        { action: 'Profile updated', timestamp: '7 hours ago', vendor: 'CleanCo' },
      ];
      setVendorAnalytics({
        totalVendors,
        activeVendors,
        pendingApproval,
        suspendedVendors,
        newVendorsThisWeek,
        newVendorsThisMonth,
        vendorGrowthRate: parseFloat(vendorGrowthRate),
        topCategories,
        recentActivity
      });
      setIsLoadingVendorAnalytics(false);
    }, 1000);
  }, []);

  const filteredVendors = vendors.filter((vendor) => {
    const matchesStatus = statusFilter === 'all' || vendor.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || vendor.category === categoryFilter;
    const matchesRegistrationDate = !registrationDateFilter || (vendor.registrationDate && new Date(vendor.registrationDate) >= new Date(registrationDateFilter));
    return matchesStatus && matchesCategory && matchesRegistrationDate;
  });
  const sortedVendors = [...filteredVendors].sort((a, b) => {
    let aValue: any, bValue: any;
    switch (sortBy) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'category':
        aValue = a.category;
        bValue = b.category;
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'registrationDate':
        aValue = a.registrationDate ? new Date(a.registrationDate) : new Date(0);
        bValue = b.registrationDate ? new Date(b.registrationDate) : new Date(0);
        break;
      default:
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
    }
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const pendingVendors = vendors.filter(v => v.approvalStatus === 'pending')

  const handleAddVendor = () => {
    if (newVendor.name && newVendor.contactPerson && newVendor.email && newVendor.phone && newVendor.businessAddress) {
      const vendor: Vendor = {
        id: (vendors.length + 1).toString(),
        status: 'Active',
        approvalStatus: autoApproveVendors ? 'approved' : 'pending',
        ...newVendor as Omit<Vendor, 'id' | 'status' | 'approvalStatus'>,
      }
      setVendors([...vendors, vendor])
      setNewVendor({ name: '', contactPerson: '', email: '', phone: '', businessAddress: '' })
      setIsAddVendorOpen(false)
    }
  }

  const approveVendor = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      // Simulate async
      await new Promise(res => setTimeout(res, 500))
      setVendors(vendors => vendors.map(v => v.id === id ? { ...v, approvalStatus: 'approved', status: 'Active' } : v))
    } catch (e) {
      setError('Failed to approve vendor.')
    } finally {
      setLoading(false)
    }
  }
  const rejectVendor = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      // Simulate async
      await new Promise(res => setTimeout(res, 500))
      setVendors(vendors => vendors.map(v => v.id === id ? { ...v, approvalStatus: 'rejected', status: 'Inactive' } : v))
    } catch (e) {
      setError('Failed to reject vendor.')
    } finally {
      setLoading(false)
    }
  }

  const toggleVendorSelection = (id: string) => {
    setSelectedVendors(prev => prev.includes(id) ? prev.filter(vId => vId !== id) : [...prev, id])
  }
  const bulkApprove = () => {
    setVendors(vendors => vendors.map(v => selectedVendors.includes(v.id) && v.approvalStatus === 'pending' ? { ...v, approvalStatus: 'approved', status: 'Active' } : v))
    setSelectedVendors([])
  }
  const bulkReject = () => {
    setVendors(vendors => vendors.map(v => selectedVendors.includes(v.id) && v.approvalStatus === 'pending' ? { ...v, approvalStatus: 'rejected', status: 'Inactive' } : v))
    setSelectedVendors([])
  }

  const handleRejectVendor = (vendor: Vendor) => setConfirmAction({ type: 'reject', vendor })
  const handleDeactivateVendor = (vendor: Vendor) => setConfirmAction({ type: 'deactivate', vendor })
  const confirmReject = async () => {
    if (confirmAction?.type === 'reject') await rejectVendor(confirmAction.vendor.id)
    setConfirmAction(null)
  }
  const confirmDeactivate = async () => {
    if (confirmAction?.type === 'deactivate') {
      setLoading(true)
      setError(null)
      try {
        await new Promise(res => setTimeout(res, 500))
        setVendors(vendors => vendors.map(v => v.id === confirmAction.vendor.id ? { ...v, status: 'Inactive' } : v))
      } catch (e) {
        setError('Failed to deactivate vendor.')
      } finally {
        setLoading(false)
        setConfirmAction(null)
      }
    }
  }

  const VENDOR_COLUMNS = [
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'contactPerson', label: 'Contact' },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status' },
    { key: 'approvalStatus', label: 'Approval' },
    { key: 'registrationDate', label: 'Registered' },
    { key: 'actions', label: 'Actions' },
  ];
  const [visibleVendorColumns, setVisibleVendorColumns] = useState(VENDOR_COLUMNS.map(c => c.key));
  const toggleVendorColumn = (key: string) => setVisibleVendorColumns(cols => cols.includes(key) ? cols.filter(c => c !== key) : [...cols, key]);
  const [exportHistory, setExportHistory] = useState<Array<{id: string, timestamp: string, format: string, status: string, filters: string}>>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportColumns, setExportColumns] = useState(VENDOR_COLUMNS.map(c => c.key));

  const handleVendorExport = async () => {
    setIsExporting(true);
    setTimeout(() => {
      const newExport = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        format: exportFormat,
        status: 'completed',
        filters: `Status: ${statusFilter}, Category: ${categoryFilter}`
      };
      setExportHistory(prev => [newExport, ...prev]);
      setIsExporting(false);
    }, 2000);
  };

  const handleQuickView = (vendor: any) => {
    setQuickViewVendor(vendor);
    setShowQuickView(true);
    setIsLoadingAudit(true);
    // Simulate loading audit trail, notes, and jobs
    setTimeout(() => {
      setVendorAuditTrail([
        { id: '1', action: 'Vendor Created', timestamp: '2024-01-10T09:00:00Z', admin: 'System', details: 'Vendor account created.' },
        { id: '2', action: 'Profile Updated', timestamp: '2024-02-01T14:30:00Z', admin: 'admin@reliance.com', details: 'Updated business address.' },
        { id: '3', action: 'Vendor Approved', timestamp: '2024-02-05T11:00:00Z', admin: 'admin@reliance.com', details: 'Vendor approved for platform.' },
      ]);
      setVendorNotes([
        { id: 'n1', text: 'Initial vendor onboarding.', author: 'System', date: '2024-01-10T09:00:00Z' },
        { id: 'n2', text: 'Vendor provided all required documents.', author: 'Admin', date: '2024-02-01T14:35:00Z' },
      ]);
      setVendorJobs([
        { id: 'vj1', user: 'User 1', type: 'Cleaning', date: '2024-03-01', status: 'completed', feedback: 'Excellent service.', details: 'Office cleaning.' },
        { id: 'vj2', user: 'User 2', type: 'Plumbing', date: '2024-03-15', status: 'completed', feedback: 'Quick fix.', details: 'Fixed leaking pipe.' },
      ]);
      setIsLoadingAudit(false);
    }, 800);
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim()) return;
    setIsAddingNote(true);
    setTimeout(() => {
      const newNote = {
        id: Date.now().toString(),
        text: newNoteText,
        author: 'Current Admin',
        date: new Date().toISOString(),
      };
      setVendorNotes(notes => [newNote, ...notes]);
      setNewNoteText('');
      setShowAddNote(false);
      setIsAddingNote(false);
    }, 500);
  };
  const handleEditNote = async (noteId: string) => {
    if (!editingNoteText.trim()) return;
    setTimeout(() => {
      setVendorNotes(notes => notes.map(note => note.id === noteId ? { ...note, text: editingNoteText } : note));
      setEditingNoteId(null);
      setEditingNoteText('');
    }, 500);
  };
  const handleDeleteNote = async (noteId: string) => {
    setTimeout(() => {
      setVendorNotes(notes => notes.filter(note => note.id !== noteId));
    }, 500);
  };
  const startEditNote = (note: { id: string; text: string }) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.text);
  };

  const allVisibleVendorIds = sortedVendors.map(v => v.id);
  const allSelected = allVisibleVendorIds.every(id => selectedVendors.includes(id)) && allVisibleVendorIds.length > 0;
  const handleSelectAll = () => {
    if (allSelected) setSelectedVendors(selectedVendors.filter(id => !allVisibleVendorIds.includes(id)));
    else setSelectedVendors([...new Set([...selectedVendors, ...allVisibleVendorIds])]);
  };
  const handleSelect = (id: string) => {
    setSelectedVendors(selected => selected.includes(id) ? selected.filter(i => i !== id) : [...selected, id]);
  };
  const handleBulkActivate = () => {
    // Simulate bulk activate
    setVendors(vendors => vendors.map(v => selectedVendors.includes(v.id) ? { ...v, status: 'Active' } : v));
    setSelectedVendors([]);
  };
  const handleBulkSuspend = () => {
    setVendors(vendors => vendors.map(v => selectedVendors.includes(v.id) ? { ...v, status: 'Suspended' } : v));
    setSelectedVendors([]);
    setShowSuspendConfirm(false);
  };
  const handleBulkDelete = () => {
    setVendors(vendors => vendors.filter(v => !selectedVendors.includes(v.id)));
    setSelectedVendors([]);
    setShowDeleteConfirm(false);
  };
  const handleBulkExport = () => {
    // Simulate export
    setSelectedVendors([]);
  };

  const handleImpersonate = (vendor: any) => {
    setVendorToImpersonate(vendor);
    setShowImpersonateConfirm(true);
  };
  const confirmImpersonation = async () => {
    if (!vendorToImpersonate) return;
    setIsImpersonating(true);
    setTimeout(() => {
      // In a real implementation, this would redirect to the vendor's view with impersonation token
      // Log the impersonation action
      setVendorAuditTrail(prev => [{
        id: Date.now().toString(),
        action: 'Vendor Impersonation Started',
        timestamp: new Date().toISOString(),
        admin: 'Current Admin',
        details: `Started impersonating vendor: ${vendorToImpersonate.name} (${vendorToImpersonate.email})`
      }, ...prev]);
      setShowImpersonateConfirm(false);
      setVendorToImpersonate(null);
      setIsImpersonating(false);
      // window.location.href = `/vendor/dashboard?impersonate=true&token=${impersonationToken}`;
    }, 1000);
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold mb-2">Vendor Management</h2>
      {/* Auto-Approval Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Auto-Approval Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="autoApproveVendors" 
              checked={autoApproveVendors} 
              onCheckedChange={(v) => setAutoApproveVendors(!!v)} 
            />
            <label htmlFor="autoApproveVendors" className="text-sm font-medium">
              Automatically approve new vendor registrations
            </label>
          </div>
          <p className="text-xs text-gray-500">
            When enabled, new vendors will be automatically approved and can access the platform immediately.
          </p>
        </CardContent>
      </Card>
      {/* Approval Queue Banner */}
      {pendingVendors.length > 0 && (
        <div className="border-orange-200 bg-orange-50 border rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="warning" className="text-sm">
              {pendingVendors.length} Pending Vendor Approval
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowApprovalQueue(!showApprovalQueue)}>
            {showApprovalQueue ? 'Hide' : 'Show'} Approval Queue
          </Button>
        </div>
      )}

      {/* Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Vendors */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Vendors</p>
                <p className="text-2xl font-bold text-blue-800">
                  {isLoadingVendorAnalytics ? '...' : vendorAnalytics.totalVendors.toLocaleString()}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  +{vendorAnalytics.newVendorsThisWeek} this week
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-200 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 text-xl">🏢</span>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Active Vendors */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Active Vendors</p>
                <p className="text-2xl font-bold text-green-800">
                  {isLoadingVendorAnalytics ? '...' : vendorAnalytics.activeVendors.toLocaleString()}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  {vendorAnalytics.totalVendors > 0 ? ((vendorAnalytics.activeVendors / vendorAnalytics.totalVendors) * 100).toFixed(1) : 0}% of total
                </p>
              </div>
              <div className="w-12 h-12 bg-green-200 rounded-lg flex items-center justify-center">
                <span className="text-green-600 text-xl">✅</span>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Pending Approval */}
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Pending Approval</p>
                <p className="text-2xl font-bold text-yellow-800">
                  {isLoadingVendorAnalytics ? '...' : vendorAnalytics.pendingApproval.toLocaleString()}
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  Requires attention
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-200 rounded-lg flex items-center justify-center">
                <span className="text-yellow-600 text-xl">⏳</span>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Suspended Vendors */}
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Suspended Vendors</p>
                <p className="text-2xl font-bold text-red-800">
                  {isLoadingVendorAnalytics ? '...' : vendorAnalytics.suspendedVendors.toLocaleString()}
                </p>
                <p className="text-xs text-red-600 mt-1">
                  {vendorAnalytics.totalVendors > 0 ? ((vendorAnalytics.suspendedVendors / vendorAnalytics.totalVendors) * 100).toFixed(1) : 0}% of total
                </p>
              </div>
              <div className="w-12 h-12 bg-red-200 rounded-lg flex items-center justify-center">
                <span className="text-red-600 text-xl">🚫</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Growth & Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Growth Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Growth Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Monthly Growth</span>
              <span className={`font-semibold ${vendorAnalytics.vendorGrowthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {vendorAnalytics.vendorGrowthRate >= 0 ? '+' : ''}{vendorAnalytics.vendorGrowthRate}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">New Vendors (Month)</span>
              <span className="font-semibold text-blue-600">{vendorAnalytics.newVendorsThisMonth}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">New Vendors (Week)</span>
              <span className="font-semibold text-blue-600">{vendorAnalytics.newVendorsThisWeek}</span>
            </div>
          </CardContent>
        </Card>
        {/* Top Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {vendorAnalytics.topCategories.map((cat, index) => (
              <div key={cat.category} className="flex justify-between items-center">
                <span className="text-sm text-gray-600 truncate">
                  {cat.category}
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${(cat.count / vendorAnalytics.totalVendors) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{cat.count}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {vendorAnalytics.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 truncate">{activity.action}</p>
                  <p className="text-xs text-gray-500">
                    {activity.vendor} • {activity.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center">
        <Input
          placeholder="Search vendors..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Dialog open={isAddVendorOpen} onOpenChange={setIsAddVendorOpen}>
          <DialogTrigger asChild>
            <Button>Add New Vendor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Vendor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Vendor Name</Label>
                <Input
                  id="name"
                  value={newVendor.name}
                  onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input
                  id="contactPerson"
                  value={newVendor.contactPerson}
                  onChange={(e) => setNewVendor({ ...newVendor, contactPerson: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newVendor.email}
                  onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={newVendor.phone}
                  onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessAddress">Business Address</Label>
                <Input
                  id="businessAddress"
                  value={newVendor.businessAddress}
                  onChange={(e) => setNewVendor({ ...newVendor, businessAddress: e.target.value })}
                />
              </div>
              <Button onClick={handleAddVendor} className="w-full">
                Add Vendor
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Advanced Filters & Sorting */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Input
          placeholder="Search vendors"
          className="max-w-xs"
          // Add search logic if needed
        />
        <select
          className="border rounded px-2 py-1 pr-6 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Suspended">Suspended</option>
          <option value="Pending">Pending</option>
        </select>
        <select
          className="border rounded px-2 py-1 pr-6 text-sm"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          <option value="Cleaning">Cleaning</option>
          <option value="Plumbing">Plumbing</option>
          <option value="Painting">Painting</option>
          {/* Add more categories as needed */}
        </select>
        <input
          type="date"
          className="border rounded px-2 py-1 text-sm"
          value={registrationDateFilter || ''}
          onChange={e => setRegistrationDateFilter(e.target.value)}
          placeholder="Registered After"
          title="Registered After"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="ml-2"
        >
          {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
        </Button>
      </div>
      {showAdvancedFilters && (
        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <h4 className="text-sm font-medium mb-3 text-gray-700">Advanced Filters</h4>
          {/* Add more advanced filters here if needed */}
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter('all');
                setCategoryFilter('all');
                setRegistrationDateFilter(undefined);
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      )}
      {/* Sorting */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-600">Sort by:</span>
        <select
          className="border rounded px-2 py-1 pr-6 text-sm"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          <option value="name">Name</option>
          <option value="category">Category</option>
          <option value="status">Status</option>
          <option value="registrationDate">Registration Date</option>
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
          className="flex items-center gap-1"
        >
          {sortDirection === 'asc' ? '↑' : '↓'} {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
        </Button>
      </div>

      {/* Bulk Actions Bar */}
      {selectedVendors.length > 0 && (
        <div className="flex gap-2 mb-3 items-center bg-blue-50 border border-blue-200 rounded p-2">
          <span className="text-sm font-medium">Bulk Actions:</span>
          <Button size="sm" onClick={handleBulkActivate} className="bg-green-600 hover:bg-green-700">Activate</Button>
          <Button size="sm" onClick={() => setShowSuspendConfirm(true)} className="bg-yellow-600 hover:bg-yellow-700">Suspend</Button>
          <Button size="sm" onClick={() => setShowDeleteConfirm(true)} className="bg-red-600 hover:bg-red-700">Delete</Button>
          <Button size="sm" onClick={handleBulkExport} className="bg-blue-600 hover:bg-blue-700">Export</Button>
          <span className="text-xs text-gray-500 ml-2">{selectedVendors.length} selected</span>
        </div>
      )}
      {/* Confirm Delete Dialog */}
      {showDeleteConfirm && (
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Delete</DialogTitle>
            </DialogHeader>
            <p className="mb-4">Are you sure you want to delete the selected vendors? This action cannot be undone.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {/* Confirm Suspend Dialog */}
      {showSuspendConfirm && (
        <Dialog open={showSuspendConfirm} onOpenChange={setShowSuspendConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Suspend</DialogTitle>
            </DialogHeader>
            <p className="mb-4">Are you sure you want to suspend the selected vendors?</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSuspendConfirm(false)}>Cancel</Button>
              <Button onClick={handleBulkSuspend} className="bg-yellow-600 hover:bg-yellow-700">Suspend</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Column Chooser UI */}
      <div className="flex gap-2 mb-2 items-center">
        <span className="text-xs text-gray-500">Columns:</span>
        {VENDOR_COLUMNS.map(col => (
          <label key={col.key} className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={visibleVendorColumns.includes(col.key)} onChange={() => toggleVendorColumn(col.key)} />
            {col.label}
          </label>
        ))}
      </div>
      {/* Custom Export Button */}
      <Button onClick={() => setShowExportModal(true)} className="mb-4 w-fit flex items-center gap-2" variant="outline">
        <span className="text-lg">📤</span>
        Custom Export
      </Button>
      {/* Custom Export Modal */}
      {showExportModal && (
        <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Custom Export</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Format</label>
                <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} className="w-full p-2 border rounded">
                  <option value="csv">CSV</option>
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Columns</label>
                <select multiple value={exportColumns} onChange={(e) => setExportColumns(Array.from(e.target.selectedOptions, option => option.value))} className="w-full p-2 border rounded h-20">
                  {VENDOR_COLUMNS.map(col => (
                    <option key={col.key} value={col.key}>{col.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleVendorExport} disabled={isExporting} className="w-full">
                  {isExporting ? 'Exporting...' : 'Export Vendors'}
                </Button>
              </div>
            </div>
            {/* Export History */}
            {exportHistory.length > 0 && (
              <div>
                <h4 className="text-md font-medium mb-2">Export History</h4>
                <div className="space-y-2">
                  {exportHistory.slice(0, 5).map(export_ => (
                    <div key={export_.id} className="flex items-center justify-between p-2 bg-white rounded border">
                      <div>
                        <span className="text-sm font-medium">{export_.format.toUpperCase()}</span>
                        <span className="text-xs text-gray-500 ml-2">{new Date(export_.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={export_.status === 'completed' ? 'success' : 'warning'} className="text-xs">
                          {export_.status}
                        </Badge>
                        <Button size="sm" variant="outline">Download</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExportModal(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Vendor Grid/Table - add checkboxes for selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedVendors.map((v) => (
          <Card key={v.id} className="relative">
            <div className="absolute top-2 left-2">
              <input type="checkbox" checked={selectedVendors.includes(v.id)} onChange={() => handleSelect(v.id)} />
            </div>
            <div className="flex flex-col items-center gap-3 p-4">
              <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${v.name}`} alt={v.name} className="w-16 h-16 rounded-full border mb-2" />
              <h3 className="text-xl font-bold mb-1">{v.name}</h3>
              <div className="flex gap-2 mb-2">
                <Badge variant={v.status === 'Active' ? 'success' : 'secondary'}>{v.status}</Badge>
                <Badge variant={v.approvalStatus === 'approved' ? 'success' : v.approvalStatus === 'pending' ? 'warning' : 'destructive'}>
                  {v.approvalStatus.charAt(0).toUpperCase() + v.approvalStatus.slice(1)}
                </Badge>
              </div>
              <div className="w-full grid grid-cols-2 gap-2 text-sm mb-2">
                <div className="font-semibold">Contact Person:</div><div>{v.contactPerson}</div>
                <div className="font-semibold">Email:</div><div>{v.email}</div>
                <div className="font-semibold">Phone:</div><div>{v.phone}</div>
                <div className="font-semibold">Business Address:</div><div>{v.businessAddress}</div>
              </div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => setEditingVendor(v)}><Edit className="w-4 h-4 mr-1" />Edit</Button>
                {v.approvalStatus === 'pending' && (
                  <>
                    <Button size="sm" variant="success" onClick={() => approveVendor(v.id)}><CheckCircle className="w-4 h-4 mr-1" />Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => rejectVendor(v.id)}><XCircle className="w-4 h-4 mr-1" />Reject</Button>
                  </>
                )}
                <Button 
                  size="sm" 
                  onClick={() => handleImpersonate(v)} 
                  className="bg-orange-600 hover:bg-orange-700"
                  title="Impersonate this vendor"
                >
                  👤
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Vendor Detail Modal/Card */}
      {editingVendor && (
        <Dialog open onOpenChange={() => setEditingVendor(null)}>
          <DialogContent className="max-w-lg">
            <div className="flex flex-col items-center gap-3 p-4">
              <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${editingVendor.name}`} alt={editingVendor.name} className="w-16 h-16 rounded-full border mb-2" />
              <h3 className="text-xl font-bold mb-1">{editingVendor.name}</h3>
              <div className="flex gap-2 mb-2">
                <Badge variant={editingVendor.status === 'Active' ? 'success' : 'secondary'}>{editingVendor.status}</Badge>
                <Badge variant={editingVendor.approvalStatus === 'approved' ? 'success' : editingVendor.approvalStatus === 'pending' ? 'warning' : 'destructive'}>
                  {editingVendor.approvalStatus.charAt(0).toUpperCase() + editingVendor.approvalStatus.slice(1)}
                </Badge>
              </div>
              <div className="w-full grid grid-cols-2 gap-2 text-sm mb-2">
                <div className="font-semibold">Contact Person:</div><div>{editingVendor.contactPerson}</div>
                <div className="font-semibold">Email:</div><div>{editingVendor.email}</div>
                <div className="font-semibold">Phone:</div><div>{editingVendor.phone}</div>
                <div className="font-semibold">Business Address:</div><div>{editingVendor.businessAddress}</div>
              </div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => setIsAddVendorOpen(true)}><Edit className="w-4 h-4 mr-1" />Edit</Button>
                {editingVendor.approvalStatus === 'pending' && (
                  <>
                    <Button size="sm" variant="success" onClick={() => approveVendor(editingVendor.id)}><CheckCircle className="w-4 h-4 mr-1" />Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => rejectVendor(editingVendor.id)}><XCircle className="w-4 h-4 mr-1" />Reject</Button>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {loading && (
        <div className="fixed inset-0 bg-white bg-opacity-60 flex items-center justify-center z-50">
          <span className="text-lg font-semibold text-blue-700">Processing...</span>
        </div>
      )}
      {error && (
        <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded mb-2">
          {error}
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      )}

      {confirmAction && (
        <Dialog open onOpenChange={() => setConfirmAction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm {confirmAction.type === 'reject' ? 'Reject' : 'Deactivate'} Vendor</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p>Are you sure you want to {confirmAction.type} <span className="font-semibold">{confirmAction.vendor.name}</span>?</p>
              <div className="flex gap-2 mt-4 justify-end">
                <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
                <Button variant={confirmAction.type === 'reject' ? 'destructive' : 'outline'} onClick={confirmAction.type === 'reject' ? confirmReject : confirmDeactivate}>
                  Confirm
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Backend Developer Notes */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">📋 Backend Developer Notes</h3>
        <div className="text-sm text-blue-700 space-y-2">
          <p><strong>Endpoints Needed:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><code>GET /api/vendors</code> – List vendors (with filters, search, pagination)</li>
            <li><code>POST /api/vendors</code> – Add new vendor</li>
            <li><code>PATCH /api/vendors/:id</code> – Update vendor details, status, approval</li>
            <li><code>POST /api/vendors/bulk-approve</code> – Bulk approve vendors (array of IDs)</li>
            <li><code>POST /api/vendors/bulk-reject</code> – Bulk reject vendors (array of IDs)</li>
          </ul>
          <p><strong>Vendor Data Format:</strong></p>
          <pre className="bg-gray-100 p-2 rounded text-xs mt-2 overflow-x-auto">{`
{
  id: string,
  name: string,
  contactPerson: string,
  email: string,
  phone: string,
  businessAddress: string,
  status: 'Active' | 'Inactive',
  approvalStatus: 'pending' | 'approved' | 'rejected'
}
`}</pre>
          <p><strong>Integration Notes:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Respect the auto-approve vendors setting from the Settings page.</li>
            <li>All vendor actions (approve, reject, edit) should call the appropriate endpoint and update the UI on success.</li>
            <li>Bulk actions should accept an array of vendor IDs and an action type.</li>
            <li>Show loading and error states for all async actions.</li>
            <li>Paginate vendor lists on the backend for large datasets.</li>
          </ul>
          <p className="mt-2"><strong>Validation & Security:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Only admins can approve/reject vendors and perform edits.</li>
            <li>All endpoints should validate user permissions and input data.</li>
            <li>Return clear error messages for failed actions.</li>
          </ul>
          <li>Show loading and error states for all async actions (approve, reject, save, deactivate).</li>
          <li>Show confirmation dialogs before destructive actions (reject, deactivate).</li>
        </div>
      </div>
      {/* BACKEND DEVELOPER NOTES:
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">📋 Backend Developer Notes</h3>
        <div className="text-sm text-blue-700 space-y-2">
          <p><strong>Endpoints Needed:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><code>GET /api/admin/vendors/analytics</code> – Get analytics data (total vendors, growth, status breakdowns, top categories, recent activity)</li>
            <li><code>GET /api/vendors</code> – List vendors (with filters, search, pagination)</li>
            <li><code>POST /api/vendors</code> – Add new vendor</li>
            <li><code>PATCH /api/vendors/:id</code> – Update vendor details, status, approval</li>
            <li><code>POST /api/vendors/bulk-approve</code> – Bulk approve vendors (array of IDs)</li>
            <li><code>POST /api/vendors/bulk-reject</code> – Bulk reject vendors (array of IDs)</li>
          </ul>
          <p><strong>Vendor Data Format:</strong></p>
          <pre className="bg-gray-100 p-2 rounded text-xs mt-2 overflow-x-auto">{`
{
  id: string,
  name: string,
  contactPerson: string,
  email: string,
  phone: string,
  businessAddress: string,
  status: 'Active' | 'Inactive',
  approvalStatus: 'pending' | 'approved' | 'rejected'
}
`}</pre>
          <p><strong>Integration Notes:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Respect the auto-approve vendors setting from the Settings page.</li>
            <li>All vendor actions (approve, reject, edit) should call the appropriate endpoint and update the UI on success.</li>
            <li>Bulk actions should accept an array of vendor IDs and an action type.</li>
            <li>Show loading and error states for all async actions.</li>
            <li>Paginate vendor lists on the backend for large datasets.</li>
          </ul>
          <p className="mt-2"><strong>Validation & Security:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Only admins can approve/reject vendors and perform edits.</li>
            <li>All endpoints should validate user permissions and input data.</li>
            <li>Return clear error messages for failed actions.</li>
          </ul>
          <li>Show loading and error states for all async actions (approve, reject, save, deactivate).</li>
          <li>Show confirmation dialogs before destructive actions (reject, deactivate).</li>
        </div>
      </div> */}
      {/* Quick View Modal */}
      {showQuickView && quickViewVendor && (
        <Dialog open={showQuickView} onOpenChange={setShowQuickView}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div>
                  <h2 className="text-xl font-bold">{quickViewVendor.name}</h2>
                  <p className="text-sm text-gray-600">{quickViewVendor.email}</p>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Vendor Details & Job History */}
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-3">Vendor Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-medium">{quickViewVendor.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Category:</span>
                      <span className="font-medium">{quickViewVendor.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Contact:</span>
                      <span className="font-medium">{quickViewVendor.contactPerson}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Email:</span>
                      <span className="font-medium">{quickViewVendor.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Registered:</span>
                      <span className="font-medium">{quickViewVendor.registrationDate}</span>
                    </div>
                  </div>
                </div>
                {/* Job/Service History */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-3">Job/Service History</h3>
                  {vendorJobs.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {vendorJobs.map(job => (
                        <div key={job.id} className="bg-white p-2 rounded border flex flex-col gap-1">
                          <div className="font-medium text-sm text-gray-800 break-words">{job.type}</div>
                          <div className="text-xs text-gray-500 break-words">User: {job.user}</div>
                          <div className="text-xs text-gray-500">Date: {job.date}</div>
                          <div className="text-xs font-semibold" style={{ color: job.status === 'completed' ? '#16a34a' : '#b91c1c' }}>
                            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                          </div>
                          <Button size="sm" variant="outline" className="mt-1 w-fit self-end" onClick={() => { setJobDetails(job); setShowJobDetails(true); }}>
                            View Details
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No jobs found for this vendor.</p>
                  )}
                </div>
              </div>
              {/* Admin Notes & Audit Trail */}
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-3">Admin Notes</h3>
                  {vendorNotes.length > 0 ? (
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {vendorNotes.map((note, index) => (
                        <div key={index} className="bg-white p-3 rounded border">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium text-gray-700 break-words">{note.author}</span>
                            <span className="text-xs text-gray-500">{new Date(note.date).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{note.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No admin notes yet.</p>
                  )}
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-3">Audit Trail</h3>
                  {isLoadingAudit ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-2 text-sm text-gray-600">Loading audit trail...</span>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {vendorAuditTrail.map((entry) => (
                        <div key={entry.id} className="bg-white p-3 rounded border">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-sm font-medium text-gray-700 break-words">{entry.action}</span>
                            <span className="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-gray-600 break-words">By: {entry.admin}</span>
                          </div>
                          <p className="text-xs text-gray-600 whitespace-pre-wrap break-words">{entry.details}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Job Details Modal */}
            {showJobDetails && jobDetails && (
              <Dialog open={showJobDetails} onOpenChange={setShowJobDetails}>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Job Details</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">Type:</span>
                      <span>{jobDetails.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">User:</span>
                      <span>{jobDetails.user}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Date:</span>
                      <span>{jobDetails.date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Status:</span>
                      <span>{jobDetails.status}</span>
                    </div>
                    <div>
                      <span className="font-medium">Feedback:</span>
                      <p className="text-sm text-gray-700 mt-1">{jobDetails.feedback}</p>
                    </div>
                    <div>
                      <span className="font-medium">Details:</span>
                      <p className="text-sm text-gray-700 mt-1">{jobDetails.details}</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowJobDetails(false)}>
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowQuickView(false)}>
                Close
              </Button>
              <Button onClick={() => {/* Implement edit vendor logic */}}>
                Edit Vendor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {/* Admin Notes Section in Quick View */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">Admin Notes</h3>
          <Button size="sm" onClick={() => setShowAddNote(true)} className="bg-blue-600 hover:bg-blue-700">Add Note</Button>
        </div>
        {vendorNotes.length > 0 ? (
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {vendorNotes.map((note, index) => (
              <div key={index} className="bg-white p-3 rounded border">
                {editingNoteId === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingNoteText}
                      onChange={(e) => setEditingNoteText(e.target.value)}
                      className="w-full p-2 border rounded text-sm"
                      rows={3}
                      placeholder="Enter note text..."
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleEditNote(note.id)} className="bg-green-600 hover:bg-green-700">Save</Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditingNoteId(null); setEditingNoteText(''); }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium text-gray-700 break-words">{note.author}</span>
                      <span className="text-xs text-gray-500">{new Date(note.date).toLocaleString()}</span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => startEditNote(note)} className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700">✏️</Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteNote(note.id)} className="h-6 w-6 p-0 text-gray-500 hover:text-red-600">🗑️</Button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{note.text}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No admin notes yet.</p>
        )}
      </div>
      {/* Add Note Modal */}
      {showAddNote && (
        <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Admin Note</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Note Text</label>
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="w-full p-3 border rounded-lg text-sm"
                  rows={4}
                  placeholder="Enter your private note about this vendor..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddNote(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddNote} disabled={!newNoteText.trim() || isAddingNote} className="bg-blue-600 hover:bg-blue-700">
                {isAddingNote ? 'Adding...' : 'Add Note'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {/* Impersonation Confirmation Modal */}
      {showImpersonateConfirm && vendorToImpersonate && (
        <Dialog open={showImpersonateConfirm} onOpenChange={setShowImpersonateConfirm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-orange-600">⚠️</span>
                Confirm Vendor Impersonation
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-semibold text-orange-800 mb-2">Security Warning</h4>
                <p className="text-sm text-orange-700">
                  You are about to impersonate <strong>{vendorToImpersonate.name}</strong>.
                  This action will be logged and you will have access to their account view.
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <h4 className="font-medium mb-2">Vendor Details</h4>
                <div className="text-sm space-y-1">
                  <div><strong>Name:</strong> {vendorToImpersonate.name}</div>
                  <div><strong>Email:</strong> {vendorToImpersonate.email}</div>
                  <div><strong>Category:</strong> {vendorToImpersonate.category}</div>
                  <div><strong>Status:</strong> {vendorToImpersonate.status}</div>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">Important Notes</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• This action is logged for security audit</li>
                  <li>• You can exit impersonation from the user menu</li>
                  <li>• Impersonation will automatically expire after 30 minutes</li>
                  <li>• Do not perform sensitive actions while impersonating</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowImpersonateConfirm(false)}>
                Cancel
              </Button>
              <Button 
                onClick={confirmImpersonation} 
                disabled={isImpersonating}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isImpersonating ? 'Starting Impersonation...' : 'Start Impersonation'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {/* Add a section for pending business/service approval requests */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Pending Business/Service Approval</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingBusinessRequests.length === 0 ? (
            <div className="text-gray-500">No pending business/service requests.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business/Service Name</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingBusinessRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>
                      {editingBusiness && editingBusiness.id === req.id ? (
                        <Input
                          value={editingBusiness.name}
                          onChange={e => setEditingBusiness({ ...editingBusiness, name: e.target.value })}
                        />
                      ) : (
                        req.name
                      )}
                    </TableCell>
                    <TableCell>{req.submittedBy}</TableCell>
                    <TableCell>{req.date}</TableCell>
                    <TableCell>
                      {editingBusiness && editingBusiness.id === req.id ? (
                        <>
                          <Button size="sm" onClick={() => {
                            // Save edit
                            setPendingBusinessRequests(pendingBusinessRequests.map(r => r.id === req.id ? { ...r, name: editingBusiness.name } : r));
                            setEditingBusiness(null);
                          }}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingBusiness(null)}>Cancel</Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setEditingBusiness(req)}>Edit</Button>
                          <Button size="sm" variant="success" onClick={() => {
                            // Approve: add to catalog, mark as approved, notify
                            setServiceCatalog([...serviceCatalog, req.name]);
                            setPendingBusinessRequests(pendingBusinessRequests.map(r => r.id === req.id ? { ...r, status: 'approved' } : r));
                            setAdminNotifications([...adminNotifications, { id: Date.now().toString(), type: 'BusinessApproval', message: `Approved new business/service: ${req.name}`, date: new Date().toISOString(), resolved: false }]);
                          }}>Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => {
                            setPendingBusinessRequests(pendingBusinessRequests.map(r => r.id === req.id ? { ...r, status: 'rejected' } : r));
                            setAdminNotifications([...adminNotifications, { id: Date.now().toString(), type: 'BusinessApproval', message: `Rejected business/service: ${req.name}`, date: new Date().toISOString(), resolved: false }]);
                          }}>Reject</Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {/* Admin Notifications section (for new business/service requests and approvals) */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Admin Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          {adminNotifications.length === 0 ? (
            <div className="text-gray-500">No notifications.</div>
          ) : (
            <ul className="space-y-2">
              {adminNotifications.map(note => (
                <li key={note.id} className="border rounded p-2 flex justify-between items-center">
                  <span>{note.message}</span>
                  <span className="text-xs text-gray-500">{new Date(note.date).toLocaleString()}</span>
                  {note.resolved ? <span className="text-green-600 ml-2">Resolved</span> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 