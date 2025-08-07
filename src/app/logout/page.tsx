'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut, CheckCircle, AlertCircle } from 'lucide-react';

export default function LogoutPage() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const performLogout = async () => {
      try {
        console.log('Starting logout process...');

        // Call the logout API
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Logout API call failed');
        }

        console.log('Logout API call successful');

        // Clear any client-side authentication data
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        sessionStorage.removeItem('registrationSuccess');
        sessionStorage.removeItem('registrationUserType');

        // Clear any cookies (if using cookies for auth)
        document.cookie.split(";").forEach(function(c) { 
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
        });

        console.log('Client-side data cleared');

        // Redirect to login page after a short delay
        setTimeout(() => {
          router.push('/auth/login');
        }, 1500);

      } catch (err) {
        console.error('Logout error:', err);
        setError(err instanceof Error ? err.message : 'Logout failed');
        setIsLoggingOut(false);
      }
    };

    performLogout();
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle className="text-xl">Logout Failed</CardTitle>
            <CardDescription>
              There was an error during logout
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-red-600">{error}</p>
            <div className="space-y-2">
              <Button 
                onClick={() => router.push('/auth/login')} 
                className="w-full"
              >
                Go to Login
              </Button>
              <Button 
                variant="outline" 
                onClick={() => router.push('/user-dashboard')} 
                className="w-full"
              >
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
      <Card className="max-w-md w-full mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <LogOut className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-xl">Logging Out</CardTitle>
          <CardDescription>
            Please wait while we securely log you out...
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-sm text-gray-600">
            Clearing your session and redirecting to login...
          </p>
        </CardContent>
      </Card>
    </div>
  );
} 