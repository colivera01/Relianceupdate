import ServerRoleBoundary from './ServerRoleBoundary';

function VendorBoundary({
  children,
  allowPendingOnboarding,
  requiredVendorRole,
  requiredVendorId,
  accessContext,
}: {
  children: React.ReactNode;
  allowPendingOnboarding: boolean;
  requiredVendorRole?: 'MANAGER' | 'EMPLOYEE';
  requiredVendorId?: string;
  accessContext?: 'general' | 'manager-review';
}) {
  return (
    <ServerRoleBoundary
      role="vendor"
      allowPendingVendorOnboarding={allowPendingOnboarding}
      requiredVendorRole={requiredVendorRole}
      requiredVendorId={requiredVendorId}
      accessContext={accessContext}
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

export function VendorManagerResourceBoundary({
  children,
  vendorId,
}: {
  children: React.ReactNode;
  vendorId: string;
}) {
  return (
    <VendorBoundary
      allowPendingOnboarding={false}
      requiredVendorRole="MANAGER"
      requiredVendorId={vendorId}
      accessContext="manager-review"
    >
      {children}
    </VendorBoundary>
  );
}
