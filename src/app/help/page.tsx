import Link from 'next/link';

export default function PublicHelpPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Link href="/" className="text-sm font-medium text-blue-700 hover:text-blue-800">
          Back to Reliance
        </Link>

        <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-bold">Help Center</h1>
          <p className="mt-4 text-slate-600">
            Reliance helps customers discover publicly listed local services and helps approved vendors manage service work.
          </p>

          <div className="mt-8 grid gap-6">
            <div>
              <h2 className="text-lg font-semibold">Browsing services</h2>
              <p className="mt-2 text-sm text-slate-600">
                Use the public browse page to search services from vendors that are publicly listed and have published inventory.
              </p>
              <Link href="/browse" className="mt-2 inline-block text-sm font-medium text-blue-700 hover:text-blue-800">
                Browse public services
              </Link>
            </div>

            <div>
              <h2 className="text-lg font-semibold">Booking or saving a service</h2>
              <p className="mt-2 text-sm text-slate-600">
                Create a customer account or sign in before booking, saving favorites, or managing service requests.
              </p>
              <Link href="/auth/register?type=user" className="mt-2 inline-block text-sm font-medium text-blue-700 hover:text-blue-800">
                Create a customer account
              </Link>
            </div>

            <div>
              <h2 className="text-lg font-semibold">Vendor access</h2>
              <p className="mt-2 text-sm text-slate-600">
                Vendors can register, sign in, and manage approved vendor work from the vendor dashboard.
              </p>
              <Link href="/auth/register?type=vendor" className="mt-2 inline-block text-sm font-medium text-blue-700 hover:text-blue-800">
                Join as a vendor
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
