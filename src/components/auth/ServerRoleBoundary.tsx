import { randomUUID } from 'node:crypto';
import { Suspense } from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import ServerRoleBoundaryActions from './ServerRoleBoundaryActions';
import {
  resolveServerRoleBoundaryAccess,
  serverRoleBoundaryLogDetails,
  type ParticipantRole,
} from '@/lib/server-role-boundary-access';

export default async function ServerRoleBoundary({
  role,
  children,
  allowPendingVendorOnboarding = false,
  requiredVendorRole,
}: {
  role: ParticipantRole;
  children: React.ReactNode;
  allowPendingVendorOnboarding?: boolean;
  requiredVendorRole?: 'MANAGER' | 'EMPLOYEE';
}) {
  const requestHeaders = await headers();
  const outcome = await resolveServerRoleBoundaryAccess(
    new Request(`http://localhost/${role}`, { headers: requestHeaders }),
    { role, allowPendingVendorOnboarding, requiredVendorRole }
  );

  if (outcome.status === 'allowed') return <>{children}</>;

  const correlationId = outcome.status === 'resolution_failure' ? randomUUID() : undefined;
  const logDetails = serverRoleBoundaryLogDetails(outcome, role, correlationId);
  if (outcome.status === 'resolution_failure') {
    console.error('[ServerRoleBoundary] actor resolution failed', logDetails);
  } else if (outcome.status === 'unauthenticated') {
    console.info('[ServerRoleBoundary] authentication required', logDetails);
  } else {
    console.warn('[ServerRoleBoundary] canonical role denied', logDetails);
  }

  const fallbackPath = role === 'vendor' ? '/vendor/dashboard' : '/user-dashboard';
  const isUnauthenticated = outcome.status === 'unauthenticated';
  const isResolutionFailure = outcome.status === 'resolution_failure';
  const heading = isUnauthenticated
    ? 'Sign in to continue'
    : isResolutionFailure
      ? 'We could not verify access'
      : role === 'vendor'
        ? 'Vendor access required'
        : 'Customer access required';
  const description = isUnauthenticated
    ? 'Your Reliance session is missing or no longer valid. Sign in to return to this page.'
    : isResolutionFailure
      ? 'Reliance could not verify access because of a temporary server problem. No protected account information was opened. Try the request again.'
      : `This signed-in account does not have current active ${role} access. No protected account information was opened.`;

  return (
    <main className="min-h-[70vh] bg-slate-950 px-4 py-12 text-white">
      <section className="mx-auto flex min-h-[50vh] max-w-2xl items-center">
        <div className="w-full rounded-lg border border-amber-300/25 bg-slate-900 p-7 shadow-2xl">
          <p className="text-xs font-semibold uppercase text-amber-200">Access protected</p>
          <h1 className="mt-3 text-2xl font-semibold">{heading}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
          {correlationId ? (
            <p className="mt-3 text-xs text-slate-400">Support reference: {correlationId}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            {isUnauthenticated || isResolutionFailure ? (
              <Suspense
                fallback={
                  <span className="px-4 py-2 text-sm text-slate-400">
                    Preparing access options...
                  </span>
                }
              >
                <ServerRoleBoundaryActions
                  mode={isUnauthenticated ? 'sign-in' : 'retry'}
                  fallbackPath={fallbackPath}
                />
              </Suspense>
            ) : null}
            <Link
              href="/"
              className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Back to home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
