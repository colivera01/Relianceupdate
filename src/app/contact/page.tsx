import Link from 'next/link';

export default function PublicContactPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Link href="/" className="text-sm font-medium text-blue-700 hover:text-blue-800">
          Back to Reliance
        </Link>

        <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-bold">Contact Reliance</h1>
          <p className="mt-4 text-slate-600">
            Need help with a public service listing, customer account, or vendor access? Use the appropriate entry point below.
          </p>

          <div className="mt-8 grid gap-6">
            <div className="rounded-xl border border-slate-200 p-5">
              <h2 className="text-lg font-semibold">Customers</h2>
              <p className="mt-2 text-sm text-slate-600">
                Sign in to manage bookings, favorites, reviews, and account details.
              </p>
              <Link href="/auth/login" className="mt-3 inline-block text-sm font-medium text-blue-700 hover:text-blue-800">
                Customer sign in
              </Link>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h2 className="text-lg font-semibold">Vendors</h2>
              <p className="mt-2 text-sm text-slate-600">
                Approved vendors can access dashboard support from inside the vendor portal after signing in.
              </p>
              <Link href="/auth/login" className="mt-3 inline-block text-sm font-medium text-blue-700 hover:text-blue-800">
                Vendor sign in
              </Link>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h2 className="text-lg font-semibold">Explore first</h2>
              <p className="mt-2 text-sm text-slate-600">
                Signed-out visitors can browse public, moderation-filtered service inventory before creating an account.
              </p>
              <Link href="/browse" className="mt-3 inline-block text-sm font-medium text-blue-700 hover:text-blue-800">
                Browse public services
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
