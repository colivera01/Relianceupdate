import Link from 'next/link';
import { cookies } from 'next/headers';
import { PasskeySetupCard } from '@/components/auth/PasskeySetupCard';
import { getAuthSessionCookieName, verifyAuthSessionCookie } from '@/lib/auth-session';

export default async function CustomerSecureAccountPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(getAuthSessionCookieName())?.value || '';
  const session = verifyAuthSessionCookie(sessionToken);

  if (!session?.userId) {
    return (
      <div className="reliance-operator-shell reliance-grid-lines flex min-h-screen items-center justify-center px-4 text-white">
        <div className="reliance-light-card w-full max-w-xl rounded-2xl p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-white">Secure Account</h1>
          <p className="mt-3 text-slate-300">
            Sign in to manage passkeys and sign-in protection for your customer account.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/auth/login?next=%2Fcustomer%2Fsecure-account"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Sign In
            </Link>
            <Link
              href="/profile-settings"
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10"
            >
              Back to Profile Settings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PasskeySetupCard
      title="Secure Your Account"
      description="Add a passkey so you can sign in with your device security instead of typing a password."
      redirectPath="/profile-settings"
      skipLabel="Back to Profile Settings"
      secondaryActions={[
        {
          label: "Open Help Center",
          href: "/customer/support?returnTo=%2Fcustomer%2Fsecure-account&returnLabel=Back%20to%20Secure%20Account",
        },
        { label: "Go to Dashboard", href: "/user-dashboard" },
      ]}
    />
  );
}
