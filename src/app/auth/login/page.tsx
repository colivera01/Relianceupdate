'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, type AuthUser } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('Attempting login with:', { email: formData.email, password: '[HIDDEN]' });

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const rawText = await response.text();
      let data: Record<string, unknown> = {};
      try {
        data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
      } catch {
        console.error('[auth/login] non-JSON response', {
          status: response.status,
          preview: rawText.slice(0, 200),
        });
        alert(
          `Login response was not JSON (HTTP ${response.status}). You may be on the wrong dev port or the server returned an error page. Use the app on the same host as this page (default: http://localhost:3000 for npm run dev).`
        );
        return;
      }

      if (response.ok) {
        console.log('Login successful:', data);

        const u = data.user as Record<string, unknown>;
        const rawType = String(u.userType || 'customer');
        const normalizedType: AuthUser['userType'] =
          rawType === 'vendor'
            ? 'vendor'
            : rawType === 'admin'
              ? 'admin'
              : rawType === 'both'
                ? 'both'
                : 'customer';

        const sessionUser: AuthUser = {
          id: String(u.id),
          name: String(u.name || u.email || 'User'),
          email: String(u.email),
          userType: normalizedType,
          avatar: u.avatar as string | undefined,
          availableProfiles: Array.isArray(u.availableProfiles)
            ? (u.availableProfiles as string[])
            : undefined,
        };

        // Single source of truth: AuthProvider persists userData + authToken + cookies
        login(sessionUser, data.token != null ? String(data.token) : null);

        if (process.env.NODE_ENV !== 'production') {
          console.info('[auth/login] session write delegated to AuthProvider', {
            userId: sessionUser.id,
            tokenPreview: data.token != null ? `${String(data.token).slice(0, 14)}…` : null,
          });
        }

        // Check user type and redirect accordingly
        if (u.userType === 'vendor') {
          // Pure vendor user - go to vendor dashboard
          router.push('/vendor/dashboard');
        } else if (u.userType === 'both') {
          // User with both profiles - go to user dashboard first
          // They can then toggle to vendor profile if needed
          router.push('/user-dashboard');
        } else {
          // Pure customer user - go to user dashboard
          router.push('/user-dashboard');
        }
      } else {
        const code = data.code != null ? String(data.code) : '';
        const err = data.error != null ? String(data.error) : 'Login failed';
        const details = data.details != null ? String(data.details) : '';
        console.warn('[auth/login] rejected', { status: response.status, code, err, details });
        const devHint =
          process.env.NODE_ENV !== 'production' && code
            ? `\n\n(code: ${code})`
            : '';
        const detailSuffix = details && process.env.NODE_ENV !== 'production' ? `\n\n${details}` : '';
        alert(`${err}${devHint}${detailSuffix}`);
      }
    } catch (error) {
      console.error('Login error:', error);
      const msg = error instanceof Error ? error.message : String(error);
      alert(
        `Network or unexpected error: ${msg}\n\nIf the app is open on localhost:3001 but API runs on :3000, open the login page on the same port as the Next dev server (see terminal "Local:" URL).`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center py-12">
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome Back
          </h1>
          <p className="text-gray-600">
            Sign in to your Reliance account
          </p>
        </div>

        {/* Login Form */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl text-center">Sign In</CardTitle>
            <CardDescription className="text-center">
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Link href="/auth/forgot-password" className="text-sm text-blue-600 hover:text-blue-800">
                  Forgot password?
                </Link>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Don't have an account?{' '}
                <Link href="/auth/register" className="text-blue-600 hover:text-blue-800 font-medium">
                  Sign up
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 