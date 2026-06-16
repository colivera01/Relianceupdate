import Link from 'next/link';
import {
  HAS_LAUNCH_SUPPORT_EMAIL,
  LAUNCH_SUPPORT_EMAIL,
  LAUNCH_SUPPORT_MAILTO,
  LAUNCH_SUPPORT_RESPONSE_TIME,
} from '@/lib/support';

function sanitizeReturnHref(value: string | string[] | undefined): string | null {
  const href = String(Array.isArray(value) ? value[0] : value || '').trim();
  if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/customer/support')) return null;
  return href;
}

function sanitizeReturnLabel(value: string | string[] | undefined): string | null {
  const label = String(Array.isArray(value) ? value[0] : value || '').trim();
  if (!label || label.length > 80) return null;
  return label;
}

export default async function CustomerSupportPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const backHref = sanitizeReturnHref(resolvedSearchParams.returnTo) || '/user-dashboard';
  const backLabel = sanitizeReturnLabel(resolvedSearchParams.returnLabel) || 'Back to Customer Dashboard';

  return (
    <div className="space-y-6 text-white">
      <Link
        href={backHref}
        className="inline-flex text-sm font-medium text-[var(--reliance-blue-soft)] hover:text-white"
      >
        {backLabel}
      </Link>

      <section className="rounded-[34px] border border-white/10 bg-slate-950/72 p-8 shadow-[0_24px_80px_rgba(3,8,20,0.32)] sm:p-10">
        <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/62">
          Customer support
        </div>
        <h1 className="mt-5 font-display text-4xl font-semibold text-white sm:text-5xl">
          Help without leaving your account
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-white/72">
          Use this page for account access, service-record questions, public proof concerns, reviews,
          vendor approval questions, or media follow-up. Your customer navigation stays visible so you
          can move back to your records, profile, and saved proof without starting over.
        </p>

        <div className="mt-8 rounded-[28px] border border-[rgba(130,167,255,0.26)] bg-[rgba(36,107,255,0.14)] p-6">
          <h2 className="text-lg font-semibold text-white">Need help from Reliance?</h2>
          {HAS_LAUNCH_SUPPORT_EMAIL ? (
            <p className="mt-3 text-sm leading-7 text-[#dbe7ff]">
              Email{' '}
              <a href={LAUNCH_SUPPORT_MAILTO} className="font-semibold text-white underline underline-offset-4">
                {LAUNCH_SUPPORT_EMAIL}
              </a>
              . Include the service record, vendor, review, or page involved when you can. Reliance aims
              to respond {LAUNCH_SUPPORT_RESPONSE_TIME}.
            </p>
          ) : (
            <p className="mt-3 text-sm leading-7 text-[#dbe7ff]">
              A public support inbox has not been published yet for this launch. Use this page as the
              in-account support reference until the support inbox is configured.
            </p>
          )}
          <p className="mt-3 text-sm leading-7 text-[#dbe7ff]">
            Live chat, phone support, and in-app ticketing are not available yet.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {[
            {
              heading: 'Service records',
              description:
                'Review active and completed work, approved stage videos, and service-record details before contacting support.',
              href: '/my-bookings',
              label: 'Open My Service Records',
            },
            {
              heading: 'Secure account',
              description:
                'Manage sign-in recovery, passkeys, and security settings connected to this customer account.',
              href: '/customer/secure-account',
              label: 'Open Secure Account',
            },
            {
              heading: 'Profile settings',
              description:
                'Update saved contact details, address information, and your customer profile photo.',
              href: '/profile-settings',
              label: 'Open Profile & Settings',
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
  );
}
