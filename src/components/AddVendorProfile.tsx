'use client';
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Briefcase, X, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

interface AddVendorProfileProps {
  userId: string;
  className?: string;
  onVisibilityChange?: (isHidden: boolean) => void;
}

export default function AddVendorProfile({ userId, className = '', onVisibilityChange }: AddVendorProfileProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  // Check if user has hidden this card
  useEffect(() => {
    const hidden = localStorage.getItem(`vendor-profile-hidden-${userId}`);
    if (hidden === 'true') {
      setIsHidden(true);
    }
  }, [userId]);

  const handleClose = () => {
    setIsHidden(true);
    localStorage.setItem(`vendor-profile-hidden-${userId}`, 'true');
    onVisibilityChange?.(true);
  };

  const handleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Don't render if hidden
  if (isHidden) {
    return null;
  }



  return (
    <Card className={`bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Briefcase className="w-5 h-5" />
            Add Business Profile
          </CardTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCollapse}
              className="p-1 hover:bg-blue-100 rounded transition-colors"
              title={isCollapsed ? "Expand" : "Collapse"}
            >
              {isCollapsed ? (
                <ChevronDown className="w-4 h-4 text-blue-600" />
              ) : (
                <ChevronUp className="w-4 h-4 text-blue-600" />
              )}
            </button>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-red-100 rounded transition-colors"
              title="Close"
            >
              <X className="w-4 h-4 text-red-600" />
            </button>
          </div>
        </div>
      </CardHeader>
      
              {!isCollapsed && (
          <CardContent>
            <p className="text-blue-700 mb-4">
              Ready to offer your services? Create a vendor profile to start accepting bookings and growing your business.
            </p>
            
            <div className="mb-4 p-3 bg-blue-100 rounded-lg">
              <p className="text-xs text-blue-700">
                💡 <strong>Tip:</strong> You can always access this option later in your Profile & Settings → Business Profile section.
              </p>
            </div>
            
            <div className="space-y-3">
              <Link href="/auth/register?type=vendor">
                <Button className="bg-blue-600 hover:bg-blue-700 w-full">
                  <Briefcase className="w-4 h-4 mr-2" />
                  Register
                </Button>
              </Link>
            </div>
          </CardContent>
        )}
    </Card>
  );
}
