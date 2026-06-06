'use client';
import React, { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { User, Briefcase } from 'lucide-react';

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
  className = '',
}: ProfileHeaderProps) {
  const [availableProfiles, setAvailableProfiles] = useState<('customer' | 'vendor')[]>([]);

  useEffect(() => {
    const profiles: ('customer' | 'vendor')[] = ['customer'];
    if (userData?.businessName || userData?.category) {
      profiles.push('vendor');
    }
    setAvailableProfiles(profiles);
  }, [userData]);

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

  // Right-side controls (Settings dropdown, Logout) were removed because they
  // only duplicated sidebar entries (Profile & Settings, Logout). The header
  // now displays identity + active role only; role switching is handled by
  // <ProfileToggle /> rendered above the page content.
  return (
    <div className={`flex items-center justify-between p-4 bg-white border-b border-gray-200 ${className}`}>
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
                - {availableProfiles.length} profiles available
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
