'use client';
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { User, Briefcase, ChevronDown, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ProfileToggleProps {
  currentProfile: 'customer' | 'vendor';
  availableProfiles: ('customer' | 'vendor')[];
  userId: string;
  className?: string;
}

export default function ProfileToggle({ 
  currentProfile, 
  availableProfiles, 
  userId,
  className = '' 
}: ProfileToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeProfile, setActiveProfile] = useState(currentProfile);
  const router = useRouter();

  // Update active profile when prop changes
  useEffect(() => {
    setActiveProfile(currentProfile);
  }, [currentProfile]);

  const handleProfileSwitch = async (targetProfile: 'customer' | 'vendor') => {
    if (targetProfile === activeProfile) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/profile/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || 'temp-jwt-token'}`
        },
        body: JSON.stringify({
          userId,
          targetProfileType: targetProfile
        })
      });

      if (response.ok) {
        const data = await response.json();
        setActiveProfile(targetProfile);
        
        // Navigate to the appropriate dashboard
        if (targetProfile === 'vendor') {
          router.push('/vendor/dashboard');
        } else {
          router.push('/user-dashboard');
        }
        
        setIsOpen(false);
      } else {
        const error = await response.json();
        console.error('Profile switch failed:', error);
        alert('Failed to switch profile. Please try again.');
      }
    } catch (error) {
      console.error('Profile switch error:', error);
      alert('Failed to switch profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
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

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 min-w-[140px] justify-between"
      >
        <div className="flex items-center gap-2">
          {getProfileIcon(activeProfile)}
          <span className="hidden sm:inline">{getProfileLabel(activeProfile)}</span>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-2">
            <div className="text-xs font-medium text-gray-500 px-2 py-1 mb-2">
              Switch Profile
            </div>
            
            {availableProfiles.map((profile) => (
              <button
                key={profile}
                onClick={() => handleProfileSwitch(profile)}
                disabled={isLoading}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-md hover:bg-gray-50 transition-colors ${
                  profile === activeProfile ? 'bg-gray-100' : ''
                }`}
              >
                {getProfileIcon(profile)}
                <span className="flex-1">{getProfileLabel(profile)}</span>
                {profile === activeProfile && (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 rounded-md flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
}
