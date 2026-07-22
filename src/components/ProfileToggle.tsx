'use client';
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { User, Briefcase, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { AppRole } from '@/hooks/useAvailableRoles';

interface ProfileToggleProps {
  currentProfile: AppRole;
  availableProfiles: AppRole[];
  userId?: string;
  className?: string;
}

export default function ProfileToggle({ 
  currentProfile, 
  availableProfiles, 
  userId,
  className = '' 
}: ProfileToggleProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeProfile, setActiveProfile] = useState(currentProfile);
  const router = useRouter();
  const hasMultipleProfiles = availableProfiles.length > 1;

  // Update active profile when prop changes
  useEffect(() => {
    setActiveProfile(currentProfile);
  }, [currentProfile]);

  const handleProfileSwitch = async (targetProfile: AppRole) => {
    if (targetProfile === activeProfile) {
      return;
    }

    const navigateToRole = () => {
      if (targetProfile === 'admin') {
        router.push('/admin/dashboard');
      } else if (targetProfile === 'vendor') {
        router.push('/vendor/dashboard');
      } else {
        router.push('/user-dashboard');
      }
    };

    setIsLoading(true);
    try {
      if (targetProfile === 'admin') {
        navigateToRole();
        return;
      }

      const canToggleCustomerVendor =
        Boolean(userId) &&
        availableProfiles.includes('customer') &&
        availableProfiles.includes('vendor');

      if (!canToggleCustomerVendor) {
        navigateToRole();
        return;
      }

      const token =
        sessionStorage.getItem('authToken') ||
        sessionStorage.getItem('auth_token') ||
        '';
      const response = await fetch('/api/profile/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId,
          targetProfileType: targetProfile
        })
      });

      if (response.ok) {
        await response.json().catch(() => ({}));
        setActiveProfile(targetProfile);
        navigateToRole();
      } else {
        const error = await response.json().catch(() => ({}));
        console.error('Profile switch failed:', error);
        navigateToRole();
      }
    } catch (error) {
      console.error('Profile switch error:', error);
      navigateToRole();
    } finally {
      setIsLoading(false);
    }
  };

  const getProfileIcon = (profile: AppRole) => {
    if (profile === 'customer') return <User className="w-4 h-4" />;
    if (profile === 'vendor') return <Briefcase className="w-4 h-4" />;
    return <Shield className="w-4 h-4" />;
  };

  const getProfileLabel = (profile: AppRole) => {
    if (profile === 'customer') return 'Customer';
    if (profile === 'vendor') return 'Vendor';
    return 'Admin';
  };

  if (!hasMultipleProfiles) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-1">
        {availableProfiles.map((profile) => {
          const isActive = activeProfile === profile;
          return (
            <Button
              key={profile}
              type="button"
              variant="ghost"
              onClick={() => {
                if (isLoading) return;
                void handleProfileSwitch(profile);
              }}
              disabled={isLoading}
              className={`h-9 rounded-md px-4 text-sm ${
                isActive
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="mr-2">{getProfileIcon(profile)}</span>
              {getProfileLabel(profile)}
            </Button>
          );
        })}
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 rounded-md flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
}
