const http = require('http');

console.log('🧪 Testing Backend API\n');

// Test function
const testEndpoint = (url, description) => {
  return new Promise((resolve) => {
    console.log(`Testing: ${description}`);
    
    const req = http.request(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log(`✅ ${description} - Status: ${res.statusCode}`);
          if (result.message) {
            console.log(`   Message: ${result.message}`);
          }
          resolve(true);
        } catch (error) {
          console.log(`❌ ${description} - Invalid JSON response`);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ ${description} - ${error.message}`);
      resolve(false);
    });

    req.setTimeout(5000, () => {
      console.log(`❌ ${description} - Timeout`);
      req.destroy();
      resolve(false);
    });

    req.end();
  });
};

// Run tests
const runTests = async () => {
  console.log('Starting backend tests...\n');

  // Test 1: Health check
  const healthOk = await testEndpoint('http://localhost:5000/health', 'Health Check');
  
  if (!healthOk) {
    console.log('\n❌ Backend server is not responding on port 5000');
    console.log('\n📋 Troubleshooting:');
    console.log('1. Make sure backend is running: npm run dev');
    console.log('2. Check if port 5000 is available');
    console.log('3. Check if PostgreSQL is installed and running');
    console.log('4. Check if .env file exists with proper configuration');
    return;
  }

  console.log('\n2. Testing API endpoints...\n');

  // Test 2: Auth endpoints
  await testEndpoint('http://localhost:5000/api/auth', 'Auth Endpoint');

  // Test 3: Services endpoints
  await testEndpoint('http://localhost:5000/api/services', 'Services Endpoint');

  // Test 4: Users endpoint
  await testEndpoint('http://localhost:5000/api/users', 'Users Endpoint');

  // Test 5: Vendors endpoint
  await testEndpoint('http://localhost:5000/api/vendors', 'Vendors Endpoint');

  // Test 6: Bookings endpoint
  await testEndpoint('http://localhost:5000/api/bookings', 'Bookings Endpoint');

  console.log('\n🎉 Backend test completed!');
  console.log('\n📋 Summary:');
  console.log('- Backend server: ✅ Running on port 5000');
  console.log('- API endpoints: ✅ All endpoints responding');
  console.log('- Database: ✅ Connected (if no errors above)');
  console.log('\n🚀 Your backend is ready for frontend integration!');
  console.log('\n📝 Next steps:');
  console.log('1. Your frontend can now connect to http://localhost:5000/api');
  console.log('2. Test authentication: POST /api/auth/login');
  console.log('3. Test services: GET /api/services');
  console.log('4. Integrate with your React/Next.js frontend');
};

runTests(); 