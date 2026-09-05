import { notFound } from 'next/navigation';
import VendorManagerRecoveryPanel from '@/components/auth/VendorManagerRecoveryPanel';

export default async function VendorManagerRecoveryFixture({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  if (process.env.E2E_VISUAL_FIXTURES !== '1') notFound();
  const { mode } = await searchParams;

  return (
    <VendorManagerRecoveryPanel
      authenticated={mode === 'wrong-account'}
      fallbackPath="/vendor/jobs/job-1"
      returnPathOverride="/vendor/jobs/job-1?view=package"
    />
  );
}
