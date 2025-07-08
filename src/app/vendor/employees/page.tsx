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
    <div className="p-6 max-w-2xl mx-auto">
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
    </div>
  );
} 