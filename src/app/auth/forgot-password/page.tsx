'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthExperienceShell } from '@/components/auth/AuthExperienceShell';
import { appendAuthNext, getAuthContinuationPhrase, sanitizeAuthNextPath } from '@/lib/auth-next';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { HAS_LAUNCH_SUPPORT_EMAIL, LAUNCH_SUPPORT_EMAIL, LAUNCH_SUPPORT_MAILTO } from '@/lib/support';

function ForgotPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const safeNextPath = sanitizeAuthNextPath(searchParams?.get('next'));
  const loginHref = appendAuthNext('/auth/login', safeNextPath);
  const continuationPhrase = getAuthContinuationPhrase(safeNextPath);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      console.log('Requesting password reset for:', email);

      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          ...(safeNextPath ? { next: safeNextPath } : {}),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Password reset request successful');
        setIsSubmitted(true);
      } else {
        console.log('Password reset request failed:', data);
        setError(data.error || 'Failed to send reset email');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <AuthExperienceShell
        backHref={loginHref}
        backLabel="Back to Login"
        title="Check Your Email"
        description={
          continuationPhrase
            ? `We've sent you a password reset link so you can ${continuationPhrase}.`
            : "We've sent you a password reset link."
        }
        heroTitle="Recover access without losing context."
        heroDescription="Password recovery should feel like a continuation of the same marketplace journey, not a separate detour. Reliance keeps the destination and purpose visible all the way through."
        heroBadge="Recovery that keeps the trust flow intact."
      >
          <Card className="overflow-hidden rounded-[30px] border-white/80 bg-white/92 shadow-[0_30px_90px_rgba(15,23,42,0.14)] backdrop-blur-xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <CardTitle className="font-display text-2xl">Reset Email Sent</CardTitle>
              <CardDescription>
                We've sent a password reset link to <strong>{email}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-gray-600">
                {continuationPhrase
                  ? `Click the link in your email to reset your password and ${continuationPhrase}. The link will expire in 1 hour.`
                  : 'Click the link in your email to reset your password. The link will expire in 1 hour.'}
              </p>
              
              <div className="space-y-2">
                <Button 
                  onClick={() => router.push(loginHref)} 
                  className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#246BFF,#0F4BFF_60%,#2DAAFB)] text-white shadow-[0_20px_45px_rgba(36,107,255,0.28)] hover:brightness-110"
                >
                  Back to Login
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsSubmitted(false);
                    setEmail('');
                  }} 
                  className="h-12 w-full rounded-2xl border-slate-200 bg-white"
                >
                  Send Another Email
                </Button>
              </div>

              <div className="text-xs text-gray-500">
                <p>Didn't receive the email? Check your spam folder.</p>
                <p>
                  Still having trouble?{' '}
                  {HAS_LAUNCH_SUPPORT_EMAIL ? (
                    <a href={LAUNCH_SUPPORT_MAILTO} className="font-medium text-blue-700 underline">
                      Contact {LAUNCH_SUPPORT_EMAIL}
                    </a>
                  ) : (
                    'Contact support.'
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
      </AuthExperienceShell>
    );
  }

  return (
    <AuthExperienceShell
      backHref={loginHref}
      backLabel="Back to Login"
      title="Forgot Password?"
      description={
        continuationPhrase
          ? `Reset your password to ${continuationPhrase}.`
          : 'Enter your email to receive a password reset link.'
      }
      heroTitle="Recovery should still feel premium."
      heroDescription="Use the same trusted path back into Reliance without losing your destination, your context, or the trust-first story behind the platform."
      heroBadge="Reset links keep the journey intact."
    >
        <Card className="overflow-hidden rounded-[30px] border-white/80 bg-white/92 shadow-[0_30px_90px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-center font-display text-2xl">Reset Password</CardTitle>
            <CardDescription className="text-center text-sm leading-6">
              {continuationPhrase
                ? `We'll send you a link so you can ${continuationPhrase}.`
                : "We'll send you a link to reset your password"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                    <div>
                      <h4 className="text-sm font-medium text-red-800">Error</h4>
                      <p className="text-sm text-red-700 mt-1">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-2xl border-slate-200 bg-white pl-10 shadow-sm"
                    placeholder="Enter your email address"
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#246BFF,#0F4BFF_60%,#2DAAFB)] text-white shadow-[0_20px_45px_rgba(36,107,255,0.28)] hover:brightness-110" 
                disabled={isLoading || !email}
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Remember your password?{' '}
                <Link href={loginHref} className="text-blue-600 hover:text-blue-800 font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
    </AuthExperienceShell>
  );
}

function ForgotPasswordPageFallback() {
  return (
    <AuthExperienceShell
      backHref="/auth/login"
      backLabel="Back to Login"
      title="Forgot Password?"
      description="Preparing your recovery options."
      heroTitle="Recovery should still feel premium."
      heroDescription="Use the same trusted path back into Reliance without losing your destination, your context, or the trust-first story behind the platform."
      heroBadge="Reset links keep the journey intact."
    >
      <Card className="overflow-hidden rounded-[30px] border-white/80 bg-white/92 shadow-[0_30px_90px_rgba(15,23,42,0.14)] backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-center font-display text-2xl">Reset Password</CardTitle>
          <CardDescription className="text-center text-sm leading-6">
            Preparing your recovery details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-sm text-slate-500">
            Loading recovery details...
          </div>
        </CardContent>
      </Card>
    </AuthExperienceShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<ForgotPasswordPageFallback />}>
      <ForgotPasswordPageContent />
    </Suspense>
  );
}
