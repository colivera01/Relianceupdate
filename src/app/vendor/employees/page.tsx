"use client";
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const mockEmployees = [
  { id: 1, name: 'Maria Lopez', email: 'maria@vendor.com', role: 'Manager', photo: 'https://randomuser.me/api/portraits/women/44.jpg' },
  { id: 2, name: 'James Lee', email: 'james@vendor.com', role: 'Technician', photo: 'https://randomuser.me/api/portraits/men/45.jpg' },
];

const roleOptions = [
  { value: 'Manager', label: 'Manager', description: 'Can manage jobs, employees, and view all data' },
  { value: 'Technician', label: 'Technician', description: 'Can view assigned jobs and update status' },
];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState(mockEmployees);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [newEmp, setNewEmp] = useState({ name: '', email: '', role: 'Technician', photo: '' });
  const [editEmp, setEditEmp] = useState({ name: '', email: '', role: '', photo: '' });

  const handleAdd = () => {
    setEmployees([...employees, { ...newEmp, id: Date.now() }]);
    setShowAdd(false);
    setNewEmp({ name: '', email: '', role: 'Technician', photo: '' });
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setEditEmp({ name: employee.name, email: employee.email, role: employee.role, photo: employee.photo });
    setShowEdit(true);
  };

  const handleSaveEdit = () => {
    setEmployees(employees.map(emp => 
      emp.id === editingEmployee.id ? { ...emp, ...editEmp } : emp
    ));
    setShowEdit(false);
    setEditingEmployee(null);
    setEditEmp({ name: '', email: '', role: '', photo: '' });
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      setEmployees(employees.filter(e => e.id !== id));
    }
  };

  const getRoleBadgeVariant = (role) => {
    return role === 'Manager' ? 'default' : 'secondary';
  };

  return (
    <div className="px-4 md:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Team Management</h2>
          <p className="text-gray-600 mt-1">Manage your team members and their permissions</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>Add Employee</Button>
      </div>

      {/* Team Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg border">
          <div className="text-2xl font-bold text-blue-600">{employees.length}</div>
          <div className="text-sm text-blue-600">Total Employees</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border">
          <div className="text-2xl font-bold text-green-600">
            {employees.filter(e => e.role === 'Manager').length}
          </div>
          <div className="text-sm text-green-600">Managers</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border">
          <div className="text-2xl font-bold text-purple-600">
            {employees.filter(e => e.role === 'Technician').length}
          </div>
          <div className="text-sm text-purple-600">Technicians</div>
        </div>
      </div>

      {/* Employee List */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Employee List</h3>
        </div>
        <div className="divide-y">
          {employees.map(emp => (
            <div key={emp.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
              <img src={emp.photo} alt={emp.name} className="w-12 h-12 rounded-full border" />
              <div className="flex-1">
                <div className="font-semibold">{emp.name}</div>
                <div className="text-sm text-gray-500">{emp.email}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={getRoleBadgeVariant(emp.role)}>
                  {emp.role}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => handleEdit(emp)}>
                  Edit
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive" 
                  onClick={() => handleDelete(emp.id)}
                  disabled={emp.role === 'Manager' && employees.filter(e => e.role === 'Manager').length === 1}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Employee Modal */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="w-full max-w-md">
          <DialogTitle>Add New Employee</DialogTitle>
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleAdd(); }}>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input 
                id="name"
                value={newEmp.name} 
                onChange={e => setNewEmp({ ...newEmp, name: e.target.value })} 
                required 
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email"
                type="email" 
                value={newEmp.email} 
                onChange={e => setNewEmp({ ...newEmp, email: e.target.value })} 
                required 
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={newEmp.role} onValueChange={(value) => setNewEmp({ ...newEmp, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      <div>
                        <div className="font-medium">{role.label}</div>
                        <div className="text-xs text-gray-500">{role.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="photo">Photo URL</Label>
              <Input 
                id="photo"
                value={newEmp.photo} 
                onChange={e => setNewEmp({ ...newEmp, photo: e.target.value })} 
                placeholder="https://example.com/photo.jpg"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" type="button" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Employee</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Modal */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="w-full max-w-md">
          <DialogTitle>Edit Employee</DialogTitle>
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSaveEdit(); }}>
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input 
                id="edit-name"
                value={editEmp.name} 
                onChange={e => setEditEmp({ ...editEmp, name: e.target.value })} 
                required 
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input 
                id="edit-email"
                type="email" 
                value={editEmp.email} 
                onChange={e => setEditEmp({ ...editEmp, email: e.target.value })} 
                required 
              />
            </div>
            <div>
              <Label htmlFor="edit-role">Role</Label>
              <Select value={editEmp.role} onValueChange={(value) => setEditEmp({ ...editEmp, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      <div>
                        <div className="font-medium">{role.label}</div>
                        <div className="text-xs text-gray-500">{role.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-photo">Photo URL</Label>
              <Input 
                id="edit-photo"
                value={editEmp.photo} 
                onChange={e => setEditEmp({ ...editEmp, photo: e.target.value })} 
                placeholder="https://example.com/photo.jpg"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" type="button" onClick={() => setShowEdit(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Backend Developer Notes Section */}
      <div className="mt-10">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded shadow-sm">
          <h3 className="font-bold text-yellow-800 mb-2">Backend Developer Notes</h3>
          <ul className="text-sm text-yellow-900 list-disc pl-5 space-y-1">
            <li>Fetch employees for this vendor from <b>GET /api/vendor/employees</b></li>
            <li>Add a new employee via <b>POST /api/vendor/employees</b> with name, email, role, photo, etc.</li>
            <li>Update employee details via <b>PUT /api/vendor/employees/:employeeId</b></li>
            <li>Delete employee via <b>DELETE /api/vendor/employees/:employeeId</b></li>
            <li>Role should be either 'Manager' or 'Technician'</li>
            <li>Prevent deletion of the last Manager</li>
            <li>All actions should be authenticated as vendor</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 