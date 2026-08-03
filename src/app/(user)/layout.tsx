'use client';
import { Suspense, useEffect, useState } from 'react';
import UserSidebar from '@/components/UserSidebar';
import ProfileToggle from '@/components/ProfileToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useAvailableRoles } from '@/hooks/useAvailableRoles';
import { getClientSessionHeaders } from '@/lib/client-session';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { AlertTriangle, LogIn, Video } from 'lucide-react';
import {
  appendAuthNext,
  getCustomerServiceVideoIntent,
} from '@/lib/auth-next';

function UserLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [restrictedMessage, setRestrictedMessage] = useState<string | null>(null);
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const queryString = searchParams?.toString() || '';
  // The customer shell should identify itself as "customer" even when the
  // signed-in identity also has admin/vendor access. Role toggles should
  // reflect the current shell, not the highest-privilege account type.
  const currentProfile = 'customer' as const;
  const { availableRoles, userId } = useAvailableRoles(currentProfile);
  const isPublicServiceRoute = pathname.startsWith('/service/');
  const returnPath = `${pathname || '/user-dashboard'}${
    queryString ? `?${queryString}` : ''
  }`;
  const serviceVideoIntent = getCustomerServiceVideoIntent(returnPath);
  const signInHref = appendAuthNext('/auth/login', returnPath);
  const registrationHref = appendAuthNext(
    '/auth/register?type=user',
    returnPath
  );

  useEffect(() => {
    let cancelled = false;
    async function checkCustomerStatus() {
      if (!user?.id || isPublicServiceRoute || !isAuthenticated) {
        setRestrictedMessage(null);
        return;
      }
      try {
        const response = await fetch('/api/customer/profile', {
          method: 'GET',
          headers: getClientSessionHeaders(user.id),
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({}));
        if (!cancelled && response.status === 403 && payload?.code === 'USER_ACCOUNT_RESTRICTED') {
          setRestrictedMessage(
            String(payload?.message || payload?.error || 'Customer account restricted. Contact support for help.')
          );
        } else if (!cancelled) {
          setRestrictedMessage(null);
        }
      } catch {
        if (!cancelled) setRestrictedMessage(null);
      }
    }
    void checkCustomerStatus();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isPublicServiceRoute, user?.id]);

  if (isPublicServiceRoute) {
    return <>{children}</>;
  }

  if (authLoading) {
    return (
      <div className="reliance-marketplace-shell min-h-screen bg-[var(--reliance-paper)] px-4 py-12">
        <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center">
          <div className="w-full rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-[0_24px_80px_rgba(7,16,38,0.08)]">
            <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--reliance-blue)]" />
            <h1 className="font-display text-3xl font-semibold text-slate-950">Checking your customer account</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              Reliance is confirming your sign-in so your service records, reviews, and saved details load in the right account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (serviceVideoIntent) {
      return (
        <div className="reliance-marketplace-shell min-h-screen bg-[var(--reliance-paper)] px-4 py-12">
          <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center justify-center">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="service-video-registration-title"
              className="w-full rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_28px_90px_rgba(7,16,38,0.16)] sm:p-9"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                <Video className="h-6 w-6" />
              </div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                Completed service record
              </p>
              <h1
                id="service-video-registration-title"
                className="mt-2 font-display text-3xl font-semibold text-slate-950"
              >
                Your completed service video is ready
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                You are continuing to Reliance to securely view the completed
                work order shared by your service provider.
              </p>
              <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm leading-6 text-slate-700">
                <p className="font-semibold text-slate-950">
                  Create a free customer account to continue.
                </p>
                <p className="mt-1">
                  The work order will be saved in My Service Records, where you
                  can watch approved videos and leave a review. You can also
                  browse Reliance&apos;s network and public service proof.
                </p>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={registrationHref}
                  className="inline-flex items-center justify-center rounded-lg bg-[var(--reliance-blue)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1a58db]"
                >
                  Continue to Free Registration
                </Link>
                <Link
                  href={signInHref}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <LogIn className="h-4 w-4" />
                  I Already Have an Account
                </Link>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="reliance-marketplace-shell min-h-screen bg-[var(--reliance-paper)] px-4 py-12">
        <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center">
          <div className="w-full rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(7,16,38,0.08)]">
            <div className="inline-flex rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
              Customer account
            </div>
            <h1 className="mt-5 font-display text-3xl font-semibold text-slate-950">Sign in to open your customer account</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              Your service records, reviews, saved items, and profile settings only appear after you sign in with the customer account that created them.
            </p>
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700">
              <p className="font-medium text-slate-900">What you can do next</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">
                <li>Sign in to see your active and completed services.</li>
                <li>Open approved service videos and leave reviews from the right service record.</li>
                <li>Update your saved profile details and customer preferences.</li>
              </ul>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={signInHref}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--reliance-blue)] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#1a58db]"
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </Link>
              <Link
                href="/browse"
                className="inline-flex items-center rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Browse Public Services
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (serviceVideoIntent) {
    return (
      <div className="reliance-operator-shell reliance-grid-lines min-h-screen">
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
          {children}
        </main>
      </div>
    );
  }

  const content = restrictedMessage ? (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h1 className="text-2xl font-semibold text-amber-950">Account restricted</h1>
      <p className="mt-2 text-sm">{restrictedMessage}</p>
      <p className="mt-4 text-sm">Protected customer actions are unavailable until this account is active again.</p>
    </div>
  ) : (
    children
  );

  return (
    <div className="reliance-operator-shell reliance-grid-lines flex min-h-screen">
      <UserSidebar />
      <main className="reliance-operator-main min-w-0 flex-1 overflow-auto">
        <div className="w-full max-w-6xl px-4 pt-6 pb-28 sm:px-6 sm:pt-10 md:pb-6">
          {availableRoles.length > 1 ? (
            <div className="mb-6 rounded-[28px] border border-white/10 bg-white/6 px-5 py-4 shadow-[0_18px_60px_rgba(4,9,20,0.18)] backdrop-blur-xl">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-100/78">
                    Linked account access
                  </p>
                  <p className="text-sm font-medium text-white">
                    This sign-in is connected to more than one Reliance view.
                  </p>
                  <p className="text-sm leading-6 text-white/68">
                    Move between your customer account and business tools without signing out.
                  </p>
                </div>
                <ProfileToggle
                  currentProfile={currentProfile}
                  availableProfiles={availableRoles}
                  userId={userId}
                  className="shrink-0"
                />
              </div>
            </div>
          ) : null}
          {content}
        </div>
      </main>
    </div>
  );
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="reliance-marketplace-shell min-h-screen bg-[var(--reliance-paper)] px-4 py-12">
          <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center">
            <div className="w-full rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-[0_24px_80px_rgba(7,16,38,0.08)]">
              <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--reliance-blue)]" />
              <h1 className="font-display text-3xl font-semibold text-slate-950">
                Opening your customer account
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                Reliance is preparing the secure page connected to this link.
              </p>
            </div>
          </div>
        </div>
      }
    >
      <UserLayoutContent>{children}</UserLayoutContent>
    </Suspense>
  );
}
