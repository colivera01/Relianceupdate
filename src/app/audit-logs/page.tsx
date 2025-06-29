import { AuditLog } from '../../../components/AuditLog';

// Backend Developer Notes
export function AuditLogWithNotes() {
  return <>
    <AuditLog />
    <div className="max-w-3xl mx-auto mt-12 mb-8 p-6 bg-gray-50 border border-gray-200 rounded shadow-sm">
      <h2 className="text-lg font-bold mb-2">Backend Developer Notes</h2>
      <ul className="list-disc pl-6 text-sm space-y-2">
        <li><b>Audit Log Data Model:</b> Each log entry should include: <code>id</code>, <code>userId</code>, <code>action</code>, <code>entityType</code>, <code>entityId</code>, <code>timestamp</code>, <code>details</code>, <code>ip</code>, <code>location</code>.</li>
        <li><b>Endpoints:</b>
          <ul className="list-disc pl-6">
            <li><code>GET /api/audit-logs</code> (filters: user, action, entity, date range, pagination, sort)</li>
            <li><code>POST /api/audit-logs/export</code> (export logs to CSV/Excel)</li>
            <li><code>GET /api/users</code> (for user filter dropdown)</li>
          </ul>
        </li>
        <li><b>Batch Actions:</b> Endpoints should support batch export and batch delete by IDs.</li>
        <li><b>Permissions:</b> Only admins or users with <code>audit:view</code> can access logs. Log all access for audit.</li>
        <li><b>Error Handling:</b> Return clear error messages for invalid filters or permission issues.</li>
        <li><b>Future Features:</b> Retention policy management, drilldown, alerting, integration with SIEM tools.</li>
      </ul>
    </div>
  </>;
}

export default AuditLogWithNotes; 