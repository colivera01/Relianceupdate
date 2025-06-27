import { useState } from 'react'
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
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'

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
  const [autoApproveVendors] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [selectedVendors, setSelectedVendors] = useState<string[]>([])
  const [approvalFilter, setApprovalFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [contactFilter, setContactFilter] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: 'reject' | 'deactivate', vendor: Vendor } | null>(null)

  const filteredVendors = vendors.filter((vendor) =>
    (vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.email.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (approvalFilter === 'all' || vendor.approvalStatus === approvalFilter) &&
    (statusFilter === 'all' || vendor.status === statusFilter) &&
    (contactFilter === 'all' || vendor.contactPerson === contactFilter)
  )

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

  return (
    <div className="space-y-6">
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Input
          placeholder="Search vendors..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="border rounded px-2 py-1 text-sm pr-6"
          value={approvalFilter}
          onChange={(e) => setApprovalFilter(e.target.value)}
        >
          <option value="all">All Approval Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          className="border rounded px-2 py-1 text-sm pr-6"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <select
          className="border rounded px-2 py-1 text-sm pr-6"
          value={contactFilter}
          onChange={(e) => setContactFilter(e.target.value)}
        >
          <option value="all">All Contacts</option>
          {[...new Set(vendors.map(v => v.contactPerson))].map(cp => (
            <option key={cp} value={cp}>{cp}</option>
          ))}
        </select>
      </div>

      {/* Bulk Actions Bar */}
      {selectedVendors.length > 0 && (
        <div className="border-blue-200 bg-blue-50 border rounded-lg p-4 flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{selectedVendors.length} vendor(s) selected</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={bulkApprove} disabled={!selectedVendors.some(id => vendors.find(v => v.id === id)?.approvalStatus === 'pending')}>Approve Selected</Button>
            <Button variant="outline" size="sm" onClick={bulkReject} disabled={!selectedVendors.some(id => vendors.find(v => v.id === id)?.approvalStatus === 'pending')}>Reject Selected</Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedVendors([])}>Clear Selection</Button>
          </div>
        </div>
      )}

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <input type="checkbox" checked={filteredVendors.length > 0 && filteredVendors.every(v => selectedVendors.includes(v.id))} onChange={e => setSelectedVendors(e.target.checked ? filteredVendors.map(v => v.id) : [])} />
              </TableHead>
              <TableHead>Vendor Name</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(showApprovalQueue ? pendingVendors : filteredVendors).map((vendor) => (
              <TableRow key={vendor.id}>
                <TableCell>
                  <Checkbox checked={selectedVendors.includes(vendor.id)} onCheckedChange={() => toggleVendorSelection(vendor.id)} />
                </TableCell>
                <TableCell>{vendor.name}</TableCell>
                <TableCell>{vendor.contactPerson}</TableCell>
                <TableCell>{vendor.email}</TableCell>
                <TableCell>{vendor.phone}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-sm ${
                    vendor.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {vendor.status}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={
                    vendor.approvalStatus === 'approved' ? 'success' :
                    vendor.approvalStatus === 'rejected' ? 'destructive' :
                    'warning'
                  } className="capitalize">
                    {vendor.approvalStatus}
                  </Badge>
                </TableCell>
                <TableCell>
                  {vendor.approvalStatus === 'pending' ? (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => approveVendor(vendor.id)}>
                        Approve
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleRejectVendor(vendor)}>
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setEditingVendor(vendor)}>
                      Edit
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editingVendor && (
        <Dialog open={!!editingVendor} onOpenChange={() => setEditingVendor(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Vendor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editName">Vendor Name</Label>
                <Input
                  id="editName"
                  value={editingVendor.name}
                  onChange={(e) => setEditingVendor({ ...editingVendor, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editContactPerson">Contact Person</Label>
                <Input
                  id="editContactPerson"
                  value={editingVendor.contactPerson}
                  onChange={(e) => setEditingVendor({ ...editingVendor, contactPerson: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editEmail">Email</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={editingVendor.email}
                  onChange={(e) => setEditingVendor({ ...editingVendor, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPhone">Phone</Label>
                <Input
                  id="editPhone"
                  value={editingVendor.phone}
                  onChange={(e) => setEditingVendor({ ...editingVendor, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editBusinessAddress">Business Address</Label>
                <Input
                  id="editBusinessAddress"
                  value={editingVendor.businessAddress}
                  onChange={(e) => setEditingVendor({ ...editingVendor, businessAddress: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editStatus">Status</Label>
                <select
                  id="editStatus"
                  className="w-full border rounded px-2 py-1"
                  value={editingVendor.status}
                  onChange={(e) => setEditingVendor({ ...editingVendor, status: e.target.value as 'Active' | 'Inactive' })}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editApprovalStatus">Approval Status</Label>
                <select
                  id="editApprovalStatus"
                  className="w-full border rounded px-2 py-1"
                  value={editingVendor.approvalStatus}
                  onChange={(e) => setEditingVendor({ ...editingVendor, approvalStatus: e.target.value as 'pending' | 'approved' | 'rejected' })}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <Button className="w-full" onClick={() => {
                setVendors(vendors => vendors.map(v => v.id === editingVendor.id ? editingVendor : v))
                setEditingVendor(null)
              }}>
                Save Changes
              </Button>
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
    </div>
  )
} 