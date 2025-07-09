"use client";
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const mockEmployees = [
  { id: 1, name: 'Maria Lopez', email: 'maria@vendor.com', role: 'Technician', photo: 'https://randomuser.me/api/portraits/women/44.jpg' },
  { id: 2, name: 'James Lee', email: 'james@vendor.com', role: 'Technician', photo: 'https://randomuser.me/api/portraits/men/45.jpg' },
];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState(mockEmployees);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmp, setNewEmp] = useState({ name: '', email: '', role: '', photo: '' });

  const handleAdd = () => {
    setEmployees([...employees, { ...newEmp, id: Date.now() }]);
    setShowAdd(false);
    setNewEmp({ name: '', email: '', role: '', photo: '' });
  };
  const handleDelete = (id) => setEmployees(employees.filter(e => e.id !== id));

  return (
    <div className="px-4 md:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Employees</h2>
        <Button onClick={() => setShowAdd(true)}>Add Employee</Button>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {employees.map(emp => (
          <div key={emp.id} className="flex items-center gap-4 p-4 border rounded bg-white">
            <img src={emp.photo} alt={emp.name} className="w-12 h-12 rounded-full border" />
            <div className="flex-1">
              <div className="font-semibold">{emp.name}</div>
              <div className="text-xs text-gray-500">{emp.email}</div>
              <div className="text-xs text-gray-400">{emp.role}</div>
            </div>
            <Button size="sm" variant="outline" className="mr-2">Edit</Button>
            <Button size="sm" variant="destructive" onClick={() => handleDelete(emp.id)}>Delete</Button>
          </div>
        ))}
      </div>
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="w-full max-w-sm p-6">
          <DialogTitle>Add Employee</DialogTitle>
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleAdd(); }}>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input className="border rounded px-2 py-1 w-full" value={newEmp.name} onChange={e => setNewEmp({ ...newEmp, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input className="border rounded px-2 py-1 w-full" type="email" value={newEmp.email} onChange={e => setNewEmp({ ...newEmp, email: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <input className="border rounded px-2 py-1 w-full" value={newEmp.role} onChange={e => setNewEmp({ ...newEmp, role: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Photo URL</label>
              <input className="border rounded px-2 py-1 w-full" value={newEmp.photo} onChange={e => setNewEmp({ ...newEmp, photo: e.target.value })} />
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" type="button" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit">Add</Button>
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
            <li>All actions should be authenticated as vendor</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 