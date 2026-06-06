'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { startAuthentication } from '@simplewebauthn/browser';
import { useAuth, type AuthUser } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthExperienceShell } from '@/components/auth/AuthExperienceShell';
import {
  appendAuthNext,
  getAuthEntryBackHref,
  getAuthEntryBackLabel,
  getAuthEntryDescription,
  resolveAuthPostLoginRedirect,
  sanitizeAuthNextPath,
} from '@/lib/auth-next';
import { Mail, Lock, Eye, EyeOff, KeyRound } from 'lucide-react';

type FormMessageTone = 'info' | 'success' | 'error';

type FormMessage = {
  tone: FormMessageTone;
  text: string;
};

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const requestedNext = searchParams?.get('next') || null;
  const safeNextPath = sanitizeAuthNextPath(requestedNext);
  const prefilledEmailFromQuery = String(searchParams?.get('email') || '').trim();
  const registrationRole = String(searchParams?.get('role') || 'customer').trim().toLowerCase();
  const registrationMessageFromQuery =
    searchParams?.get('registered') === '1'
      ? {
          tone: 'success' as const,
          text:
            registrationRole === 'vendor'
              ? 'Vendor account created. Check your email to verify it, then sign in to continue vendor setup.'
              : 'Account created. Check your email to verify it, then sign in to continue.',
        }
      : null;
  const [formData, setFormData] = useState({
    email: prefilledEmailFromQuery,
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mfaChallengeId, setMfaChallengeId] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaEmail, setMfaEmail] = useState('');
  const [mfaCodePreview, setMfaCodePreview] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [supportsPasskeys, setSupportsPasskeys] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [formMessage, setFormMessage] = useState<FormMessage | null>(registrationMessageFromQuery);
  const forgotPasswordHref = appendAuthNext('/auth/forgot-password', safeNextPath);
  const registerHref = appendAuthNext('/auth/register', safeNextPath);
  const entryBackHref = getAuthEntryBackHref(safeNextPath);
  const entryBackLabel = getAuthEntryBackLabel(safeNextPath);
  const entryDescription = getAuthEntryDescription('login', safeNextPath);

  useEffect(() => {
    setSupportsPasskeys(typeof window !== 'undefined' && window.PublicKeyCredential !== undefined);
  }, []);

  const handleInputChange = (field: string, value: string) => {
    if (formMessage?.tone === 'error') {
      setFormMessage(null);
    }
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePasskeySignIn = async () => {
    if (!formData.email.trim()) {
      setFormMessage({
        tone: 'info',
        text: 'Enter your email first, then use your saved passkey to continue.',
      });
      return;
    }

    setIsPasskeyLoading(true);
    setFormMessage(null);
    try {
      const optionsResponse = await fetch('/api/passkey/authenticate-options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: formData.email,
        }),
      });

      const optionsData = (await optionsResponse.json().catch(() => ({}))) as Record<string, unknown>;
      if (!optionsResponse.ok) {
        setFormMessage({
          tone: 'error',
          text: String(optionsData.error || 'Passkey sign-in is not available for that account.'),
        });
        return;
      }

      const challengeId = String(optionsData.challengeId || '');
      const options = optionsData.options;
      if (!challengeId || !options || typeof options !== 'object') {
        setFormMessage({
          tone: 'error',
          text: 'Passkey sign-in is temporarily unavailable because the sign-in options were incomplete.',
        });
        return;
      }

      const response = await startAuthentication({
        optionsJSON: options as any,
      });

      const verifyResponse = await fetch('/api/passkey/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: formData.email,
          challengeId,
          response,
        }),
      });

      const verifyData = (await verifyResponse.json().catch(() => ({}))) as Record<string, unknown>;
      if (!verifyResponse.ok) {
        setFormMessage({
          tone: 'error',
          text: String(verifyData.error || 'Passkey sign-in failed.'),
        });
        return;
      }

      finishLogin(verifyData);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFormMessage({
        tone: 'error',
        text: `Passkey sign-in failed: ${message}`,
      });
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const finishLogin = (data: Record<string, unknown>) => {
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

    login(sessionUser, data.token != null ? String(data.token) : null);

    router.push(resolveAuthPostLoginRedirect(safeNextPath, normalizedType));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormMessage(null);

    try {
      const response = mfaChallengeId
        ? await fetch('/api/auth/mfa/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              challengeId: mfaChallengeId,
              code: mfaCode,
              rememberDevice,
            }),
          })
        : await fetch('/api/auth/login', {
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
        setFormMessage({
          tone: 'error',
          text:
            `Login response was not valid app data (HTTP ${response.status}). Make sure this page is open on the same Reliance dev host as the API, usually http://localhost:3000.`,
        });
        return;
      }

      if (response.ok) {
        if (data.mfaRequired === true) {
          setMfaChallengeId(String(data.challengeId || ''));
          setMfaEmail(String(data.email || formData.email));
          setMfaCode('');
          setMfaCodePreview(String(data.mfaCodePreview || ''));
          setRememberDevice(false);
          setFormMessage({
            tone: 'success',
            text:
              process.env.NODE_ENV !== 'production' && data.mfaCodePreview
                ? `A sign-in code was sent. Dev preview: ${String(data.mfaCodePreview)}`
                : 'A sign-in code was sent to your email.',
          });
          return;
        }

        if (process.env.NODE_ENV !== 'production') {
          const u = data.user as Record<string, unknown>;
          console.info('[auth/login] session write delegated to AuthProvider', {
            userId: String(u.id || ''),
            tokenPreview: data.token != null ? `${String(data.token).slice(0, 14)}...` : null,
          });
        }
        finishLogin(data);
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
        setFormMessage({
          tone: 'error',
          text: `${err}${devHint}${detailSuffix}`,
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      const msg = error instanceof Error ? error.message : String(error);
      setFormMessage({
        tone: 'error',
        text:
          `Network or unexpected error: ${msg}\n\nIf this page is open on a different port than the Reliance dev server, reopen login on the same host as the app runtime.`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!mfaChallengeId) return;
    setIsLoading(true);
    setFormMessage(null);
    try {
      const response = await fetch('/api/auth/mfa/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ challengeId: mfaChallengeId }),
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        setFormMessage({
          tone: 'error',
          text: String(data.error || 'Failed to resend sign-in code'),
        });
        return;
      }
      setMfaChallengeId(String(data.challengeId || mfaChallengeId));
      setMfaCodePreview(String(data.mfaCodePreview || ''));
      setMfaCode('');
      setFormMessage({
        tone: 'success',
        text:
          process.env.NODE_ENV !== 'production' && data.mfaCodePreview
            ? `A new sign-in code was sent. Dev preview: ${String(data.mfaCodePreview)}`
            : 'A new sign-in code was sent to your email.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFormMessage({
        tone: 'error',
        text: `Failed to resend sign-in code: ${message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthExperienceShell
      backHref={entryBackHref}
      backLabel={entryBackLabel}
      title="Welcome Back"
      description={entryDescription || 'Sign in to your Reliance account and pick up right where you left off.'}
      heroTitle="Return to a marketplace where trust signals stay separate."
      heroDescription="Reliance keeps Customer Reviews, Verified Service Videos, and the Reliance Trust Score visible as distinct systems so every booking, approval, and follow-up feels grounded in real evidence."
      heroBadge="Built for transparent service decisions."
    >
        <Card className="overflow-hidden rounded-[30px] border-white/80 bg-white/92 shadow-[0_30px_90px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-center font-display text-2xl">
              {mfaChallengeId ? 'Enter Sign-In Code' : 'Sign In'}
            </CardTitle>
            <CardDescription className="text-center text-sm leading-6">
              {mfaChallengeId
                ? `Enter the 6-digit code sent to ${mfaEmail || formData.email}`
                : 'Enter your credentials to access your account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formMessage ? (
                <div
                  className={`rounded-lg border px-3 py-2 text-sm whitespace-pre-line ${
                    formMessage.tone === 'error'
                      ? 'border-red-200 bg-red-50/90 text-red-700'
                      : formMessage.tone === 'success'
                        ? 'border-emerald-200 bg-emerald-50/90 text-emerald-700'
                        : 'border-blue-200 bg-blue-50/90 text-blue-700'
                  }`}
                >
                  {formMessage.text}
                </div>
              ) : null}
              {mfaChallengeId ? (
                <div>
                  <Label htmlFor="mfaCode">Sign-In Code</Label>
                  <Input
                    id="mfaCode"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                  />
                  {process.env.NODE_ENV !== 'production' && mfaCodePreview ? (
                    <p className="mt-2 text-xs text-slate-500">Dev code preview: {mfaCodePreview}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-500">
                    Vendor, employee, and admin operational accounts use an extra sign-in step to protect dashboard and job access.
                  </p>
                  <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberDevice}
                      onChange={(e) => setRememberDevice(e.target.checked)}
                    />
                    Skip the email code on this device for 30 days
                  </label>
                  <button
                    type="button"
                    className="mt-3 block text-sm text-blue-600 hover:text-blue-800"
                    onClick={handleResendCode}
                    disabled={isLoading}
                  >
                    Send a new code
                  </button>
                  <button
                    type="button"
                    className="mt-3 text-sm text-blue-600 hover:text-blue-800"
                    onClick={() => {
                      setMfaChallengeId('');
                      setMfaCode('');
                      setMfaEmail('');
                      setMfaCodePreview('');
                      setRememberDevice(false);
                    }}
                  >
                    Start over
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="h-12 rounded-2xl border-slate-200 bg-white pl-10 shadow-sm"
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
                        className="h-12 rounded-2xl border-slate-200 bg-white pl-10 pr-10 shadow-sm"
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
                    <Link href={forgotPasswordHref} className="text-sm text-blue-600 hover:text-blue-800">
                      Forgot password?
                    </Link>
                  </div>

                  {supportsPasskeys ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">Faster sign-in</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        Enter your email, then use your saved passkey to sign in without the password and email code steps.
                      </p>
                    </div>
                  ) : null}

                  {supportsPasskeys ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-full rounded-2xl border-blue-200 bg-white text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                      onClick={handlePasskeySignIn}
                      disabled={isLoading || isPasskeyLoading}
                    >
                      <KeyRound className="h-4 w-4 mr-2" />
                      {isPasskeyLoading ? 'Using Passkey...' : 'Use Passkey'}
                    </Button>
                  ) : null}
                </>
              )}

              <Button 
                type="submit" 
                className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#246BFF,#0F4BFF_60%,#2DAAFB)] text-white shadow-[0_20px_45px_rgba(36,107,255,0.28)] hover:brightness-110" 
                disabled={isLoading}
              >
                {isLoading ? (mfaChallengeId ? 'Verifying...' : 'Signing In...') : (mfaChallengeId ? 'Verify Code' : 'Sign In')}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Don't have an account?{' '}
                <Link href={registerHref} className="text-blue-600 hover:text-blue-800 font-medium">
                  Sign up
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
    </AuthExperienceShell>
  );
}

function LoginPageFallback() {
  return (
    <AuthExperienceShell
      backHref="/"
      backLabel="Back to Home"
      title="Welcome Back"
      description="Preparing your Reliance sign-in experience."
      heroTitle="Return to a marketplace where trust signals stay separate."
      heroDescription="Reliance keeps Customer Reviews, Verified Service Videos, and the Reliance Trust Score visible as distinct systems so every booking, approval, and follow-up feels grounded in real evidence."
      heroBadge="Built for transparent service decisions."
    >
      <Card className="overflow-hidden rounded-[30px] border-white/80 bg-white/92 shadow-[0_30px_90px_rgba(15,23,42,0.14)] backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-center font-display text-2xl">Sign In</CardTitle>
          <CardDescription className="text-center text-sm leading-6">
            Preparing your Reliance sign-in experience.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-sm text-slate-500">
            Loading sign-in details...
          </div>
        </CardContent>
      </Card>
    </AuthExperienceShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
