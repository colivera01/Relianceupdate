import Link from "next/link";
import { headers } from "next/headers";
import { MailCheck, Shield, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/server/db";

function formatDate(date: Date | null | undefined) {
  if (!date) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default async function AdminProfilePage() {
  const requestHeaders = await headers();
  const { userId, role } = await requireAdmin(
    new Request("http://localhost/admin/profile", {
      headers: requestHeaders,
    })
  );

  const adminUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      city: true,
      state: true,
      accountStatus: true,
      createdAt: true,
      authCredential: {
        select: {
          emailVerifiedAt: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Admin Account</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Read-only admin account details and quick links to the live security and operations tools.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Access role</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Shield className="h-5 w-5 text-primary" />
              {role}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Email verification</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <MailCheck className="h-5 w-5 text-primary" />
              {adminUser?.authCredential?.emailVerifiedAt ? "Verified" : "Pending"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Account status</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <UserCog className="h-5 w-5 text-primary" />
              {adminUser?.accountStatus || "active"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
          <CardDescription>
            Review the current admin account details here, then use Admin Security for sign-in protection and recovery settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <div className="text-sm font-medium text-slate-900">Name</div>
            <div className="text-sm text-muted-foreground">
              {adminUser?.name || "Not recorded"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-slate-900">Email</div>
            <div className="text-sm text-muted-foreground">
              {adminUser?.email || "Not recorded"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-slate-900">Phone</div>
            <div className="text-sm text-muted-foreground">
              {adminUser?.phone || "Not recorded"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-slate-900">Location</div>
            <div className="text-sm text-muted-foreground">
              {[adminUser?.city, adminUser?.state].filter(Boolean).join(", ") || "Not recorded"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-slate-900">Admin ID</div>
            <div className="break-all text-sm text-muted-foreground">
              {adminUser?.id || userId}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-slate-900">Joined</div>
            <div className="text-sm text-muted-foreground">
              {formatDate(adminUser?.createdAt)}
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <div className="text-sm font-medium text-slate-900">Verification</div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={adminUser?.authCredential?.emailVerifiedAt ? "success" : "secondary"}
              >
                {adminUser?.authCredential?.emailVerifiedAt
                  ? "email verified"
                  : "verification pending"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {adminUser?.authCredential?.emailVerifiedAt
                  ? `Verified ${formatDate(adminUser.authCredential.emailVerifiedAt)}`
                  : "Verify this admin email before relying on email-based account recovery."}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin tools</CardTitle>
          <CardDescription>
            Use the live admin account and security surfaces below for your current access, security, and operator tools.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/admin/security">Open Admin Security</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/users">Open Customer Overview</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/dashboard">Back to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
