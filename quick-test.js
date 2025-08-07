// quick-test.js
require('dotenv').config();
const sql = require('mssql');

console.log("💡 Quick test starting...\n");

// Environment variable check
console.log("Environment check:");
console.log("NODE_ENV:", process.env.NODE_ENV || 'not set');
console.log("DATABASE_URL exists:", process.env.DATABASE_URL ? "Yes" : "No");
console.log("");

// Function to test DB connection
async function testDatabase() {
  try {
    console.log("🔌 Connecting to Azure SQL Database...");
    await sql.connect(process.env.DATABASE_URL);
    console.log("✅ Connected to Azure SQL Database successfully!");
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
  } finally {
    await sql.close();
  }
}

// Basic functionality tests
console.log("Basic functionality tests:");
console.log("✅ Array map test:", [1, 2, 3, 4, 5].map(n => n * 2));
console.log("✅ Object test:", { name: 'Project Reliance', version: '1.0.0', status: 'active' });
console.log("✅ Test run at:", new Date().toISOString());
console.log("");

// Run tests
(async () => {
  await testDatabase();
  console.log("\n🎉 All tests completed!");
})();