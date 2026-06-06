import Link from "next/link";
import { Button } from "@/components/ui/button";
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
  { href: "/browse", label: "Browse" },
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

  return (
    <header
      className={cn(
        "w-full",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-[30px] border px-4 py-3.5 sm:px-6",
          dark
            ? "border-white/10 bg-white/6 backdrop-blur-xl"
            : "border-slate-200/80 bg-white/90 shadow-[0_16px_55px_rgba(10,36,99,0.08)] backdrop-blur-xl"
        )}
      >
        {hideLogo ? (
          <div aria-hidden="true" className="h-[5.5rem] w-[5.5rem] shrink-0" />
        ) : (
          <RelianceLogo
            href="/"
            tone={dark ? "light" : "dark"}
            compact
            blend={dark}
            frameClassName={dark ? "h-[5.5rem] w-[5.5rem]" : "h-[5.5rem] w-[5.5rem]"}
          />
        )}

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

        <div className="flex items-center gap-2 sm:gap-3">
          <Link href={secondaryHref}>
            <Button
              variant={dark ? "ghost" : "outline"}
              className={cn(
                "rounded-full px-4",
                dark
                  ? "text-white hover:bg-white/10 hover:text-white"
                  : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
              )}
            >
              {secondaryLabel}
            </Button>
          </Link>
          <Link href={ctaHref}>
            <Button className="rounded-full bg-[linear-gradient(135deg,#246BFF,#0F4BFF_60%,#2DAAFB)] px-5 text-white shadow-[0_18px_40px_rgba(36,107,255,0.28)] hover:brightness-110">
              {ctaLabel}
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
