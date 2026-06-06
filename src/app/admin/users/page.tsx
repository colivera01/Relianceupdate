import Link from "next/link";
import { headers } from "next/headers";
import { MailCheck, ShieldCheck, UserCheck, Users } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { countableUserWhere } from "@/lib/metrics-exclusion";
import { prisma } from "@/server/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type UsersPageProps = {
  searchParams?: Promise<{
    q?: string | string[];
  }>;
};

function normalizeSearchValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

function formatDate(date: Date | null | undefined) {
  if (!date) return "Not available";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function buildUserSearchWhere(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return countableUserWhere();

  return countableUserWhere({
    OR: [
      { id: { contains: trimmed } },
      { name: { contains: trimmed } },
      { email: { contains: trimmed } },
      { phone: { contains: trimmed } },
      { city: { contains: trimmed } },
      { state: { contains: trimmed } },
      { zipCode: { contains: trimmed } },
    ],
  });
}

function verificationPendingWhere() {
  return countableUserWhere({
    OR: [
      { authCredential: { is: null } },
      { authCredential: { is: { emailVerifiedAt: null } } },
    ],
  });
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const resolvedSearchParams = (await searchParams) || {};
  const query = normalizeSearchValue(resolvedSearchParams.q);
  const requestHeaders = await headers();

  await requireAdmin(
    new Request("http://localhost/admin/users", {
      headers: requestHeaders,
    })
  );

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const usersWhere = buildUserSearchWhere(query);

  const [totalCustomers, verifiedCustomers, pendingVerification, newThisMonth, users] =
    await Promise.all([
      prisma.user.count({ where: countableUserWhere() }),
      prisma.user.count({
        where: countableUserWhere({
          authCredential: {
            is: {
              emailVerifiedAt: {
                not: null,
              },
            },
          },
        }),
      }),
      prisma.user.count({ where: verificationPendingWhere() }),
      prisma.user.count({
        where: countableUserWhere({
          createdAt: {
            gte: startOfMonth,
          },
        }),
      }),
      prisma.user.findMany({
        where: usersWhere,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          city: true,
          state: true,
          zipCode: true,
          accountStatus: true,
          createdAt: true,
          authCredential: {
            select: {
              emailVerifiedAt: true,
            },
          },
          _count: {
            select: {
              bookings: true,
              reviews: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
    ]);

  return (
    <div className="space-y-6 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Customer Overview</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Launch-facing customers only. Internal, demo, and owner-linked records stay
          out of this view so admin counts and customer checks match the real platform story.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Countable Customers</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <Users className="h-6 w-6 text-primary" />
              {totalCustomers}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Verified Emails</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <MailCheck className="h-6 w-6 text-primary" />
              {verifiedCustomers}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Pending Verification</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <ShieldCheck className="h-6 w-6 text-primary" />
              {pendingVerification}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>New This Month</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <UserCheck className="h-6 w-6 text-primary" />
              {newThisMonth}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Customers</CardTitle>
          <CardDescription>
            Search by name, email, phone, city, state, zip, or customer id.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-col gap-3 md:flex-row" method="get">
            <Input
              defaultValue={query}
              name="q"
              placeholder="Search customers..."
              className="md:max-w-xl"
            />
            <div className="flex gap-3">
              <Button type="submit">Apply Search</Button>
              <Button asChild type="button" variant="outline">
                <Link href="/admin/users">Clear</Link>
              </Button>
            </div>
          </form>
          <div className="rounded-lg border bg-slate-50 px-4 py-3 text-sm text-slate-700">
            This view is read-only. Use <Link href="/admin/vendors" className="font-medium text-primary underline underline-offset-4">Vendor Management</Link>{" "}
            for account actions that are already fully wired into the admin workflow.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {query ? `Customer Results (${users.length})` : "Recent Customers"}
          </CardTitle>
          <CardDescription>
            Showing up to 25 launch-facing customer records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
              No launch-facing customers matched this search.
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => {
                const location = [user.city, user.state].filter(Boolean).join(", ");
                return (
                  <div
                    key={user.id}
                    className="rounded-lg border bg-white px-4 py-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold">
                            {user.name || "Unnamed customer"}
                          </h3>
                          <Badge variant="outline">{user.accountStatus || "active"}</Badge>
                          <Badge
                            variant={
                              user.authCredential?.emailVerifiedAt ? "success" : "secondary"
                            }
                          >
                            {user.authCredential?.emailVerifiedAt
                              ? "email verified"
                              : "verification pending"}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <div>{user.email || "No email on file"}</div>
                          <div>{user.phone || "No phone on file"}</div>
                          <div>{location || user.zipCode || "Location not recorded"}</div>
                        </div>
                      </div>
                      <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:min-w-[280px]">
                        <div>
                          <div className="font-medium text-slate-900">Customer ID</div>
                          <div className="break-all text-muted-foreground">{user.id}</div>
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">Joined</div>
                          <div className="text-muted-foreground">
                            {formatDate(user.createdAt)}
                          </div>
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">Bookings</div>
                          <div className="text-muted-foreground">{user._count.bookings}</div>
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">Reviews</div>
                          <div className="text-muted-foreground">{user._count.reviews}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
