'use client';

import { PasskeySetupCard } from '@/components/auth/PasskeySetupCard';

export default function VendorSecureAccountPage() {
  return (
    <PasskeySetupCard
      title="Secure Your Business Account"
      description="Add a passkey for faster sign-in to your vendor tools and reduced sign-in friction on trusted devices."
      redirectPath="/vendor/dashboard"
      skipLabel="Back to Vendor Dashboard"
    />
  );
}
