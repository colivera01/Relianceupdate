import Link from 'next/link';
import ServerRoleBoundaryActions from './ServerRoleBoundaryActions';
import { vendorManagerRecoveryCopy } from '@/lib/vendor-access-recovery';

export default function VendorManagerRecoveryPanel({
  authenticated,
  fallbackPath,
  returnPathOverride,
}: {
  authenticated: boolean;
  fallbackPath: string;
  returnPathOverride?: string;
}) {
  const copy = vendorManagerRecoveryCopy(authenticated);

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-2xl rounded-lg border border-amber-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase text-amber-700">Manager access protected</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">{copy.heading}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{copy.description}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <ServerRoleBoundaryActions
            mode={copy.mode}
            fallbackPath={fallbackPath}
            returnPathOverride={returnPathOverride}
          />
          <Link
            href="/"
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
