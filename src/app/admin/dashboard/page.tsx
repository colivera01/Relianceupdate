"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckSquare,
  ClipboardList,
  KeyRound,
  Megaphone,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Star,
  Store,
  Users,
} from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { getAdminRequestHeaders } from "@/lib/admin-client";

type AdminQuickLink = {
  href: string;
  label: string;
  description: string;
  icon: typeof Store;
  accentClass: string;
};

type AdminStats = {
  totalUsers: number;
  totalVendors: number;
  totalReviews: number;
  pendingModeration: number;
  pendingModerationBreakdown: {
    reviews: number;
    mediaPackages: number;
  };
};

type DashboardMetric = {
  title: string;
  value: number | null;
  helper: string;
  href?: string;
  cta?: string;
};

const quickLinks: AdminQuickLink[] = [
  {
    href: "/admin/accounts",
    label: "All Accounts",
    description: "Open one unified roster for customers, vendors, and suspended or restricted accounts.",
    icon: Users,
    accentClass: "bg-[rgba(53,214,165,0.16)] text-[var(--reliance-emerald)]",
  },
  {
    href: "/admin/accounts?tab=vendors",
    label: "Vendor Accounts",
    description: "Jump directly into the vendor roster, approval holds, and account-state controls.",
    icon: Store,
    accentClass: "bg-[rgba(36,107,255,0.16)] text-[var(--reliance-blue-soft)]",
  },
  {
    href: "/admin/publish-management",
    label: "Publish Management",
    description: "Control public visibility of vendors and services.",
    icon: Megaphone,
    accentClass: "bg-[rgba(130,167,255,0.16)] text-[var(--reliance-blue-soft)]",
  },
  {
    href: "/admin/media-moderation",
    label: "Media Moderation",
    description: "Approve or block customer-visible service videos and photos.",
    icon: ShieldCheck,
    accentClass: "bg-[rgba(53,214,165,0.16)] text-[var(--reliance-emerald)]",
  },
  {
    href: "/admin/reviews",
    label: "Review Moderation",
    description: "Audit and moderate customer reviews.",
    icon: Star,
    accentClass: "bg-[rgba(248,182,60,0.16)] text-[var(--reliance-amber)]",
  },
  {
    href: "/admin/review-audit",
    label: "Review Audit",
    description: "Inspect review availability, evidence coverage, and moderation readiness.",
    icon: Search,
    accentClass: "bg-[rgba(248,182,60,0.12)] text-[var(--reliance-amber)]",
  },
  {
    href: "/admin/security",
    label: "Admin Security",
    description: "Manage admin passkeys and stronger sign-in options.",
    icon: KeyRound,
    accentClass: "bg-[rgba(81,191,255,0.16)] text-[var(--reliance-cyan)]",
  },
  {
    href: "/admin/settings",
    label: "Admin Settings",
    description: "Review launch readiness, delivery setup, AI rollout state, and control rules.",
    icon: Settings,
    accentClass: "bg-[rgba(130,167,255,0.16)] text-[var(--reliance-blue-soft)]",
  },
  {
    href: "/admin/reported-content",
    label: "Reported Content",
    description: "Review submitted review and service-media reports.",
    icon: ShieldAlert,
    accentClass: "bg-[rgba(255,120,140,0.16)] text-[#ffb8c2]",
  },
  {
    href: "/admin/reports",
    label: "Reports & Analytics",
    description: "Review launch-facing reporting built from live moderation and account data.",
    icon: BarChart3,
    accentClass: "bg-[rgba(81,191,255,0.16)] text-[var(--reliance-cyan)]",
  },
  {
    href: "/admin/activity",
    label: "Activity Monitoring",
    description: "Review AI assist runs, operator feedback, and exportable activity trends.",
    icon: Activity,
    accentClass: "bg-[rgba(130,167,255,0.16)] text-[var(--reliance-blue-soft)]",
  },
  {
    href: "/admin/audit-logs",
    label: "Audit Logs",
    description: "Inspect admin and moderation actions.",
    icon: ClipboardList,
    accentClass: "bg-white/8 text-white/78",
  },
];

function formatMetric(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

function pluralizeCount(count: number, singular: string, plural: string): string {
  return `${formatMetric(count)} ${count === 1 ? singular : plural}`;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const fetchStats = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/admin/stats", {
          method: "GET",
          headers: getAdminRequestHeaders(),
          cache: "no-store",
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(json?.error || json?.message || `Status ${response.status}`);
        }

        if (!mounted) return;
        setStats({
          totalUsers: Number(json?.stats?.totalUsers || 0),
          totalVendors: Number(json?.stats?.totalVendors || 0),
          totalReviews: Number(json?.stats?.totalReviews || 0),
          pendingModeration: Number(json?.stats?.pendingModeration || 0),
          pendingModerationBreakdown: {
            reviews: Number(json?.stats?.pendingModerationBreakdown?.reviews || 0),
            mediaPackages: Number(
              json?.stats?.pendingModerationBreakdown?.mediaPackages || 0
            ),
          },
        });
      } catch (err) {
        if (!mounted) return;
        setStats(null);
        setError(err instanceof Error ? err.message : "Failed to load admin stats");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void fetchStats();

    return () => {
      mounted = false;
    };
  }, []);

  const metrics: DashboardMetric[] = [
    {
      title: "Countable Customers",
      value: stats?.totalUsers ?? null,
      href: "/admin/accounts?tab=customers",
      cta: "Open customer tab",
      helper: loading
        ? "Loading launch-facing customer count."
        : error
          ? "Unable to load launch-facing customer count."
          : "Customer accounts counted after internal/demo exclusions.",
    },
    {
      title: "Countable Vendors",
      value: stats?.totalVendors ?? null,
      href: "/admin/accounts?tab=vendors&status=all",
      cta: "Open vendor tab",
      helper: loading
        ? "Loading launch-facing vendor count."
        : error
          ? "Unable to load launch-facing vendor count."
          : "Public-facing vendor businesses counted after internal/demo exclusions.",
    },
    {
      title: "Countable Reviews",
      value: stats?.totalReviews ?? null,
      href: "/admin/reviews",
      cta: "Open review moderation",
      helper: loading
        ? "Loading launch-facing review count."
        : error
          ? "Unable to load launch-facing review count."
          : "Customer reviews that still count toward launch-facing reporting.",
    },
    {
      title: "Pending Moderation",
      value: stats?.pendingModeration ?? null,
      href: "/admin/media-moderation",
      cta: "Open moderation queues",
      helper: loading
        ? "Loading pending moderation workload."
        : error
          ? "Unable to load pending moderation count."
          : stats
            ? `${pluralizeCount(
                stats.pendingModerationBreakdown.reviews,
                "review",
                "reviews"
              )}, ${pluralizeCount(
                stats.pendingModerationBreakdown.mediaPackages,
                "video package",
                "video packages"
              )}`
            : "Reviews and video packages awaiting moderation.",
    },
  ];

  return (
    <div className="space-y-8">
      <header className="reliance-operator-hero rounded-[32px] px-6 py-7">
        <div className="reliance-kicker border border-white/10 bg-white/6 text-white/64">
          Operator command
        </div>
        <h1 className="mt-5 font-display text-4xl font-semibold text-white sm:text-5xl">
          Admin Overview
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/72 sm:text-base">
              Launch-facing control surface for vendor approvals, featured proof placements, moderation,
          AI activity, trust review, and audit visibility. The workflows stay the same, while this
          overview keeps public trust signals and internal launch controls in one place.
        </p>
      </header>

      <Card className="border-blue-100 bg-blue-50/90">
        <CardContent className="space-y-2 pt-6 text-sm text-blue-950">
          <div className="flex items-center gap-2 font-semibold text-slate-950">
            <CheckSquare className="h-4 w-4" />
            How to read these counts
          </div>
          <p>
            These summary cards are intentionally filtered for launch-facing reporting.
            Internal/demo identities, hidden test vendors, and excluded verification
            activity do not count here.
          </p>
          <p className="text-xs text-blue-900">
            Use vendor detail pages, audit logs, and trust score panels when you need
            internal testing history or account-by-account investigation.
          </p>
        </CardContent>
      </Card>

      <section
        aria-label="Platform metrics"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {metrics.map((metric) => (
          <Link
            key={metric.title}
            href={metric.href || "#"}
            className={metric.href ? "group block" : "pointer-events-none block"}
          >
            <Card className="bg-white transition-all group-hover:-translate-y-0.5 group-hover:border-[var(--reliance-blue)] group-hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-700">
                  {metric.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-3xl font-bold leading-none ${
                    metric.value === null ? "text-gray-300" : "text-slate-950"
                  }`}
                >
                  {formatMetric(metric.value)}
                </div>
                <div className="mt-2 text-xs text-gray-500">{metric.helper}</div>
                {metric.cta ? (
                  <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--reliance-blue-soft)]">
                    {metric.cta}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <section aria-label="Quick links" className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-display text-2xl font-semibold text-slate-950">Quick actions</h2>
          <p className="text-sm text-gray-600">
            These links route to currently usable admin workflows, including
            launch-readiness settings, AI activity monitoring, moderation, and
            vendor operations.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} className="group block">
              <Card className="h-full border-gray-200 bg-white transition-all group-hover:-translate-y-0.5 group-hover:border-[var(--reliance-blue)] group-hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${link.accentClass}`}>
                      <link.icon className="h-5 w-5" />
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--reliance-blue-soft)]">
                      Open
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="font-semibold text-slate-950">
                      {link.label}
                    </div>
                    <div className="text-sm text-gray-600">
                      {link.description}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
