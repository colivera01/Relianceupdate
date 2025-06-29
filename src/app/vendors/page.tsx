'use client';
import { VendorManagement } from '@/components/VendorManagement';

export default function VendorsPage() {
  return (
    <>
      <VendorManagement />
      {/* Backend Developer Notes */}
      <div className="max-w-3xl mx-auto mt-12 mb-8 p-6 bg-gray-50 border border-gray-200 rounded shadow-sm">
        <h2 className="text-lg font-bold mb-2">Backend Developer Notes</h2>
        <ul className="list-disc pl-6 text-sm space-y-2">
          <li><b>Vendor Data Model:</b> Each vendor should include: <code>id</code>, <code>name</code>, <code>contactPerson</code>, <code>email</code>, <code>phone</code>, <code>status</code>, <code>approval</code>, <code>createdAt</code>, <code>services</code>, <code>address</code>, <code>users</code> (array of user IDs).</li>
          <li><b>Endpoints:</b>
            <ul className="list-disc pl-6">
              <li><code>GET /api/vendors</code> (filters: search, status, approval, pagination, sort)</li>
              <li><code>POST /api/vendors</code> (create new vendor)</li>
              <li><code>PATCH /api/vendors/:id</code> (update vendor details, status, approval)</li>
              <li><code>DELETE /api/vendors/:id</code> (delete/deactivate vendor)</li>
              <li><code>POST /api/vendors/import</code> (bulk import vendors)</li>
              <li><code>POST /api/vendors/:id/notify</code> (send notification to vendor)</li>
            </ul>
          </li>
          <li><b>Batch Actions:</b> Endpoints should support batch operations (update/delete multiple vendors by IDs).</li>
          <li><b>Permissions:</b> Only admins or users with <code>vendor:manage</code> can perform management actions. Log all changes for audit.</li>
          <li><b>Error Handling:</b> Return clear error messages for duplicate emails, invalid status, or permission issues.</li>
          <li><b>Future Features:</b> Vendor analytics, document uploads, integration with external services.</li>
        </ul>
      </div>
    </>
  );
} 