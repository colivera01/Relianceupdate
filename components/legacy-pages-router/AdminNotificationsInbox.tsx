import React, { useState, useEffect } from "react";

interface AlertItem {
  id: string;
  user: string;
  type: "User" | "Vendor" | "Review" | "Payment";
  message: string;
  date: string;
  priority: "Low" | "Medium" | "High";
  resolved: boolean;
}

const AdminNotificationsInbox = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>("All");
  const [filterPriority, setFilterPriority] = useState<string>("All");
  const [filterDate, setFilterDate] = useState<string>("");

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch("/api/admin/alerts");
        if (!res.ok) throw new Error();
        const json = await res.json();
        setAlerts(json.alerts || []);
      } catch {
        // For preview, use sample data
        setAlerts([
          { id: "1", user: "Alice", type: "Vendor", message: "Vendor Acme flagged for low rating.", date: new Date().toISOString(), priority: "High", resolved: false },
          { id: "2", user: "Bob", type: "Payment", message: "Subscription payment failed for Vendor XYZ.", date: new Date().toISOString(), priority: "Medium", resolved: false }
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchAlerts();
  }, []);

  const filteredAlerts = alerts.filter((alert) => {
    if (filterType !== "All" && alert.type !== filterType) return false;
    if (filterPriority !== "All" && alert.priority !== filterPriority) return false;
    if (filterDate && !alert.date.startsWith(filterDate)) return false;
    return true;
  });

  const markResolved = async (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, resolved: true } : a)));
    try {
      await fetch(`/api/admin/alerts/${id}/resolve`, { method: "POST" });
    } catch {
      // ignore
    }
  };

  if (loading) return <div style={{ padding: "1rem" }}>Loading alerts...</div>;

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Notifications / Inbox</h2>
      <div style={{ display: "flex", gap: "1rem", margin: "1rem 0" }}>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option>All</option>
          <option>User</option>
          <option>Vendor</option>
          <option>Review</option>
          <option>Payment</option>
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
          <option>All</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
      </div>

      {filteredAlerts.length === 0 ? (
        <div>No pending alerts.</div>
      ) : (
        filteredAlerts.map((alert) => (
          <div
            key={alert.id}
            style={{ border: "1px solid #ccc", borderRadius: "4px", margin: "0.5rem 0", padding: "0.5rem" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <strong>{alert.priority} Priority</strong> - <em>{alert.type} Alert</em> for <strong>{alert.user}</strong>
              </div>
              <div style={{ fontSize: "0.8rem", color: "#555" }}>{new Date(alert.date).toLocaleString()}</div>
            </div>
            <div style={{ margin: "0.5rem 0" }}>{alert.message}</div>
            {alert.resolved ? (
              <span style={{ color: "green" }}>Resolved</span>
            ) : (
              <button onClick={() => markResolved(alert.id)}>Mark Resolved</button>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default AdminNotificationsInbox; 