import Link from "next/link";
import { RelianceLogo } from "@/components/public/RelianceLogo";
import { cn } from "@/lib/utils";

type HeaderLink = {
  href: string;
  label: string;
};

type PublicSiteHeaderProps = {
  tone?: "dark" | "light";
  links?: HeaderLink[];
  className?: string;
  hideLogo?: boolean;
  ctaHref?: string;
  ctaLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

const defaultLinks: HeaderLink[] = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse Services" },
  { href: "/help", label: "Help" },
];

export function PublicSiteHeader({
  tone = "light",
  links = defaultLinks,
  className,
  hideLogo = false,
  ctaHref = "/auth/register?type=user",
  ctaLabel = "Get Started",
  secondaryHref = "/auth/login",
  secondaryLabel = "Sign In",
}: PublicSiteHeaderProps) {
  const dark = tone === "dark";
  const secondaryClassName = cn(
    "inline-flex h-14 items-center justify-center rounded-full px-7 text-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 xl:h-16 xl:px-9 xl:text-xl",
    dark
      ? "text-white hover:bg-white/10 hover:text-white"
      : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
  );
  const mobileSecondaryClassName = cn(
    "inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    dark
      ? "text-white hover:bg-white/10 hover:text-white"
      : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
  );
  const ctaClassName =
    "inline-flex h-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#246BFF,#0F4BFF_60%,#2DAAFB)] px-8 text-lg font-semibold text-white shadow-[0_18px_40px_rgba(36,107,255,0.28)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 xl:h-16 xl:px-10 xl:text-xl";
  const mobileCtaClassName =
    "inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[linear-gradient(135deg,#246BFF,#0F4BFF_60%,#2DAAFB)] px-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(36,107,255,0.24)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-4";

  return (
    <header
      className={cn(
        "w-full",
        className
      )}
    >
      <div
        className={cn(
          "flex w-full flex-col gap-3 rounded-[26px] border px-3 py-4 sm:rounded-[30px] sm:px-6 md:flex-row md:items-center md:justify-between md:gap-4 xl:px-9 xl:py-5",
          dark
            ? "border-white/10 bg-white/6 backdrop-blur-xl"
            : "border-slate-200/80 bg-white/90 shadow-[0_16px_55px_rgba(10,36,99,0.08)] backdrop-blur-xl"
        )}
      >
        <div className="flex w-full flex-wrap items-center justify-between gap-2 md:w-auto">
          {hideLogo ? (
            <div aria-hidden="true" className="h-10 w-10 shrink-0 md:h-8 md:w-8" />
          ) : dark ? (
            <Link href="/" className="relative inline-flex h-20 w-36 shrink-0 items-center justify-center sm:h-24 sm:w-44 xl:h-28 xl:w-52">
              <span className="pointer-events-none absolute inset-[-8%] rounded-[28px] bg-[radial-gradient(circle_at_40%_38%,rgba(141,178,255,0.18),rgba(45,107,255,0.11)_42%,transparent_72%)] blur-xl" />
              <img
                src="/reliance-email-logo.png"
                alt="Reliance"
                className="relative z-[1] h-full w-full object-contain opacity-95 drop-shadow-[0_0_24px_rgba(72,128,255,0.34)]"
              />
            </Link>
          ) : (
            <RelianceLogo
              href="/"
              tone="dark"
              compact
              frameClassName="h-12 w-36 sm:h-14 sm:w-44 xl:h-16 xl:w-52"
            />
          )}

          <div className="ml-auto flex w-full min-w-0 shrink-0 items-center justify-end gap-1.5 sm:w-auto sm:gap-3 md:hidden">
            <Link href={secondaryHref} className={mobileSecondaryClassName}>
              {secondaryLabel}
            </Link>
            <Link href={ctaHref} className={mobileCtaClassName}>
              {ctaLabel}
            </Link>
          </div>
        </div>

        {links.length > 0 ? (
          <nav className="hidden items-center gap-6 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium transition-colors",
                  dark
                    ? "text-white/78 hover:text-white"
                    : "text-slate-600 hover:text-slate-950"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ) : (
          <div className="hidden flex-1 md:block" aria-hidden="true" />
        )}

        {links.length > 0 ? (
          <nav className="flex w-full items-center gap-2 overflow-x-auto pb-1 md:hidden">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold",
                  dark
                    ? "border-white/10 bg-white/7 text-white/82"
                    : "border-slate-200 bg-white text-slate-700"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}

        <div className="hidden items-center gap-2 sm:gap-3 md:flex">
          <Link href={secondaryHref} className={secondaryClassName}>
            {secondaryLabel}
          </Link>
          <Link href={ctaHref} className={ctaClassName}>
            {ctaLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
