"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AdminAccessRequired() {
  const pathname = usePathname() || "/admin/dashboard";
  const searchParams = useSearchParams();
  const query = searchParams?.toString() || "";
  const nextPath = `${pathname}${query ? `?${query}` : ""}`;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-12">
        <Card className="w-full border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle>Admin access required</CardTitle>
            <CardDescription>
              Sign in with an admin-capable account to open the Reliance admin console.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Admin routes include moderation, launch-readiness settings, reporting, vendor controls,
              and other internal operator tools. They are intentionally hidden until an admin session is active.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href={`/auth/login?next=${encodeURIComponent(nextPath)}`} className="font-medium text-blue-600 underline">
                Sign in
              </Link>
              <Link href="/" className="font-medium text-blue-600 underline">Back to home</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
