import Link from 'next/link';
import { VendorManagerResourceBoundary } from '@/components/auth/VendorPageBoundary';
import { prisma } from '@/server/db';

export default async function VendorJobResourceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id: String(jobId || '').trim() },
    select: { vendorId: true },
  });

  if (!booking) {
    return (
      <main className="min-h-[70vh] bg-slate-950 px-4 py-12 text-white">
        <section className="mx-auto flex min-h-[50vh] max-w-2xl items-center">
          <div className="w-full rounded-lg border border-slate-700 bg-slate-900 p-7 shadow-2xl">
            <p className="text-xs font-semibold uppercase text-slate-400">Service Record unavailable</p>
            <h1 className="mt-3 text-2xl font-semibold">This Service Record could not be opened</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              The link may be invalid or the Service Record may no longer be available.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Cancel
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <VendorManagerResourceBoundary vendorId={booking.vendorId}>
      {children}
    </VendorManagerResourceBoundary>
  );
}
