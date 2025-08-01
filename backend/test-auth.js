const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test data
const testUser = {
  email: 'test@example.com',
  password: 'password123',
  first_name: 'Test',
  last_name: 'User',
  phone: '+1234567890'
};

let authToken = '';

// Test functions
const testHealth = async () => {
  try {
    const response = await axios.get(`${BASE_URL.replace('/api', '')}/health`);
    console.log('✅ Health check:', response.data);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }
};

const testRegister = async () => {
  try {
    const response = await axios.post(`${BASE_URL}/auth/register`, testUser);
    console.log('✅ Registration successful:', response.data.message);
    authToken = response.data.token;
    return true;
  } catch (error) {
    if (error.response?.status === 409) {
      console.log('ℹ️ User already exists, proceeding to login...');
      return false;
    }
    console.error('❌ Registration failed:', error.response?.data || error.message);
    return false;
  }
};

const testLogin = async () => {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    console.log('✅ Login successful:', response.data.message);
    authToken = response.data.token;
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
};

const testGetProfile = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Get profile successful:', response.data.user.email);
    return true;
  } catch (error) {
    console.error('❌ Get profile failed:', error.response?.data || error.message);
    return false;
  }
};

const testUpdateProfile = async () => {
  try {
    const response = await axios.patch(`${BASE_URL}/auth/profile`, {
      first_name: 'Updated',
      last_name: 'Name'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Update profile successful:', response.data.message);
    return true;
  } catch (error) {
    console.error('❌ Update profile failed:', error.response?.data || error.message);
    return false;
  }
};

const testLogout = async () => {
  try {
    const response = await axios.post(`${BASE_URL}/auth/logout`, {}, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Logout successful:', response.data.message);
    return true;
  } catch (error) {
    console.error('❌ Logout failed:', error.response?.data || error.message);
    return false;
  }
};

// Run all tests
const runTests = async () => {
  console.log('🧪 Starting authentication tests...\n');

  await testHealth();
  console.log('');

  const registered = await testRegister();
  console.log('');

  if (!registered) {
    await testLogin();
    console.log('');
  }

  await testGetProfile();
  console.log('');

  await testUpdateProfile();
  console.log('');

  await testLogout();
  console.log('');

  console.log('🎉 Authentication tests completed!');
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests }; 