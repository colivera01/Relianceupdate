import { useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const mockProfile = {
  name: "Admin User",
  email: "admin@reliance.com",
  role: "Administrator",
  avatar: "https://randomuser.me/api/portraits/men/32.jpg",
  status: "active",
  privileges: [
    "Full Dashboard Access",
    "User Management",
    "Vendor Management",
    "Review Moderation",
    "Audit Logs",
    "Settings Access"
  ],
  activity: [
    "Logged in from new device (2024-06-10)",
    "Approved review #1234 (2024-06-09)",
    "Suspended user #5678 (2024-06-08)",
    "Updated profile info (2024-06-07)"
  ],
  employees: [
    { id: 1, name: "Maria Lopez", photo: "https://randomuser.me/api/portraits/women/44.jpg" },
    { id: 2, name: "James Lee", photo: "https://randomuser.me/api/portraits/men/45.jpg" }
  ]
};

export default function Profile() {
  const [profile, setProfile] = useState(mockProfile);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: profile.name, email: profile.email });
  const [employees, setEmployees] = useState(profile.employees);
  const [newEmployee, setNewEmployee] = useState({ name: "", photo: "" });

  const save = () => {
    setProfile({ ...profile, ...form });
    setEditing(false);
  };

  const addEmployee = () => {
    if (!newEmployee.name) return;
    setEmployees([...employees, { ...newEmployee, id: Date.now() }]);
    setNewEmployee({ name: "", photo: "" });
  };

  const removeEmployee = (id: number) => {
    setEmployees(employees.filter(e => e.id !== id));
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader className="flex items-center gap-4">
          <img src={profile.avatar} alt={profile.name} className="w-20 h-20 rounded-full border object-cover" />
          <div>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              {profile.name}
              <Badge variant="secondary">{profile.role}</Badge>
            </CardTitle>
            <div className="text-gray-600">{profile.email}</div>
            <div className="mt-1">
              <Badge variant={profile.status === 'active' ? 'success' : 'destructive'} className="capitalize text-xs">{profile.status}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 mt-4">
          <div>
            <h3 className="font-semibold mb-2">Profile Details</h3>
            {editing ? (
              <div className="space-y-2">
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Name"
                />
                <Input
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="Email"
                />
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                  <Button onClick={save}>Save</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div><span className="font-medium">Name:</span> {profile.name}</div>
                <div><span className="font-medium">Email:</span> {profile.email}</div>
                <Button size="sm" className="mt-2" onClick={() => setEditing(true)}>Edit</Button>
              </div>
            )}
          </div>
          <div>
            <h3 className="font-semibold mb-2">Team Members</h3>
            <div className="space-y-2">
              {employees.map(emp => (
                <div key={emp.id} className="flex items-center gap-3 bg-gray-50 rounded p-2">
                  <img src={emp.photo || 'https://via.placeholder.com/40'} alt={emp.name} className="w-10 h-10 rounded-full border object-cover" />
                  <span className="flex-1">{emp.name}</span>
                  <Button size="sm" variant="destructive" onClick={() => removeEmployee(emp.id)}>Remove</Button>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <Input
                  value={newEmployee.name}
                  onChange={e => setNewEmployee(ne => ({ ...ne, name: e.target.value }))}
                  placeholder="Employee Name"
                  className="flex-1"
                />
                <Input
                  value={newEmployee.photo}
                  onChange={e => setNewEmployee(ne => ({ ...ne, photo: e.target.value }))}
                  placeholder="Photo URL (optional)"
                  className="flex-1"
                />
                <Button size="sm" onClick={addEmployee}>Add</Button>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Admin Privileges</h3>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              {profile.privileges.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Recent Activity</h3>
            <ul className="text-xs text-gray-600 space-y-1">
              {profile.activity.map((a, i) => <li key={i}>• {a}</li>)}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 