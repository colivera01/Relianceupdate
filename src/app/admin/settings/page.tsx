import Link from "next/link";
import { headers } from "next/headers";
import { CheckCircle2, Mail, Shield, Smartphone, Sparkles, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { readAdminAccess } from "@/lib/admin-auth";
import { HAS_LAUNCH_SUPPORT_EMAIL, LAUNCH_SUPPORT_EMAIL } from "@/lib/support";
import { readNotificationEnv } from "@/lib/env/notification-config";
import { readAiRolloutStatus } from "@/lib/ai/rollout-status";
import { readAiPromptCatalog } from "@/lib/ai/prompt-registry";

function statusBadge(enabled: boolean, enabledLabel = "Active", disabledLabel = "Needs setup") {
  return enabled ? (
    <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">{enabledLabel}</Badge>
  ) : (
    <Badge variant="secondary">{disabledLabel}</Badge>
  );
}

function formatOptional(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  return normalized || "Not configured";
}

export default async function AdminSettingsPage() {
  const requestHeaders = await headers();
  const adminAccess = await readAdminAccess(
    new Request("http://localhost/admin/settings", {
      headers: requestHeaders,
    })
  );
  if (!adminAccess.isAdmin) {
    return (
      <div className="space-y-6 py-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Admin Settings</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Read-only launch configuration overview for security, notifications, AI rollout, and
            external-link readiness.
          </p>
        </div>

        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle>Admin access required</CardTitle>
            <CardDescription>
              Sign in with an admin-capable account to view this launch-readiness console.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              This page shows live configuration for sign-in protection, delivery setup, AI rollout,
              and external-link readiness. It only renders full details for signed-in admins.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/auth/login?next=/admin/settings" className="font-medium text-blue-600 underline">
                Sign in
              </Link>
              <Link href="/admin/dashboard" className="font-medium text-blue-600 underline">
                Back to Dashboard
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const notificationEnv = readNotificationEnv();
  const publicBaseUrl = notificationEnv.appBaseUrl;
  const publicBaseUrlConfigured = Boolean(publicBaseUrl);
  const publicBaseUrlReachable = publicBaseUrlConfigured && !/localhost|127\.0\.0\.1/i.test(publicBaseUrl);
  const emailDeliveryReady =
    notificationEnv.emailEnabled &&
    Boolean(notificationEnv.resendApiKey) &&
    Boolean(notificationEnv.emailFrom);
  const smsDeliveryReady =
    notificationEnv.smsEnabled &&
    (notificationEnv.smsProvider === "telnyx"
      ? Boolean(notificationEnv.telnyxApiKey) && Boolean(notificationEnv.telnyxFromNumber)
      : Boolean(notificationEnv.twilioAccountSid) &&
        Boolean(notificationEnv.twilioAuthToken) &&
        (Boolean(notificationEnv.twilioMessagingServiceSid) || Boolean(notificationEnv.twilioPhoneNumber)));
  const smsSenderLabel =
    notificationEnv.smsProvider === "telnyx"
      ? `Telnyx sender: ${formatOptional(notificationEnv.telnyxFromNumber)}`
      : notificationEnv.twilioMessagingServiceSid
        ? "Twilio 10DLC Messaging Service configured"
        : `Twilio phone sender: ${formatOptional(notificationEnv.twilioPhoneNumber)}`;
  const aiRollout = readAiRolloutStatus();
  const aiPromptCatalog = readAiPromptCatalog();

  return (
    <div className="space-y-6 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Admin Settings</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Read-only launch configuration overview for security, notifications, and external-link readiness.
          This page is meant to reduce guesswork, not pretend there is a full settings console already.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Customer Email Verification</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Mail className="h-5 w-5 text-primary" />
              Active
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">
            Booking creation, review submission, vendor registration, and promotion requests now require
            a verified email unless the account is an internal dev audit identity.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Vendor/Admin Sign-In Protection</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Shield className="h-5 w-5 text-primary" />
              MFA + Passkeys
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">
            Vendor and admin-capable accounts use email-code MFA, trusted devices, and optional passkeys.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Notification Delivery</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              {emailDeliveryReady ? "Email Ready" : "Email Needs Setup"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">
            Email delivery depends on Resend plus a valid sender. SMS uses the configured provider
            ({notificationEnv.smsProvider}) once sender credentials are complete.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Phone Pairing Links</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Smartphone className="h-5 w-5 text-primary" />
              {publicBaseUrlReachable ? "Public" : "Local Only"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">
            Device invite links are only truly phone-ready when `APP_BASE_URL` points to a real reachable URL.
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Security posture</CardTitle>
            <CardDescription>
              Live sign-in protections currently active in this launch environment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div>
                <div className="font-medium text-slate-900">Customer email verification</div>
                <div className="text-muted-foreground">
                  Sensitive customer actions are blocked until the account email is verified.
                </div>
              </div>
              {statusBadge(true)}
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div>
                <div className="font-medium text-slate-900">Vendor/admin email-code MFA</div>
                <div className="text-muted-foreground">
                  Admin and vendor-capable accounts require a sign-in code unless a trusted device is remembered.
                </div>
              </div>
              {statusBadge(true)}
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div>
                <div className="font-medium text-slate-900">Passkey enrollment</div>
                <div className="text-muted-foreground">
                  Passkeys are available through Secure Account for admin, vendor, and supported customer flows.
                </div>
              </div>
              {statusBadge(true, "Available", "Not available")}
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div>
                <div className="font-medium text-slate-900">Remembered devices</div>
                <div className="text-muted-foreground">
                  Trusted devices can skip MFA for 30 days until revoked or signed out.
                </div>
              </div>
              {statusBadge(true)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notification and launch readiness</CardTitle>
            <CardDescription>
              Current environment setup that affects customer-facing links and support paths.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div>
                <div className="font-medium text-slate-900">Launch support inbox</div>
                <div className="text-muted-foreground">
                  Current public support contact: {HAS_LAUNCH_SUPPORT_EMAIL ? LAUNCH_SUPPORT_EMAIL : "Not published yet"}
                </div>
              </div>
              {statusBadge(HAS_LAUNCH_SUPPORT_EMAIL, "Published", "Not published")}
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div>
                <div className="font-medium text-slate-900">Email delivery</div>
                <div className="text-muted-foreground">
                  Sender: {formatOptional(notificationEnv.emailFrom)}
                </div>
              </div>
              {statusBadge(emailDeliveryReady, "Ready", "Needs setup")}
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div>
                <div className="font-medium text-slate-900">SMS delivery</div>
                <div className="text-muted-foreground">
                  {smsSenderLabel}
                </div>
              </div>
              {statusBadge(smsDeliveryReady, "Ready", "Needs setup")}
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div>
                <div className="font-medium text-slate-900">External link base URL</div>
                <div className="text-muted-foreground">
                  {publicBaseUrlConfigured ? publicBaseUrl : "APP_BASE_URL not configured"}
                </div>
              </div>
              {statusBadge(publicBaseUrlReachable, "Phone-ready", publicBaseUrlConfigured ? "Local only" : "Needs setup")}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI rollout control point
          </CardTitle>
          <CardDescription>
            Current AI platform state, enabled Reliance AI tools, and the release gate required
            before prompt or model changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                OpenAI platform
              </div>
              <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-slate-900">
                {aiRollout.platformEnabled ? "Enabled" : "Disabled"}
              </div>
              <div className="mt-1 text-muted-foreground">
                Project configured: {aiRollout.projectConfigured ? "Yes" : "No"}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Active AI tools
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-900">
                {aiRollout.enabledFeatureCount}
              </div>
              <div className="mt-1 text-muted-foreground">
                Recommendation-only surfaces currently enabled
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Audit logging
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-900">
                {aiRollout.auditLoggingEnabled ? "On" : "Off"}
              </div>
              <div className="mt-1 text-muted-foreground">
                Timeout: {aiRollout.timeoutMs}ms - Retries: {aiRollout.maxRetries}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Default model
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-900">
                {aiRollout.defaultModel}
              </div>
              <div className="mt-1 text-muted-foreground">
                API key configured: {aiRollout.apiKeyConfigured ? "Yes" : "No"}
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium text-slate-900">Enabled feature map</div>
            <div className="mt-3 space-y-3">
              {aiRollout.featureStatuses.map((feature) => (
                <div
                  key={feature.feature}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-dashed p-3"
                >
                  <div>
                    <div className="font-medium text-slate-900">{feature.label}</div>
                    <div className="text-muted-foreground">Model: {feature.model}</div>
                  </div>
                  {statusBadge(feature.enabled, "Enabled", "Disabled")}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium text-slate-900">Prompt and decision inventory</div>
            <div className="mt-3 space-y-3">
              {aiPromptCatalog.map((entry) => (
                <div
                  key={entry.feature}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-dashed p-3"
                >
                  <div className="space-y-1">
                    <div className="font-medium text-slate-900">{entry.label}</div>
                    <div className="text-muted-foreground">
                      Operation: <code>{entry.operation}</code>
                    </div>
                    <div className="text-muted-foreground">
                      Surface: <code>{entry.adminSurface}</code>
                    </div>
                    <div className="text-muted-foreground">{entry.notes}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {statusBadge(entry.scope === "ai_assistant", "AI prompt", "Deterministic")}
                    <div className="text-right text-xs text-muted-foreground">
                      {entry.promptVersion ? (
                        <>
                          Prompt version: <code>{entry.promptVersion}</code>
                        </>
                      ) : (
                        <>Prompt version: Not applicable</>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium text-slate-900">Required change discipline</div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
              <li>Do not change Trust Score math through AI prompts or model updates.</li>
              <li>Do not expand AI scope without reviewing the admin activity AI reporting view.</li>
              <li>
                Run <code>npm run test:ai:gate</code> before any prompt, model, schema, or rollout-scope
                change.
              </li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/admin/activity" className="font-medium text-blue-600 underline">
                Open AI Activity Monitoring
              </Link>
              <Link href="/admin/reports" className="font-medium text-blue-600 underline">
                Open Reports &amp; Analytics
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={!publicBaseUrlReachable || !HAS_LAUNCH_SUPPORT_EMAIL ? "border-amber-200 bg-amber-50" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-primary" />
            Current launch follow-ups
          </CardTitle>
          <CardDescription>
            Settings that still affect the polish of live operator and customer flows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            {!publicBaseUrlReachable ? (
              <li>
                Phone pairing invites are still local-only until <code>APP_BASE_URL</code> points to a
                reachable staging, tunnel, or production URL.
              </li>
            ) : null}
            {!HAS_LAUNCH_SUPPORT_EMAIL ? (
              <li>
                Public help and contact pages still show “support inbox not published yet” until a dedicated
                launch support email is configured.
              </li>
            ) : null}
            {!smsDeliveryReady ? (
              <li>
                SMS delivery remains source-ready but not launch-ready until the provider credentials are fully configured.
              </li>
            ) : null}
            {publicBaseUrlReachable && HAS_LAUNCH_SUPPORT_EMAIL && smsDeliveryReady ? (
              <li>External communications are configured for broader launch use.</li>
            ) : null}
          </ul>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/security" className="font-medium text-blue-600 underline">
              Open Admin Security
            </Link>
            <Link href="/admin/reports" className="font-medium text-blue-600 underline">
              Open Reports &amp; Analytics
            </Link>
            <Link href="/admin/dashboard" className="font-medium text-blue-600 underline">
              Back to Dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
