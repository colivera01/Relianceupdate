'use client';
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { User, Briefcase, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ProfileToggle from './ProfileToggle';

interface ProfileHeaderUserData {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
  profilePhoto?: string;
  businessName?: string;
  category?: string;
}

interface ProfileHeaderProps {
  userData: ProfileHeaderUserData | null;
  currentProfile: 'customer' | 'vendor';
  className?: string;
}

export default function ProfileHeader({ 
  userData, 
  currentProfile,
  className = '' 
}: ProfileHeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [availableProfiles, setAvailableProfiles] = useState<('customer' | 'vendor')[]>([]);
  const router = useRouter();

  useEffect(() => {
    // Determine available profiles based on user data
    const profiles: ('customer' | 'vendor')[] = ['customer'];
    
    // If user has vendor data, add vendor profile
    if (userData?.businessName || userData?.category) {
      profiles.push('vendor');
    }
    
    setAvailableProfiles(profiles);
  }, [userData]);

  const handleLogout = () => {
    // Clear local storage
    localStorage.removeItem('userData');
    localStorage.removeItem('authToken');
    sessionStorage.clear();
    
    // Redirect to login
    router.push('/auth/login');
  };

  const handleProfileSettings = () => {
    if (currentProfile === 'vendor') {
      router.push('/vendor/profile');
    } else {
      router.push('/profile-settings');
    }
    setIsDropdownOpen(false);
  };

  const getProfileIcon = (profile: 'customer' | 'vendor') => {
    return profile === 'customer' ? <User className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />;
  };

  const getProfileLabel = (profile: 'customer' | 'vendor') => {
    return profile === 'customer' ? 'Customer' : 'Vendor';
  };

  const getProfileColor = (profile: 'customer' | 'vendor') => {
    return profile === 'customer' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
  };

  if (!userData) {
    return null;
  }

  return (
    <div className={`flex items-center justify-between p-4 bg-white border-b border-gray-200 ${className}`}>
      {/* Left side - Profile info */}
      <div className="flex items-center gap-4">
        <Avatar className="w-10 h-10">
          <AvatarImage src={userData.avatar || userData.profilePhoto} alt={userData.firstName} />
          <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
            {userData.firstName?.charAt(0)}{userData.lastName?.charAt(0)}
          </AvatarFallback>
        </Avatar>
        
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {userData.firstName} {userData.lastName}
          </h2>
          <div className="flex items-center gap-2">
            <Badge className={getProfileColor(currentProfile)}>
              {getProfileIcon(currentProfile)}
              {getProfileLabel(currentProfile)}
            </Badge>
            {availableProfiles.length > 1 && (
              <span className="text-sm text-gray-500">
                • {availableProfiles.length} profiles available
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-3">
        {/* Profile Toggle - Only show if multiple profiles available */}
        {availableProfiles.length > 1 && (
          <ProfileToggle
            currentProfile={currentProfile}
            availableProfiles={availableProfiles}
            userId={userData.id}
          />
        )}

        {/* Profile Menu Dropdown */}
        <div className="relative">
          <Button
            variant="ghost"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </Button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              <div className="p-2">
                <button
                  onClick={handleProfileSettings}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-md hover:bg-gray-50 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Profile Settings
                </button>
                
                <hr className="my-2" />
                
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-md hover:bg-gray-50 transition-colors text-red-600 hover:text-red-700"
                >
                  <LogOut className="w-4 h-4" />
                  Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
