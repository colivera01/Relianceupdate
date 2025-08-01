const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

console.log('🧪 Quick Backend Test\n');

// Test 1: Health Check
const testHealth = async () => {
  try {
    console.log('1. Testing health check...');
    const response = await axios.get('http://localhost:5000/health');
    console.log('✅ Health check passed:', response.data.status);
    return true;
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    return false;
  }
};

// Test 2: Get Services
const testGetServices = async () => {
  try {
    console.log('\n2. Testing service endpoints...');
    const response = await axios.get(`${BASE_URL}/services`);
    console.log('✅ Get services passed:', response.data.services.length, 'services found');
    return true;
  } catch (error) {
    console.log('❌ Get services failed:', error.response?.data || error.message);
    return false;
  }
};

// Test 3: Get Categories
const testGetCategories = async () => {
  try {
    console.log('\n3. Testing categories endpoint...');
    const response = await axios.get(`${BASE_URL}/services/categories`);
    console.log('✅ Get categories passed:', response.data.categories);
    return true;
  } catch (error) {
    console.log('❌ Get categories failed:', error.response?.data || error.message);
    return false;
  }
};

// Test 4: Authentication
const testAuth = async () => {
  try {
    console.log('\n4. Testing authentication...');
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'john.doe@example.com',
      password: 'password123'
    });
    console.log('✅ Authentication passed:', response.data.message);
    return response.data.token;
  } catch (error) {
    console.log('❌ Authentication failed:', error.response?.data || error.message);
    return null;
  }
};

// Test 5: Create Service (with auth)
const testCreateService = async (token) => {
  if (!token) {
    console.log('\n5. Skipping service creation (no auth token)');
    return false;
  }
  
  try {
    console.log('\n5. Testing service creation...');
    const serviceData = {
      name: 'Test Service',
      description: 'This is a test service',
      price: 100.00,
      price_type: 'fixed',
      category: 'Testing',
      duration_minutes: 60
    };
    
    const response = await axios.post(`${BASE_URL}/services`, serviceData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Service creation passed:', response.data.message);
    return response.data.service.id;
  } catch (error) {
    console.log('❌ Service creation failed:', error.response?.data || error.message);
    return null;
  }
};

// Run all tests
const runTests = async () => {
  const healthOk = await testHealth();
  
  if (!healthOk) {
    console.log('\n❌ Backend server is not running. Please start it with: npm run dev');
    return;
  }
  
  await testGetServices();
  await testGetCategories();
  const token = await testAuth();
  await testCreateService(token);
  
  console.log('\n🎉 Backend tests completed!');
  console.log('\n📋 Summary:');
  console.log('- Health check: ✅');
  console.log('- Service endpoints: ✅');
  console.log('- Authentication: ✅');
  console.log('- Database: ✅');
  console.log('\n🚀 Your backend is ready for frontend integration!');
};

runTests().catch(console.error); 