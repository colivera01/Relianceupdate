const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
let authToken = '';

// Test data
const testService = {
  name: 'Professional House Cleaning',
  description: 'Complete house cleaning service including kitchen, bathroom, and living areas',
  price: 150.00,
  price_type: 'fixed',
  category: 'Cleaning',
  duration_minutes: 120,
  features: ['Deep cleaning', 'Eco-friendly products', 'Satisfaction guaranteed'],
  inclusions: ['Kitchen cleaning', 'Bathroom cleaning', 'Living area cleaning'],
  images: ['https://example.com/cleaning1.jpg'],
  videos: []
};

// Test functions
const testHealth = async () => {
  try {
    const response = await axios.get(`${BASE_URL.replace('/api', '')}/health`);
    console.log('✅ Health check:', response.data.status);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }
};

const testLogin = async () => {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'john.doe@example.com',
      password: 'password123'
    });
    console.log('✅ Login successful:', response.data.message);
    authToken = response.data.token;
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
};

const testGetServices = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/services`);
    console.log('✅ Get services successful:', response.data.services.length, 'services found');
    return true;
  } catch (error) {
    console.error('❌ Get services failed:', error.response?.data || error.message);
    return false;
  }
};

const testGetCategories = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/services/categories`);
    console.log('✅ Get categories successful:', response.data.categories);
    return true;
  } catch (error) {
    console.error('❌ Get categories failed:', error.response?.data || error.message);
    return false;
  }
};

const testGetPopularServices = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/services/popular`);
    console.log('✅ Get popular services successful:', response.data.services.length, 'services found');
    return true;
  } catch (error) {
    console.error('❌ Get popular services failed:', error.response?.data || error.message);
    return false;
  }
};

const testCreateService = async () => {
  try {
    const response = await axios.post(`${BASE_URL}/services`, testService, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Create service successful:', response.data.message);
    return response.data.service.id;
  } catch (error) {
    console.error('❌ Create service failed:', error.response?.data || error.message);
    return null;
  }
};

const testGetServiceById = async (serviceId) => {
  try {
    const response = await axios.get(`${BASE_URL}/services/${serviceId}`);
    console.log('✅ Get service by ID successful:', response.data.service.name);
    return true;
  } catch (error) {
    console.error('❌ Get service by ID failed:', error.response?.data || error.message);
    return false;
  }
};

const testUpdateService = async (serviceId) => {
  try {
    const updateData = {
      name: 'Updated Professional House Cleaning',
      price: 175.00
    };
    
    const response = await axios.put(`${BASE_URL}/services/${serviceId}`, updateData, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Update service successful:', response.data.message);
    return true;
  } catch (error) {
    console.error('❌ Update service failed:', error.response?.data || error.message);
    return false;
  }
};

const testGetMyServices = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/services/my/services`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Get my services successful:', response.data.services.length, 'services found');
    return true;
  } catch (error) {
    console.error('❌ Get my services failed:', error.response?.data || error.message);
    return false;
  }
};

const testDeleteService = async (serviceId) => {
  try {
    const response = await axios.delete(`${BASE_URL}/services/${serviceId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Delete service successful:', response.data.message);
    return true;
  } catch (error) {
    console.error('❌ Delete service failed:', error.response?.data || error.message);
    return false;
  }
};

// Run all tests
const runTests = async () => {
  console.log('🧪 Starting service tests...\n');

  await testHealth();
  console.log('');

  const loggedIn = await testLogin();
  console.log('');

  if (!loggedIn) {
    console.log('❌ Cannot proceed without authentication');
    return;
  }

  await testGetServices();
  console.log('');

  await testGetCategories();
  console.log('');

  await testGetPopularServices();
  console.log('');

  const serviceId = await testCreateService();
  console.log('');

  if (serviceId) {
    await testGetServiceById(serviceId);
    console.log('');

    await testUpdateService(serviceId);
    console.log('');

    await testGetMyServices();
    console.log('');

    await testDeleteService(serviceId);
    console.log('');
  }

  console.log('🎉 Service tests completed!');
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests }; 