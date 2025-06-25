import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import { Info } from "lucide-react";

export default function Settings() {
  const [displayName, setDisplayName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [passwordOld, setPasswordOld] = useState<string>("");
  const [passwordNew, setPasswordNew] = useState<string>("");
  const [passwordConfirm, setPasswordConfirm] = useState<string>("");

  const [minPasswordLength, setMinPasswordLength] = useState<number>(8);
  const [requireUppercase, setRequireUppercase] = useState<boolean>(false);
  const [requireNumbers, setRequireNumbers] = useState<boolean>(false);
  const [passwordExpiryDays, setPasswordExpiryDays] = useState<number>(90);
  const [lockoutThreshold, setLockoutThreshold] = useState<number>(5);
  const [lockoutDuration, setLockoutDuration] = useState<number>(30);
  const [autoApproveVendors, setAutoApproveVendors] = useState<boolean>(false);

  const [notifyNewUser, setNotifyNewUser] = useState<boolean>(false);
  const [notifyFlaggedReview, setNotifyFlaggedReview] = useState<boolean>(false);
  const [weeklySummary, setWeeklySummary] = useState<boolean>(false);
  const [alertVendorDeactivation, setAlertVendorDeactivation] = useState<boolean>(false);
  const [alertFailedLogins, setAlertFailedLogins] = useState<boolean>(false);
  const [auditLogAccess, setAuditLogAccess] = useState<boolean>(true);

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [fontSize, setFontSize] = useState<"small" | "normal" | "large">("normal");

  const [enablePaidFeatures, setEnablePaidFeatures] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("");

  const [enable2FA, setEnable2FA] = useState<boolean>(false);
  const [publicProfile, setPublicProfile] = useState<boolean>(true);
  const [autoLogoutMinutes, setAutoLogoutMinutes] = useState<number>(30);

  const [loading, setLoading] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    setDisplayName("Admin User");
    setEmail("admin@example.com");
    setMinPasswordLength(8);
    setRequireUppercase(false);
    setRequireNumbers(false);
    setPasswordExpiryDays(90);
    setLockoutThreshold(5);
    setLockoutDuration(30);
    setAutoApproveVendors(false);
    setNotifyNewUser(true);
    setNotifyFlaggedReview(false);
    setWeeklySummary(true);
    setAlertVendorDeactivation(true);
    setAlertFailedLogins(true);
    setAuditLogAccess(true);
    setTheme("dark");
    setFontSize("normal");
    setEnablePaidFeatures(false);
    setPaymentMethod("");
    setEnable2FA(false);
    setPublicProfile(true);
    setAutoLogoutMinutes(30);
  }, []);

  const saveSettings = async () => {
    setSaveStatus("saving");
    setErrorMessage("");
    setLoading(true);

    if (passwordNew && passwordNew !== passwordConfirm) {
      setSaveStatus("error");
      setErrorMessage("New passwords do not match");
      setLoading(false);
      return;
    }

    try {
      await new Promise((resolve) => setTimeout(resolve, 700));
      setSaveStatus("success");
    } catch (err: any) {
      setSaveStatus("error");
      setErrorMessage(err.message || "Unknown error");
    } finally {
      setLoading(false);
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  };

  const InfoIcon = ({ tooltip }: { tooltip: string }) => (
    <span className="ml-2 text-gray-400 cursor-pointer" title={tooltip}>
      <Info className="inline w-4 h-4" />
    </span>
  );

  return (
    <div className="p-6 space-y-6 relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-50">
          <span className="text-gray-700">Saving...</span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Settings</h2>
        {saveStatus === "success" && <Badge variant="default">Saved ✓</Badge>}
        {saveStatus === "error" && <Badge variant="destructive">Error: {errorMessage}</Badge>}
      </div>

      <Card>
        <CardHeader><CardTitle>Account Management Defaults</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="block text-sm font-medium">Minimum Password Length</label>
          <Input type="number" value={minPasswordLength} onChange={(e) => setMinPasswordLength(Number(e.target.value))} className="w-24" />
          <div className="flex items-center space-x-2">
            <Checkbox id="uppercase" checked={requireUppercase} onCheckedChange={(v) => setRequireUppercase(!!v)} />
            <label htmlFor="uppercase">Require Uppercase Letters</label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="numbers" checked={requireNumbers} onCheckedChange={(v) => setRequireNumbers(!!v)} />
            <label htmlFor="numbers">Require Numbers</label>
          </div>
          <label className="block text-sm font-medium">Password Expiry (days)</label>
          <Input type="number" value={passwordExpiryDays} onChange={(e) => setPasswordExpiryDays(Number(e.target.value))} className="w-24" />
          <label className="block text-sm font-medium">Lockout Threshold (attempts)</label>
          <Input type="number" value={lockoutThreshold} onChange={(e) => setLockoutThreshold(Number(e.target.value))} className="w-24" />
          <label className="block text-sm font-medium">Lockout Duration (minutes)</label>
          <Input type="number" value={lockoutDuration} onChange={(e) => setLockoutDuration(Number(e.target.value))} className="w-24" />
          <div className="flex items-center space-x-2">
            <Checkbox checked={autoApproveVendors} onCheckedChange={(v) => setAutoApproveVendors(!!v)} />
            <InfoIcon tooltip="Automatically approves vendor applications without manual review." />
            <label>Automatically Approve Vendors</label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>User Info</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Display Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="password" placeholder="Old Password" value={passwordOld} onChange={(e) => setPasswordOld(e.target.value)} />
          <Input type="password" placeholder="New Password" value={passwordNew} onChange={(e) => setPasswordNew(e.target.value)} />
          <Input type="password" placeholder="Confirm New Password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Checkbox checked={notifyNewUser} onCheckedChange={(v) => setNotifyNewUser(!!v)} /> Notify on new user <InfoIcon tooltip="Receive alerts when a new user registers." /><br />
          <Checkbox checked={notifyFlaggedReview} onCheckedChange={(v) => setNotifyFlaggedReview(!!v)} /> Notify on flagged review <InfoIcon tooltip="Be alerted when a review is flagged." /><br />
          <Checkbox checked={weeklySummary} onCheckedChange={(v) => setWeeklySummary(!!v)} /> Send weekly summary <InfoIcon tooltip="Get a weekly digest of key activity." /><br />
          <Checkbox checked={alertVendorDeactivation} onCheckedChange={(v) => setAlertVendorDeactivation(!!v)} /> Vendor deactivation alerts <InfoIcon tooltip="Alert when vendors are deactivated." /><br />
          <Checkbox checked={alertFailedLogins} onCheckedChange={(v) => setAlertFailedLogins(!!v)} /> Failed login alerts <InfoIcon tooltip="Notify on failed login attempts." /><br />
          <Checkbox checked={auditLogAccess} onCheckedChange={(v) => setAuditLogAccess(!!v)} /> Access to audit logs <InfoIcon tooltip="Allow access to platform audit records." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <label className="block text-sm font-medium">Theme</label>
          <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark")}> 
            <SelectTrigger>{theme}</SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
          <label className="block text-sm font-medium">Font Size</label>
          <Select value={fontSize} onValueChange={(v) => setFontSize(v as "small" | "normal" | "large")}> 
            <SelectTrigger>{fontSize}</SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Billing</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Checkbox checked={enablePaidFeatures} onCheckedChange={(v) => setEnablePaidFeatures(!!v)} /> Enable paid features <InfoIcon tooltip="Activates premium billing and subscriptions." />
          {enablePaidFeatures && (
            <Input placeholder="Payment Method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Security</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Checkbox checked={enable2FA} onCheckedChange={(v) => setEnable2FA(!!v)} /> Enable 2FA <InfoIcon tooltip="Adds two-factor authentication for extra security." /><br />
          <Checkbox checked={publicProfile} onCheckedChange={(v) => setPublicProfile(!!v)} /> Public profile <InfoIcon tooltip="Control visibility of your public profile." /><br />
          <label className="block text-sm font-medium">Auto-logout after (minutes)</label><InfoIcon tooltip="Automatically logs out users after inactivity." />
          <Input type="number" value={autoLogoutMinutes} onChange={(e) => setAutoLogoutMinutes(Number(e.target.value))} className="w-24" />
        </CardContent>
      </Card>

      <div className="pt-4">
        <Button onClick={saveSettings}>Save Settings</Button>
      </div>
    </div>
  );
} 