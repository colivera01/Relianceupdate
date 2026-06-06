import Link from 'next/link';
import { PublicSiteFooter } from '@/components/public/PublicSiteFooter';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';
import {
  HAS_LAUNCH_SUPPORT_EMAIL,
  LAUNCH_SUPPORT_EMAIL,
  LAUNCH_SUPPORT_MAILTO,
  LAUNCH_SUPPORT_RESPONSE_TIME,
} from '@/lib/support';

export default function PublicContactPage() {
  return (
    <main className="reliance-marketplace-shell min-h-screen bg-[var(--reliance-paper)] text-white">
      <section className="reliance-dark-shell relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_18%,rgba(81,191,255,0.16),transparent_18%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <PublicSiteHeader
            tone="dark"
            className="mb-10"
            links={[
              { href: '/', label: 'Home' },
              { href: '/browse', label: 'Services' },
              { href: '/help', label: 'Help' },
            ]}
            ctaHref="/browse"
            ctaLabel="Find a Service"
          />

          <Link href="/" className="inline-flex text-sm font-medium text-[var(--reliance-blue-soft)] hover:text-white">
            Back to Reliance
          </Link>

          <section className="mt-8 reliance-light-card rounded-[34px] p-8 sm:p-10">
            <div className="reliance-kicker border border-white/10 bg-white/5 text-white/62">
              Contact Reliance
            </div>
            <h1 className="mt-5 font-display text-4xl font-semibold text-white sm:text-5xl">
              One support path, clearly visible
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-white/72">
              {HAS_LAUNCH_SUPPORT_EMAIL
                ? 'Need help with a public service listing, customer account, vendor access, safety concern, or launch issue? Email Reliance support and include the page, service, booking, or vendor involved when you can.'
                : 'Need help with a public service listing, customer account, vendor access, safety concern, or launch issue? Publish a dedicated Reliance support inbox before broader rollout so customers and vendors have a clear contact path.'}
            </p>

            <div className="mt-8 rounded-[28px] border border-[rgba(130,167,255,0.26)] bg-[rgba(36,107,255,0.14)] p-6">
              <h2 className="text-lg font-semibold text-white">Launch support email</h2>
              {HAS_LAUNCH_SUPPORT_EMAIL ? (
                <p className="mt-3 text-sm leading-7 text-[#dbe7ff]">
                  Send public launch support requests to{' '}
                  <a href={LAUNCH_SUPPORT_MAILTO} className="font-semibold text-white underline underline-offset-4">
                    {LAUNCH_SUPPORT_EMAIL}
                  </a>
                  . Reliance aims to follow up {LAUNCH_SUPPORT_RESPONSE_TIME}. Phone support, live chat,
                  and in-app ticketing are not available on this launch.
                </p>
              ) : (
                <p className="mt-3 text-sm leading-7 text-[#dbe7ff]">
                  A public support inbox has not been published yet for this launch. Set a dedicated support
                  email before broader rollout so customer and vendor issues do not route to a personal inbox.
                </p>
              )}
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {[
                {
                  heading: 'Customers',
                  description: HAS_LAUNCH_SUPPORT_EMAIL
                    ? 'Sign in to manage bookings, favorites, reviews, and account details. Email support if you cannot sign in, need help with a booking, or believe an account restriction is wrong.'
                    : 'Sign in to manage bookings, favorites, reviews, and account details. Publish a dedicated support inbox before broader rollout so customer account and booking issues have a clear contact path.',
                  href: '/auth/login',
                  label: 'Customer sign in',
                },
                {
                  heading: 'Vendors',
                  description: HAS_LAUNCH_SUPPORT_EMAIL
                    ? 'Approved vendors can access dashboard guidance after signing in. Email support for account approval, profile access, jobs, media, consent, or moderation questions.'
                    : 'Approved vendors can access dashboard guidance after signing in. Publish a dedicated support inbox before broader vendor onboarding so approval, media, consent, and moderation questions have a clear path.',
                  href: '/auth/login',
                  label: 'Vendor sign in',
                },
                {
                  heading: 'Explore first',
                  description: HAS_LAUNCH_SUPPORT_EMAIL
                    ? 'Signed-out visitors can browse public, moderation-filtered service inventory before creating an account. Email support to report confusing public content or a public listing concern.'
                    : 'Signed-out visitors can browse public, moderation-filtered service inventory before creating an account. Publish a launch support inbox before wider release so public listing concerns have a clear reporting path.',
                  href: '/browse',
                  label: 'Browse public services',
                },
              ].map((item) => (
                <div key={item.heading} className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                  <h2 className="text-lg font-semibold text-white">{item.heading}</h2>
                  <p className="mt-3 text-sm leading-7 text-white/68">{item.description}</p>
                  <Link
                    href={item.href}
                    className="mt-4 inline-flex text-sm font-semibold text-[var(--reliance-blue-soft)] transition hover:text-white"
                  >
                    {item.label}
                  </Link>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
      <PublicSiteFooter />
    </main>
  );
}
