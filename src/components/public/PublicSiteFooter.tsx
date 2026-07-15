import Link from "next/link";
import { RelianceLogo } from "@/components/public/RelianceLogo";
import {
  HAS_LAUNCH_SUPPORT_EMAIL,
  LAUNCH_SUPPORT_EMAIL,
  LAUNCH_SUPPORT_GMAIL_COMPOSE_URL,
  LAUNCH_SUPPORT_RESPONSE_TIME,
} from "@/lib/support";

const exploreLinks = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse Services" },
  { href: "/help", label: "Help" },
];

const accountLinks = [
  { href: "/auth/login", label: "Sign In" },
  { href: "/auth/register?type=user", label: "Create Customer Account" },
  { href: "/auth/register?type=vendor", label: "Join as Vendor" },
];

const legalLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms" },
  { href: "/sms-policy", label: "SMS Policy" },
];

export function PublicSiteFooter() {
  return (
    <footer className="overflow-hidden border-t border-white/8 bg-[linear-gradient(180deg,#04070d,#02050b)]">
      <div className="w-full max-w-full px-4 py-14 sm:px-6 sm:py-20 lg:px-6 xl:px-8 2xl:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_0.7fr_0.8fr_1.2fr]">
          <div className="min-w-0">
            <RelianceLogo
              href="/"
              tone="light"
              compact
              blend
              frameClassName="h-[6rem] w-[6rem] sm:h-[8rem] sm:w-[8rem]"
            />
            <p className="mt-7 max-w-2xl text-xl leading-9 text-white/66 sm:text-2xl sm:leading-10">
              Reliance helps customers compare completed work, public service videos, reviews, and
              Trust Score evidence before choosing a provider.
            </p>
          </div>

          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-white/48">Explore</div>
            <div className="mt-6 space-y-4">
              {exploreLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block text-xl font-semibold text-white/76 transition hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-white/48">Accounts</div>
            <div className="mt-6 space-y-4">
              {accountLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block text-xl font-semibold text-white/76 transition hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-white/48">Support</div>
            <div className="mt-6 min-w-0 rounded-[26px] border border-white/10 bg-white/6 px-5 py-6 sm:rounded-[30px] sm:px-8 sm:py-8">
              {HAS_LAUNCH_SUPPORT_EMAIL ? (
                <>
                  <p className="text-lg font-semibold text-white sm:text-xl">Support email</p>
                  <a
                    href={LAUNCH_SUPPORT_GMAIL_COMPOSE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 block break-all text-lg font-semibold text-[var(--reliance-blue-soft)] transition hover:text-white sm:text-xl"
                  >
                    {LAUNCH_SUPPORT_EMAIL}
                  </a>
                  <p className="mt-5 text-lg leading-8 text-white/64 sm:text-xl">
                    Reliance aims to respond {LAUNCH_SUPPORT_RESPONSE_TIME}. Email is the current support channel.
                  </p>
                </>
              ) : (
                <p className="text-lg leading-8 text-white/64 sm:text-xl">
                  Publish a dedicated support inbox before wider rollout so customers and vendors always have a clear contact path.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-14 flex min-w-0 flex-col gap-5 border-t border-white/8 pt-8 text-base text-white/48 sm:flex-row sm:items-start sm:justify-between sm:text-lg">
          <div className="min-w-0">
            <p>&copy; {new Date().getFullYear()} Reliance.</p>
          </div>
          <div className="flex flex-wrap gap-6">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-semibold text-white/64 transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
