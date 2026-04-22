'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, Eye, Clock, AlertCircle, Building, Phone, Mail, MapPin, Calendar, Users, Award } from 'lucide-react';

interface PendingVendor {
  id: string;
  businessName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  category: string;
  businessType: string;
  foundedYear: number;
  totalEmployees: number;
  yearsInBusiness: number;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  createdAt: string;
  submittedAt: string;
}

interface ApprovalQueueProps {
  // Add any props if needed
}

export default function ApprovalQueuePage() {
  const [pendingVendors, setPendingVendors] = useState<PendingVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [showVendorDetails, setShowVendorDetails] = useState<PendingVendor | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  // Mock admin data - in real app, get from auth context
  const adminData = {
    id: 'admin-1',
    email: 'admin@reliance.com',
    name: 'Admin User',
  };

  const getAdminHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (process.env.NODE_ENV === 'development') {
      headers['x-admin'] = 'true';
      headers['x-user-role'] = 'admin';
      headers['x-user-id'] = adminData.id;
    }
    return headers;
  };

  useEffect(() => {
    fetchPendingVendors();
  }, [searchTerm, categoryFilter, sortBy, sortOrder]);

  const fetchPendingVendors = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/admin/vendors/pending?search=${encodeURIComponent(searchTerm)}&category=${encodeURIComponent(
          categoryFilter
        )}&sortBy=${encodeURIComponent(sortBy)}&sortOrder=${encodeURIComponent(sortOrder)}`,
        {
          method: 'GET',
          headers: getAdminHeaders(),
          cache: 'no-store',
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load pending vendors');
      }
      const vendors = payload?.data?.vendors;
      setPendingVendors(Array.isArray(vendors) ? vendors : []);
    } catch (error) {
      console.error('Error fetching pending vendors:', error);
      setError(error instanceof Error ? error.message : 'Failed to load pending vendors');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveVendor = async (vendorId: string) => {
    setProcessingAction(`approve-${vendorId}`);
    
    try {
      const response = await fetch('/api/admin/vendors/approve', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          vendorId,
          adminId: adminData.id,
          adminEmail: adminData.email,
          notes: adminNotes,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to approve vendor');
      }
      
      // Remove vendor from pending list
      setPendingVendors(prev => prev.filter(v => v.id !== vendorId));
      
      // Clear admin notes
      setAdminNotes('');
      
      console.log(`Vendor ${vendorId} approved by ${adminData.email}`);
    } catch (error) {
      console.error('Error approving vendor:', error);
      setError('Failed to approve vendor');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleRejectVendor = async (vendorId: string) => {
    if (!rejectionReason.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }

    setProcessingAction(`reject-${vendorId}`);
    
    try {
      const response = await fetch('/api/admin/vendors/reject', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          vendorId,
          adminId: adminData.id,
          adminEmail: adminData.email,
          rejectionReason,
          notes: adminNotes,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to reject vendor');
      }
      
      // Remove vendor from pending list
      setPendingVendors(prev => prev.filter(v => v.id !== vendorId));
      
      // Clear rejection reason and admin notes
      setRejectionReason('');
      setAdminNotes('');
      setShowRejectDialog(false);
      
      console.log(`Vendor ${vendorId} rejected by ${adminData.email} with reason: ${rejectionReason}`);
    } catch (error) {
      console.error('Error rejecting vendor:', error);
      setError('Failed to reject vendor');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedVendors.length === 0) return;
    
    setProcessingAction('bulk-approve');
    
    try {
      const response = await fetch('/api/admin/vendors/bulk-approve', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          vendorIds: selectedVendors,
          adminId: adminData.id,
          adminEmail: adminData.email,
          notes: adminNotes,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to bulk approve vendors');
      }
      if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
        setError(`Some approvals failed: ${payload.errors.map((item: any) => item?.vendorId).join(', ')}`);
      }
      const approvedIds = Array.isArray(payload?.results)
        ? payload.results.map((item: any) => String(item?.vendorId))
        : [];
      
      // Remove approved vendors from pending list
      setPendingVendors(prev => prev.filter(v => !approvedIds.includes(v.id)));
      setSelectedVendors(prev => prev.filter(id => !approvedIds.includes(id)));
      setAdminNotes('');
      
      console.log(`Bulk approved ${selectedVendors.length} vendors by ${adminData.email}`);
    } catch (error) {
      console.error('Error bulk approving vendors:', error);
      setError('Failed to bulk approve vendors');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleBulkReject = async () => {
    if (selectedVendors.length === 0 || !rejectionReason.trim()) {
      setError('Please select vendors and provide a rejection reason');
      return;
    }
    
    setProcessingAction('bulk-reject');
    
    try {
      const response = await fetch('/api/admin/vendors/bulk-reject', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          vendorIds: selectedVendors,
          adminId: adminData.id,
          adminEmail: adminData.email,
          rejectionReason,
          notes: adminNotes,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to bulk reject vendors');
      }
      if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
        setError(`Some rejections failed: ${payload.errors.map((item: any) => item?.vendorId).join(', ')}`);
      }
      const rejectedIds = Array.isArray(payload?.results)
        ? payload.results.map((item: any) => String(item?.vendorId))
        : [];
      
      // Remove rejected vendors from pending list
      setPendingVendors(prev => prev.filter(v => !rejectedIds.includes(v.id)));
      setSelectedVendors(prev => prev.filter(id => !rejectedIds.includes(id)));
      setRejectionReason('');
      setAdminNotes('');
      
      console.log(`Bulk rejected ${selectedVendors.length} vendors by ${adminData.email} with reason: ${rejectionReason}`);
    } catch (error) {
      console.error('Error bulk rejecting vendors:', error);
      setError('Failed to bulk reject vendors');
    } finally {
      setProcessingAction(null);
    }
  };

  const toggleVendorSelection = (vendorId: string) => {
    setSelectedVendors(prev => 
      prev.includes(vendorId) 
        ? prev.filter(id => id !== vendorId)
        : [...prev, vendorId]
    );
  };

  const selectAllVendors = () => {
    if (selectedVendors.length === pendingVendors.length) {
      setSelectedVendors([]);
    } else {
      setSelectedVendors(pendingVendors.map(v => v.id));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading approval queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vendor Approval Queue</h1>
          <p className="text-gray-600 mt-2">
            Review and approve pending vendor registrations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            {pendingVendors.length} Pending
          </Badge>
          <Badge variant="outline" className="text-sm">
            {selectedVendors.length} Selected
          </Badge>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-64">
              <Input
                placeholder="Search vendors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="all">All Categories</option>
              <option value="Cleaning">Cleaning</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Painting">Painting</option>
              <option value="Electrical">Electrical</option>
              <option value="HVAC">HVAC</option>
              <option value="Landscaping">Landscaping</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="createdAt">Registration Date</option>
              <option value="businessName">Business Name</option>
              <option value="category">Category</option>
            </select>
            <Button
              variant="outline"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedVendors.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="font-medium text-blue-800">
                  {selectedVendors.length} vendor{selectedVendors.length > 1 ? 's' : ''} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllVendors}
                >
                  {selectedVendors.length === pendingVendors.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleBulkApprove}
                  disabled={processingAction === 'bulk-approve'}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {processingAction === 'bulk-approve' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve Selected
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => setShowRejectDialog(true)}
                  disabled={processingAction === 'bulk-reject'}
                  variant="destructive"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-800">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="ml-auto"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Vendor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pendingVendors.map((vendor) => (
          <Card key={vendor.id} className="relative">
            {/* Selection Checkbox */}
            <div className="absolute top-4 left-4 z-10">
              <input
                type="checkbox"
                checked={selectedVendors.includes(vendor.id)}
                onChange={() => toggleVendorSelection(vendor.id)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>

            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-8">
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    {vendor.businessName}
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    {vendor.firstName} {vendor.lastName}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {vendor.category}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Contact Information */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{vendor.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{vendor.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">
                    {vendor.city}, {vendor.state}
                  </span>
                </div>
              </div>

              {/* Business Details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{vendor.businessType}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{vendor.totalEmployees} employees</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{vendor.yearsInBusiness} years</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Est. {vendor.foundedYear}</span>
                </div>
              </div>

              {/* Registration Info */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Registered {formatDate(vendor.createdAt)}</span>
                  <span>{getTimeAgo(vendor.createdAt)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowVendorDetails(vendor)}
                  className="flex-1"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleApproveVendor(vendor.id)}
                  disabled={processingAction === `approve-${vendor.id}`}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {processingAction === `approve-${vendor.id}` ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setShowVendorDetails(vendor);
                    setShowRejectDialog(true);
                  }}
                  disabled={processingAction === `reject-${vendor.id}`}
                >
                  {processingAction === `reject-${vendor.id}` ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {pendingVendors.length === 0 && !loading && (
        <Card className="text-center py-12">
          <CardContent>
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Pending Approvals
            </h3>
            <p className="text-gray-600">
              All vendor registrations have been reviewed. Check back later for new submissions.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Vendor Details Modal */}
      {showVendorDetails && (
        <Dialog open onOpenChange={() => setShowVendorDetails(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                {showVendorDetails.businessName}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Business Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Business Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Business Name:</span>
                      <span className="font-medium">{showVendorDetails.businessName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Business Type:</span>
                      <span className="font-medium">{showVendorDetails.businessType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Category:</span>
                      <span className="font-medium">{showVendorDetails.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Founded:</span>
                      <span className="font-medium">{showVendorDetails.foundedYear}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Employees:</span>
                      <span className="font-medium">{showVendorDetails.totalEmployees}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Years in Business:</span>
                      <span className="font-medium">{showVendorDetails.yearsInBusiness}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Contact Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Contact Person:</span>
                      <span className="font-medium">
                        {showVendorDetails.firstName} {showVendorDetails.lastName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Email:</span>
                      <span className="font-medium">{showVendorDetails.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Phone:</span>
                      <span className="font-medium">{showVendorDetails.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Address:</span>
                      <span className="font-medium text-right">
                        {showVendorDetails.address}<br />
                        {showVendorDetails.city}, {showVendorDetails.state} {showVendorDetails.zipCode}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Registration Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Registration Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Registration Date:</span>
                    <span className="font-medium">{formatDate(showVendorDetails.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time Since Registration:</span>
                    <span className="font-medium">{getTimeAgo(showVendorDetails.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Admin Notes */}
              <div className="space-y-2">
                <Label htmlFor="adminNotes">Admin Notes (Optional)</Label>
                <Textarea
                  id="adminNotes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this vendor for internal reference..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowVendorDetails(null)}
              >
                Close
              </Button>
              <Button
                onClick={() => handleApproveVendor(showVendorDetails.id)}
                disabled={processingAction === `approve-${showVendorDetails.id}`}
                className="bg-green-600 hover:bg-green-700"
              >
                {processingAction === `approve-${showVendorDetails.id}` ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve Vendor
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowRejectDialog(true)}
                disabled={processingAction === `reject-${showVendorDetails.id}`}
              >
                {processingAction === `reject-${showVendorDetails.id}` ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject Vendor
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Vendor</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejectionReason">Reason for Rejection *</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a reason for rejecting this vendor..."
                rows={4}
                className="mt-2"
              />
            </div>
            
            <div>
              <Label htmlFor="rejectionNotes">Additional Notes (Optional)</Label>
              <Textarea
                id="rejectionNotes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add any additional notes..."
                rows={3}
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectionReason('');
                setAdminNotes('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (showVendorDetails) {
                  handleRejectVendor(showVendorDetails.id);
                } else {
                  handleBulkReject();
                }
              }}
              disabled={!rejectionReason.trim() || processingAction?.includes('reject')}
            >
              {processingAction?.includes('reject') ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject Vendor{selectedVendors.length > 1 ? 's' : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 