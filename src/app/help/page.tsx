import Link from 'next/link';
import { cookies } from 'next/headers';
import { PublicSiteFooter } from '@/components/public/PublicSiteFooter';
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader';
import { getAuthSessionCookieName, verifyAuthSessionCookie } from '@/lib/auth-session';
import {
  HAS_LAUNCH_SUPPORT_EMAIL,
  LAUNCH_SUPPORT_EMAIL,
  LAUNCH_SUPPORT_MAILTO,
  LAUNCH_SUPPORT_RESPONSE_TIME,
} from '@/lib/support';

type QuickAction = {
  href: string;
  label: string;
};

type HelpRoleHint = 'admin' | 'vendor' | 'customer';

function normalizeHelpRoleHint(value: string | null | undefined): HelpRoleHint | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'admin' || normalized === 'vendor' || normalized === 'customer') {
    return normalized;
  }
  return null;
}

function sanitizeReturnHref(value: string | null | undefined): string | null {
  const href = String(value || '').trim();
  if (!href.startsWith('/') || href.startsWith('//')) return null;
  return href;
}

function sanitizeReturnLabel(value: string | null | undefined): string | null {
  const label = String(value || '').trim();
  if (!label || label.length > 80) return null;
  return label;
}

function buildHelpContext(
  session: ReturnType<typeof verifyAuthSessionCookie>,
  roleHint?: HelpRoleHint | null
): {
  backHref: string;
  backLabel: string;
  intro: string;
  bookingHeading: string;
  bookingDescription: string;
  bookingLabel: string;
  bookingHref: string;
  vendorHeading: string;
  vendorDescription: string;
  vendorLabel: string;
  vendorHref: string;
  quickActions: QuickAction[];
} {
  const effectiveUserType = roleHint || session?.userType || null;

  if (!session) {
    if (roleHint === 'customer') {
      return {
        backHref: '/user-dashboard',
        backLabel: 'Back to Customer Dashboard',
        intro:
          'Reliance helps customers discover publicly listed local services, manage bookings, and keep account and sign-in settings in one place.',
        bookingHeading: 'My services and bookings',
        bookingDescription:
          'Open your existing services and booking history to review active work, completed services, and saved customer requests.',
        bookingLabel: 'View My Services',
        bookingHref: '/my-bookings',
        vendorHeading: 'Account settings',
        vendorDescription:
          'Use Profile & Settings to update saved details, password recovery, and customer account preferences on this device.',
        vendorLabel: 'Open Profile & Settings',
        vendorHref: '/profile-settings',
        quickActions: [
          { href: '/user-dashboard', label: 'Open Customer Dashboard' },
          { href: '/customer/secure-account', label: 'Open Secure Account' },
          { href: '/favorites', label: 'Open Favorites' },
        ],
      };
    }
    return {
      backHref: '/',
      backLabel: 'Back to Reliance',
      intro:
        'Reliance helps customers discover publicly listed local services and helps approved vendors manage service work.',
      bookingHeading: 'Booking or saving a service',
      bookingDescription:
        'Create a customer account or sign in before booking, saving favorites, or managing service requests.',
      bookingLabel: 'Create a customer account',
      bookingHref: '/auth/register?type=user',
      vendorHeading: 'Vendor access',
      vendorDescription:
        'Vendors can register, sign in, and manage approved vendor work from the vendor dashboard.',
      vendorLabel: 'Join as a vendor',
      vendorHref: '/auth/register?type=vendor',
      quickActions: [],
    };
  }

  if (effectiveUserType === 'admin') {
    return {
      backHref: '/admin/dashboard',
      backLabel: 'Back to Admin Dashboard',
      intro:
        'Reliance helps admins monitor launch readiness, moderation, vendor activity, and customer trust operations.',
      bookingHeading: 'Operator tools',
      bookingDescription:
        'Use admin settings and reports to review access, launch-readiness details, and customer-account support questions.',
      bookingLabel: 'Open Admin Settings',
      bookingHref: '/admin/settings',
      vendorHeading: 'Launch operations',
      vendorDescription:
        'Use activity monitoring and vendor management to review vendor issues, moderation follow-up, and launch operations.',
      vendorLabel: 'Open Activity Monitoring',
      vendorHref: '/admin/activity',
      quickActions: [
        { href: '/admin/dashboard', label: 'Open Admin Dashboard' },
        { href: '/admin/reports', label: 'Open Reports & Analytics' },
        { href: '/admin/security', label: 'Open Admin Security' },
      ],
    };
  }

  if (effectiveUserType === 'vendor') {
    return {
      backHref: '/vendor/dashboard',
      backLabel: 'Back to Vendor Dashboard',
      intro:
        'Reliance helps approved vendors manage jobs, customer reviews, business profile settings, and support workflows.',
      bookingHeading: 'Active vendor work',
      bookingDescription:
        'Open your job workspace to manage scheduling, customer requests, and service progress for active work.',
      bookingLabel: 'Open Manage Jobs',
      bookingHref: '/vendor/jobs',
      vendorHeading: 'Vendor support',
      vendorDescription:
        'Open vendor support for launch guidance, help articles, and questions about your approved business account.',
      vendorLabel: 'Open Vendor Support',
      vendorHref: '/vendor/support',
      quickActions: [
        { href: '/vendor/dashboard', label: 'Open Vendor Dashboard' },
        { href: '/vendor/analytics', label: 'Open Analytics & Trust' },
        { href: '/vendor/profile', label: 'Open Profile & Settings' },
      ],
    };
  }

  return {
    backHref: '/user-dashboard',
    backLabel: 'Back to Customer Dashboard',
    intro:
      'Reliance helps customers discover publicly listed local services, manage bookings, and keep account and sign-in settings in one place.',
    bookingHeading: 'My services and bookings',
    bookingDescription:
      'Open your existing services and booking history to review active work, completed services, and saved customer requests.',
    bookingLabel: 'View My Services',
    bookingHref: '/my-bookings',
    vendorHeading: 'Account settings',
    vendorDescription:
      'Use Profile & Settings to update saved details, password recovery, and customer account preferences on this device.',
    vendorLabel: 'Open Profile & Settings',
    vendorHref: '/profile-settings',
    quickActions: [
      { href: '/user-dashboard', label: 'Open Customer Dashboard' },
      { href: '/customer/secure-account', label: 'Open Secure Account' },
      { href: '/favorites', label: 'Open Favorites' },
    ],
  };
}

export default async function PublicHelpPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(getAuthSessionCookieName())?.value || '';
  const session = verifyAuthSessionCookie(sessionToken);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const roleHint = normalizeHelpRoleHint(
    Array.isArray(resolvedSearchParams.role) ? resolvedSearchParams.role[0] : resolvedSearchParams.role
  );
  const returnTo = sanitizeReturnHref(
    Array.isArray(resolvedSearchParams.returnTo) ? resolvedSearchParams.returnTo[0] : resolvedSearchParams.returnTo
  );
  const returnLabel = sanitizeReturnLabel(
    Array.isArray(resolvedSearchParams.returnLabel) ? resolvedSearchParams.returnLabel[0] : resolvedSearchParams.returnLabel
  );
  const helpContext = buildHelpContext(session, roleHint);
  const backHref = returnTo || helpContext.backHref;
  const backLabel = returnLabel || helpContext.backLabel;

  return (
    <main className="reliance-marketplace-shell min-h-screen bg-[var(--reliance-paper)] text-white">
      <section className="reliance-dark-shell relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_86%_16%,rgba(36,107,255,0.18),transparent_18%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <PublicSiteHeader
            tone="dark"
            className="mb-10"
            links={[
              { href: '/', label: 'Home' },
              { href: '/browse', label: 'Services' },
              { href: '/contact', label: 'Contact' },
            ]}
            ctaHref="/browse"
            ctaLabel="Find a Service"
          />

          <Link href={backHref} className="inline-flex text-sm font-medium text-[var(--reliance-blue-soft)] hover:text-white">
            {backLabel}
          </Link>

          <section className="mt-8 reliance-light-card rounded-[34px] p-8 sm:p-10">
            <div className="reliance-kicker border border-white/10 bg-white/5 text-white/62">
              Help Center
            </div>
            <h1 className="mt-5 font-display text-4xl font-semibold text-white sm:text-5xl">
              Clear support paths without breaking the Reliance experience
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-white/72">
              {helpContext.intro}
            </p>

            <div className="mt-8 rounded-[28px] border border-[rgba(130,167,255,0.26)] bg-[rgba(36,107,255,0.14)] p-6">
              <h2 className="text-lg font-semibold text-white">Need help from Reliance?</h2>
              {HAS_LAUNCH_SUPPORT_EMAIL ? (
                <p className="mt-3 text-sm leading-7 text-[#dbe7ff]">
                  For launch support, email{' '}
                  <a href={LAUNCH_SUPPORT_MAILTO} className="font-semibold text-white underline underline-offset-4">
                    {LAUNCH_SUPPORT_EMAIL}
                  </a>
                  . Use this for account access, booking questions, vendor approval, video or media concerns,
                  public listing issues, or safety and moderation follow-up. Reliance aims to respond{' '}
                  {LAUNCH_SUPPORT_RESPONSE_TIME}.
                </p>
              ) : (
                <p className="mt-3 text-sm leading-7 text-[#dbe7ff]">
                  A public support inbox has not been published yet for this launch. Use this page as your
                  reference point for current product guidance, and publish a dedicated support email before
                  broader rollout.
                </p>
              )}
              <p className="mt-3 text-sm leading-7 text-[#dbe7ff]">
                Live chat, phone support, and in-app ticketing are not available on this launch.
              </p>
            </div>

            {helpContext.quickActions.length ? (
              <div className="mt-8 rounded-[28px] border border-white/10 bg-white/6 p-6">
                <h2 className="text-lg font-semibold text-white">Quick help for this account</h2>
                <p className="mt-2 text-sm leading-7 text-white/68">
                  These shortcuts match the account currently signed in on this device.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {helpContext.quickActions.map((action) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-medium text-white/84 transition hover:bg-white/10 hover:text-white"
                    >
                      {action.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {[
                {
                  heading: 'Browsing services',
                  description:
                    'Use the public browse page to search services from vendors that are publicly listed and have published inventory.',
                  href: '/browse',
                  label: 'Browse public services',
                },
                {
                  heading: helpContext.bookingHeading,
                  description: helpContext.bookingDescription,
                  href: helpContext.bookingHref,
                  label: helpContext.bookingLabel,
                },
                {
                  heading: helpContext.vendorHeading,
                  description: helpContext.vendorDescription,
                  href: helpContext.vendorHref,
                  label: helpContext.vendorLabel,
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
