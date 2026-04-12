/**
 * Dev-only: POST a test booking then GET vendor dashboard and assert the job title exists.
 * Configure vendorId, port, and x-user-id for your local environment before running.
 * Usage: node scripts/dev/vendor-job-dashboard-persist-check.cjs
 */
(async () => {
  const vendorId = "cmipm4d6v0000sosgqvb8tp63";
  const title = "Persist Test Job " + Date.now();
  const headers = {
    "Content-Type": "application/json",
    "x-user-id": "D43B6BB3-1A72-45EC-A362-A6E1E0580EA0",
    "x-vendor-id": vendorId,
  };
  const createRes = await fetch("http://localhost:3002/api/bookings", {
    method: "POST",
    headers,
    body: JSON.stringify({
      vendor_id: vendorId,
      title,
      client_name: "Persist Client",
      client_phone: "555-000-1111",
      booking_date: new Date().toISOString().split("T")[0],
      booking_time: "10:00:00",
      amount: 0,
    }),
  });
  const createText = await createRes.text();
  console.log("create", createRes.status, createText.slice(0, 240));

  const dashRes = await fetch(`http://localhost:3002/api/vendors/${vendorId}/dashboard`, { headers });
  const dashJson = await dashRes.json();
  const found =
    Array.isArray(dashJson?.recentJobs) && dashJson.recentJobs.some((j) => j.title === title);
  console.log("dashboard", dashRes.status, "found", found);
})();
