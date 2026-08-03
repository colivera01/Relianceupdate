import { VendorOnboardingPageBoundary } from '@/components/auth/VendorPageBoundary';

export default function VendorProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <VendorOnboardingPageBoundary>
      {children}
    </VendorOnboardingPageBoundary>
  );
}
