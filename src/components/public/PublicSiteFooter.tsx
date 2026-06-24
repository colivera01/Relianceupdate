import Link from "next/link";
import { RelianceLogo } from "@/components/public/RelianceLogo";
import {
  HAS_LAUNCH_SUPPORT_EMAIL,
  LAUNCH_SUPPORT_EMAIL,
  LAUNCH_SUPPORT_MAILTO,
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
    <footer className="border-t border-white/8 bg-[linear-gradient(180deg,#04070d,#02050b)]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr_0.9fr_1.1fr]">
          <div>
            <RelianceLogo
              href="/"
              tone="light"
              compact
              blend
              frameClassName="h-[5.8rem] w-[5.8rem]"
            />
            <p className="mt-5 max-w-sm text-sm leading-7 text-white/64">
              Reliance helps customers compare completed work, public service videos, reviews, and
              Trust Score evidence before choosing a provider.
            </p>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/44">Explore</div>
            <div className="mt-4 space-y-3">
              {exploreLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block text-sm font-medium text-white/76 transition hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/44">Accounts</div>
            <div className="mt-4 space-y-3">
              {accountLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block text-sm font-medium text-white/76 transition hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/44">Support</div>
            <div className="mt-4 rounded-[24px] border border-white/10 bg-white/6 px-5 py-5">
              {HAS_LAUNCH_SUPPORT_EMAIL ? (
                <>
                  <p className="text-sm font-semibold text-white">Support email</p>
                  <a
                    href={LAUNCH_SUPPORT_MAILTO}
                    className="mt-2 block text-sm font-medium text-[var(--reliance-blue-soft)] transition hover:text-white"
                  >
                    {LAUNCH_SUPPORT_EMAIL}
                  </a>
                  <p className="mt-3 text-sm leading-6 text-white/62">
                    Reliance aims to respond {LAUNCH_SUPPORT_RESPONSE_TIME}. Email is the current support channel.
                  </p>
                </>
              ) : (
                <p className="text-sm leading-6 text-white/62">
                  Publish a dedicated support inbox before wider rollout so customers and vendors always have a clear contact path.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/8 pt-6 text-sm text-white/44 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Reliance.</p>
          <div className="flex flex-wrap gap-4">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-medium text-white/58 transition hover:text-white"
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
