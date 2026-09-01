import ServerRoleBoundary from './ServerRoleBoundary';

function VendorBoundary({
  children,
  allowPendingOnboarding,
  requiredVendorRole,
}: {
  children: React.ReactNode;
  allowPendingOnboarding: boolean;
  requiredVendorRole?: 'MANAGER' | 'EMPLOYEE';
}) {
  return (
    <ServerRoleBoundary
      role="vendor"
      allowPendingVendorOnboarding={allowPendingOnboarding}
      requiredVendorRole={requiredVendorRole}
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

export function VendorManagerPageBoundary({ children }: { children: React.ReactNode }) {
  return (
    <VendorBoundary allowPendingOnboarding={false} requiredVendorRole="MANAGER">
      {children}
    </VendorBoundary>
  );
}
