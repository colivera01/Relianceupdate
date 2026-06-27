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
    "inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    dark
      ? "text-white hover:bg-white/10 hover:text-white"
      : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
  );
  const mobileSecondaryClassName = cn(secondaryClassName, "h-9 px-3 text-sm");
  const ctaClassName =
    "inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#246BFF,#0F4BFF_60%,#2DAAFB)] px-5 text-sm font-medium text-white shadow-[0_18px_40px_rgba(36,107,255,0.28)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
  const mobileCtaClassName = cn(ctaClassName, "h-9 px-4");

  return (
    <header
      className={cn(
        "w-full",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-7xl flex-col gap-3 rounded-[30px] border px-4 py-3.5 sm:px-6 md:flex-row md:items-center md:justify-between md:gap-4",
          dark
            ? "border-white/10 bg-white/6 backdrop-blur-xl"
            : "border-slate-200/80 bg-white/90 shadow-[0_16px_55px_rgba(10,36,99,0.08)] backdrop-blur-xl"
        )}
      >
        <div className="flex w-full items-center justify-between gap-3 md:w-auto">
          {hideLogo ? (
            <div aria-hidden="true" className="h-16 w-16 shrink-0 sm:h-[5.5rem] sm:w-[5.5rem]" />
          ) : (
            <RelianceLogo
              href="/"
              tone={dark ? "light" : "dark"}
              compact
              blend={dark}
              frameClassName={dark ? "h-16 w-16 sm:h-[5.5rem] sm:w-[5.5rem]" : "h-16 w-16 sm:h-[5.5rem] sm:w-[5.5rem]"}
            />
          )}

          <div className="flex items-center gap-2 sm:gap-3 md:hidden">
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
