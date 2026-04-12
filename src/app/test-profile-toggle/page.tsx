'use client';
import React, { useState, useEffect } from 'react';
import ProfileHeader from '@/components/ProfileHeader';
import ProfileToggle from '@/components/ProfileToggle';
import AddVendorProfile from '@/components/AddVendorProfile';

export default function TestProfileTogglePage() {
  const [userData, setUserData] = useState<any>(null);
  const [currentProfile, setCurrentProfile] = useState<'customer' | 'vendor'>('customer');

  useEffect(() => {
    // Simulate user data
    setUserData({
      id: 'test-user-1',
      firstName: 'Cesar',
      lastName: 'Olivera',
      email: 'colivera080124@gmail.com',
      businessName: 'Tech Solutions Pro',
      category: 'Technology Services',
      availableProfiles: ['customer', 'vendor']
    });
  }, []);

  const handleProfileSwitch = (newProfile: 'customer' | 'vendor') => {
    setCurrentProfile(newProfile);
    console.log('Profile switched to:', newProfile);
  };

  if (!userData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Profile Header */}
      <ProfileHeader 
        userData={userData} 
        currentProfile={currentProfile}
        className="sticky top-0 z-40"
      />

      {/* Test Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">Profile Toggle Test Page</h1>
          <p className="text-gray-600 mb-4">
            This page tests the profile toggle system. You can switch between customer and vendor profiles.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Profile Toggle Component */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Profile Toggle Component</h2>
              <ProfileToggle
                currentProfile={currentProfile}
                availableProfiles={userData.availableProfiles}
                userId={userData.id}
              />
            </div>

            {/* Current Profile Display */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Current Profile</h2>
              <div className="bg-gray-100 p-4 rounded-lg">
                <p><strong>Active Profile:</strong> {currentProfile}</p>
                <p><strong>Available Profiles:</strong> {userData.availableProfiles.join(', ')}</p>
                <p><strong>User ID:</strong> {userData.id}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Add Vendor Profile Component */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Add Vendor Profile Component</h2>
          <AddVendorProfile 
            userId={userData.id}
            className="max-w-md"
          />
        </div>

        {/* Profile Information */}
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h2 className="text-lg font-semibold mb-4">User Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-gray-700">Personal Information</h3>
              <p><strong>Name:</strong> {userData.firstName} {userData.lastName}</p>
              <p><strong>Email:</strong> {userData.email}</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-700">Business Information</h3>
              <p><strong>Business Name:</strong> {userData.businessName || 'N/A'}</p>
              <p><strong>Category:</strong> {userData.category || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
