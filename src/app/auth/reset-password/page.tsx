'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthExperienceShell } from '@/components/auth/AuthExperienceShell';
import { appendAuthNext, getAuthContinuationPhrase, sanitizeAuthNextPath } from '@/lib/auth-next';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

function ResetPasswordPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') ?? null;
  const safeNextPath = sanitizeAuthNextPath(searchParams?.get('next'));
  const loginHref = appendAuthNext('/auth/login', safeNextPath);
  const forgotPasswordHref = appendAuthNext('/auth/forgot-password', safeNextPath);
  const continuationPhrase = getAuthContinuationPhrase(safeNextPath);

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

  useEffect(() => {
    if (token) {
      void validateToken();
    } else {
      setIsValidToken(false);
    }
  }, [token]);

  const validateToken = async () => {
    try {
      const response = await fetch(`/api/auth/reset-password/validate?token=${token}`);
      const data = await response.json();

      if (response.ok) {
        setIsValidToken(true);
      } else {
        setIsValidToken(false);
        setError(data.error || 'Invalid or expired reset link');
      }
    } catch {
      setIsValidToken(false);
      setError('Failed to validate reset link');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validatePassword = (password: string) => {
    if (password.length < 8) return 'Password must be at least 8 characters long';
    if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      setError(passwordError);
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidToken === null) {
    return (
      <AuthExperienceShell
        backHref={loginHref}
        backLabel="Back to Login"
        title="Validating Reset Link"
        description="We're checking that your password reset link is still active and secure."
        heroTitle="Every recovery step should feel measured and trustworthy."
        heroDescription="Reliance treats credential recovery like the rest of the platform: clear state, clear next action, and no guesswork."
        heroBadge="Secure validation before account changes."
      >
        <div className="rounded-[30px] border border-white/80 bg-white/92 px-8 py-14 text-center shadow-[0_30px_90px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="mt-4 text-gray-600">Validating reset link...</p>
        </div>
      </AuthExperienceShell>
    );
  }

  if (isValidToken === false) {
    return (
      <AuthExperienceShell
        backHref={loginHref}
        backLabel="Back to Login"
        title="Invalid Reset Link"
        description="This reset link is missing, expired, or has already been used."
        heroTitle="Recovery links should fail clearly, not vaguely."
        heroDescription="When a recovery link is no longer valid, Reliance points you straight to the safest next action instead of leaving you stuck in a dead end."
        heroBadge="Honest failure states, clear next steps."
      >
        <Card className="overflow-hidden rounded-[30px] border-white/80 bg-white/92 shadow-[0_30px_90px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="font-display text-2xl">Link Expired or Invalid</CardTitle>
            <CardDescription>This password reset link is no longer valid</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-gray-600">
              The reset link may have expired or already been used. Please request a new password
              reset.
            </p>

            <div className="space-y-2">
              <Button
                onClick={() => router.push(forgotPasswordHref)}
                className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#246BFF,#0F4BFF_60%,#2DAAFB)] text-white shadow-[0_20px_45px_rgba(36,107,255,0.28)] hover:brightness-110"
              >
                Request New Reset Link
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(loginHref)}
                className="h-12 w-full rounded-2xl border-slate-200 bg-white"
              >
                Back to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </AuthExperienceShell>
    );
  }

  if (isSuccess) {
    return (
      <AuthExperienceShell
        backHref={loginHref}
        backLabel="Back to Login"
        title="Password Reset Successfully"
        description={
          continuationPhrase
            ? `Your account is ready so you can ${continuationPhrase}.`
            : 'Your account is ready to sign in again.'
        }
        heroTitle="Recovery complete. Back to a cleaner trust flow."
        heroDescription="Once your password is updated, the path back into Reliance should feel immediate, clear, and aligned with the work you were already doing."
        heroBadge="Updated credentials. Same destination."
      >
        <Card className="overflow-hidden rounded-[30px] border-white/80 bg-white/92 shadow-[0_30px_90px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="font-display text-2xl">Password Updated</CardTitle>
            <CardDescription>Your password has been successfully reset</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-gray-600">
              {continuationPhrase
                ? `You can now sign in with your new password and ${continuationPhrase}.`
                : 'You can now sign in with your new password.'}
            </p>

            <Button
              onClick={() => router.push(loginHref)}
              className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#246BFF,#0F4BFF_60%,#2DAAFB)] text-white shadow-[0_20px_45px_rgba(36,107,255,0.28)] hover:brightness-110"
            >
              Sign In
            </Button>
          </CardContent>
        </Card>
      </AuthExperienceShell>
    );
  }

  return (
    <AuthExperienceShell
      backHref={loginHref}
      backLabel="Back to Login"
      title="Reset Your Password"
      description={
        continuationPhrase
          ? `Enter a new password to ${continuationPhrase}.`
          : 'Enter your new password below.'
      }
      heroTitle="Reset with confidence, then go right back to work."
      heroDescription="Reliance keeps the recovery flow focused: secure validation, strong-password guidance, and a direct path back into the same customer or operator journey."
      heroBadge="Security that still feels polished."
    >
      <Card className="overflow-hidden rounded-[30px] border-white/80 bg-white/92 shadow-[0_30px_90px_rgba(15,23,42,0.14)] backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-center font-display text-2xl">New Password</CardTitle>
          <CardDescription className="text-center text-sm leading-6">
            {continuationPhrase
              ? `Choose a strong password so you can ${continuationPhrase}.`
              : 'Choose a strong password for your account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-center">
                  <AlertCircle className="mr-2 h-5 w-5 text-red-500" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800">Error</h4>
                    <p className="mt-1 text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div>
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-4 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="h-12 rounded-2xl border-slate-200 bg-white pl-10 pr-10 shadow-sm"
                  placeholder="Enter your new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-4 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Must be at least 8 characters with uppercase, lowercase, and number
              </p>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-4 h-4 w-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className="h-12 rounded-2xl border-slate-200 bg-white pl-10 pr-10 shadow-sm"
                  placeholder="Confirm your new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-4 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#246BFF,#0F4BFF_60%,#2DAAFB)] text-white shadow-[0_20px_45px_rgba(36,107,255,0.28)] hover:brightness-110"
              disabled={isLoading || !formData.password || !formData.confirmPassword}
            >
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Remember your password?{' '}
              <Link href={loginHref} className="font-medium text-blue-600 hover:text-blue-800">
                Sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </AuthExperienceShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-500">
          Loading...
        </div>
      }
    >
      <ResetPasswordPageInner />
    </Suspense>
  );
}
