import ServerRoleBoundary from './ServerRoleBoundary';

function VendorBoundary({
  children,
  allowPendingOnboarding,
}: {
  children: React.ReactNode;
  allowPendingOnboarding: boolean;
}) {
  return (
    <ServerRoleBoundary
      role="vendor"
      allowPendingVendorOnboarding={allowPendingOnboarding}
    >
      {children}
    </ServerRoleBoundary>
  );
}

export default function VendorPageBoundary({ children }: { children: React.ReactNode }) {
  return <VendorBoundary allowPendingOnboarding={false}>{children}</VendorBoundary>;
}

export function VendorOnboardingPageBoundary({ children }: { children: React.ReactNode }) {
  return <VendorBoundary allowPendingOnboarding>{children}</VendorBoundary>;
}
