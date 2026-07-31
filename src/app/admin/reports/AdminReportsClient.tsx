"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  FileWarning,
  LayoutDashboard,
  ListChecks,
  ShieldAlert,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAdminRequestHeaders } from "@/lib/admin-client";

type ReportsSummary = {
  totalCustomers: number;
  totalVendors: number;
  totalReviews: number;
  pendingReviewModeration: number;
  pendingMediaPackages: number;
  reviewWindowsLast30Days: number;
  openContentReports: number;
  recentAuditEvents: number;
};

function formatCount(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

function pluralizeCount(count: number, singular: string, plural: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}

export default function AdminReportsClient() {
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [temporarilyUnavailable, setTemporarilyUnavailable] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchSummary = async () => {
      setLoading(true);
      setError("");
      setTemporarilyUnavailable(false);

      try {
        const response = await fetch("/api/admin/reports/summary", {
          method: "GET",
          headers: getAdminRequestHeaders(),
          cache: "no-store",
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          const nextError = String(json?.error || json?.message || `Status ${response.status}`);
          if (response.status === 503 || String(json?.code || "") === "DB_UNAVAILABLE") {
            if (!mounted) return;
            setTemporarilyUnavailable(true);
            setSummary(null);
            return;
          }
          throw new Error(nextError);
        }

        if (!mounted) return;
        setSummary({
          totalCustomers: Number(json?.summary?.totalCustomers || 0),
          totalVendors: Number(json?.summary?.totalVendors || 0),
          totalReviews: Number(json?.summary?.totalReviews || 0),
          pendingReviewModeration: Number(json?.summary?.pendingReviewModeration || 0),
          pendingMediaPackages: Number(json?.summary?.pendingMediaPackages || 0),
          reviewWindowsLast30Days: Number(json?.summary?.reviewWindowsLast30Days || 0),
          openContentReports: Number(json?.summary?.openContentReports || 0),
          recentAuditEvents: Number(json?.summary?.recentAuditEvents || 0),
        });
      } catch (nextError) {
        if (!mounted) return;
        setSummary(null);
        setError(nextError instanceof Error ? nextError.message : "Failed to load reports summary");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void fetchSummary();

    return () => {
      mounted = false;
    };
  }, []);

  const cards = useMemo(
    () => [
      {
        title: "Countable Customers",
        value: loading ? null : summary?.totalCustomers ?? null,
        description: "Launch-facing customers excluding internal/demo identities.",
        icon: Users,
      },
      {
        title: "Countable Vendors",
        value: loading ? null : summary?.totalVendors ?? null,
        description: "Public-facing vendors eligible for launch operations.",
        icon: ShieldCheck,
      },
      {
        title: "Public Review Base",
        value: loading ? null : summary?.totalReviews ?? null,
        description: "Approved launch-facing reviews currently counted in reports.",
        icon: ClipboardCheck,
      },
      {
        title: "Recent Audit Events",
        value: loading ? null : summary?.recentAuditEvents ?? null,
        description: "Persisted admin audit events recorded in the last 7 days.",
        icon: BarChart3,
      },
    ],
    [loading, summary]
  );

  const shortcutLinks = [
    {
      href: "/admin/dashboard",
      label: "Open Admin Dashboard",
      description: "Return to the admin overview and quick actions.",
      icon: LayoutDashboard,
    },
    {
      href: "/admin/reviews",
      label: "Open Review Moderation",
      description: "Handle customer review approvals and rejections.",
      icon: ClipboardCheck,
    },
    {
      href: "/admin/media-moderation",
      label: "Open Media Moderation",
      description: "Review pending service-video packages.",
      icon: Video,
    },
    {
      href: "/admin/reported-content",
      label: "Open Reported Content",
      description: "Work active reported-content cases.",
      icon: FileWarning,
    },
    {
      href: "/admin/activity",
      label: "Open Activity Monitoring",
      description: "Monitor AI runs, feedback, and operator events.",
      icon: BarChart3,
    },
    {
      href: "/admin/audit-logs",
      label: "Open Audit Logs",
      description: "Inspect persisted audit events and operational history.",
      icon: ShieldAlert,
    },
    {
      href: "/admin/review-audit",
      label: "Open Review Audit",
      description: "Inspect consent, sentiment, and review-window history.",
      icon: ListChecks,
    },
  ] as const;

  return (
    <div className="space-y-6 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Reports &amp; Analytics</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Launch-facing reporting snapshot built from live moderation, review, and account data.
          This page avoids fake charts and only shows metrics the current platform can support honestly.
        </p>
      </div>

      {temporarilyUnavailable ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle>Reports are temporarily unavailable</CardTitle>
            <CardDescription>
              Reliance could not reach the service database during this admin reports check.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-amber-950">
            <p>
              The reporting overview could not finish loading because the database connection
              temporarily failed. Use the admin shortcuts below once the connection stabilizes.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle>Reports could not be loaded</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!temporarilyUnavailable && !error ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ title, value, description, icon: Icon }) => (
              <Card key={title}>
                <CardHeader className="pb-3">
                  <CardDescription>{title}</CardDescription>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <Icon className="h-5 w-5 text-primary" />
                    {formatCount(value)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  {description}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-primary" />
                  Moderation Backlog
                </CardTitle>
                <CardDescription>
                  Current queues that still need operator attention.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <div className="text-sm font-medium text-slate-900">Pending review moderation</div>
                    <div className="text-sm text-muted-foreground">
                      Customer reviews waiting on admin decision.
                    </div>
                  </div>
                  <Badge variant="secondary">{formatCount(summary?.pendingReviewModeration ?? null)}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <div className="text-sm font-medium text-slate-900">Pending video packages</div>
                    <div className="text-sm text-muted-foreground">
                      Ready-for-review video packages currently visible in the moderation queue.
                    </div>
                  </div>
                  <Badge variant="secondary">{formatCount(summary?.pendingMediaPackages ?? null)}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <div className="text-sm font-medium text-slate-900">Open reported-content cases</div>
                    <div className="text-sm text-muted-foreground">
                      Reports still open, triaged, or under review.
                    </div>
                  </div>
                  <Badge variant="secondary">{formatCount(summary?.openContentReports ?? null)}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileWarning className="h-5 w-5 text-primary" />
                  Review Pipeline
                </CardTitle>
                <CardDescription>
                  Current launch-facing activity across review collection and moderation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4">
                  <div className="text-sm font-medium text-slate-900">Review opportunities created in the last 30 days</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">
                    {formatCount(summary?.reviewWindowsLast30Days ?? null)}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Launch-facing review invitations created from completed customer-visible workflows.
                  </div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                  These counts intentionally exclude internal/demo identities like Sparkle and owner-linked records.
                  Use moderation queues and audit logs for row-level investigation when totals look lower than raw DB activity.
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Operator Shortcuts</CardTitle>
          <CardDescription>
            Jump directly to the admin tools that back the metrics above.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shortcutLinks.map(({ href, label, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-lg border bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Icon className="h-4 w-4 text-primary" />
                    {label}
                  </div>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <ArrowRight className="mt-0.5 h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
