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

const PUBLIC_OPERATOR_NAME = process.env.NEXT_PUBLIC_RELIANCE_OPERATOR_NAME || "Cesar Olivera";

export function PublicSiteFooter() {
  return (
    <footer className="border-t border-white/8 bg-[linear-gradient(180deg,#04070d,#02050b)]">
      <div className="w-full px-4 py-20 sm:px-6 lg:px-6 xl:px-8 2xl:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_0.7fr_0.8fr_1.2fr]">
          <div>
            <RelianceLogo
              href="/"
              tone="light"
              compact
              blend
              frameClassName="h-[8rem] w-[8rem]"
            />
            <p className="mt-7 max-w-2xl text-2xl leading-10 text-white/66">
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
            <div className="mt-6 rounded-[30px] border border-white/10 bg-white/6 px-8 py-8">
              {HAS_LAUNCH_SUPPORT_EMAIL ? (
                <>
                  <p className="text-xl font-semibold text-white">Support email</p>
                  <a
                    href={LAUNCH_SUPPORT_MAILTO}
                    className="mt-3 block text-xl font-semibold text-[var(--reliance-blue-soft)] transition hover:text-white"
                  >
                    {LAUNCH_SUPPORT_EMAIL}
                  </a>
                  <p className="mt-5 text-xl leading-8 text-white/64">
                    Reliance aims to respond {LAUNCH_SUPPORT_RESPONSE_TIME}. Email is the current support channel.
                  </p>
                </>
              ) : (
                <p className="text-xl leading-8 text-white/64">
                  Publish a dedicated support inbox before wider rollout so customers and vendors always have a clear contact path.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-5 border-t border-white/8 pt-8 text-lg text-white/48 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p>&copy; {new Date().getFullYear()} Reliance.</p>
            <p className="mt-3 max-w-5xl text-base leading-7 text-white/40">
              Reliance is operated by {PUBLIC_OPERATOR_NAME}. Transactional SMS may be sent for account,
              invite, service-record, consent, review, and support workflows; message frequency varies and
              users can reply STOP to opt out or HELP for help.
            </p>
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
