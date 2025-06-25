"use client";
import { useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export default function AdminSettingsPage() {
  // Mock state
  const [settings, setSettings] = useState({
    notifyNewUser: true,
    notifyFlaggedReview: false,
    weeklySummary: true,
    alertVendorDeactivation: true,
    alertFailedLogins: true,
    minPasswordLength: 8,
    requireUppercase: false,
    requireNumbers: false,
    passwordExpiryDays: 90,
    enable2FA: false,
    theme: "light",
    fontSize: "normal",
    autoApproveVendors: false,
    enablePaidFeatures: false,
    paymentMethod: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveError, setSaveError] = useState("");

  // Handlers
  const handleSave = () => {
    setSaving(true);
    setSaveStatus("idle");
    setSaveError("");
    setTimeout(() => {
      // Simulate error if payment method is empty but paid features enabled
      if (settings.enablePaidFeatures && !settings.paymentMethod) {
        setSaveStatus("error");
        setSaveError("Payment method required for paid features.");
        setSaving(false);
        return;
      }
      setSaveStatus("success");
      setSaving(false);
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 1000);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <h2 className="text-2xl font-bold mb-2">Settings</h2>
      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="font-semibold">Notifications</label>
            <Checkbox checked={settings.notifyNewUser} onCheckedChange={v => setSettings(s => ({ ...s, notifyNewUser: !!v }))} /> Notify on new user
            <Checkbox checked={settings.notifyFlaggedReview} onCheckedChange={v => setSettings(s => ({ ...s, notifyFlaggedReview: !!v }))} /> Notify on flagged review
            <Checkbox checked={settings.weeklySummary} onCheckedChange={v => setSettings(s => ({ ...s, weeklySummary: !!v }))} /> Send weekly summary
            <Checkbox checked={settings.alertVendorDeactivation} onCheckedChange={v => setSettings(s => ({ ...s, alertVendorDeactivation: !!v }))} /> Vendor deactivation alerts
            <Checkbox checked={settings.alertFailedLogins} onCheckedChange={v => setSettings(s => ({ ...s, alertFailedLogins: !!v }))} /> Failed login alerts
          </div>
          <div className="flex flex-col gap-2 mt-4">
            <label className="font-semibold">Password & Security</label>
            <label>Min Password Length</label>
            <Input type="number" value={settings.minPasswordLength} onChange={e => setSettings(s => ({ ...s, minPasswordLength: Number(e.target.value) }))} className="w-24" />
            <Checkbox checked={settings.requireUppercase} onCheckedChange={v => setSettings(s => ({ ...s, requireUppercase: !!v }))} /> Require Uppercase
            <Checkbox checked={settings.requireNumbers} onCheckedChange={v => setSettings(s => ({ ...s, requireNumbers: !!v }))} /> Require Numbers
            <label>Password Expiry (days)</label>
            <Input type="number" value={settings.passwordExpiryDays} onChange={e => setSettings(s => ({ ...s, passwordExpiryDays: Number(e.target.value) }))} className="w-24" />
            <Checkbox checked={settings.enable2FA} onCheckedChange={v => setSettings(s => ({ ...s, enable2FA: !!v }))} /> Enable 2FA
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label>Theme</label>
          <select className="border rounded px-2 py-1 text-sm" value={settings.theme} onChange={e => setSettings(s => ({ ...s, theme: e.target.value }))}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <label>Font Size</label>
          <select className="border rounded px-2 py-1 text-sm" value={settings.fontSize} onChange={e => setSettings(s => ({ ...s, fontSize: e.target.value }))}>
            <option value="small">Small</option>
            <option value="normal">Normal</option>
            <option value="large">Large</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Checkbox checked={settings.autoApproveVendors} onCheckedChange={v => setSettings(s => ({ ...s, autoApproveVendors: !!v }))} /> Automatically approve vendor applications
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Checkbox checked={settings.enablePaidFeatures} onCheckedChange={v => setSettings(s => ({ ...s, enablePaidFeatures: !!v }))} /> Enable paid features
          {settings.enablePaidFeatures && (
            <Input placeholder="Payment Method" value={settings.paymentMethod} onChange={e => setSettings(s => ({ ...s, paymentMethod: e.target.value }))} />
          )}
        </CardContent>
      </Card>

      <div className="pt-4">
        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
        {saveStatus === "success" && <span className="ml-3 text-green-600 text-sm">Saved ✓</span>}
        {saveStatus === "error" && <span className="ml-3 text-red-600 text-sm">{saveError}</span>}
      </div>

      {/* Developer Notes for Backend Integration */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">📋 Developer Notes</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <p><strong>Endpoints Needed:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><code>GET /api/settings</code> - Fetch admin settings</li>
            <li><code>PATCH /api/settings</code> - Update settings</li>
          </ul>
          <p><strong>Expected format:</strong> <code>{`{ notifyNewUser, notifyFlaggedReview, weeklySummary, alertVendorDeactivation, alertFailedLogins, minPasswordLength, requireUppercase, requireNumbers, passwordExpiryDays, enable2FA, theme, fontSize, autoApproveVendors, enablePaidFeatures, paymentMethod }`}</code></p>
          <p className="mt-2"><strong>Current Mock Data:</strong> Shows realistic admin settings for reference</p>
        </div>
      </div>
    </div>
  );
} 