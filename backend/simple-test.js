const http = require('http');

console.log('🧪 Simple Backend Test\n');

// Test health endpoint
const testHealth = () => {
  return new Promise((resolve) => {
    const req = http.request('http://localhost:5000/health', (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('✅ Health check passed:', result.status);
          resolve(true);
        } catch (error) {
          console.log('❌ Health check failed - invalid JSON');
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ Health check failed:', error.message);
      resolve(false);
    });

    req.end();
  });
};

// Test services endpoint
const testServices = () => {
  return new Promise((resolve) => {
    const req = http.request('http://localhost:5000/api/services', (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('✅ Services endpoint passed:', result.services ? result.services.length : 0, 'services');
          resolve(true);
        } catch (error) {
          console.log('❌ Services endpoint failed - invalid JSON');
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ Services endpoint failed:', error.message);
      resolve(false);
    });

    req.end();
  });
};

// Run tests
const runTests = async () => {
  console.log('1. Testing health endpoint...');
  const healthOk = await testHealth();
  
  if (!healthOk) {
    console.log('\n❌ Backend server is not responding on port 5000');
    console.log('Please make sure to:');
    console.log('1. Start the backend: npm run dev');
    console.log('2. Check if PostgreSQL is running');
    console.log('3. Check if the .env file is configured');
    return;
  }

  console.log('\n2. Testing services endpoint...');
  await testServices();

  console.log('\n🎉 Basic backend tests completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Your backend is running ✅');
  console.log('2. Test with the full test suite: node test-services.js');
  console.log('3. Integrate with your frontend');
};

runTests(); 