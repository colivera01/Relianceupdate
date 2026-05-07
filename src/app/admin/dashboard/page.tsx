"use client";
import Link from "next/link";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";

// Admin overview surface.
//
// Live metrics endpoints are not yet wired (no /api/admin/stats route),
// so this page intentionally avoids fabricated production numbers.
// Once a counts endpoint exists, the placeholder cards below should be
// replaced with real values.

type AdminQuickLink = {
  href: string;
  label: string;
  description: string;
  icon: string;
};

const quickLinks: AdminQuickLink[] = [
  {
    href: "/admin/users",
    label: "User Management",
    description: "Review, edit, and approve user accounts.",
    icon: "👥",
  },
  {
    href: "/admin/vendors",
    label: "Vendor Management",
    description: "Approve vendors and manage business profiles.",
    icon: "🏢",
  },
  {
    href: "/admin/publish-management",
    label: "Publish Management",
    description: "Control public visibility of vendors and services.",
    icon: "📢",
  },
  {
    href: "/admin/media-moderation",
    label: "Media Moderation",
    description: "Approve or block customer-visible proof media.",
    icon: "🎬",
  },
  {
    href: "/admin/reviews",
    label: "Review Moderation",
    description: "Audit and moderate customer reviews.",
    icon: "⭐",
  },
  {
    href: "/admin/audit-logs",
    label: "Audit Logs",
    description: "Inspect admin and moderation actions.",
    icon: "📋",
  },
];

const placeholderMetrics: Array<{ title: string; helper: string }> = [
  { title: "Total Users", helper: "Live count not connected yet." },
  { title: "Total Vendors", helper: "Live count not connected yet." },
  { title: "Total Reviews", helper: "Live count not connected yet." },
  { title: "Pending Moderation", helper: "Live count not connected yet." },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-[#204080]">Admin Overview</h1>
        <p className="text-sm text-gray-600">
          Operational console for moderation, publishing, and account
          management. Live aggregate metrics will appear here once the
          dedicated counts endpoint is wired.
        </p>
      </header>

      <section
        aria-label="Platform metrics"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {placeholderMetrics.map((metric) => (
          <Card key={metric.title} className="bg-white">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-700">
                {metric.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-300 leading-none">—</div>
              <div className="mt-2 text-xs text-gray-500">{metric.helper}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section aria-label="Quick links" className="space-y-4">
        <h2 className="text-lg font-semibold text-[#204080]">Quick actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group block rounded-xl border border-gray-200 bg-white p-5 transition-colors hover:border-[#204080] hover:bg-[#f5f8fc]"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none" aria-hidden>
                  {link.icon}
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-[#204080]">
                    {link.label}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {link.description}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
