import Link from 'next/link';
import { headers } from 'next/headers';
import { resolveRequestActor } from '@/lib/request-actor';
import { resolveVendorAccessForUser } from '@/lib/vendor-context';

type ParticipantRole = 'customer' | 'vendor';

export default async function ServerRoleBoundary({
  role,
  children,
  allowPendingVendorOnboarding = false,
}: {
  role: ParticipantRole;
  children: React.ReactNode;
  allowPendingVendorOnboarding?: boolean;
}) {
  const requestHeaders = await headers();
  let actor = null;
  try {
    actor = await resolveRequestActor(
      new Request(`http://localhost/${role}`, { headers: requestHeaders })
    );
  } catch {
    actor = null;
  }

  const isParticipant = Boolean(actor && !actor.platformRoles.includes('ADMIN'));
  let allowed =
    isParticipant &&
    (role === 'customer' || Boolean(actor?.vendorMemberships.length));

  if (
    !allowed &&
    role === 'vendor' &&
    allowPendingVendorOnboarding &&
    isParticipant &&
    actor
  ) {
    try {
      const vendorAccess = await resolveVendorAccessForUser(actor.userId);
      allowed = vendorAccess.state === 'PENDING';
    } catch {
      allowed = false;
    }
  }

  if (allowed) return <>{children}</>;

  return (
    <main className="min-h-[70vh] bg-slate-950 px-4 py-12 text-white">
      <section className="mx-auto flex min-h-[50vh] max-w-2xl items-center">
        <div className="w-full rounded-lg border border-amber-300/25 bg-slate-900 p-7 shadow-2xl">
          <p className="text-xs font-semibold uppercase text-amber-200">Access protected</p>
          <h1 className="mt-3 text-2xl font-semibold">
            {role === 'vendor' ? 'Vendor access required' : 'Customer access required'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Reliance could not confirm current access for this signed-in account. No protected
            account information was opened.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/auth/login?next=${encodeURIComponent(role === 'vendor' ? '/vendor/dashboard' : '/user-dashboard')}`}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Sign in
            </Link>
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
