'use client';

import React from 'react';
import UserManagement from '@/src/components/UserManagement';

export default function UsersPage() {
  return (
    <div className="p-4">
      <UserManagement />
      {/* Backend Developer Notes */}
      <div className="max-w-3xl mx-auto mt-12 mb-8 p-6 bg-gray-50 border border-gray-200 rounded shadow-sm">
        <h2 className="text-lg font-bold mb-2">Backend Developer Notes</h2>
        <ul className="list-disc pl-6 text-sm space-y-2">
          <li><b>User Data Model:</b> Each user should include: <code>id</code>, <code>name</code>, <code>email</code>, <code>role</code>, <code>status</code>, <code>createdAt</code>, <code>lastLogin</code>, <code>profileImage</code>, <code>vendorId</code> (if applicable), <code>permissions</code>.</li>
          <li><b>Endpoints:</b>
            <ul className="list-disc pl-6">
              <li><code>GET /api/users</code> (filters: search, status, role, vendor, pagination, sort)</li>
              <li><code>POST /api/users</code> (create new user)</li>
              <li><code>PATCH /api/users/:id</code> (update user details, status, role, permissions)</li>
              <li><code>DELETE /api/users/:id</code> (delete/deactivate user)</li>
              <li><code>POST /api/users/import</code> (bulk import users)</li>
              <li><code>POST /api/users/:id/notify</code> (send notification to user)</li>
            </ul>
          </li>
          <li><b>Batch Actions:</b> Endpoints should support batch operations (update/delete multiple users by IDs).</li>
          <li><b>Permissions:</b> Only admins or users with <code>user:manage</code> can perform management actions. Log all changes for audit.</li>
          <li><b>Error Handling:</b> Return clear error messages for duplicate emails, invalid roles, or permission issues.</li>
          <li><b>Future Features:</b> User activity logs, advanced search, export to CSV, role-based dashboards.</li>
        </ul>
      </div>
    </div>
  );
} 