'use client';

import { PasskeySetupCard } from '@/components/auth/PasskeySetupCard';

export default function AdminSecurityPage() {
  return (
    <PasskeySetupCard
      title="Secure Your Admin Account"
      description="Add a passkey so your admin sign-in can use device security instead of the password plus email-code flow."
      redirectPath="/admin/dashboard"
      skipLabel="Back to Admin Dashboard"
    />
  );
}
