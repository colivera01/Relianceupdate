import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import { Info, User, Shield, Bell, Palette, CreditCard, Settings as SettingsIcon, Save, Eye, EyeOff, Lock, Key, AlertTriangle, CheckCircle, XCircle, Zap, Database, Globe, Smartphone, Monitor, Moon, Sun, Type, Volume2, VolumeX } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState<boolean>(false);

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
    <span className="ml-2 text-gray-400 cursor-pointer group relative" title={tooltip}>
      <Info className="inline w-4 h-4" />
      <span className="absolute left-6 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
        {tooltip}
      </span>
    </span>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6 space-y-6 relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-700 font-medium">Saving settings...</span>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <SettingsIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
            <p className="text-sm text-gray-600">Manage your account and system preferences</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === "success" && (
            <Badge className="bg-green-100 text-green-700 border-green-300">
              <CheckCircle className="w-4 h-4 mr-1" />
              Saved ✓
            </Badge>
          )}
          {saveStatus === "error" && (
            <Badge className="bg-red-100 text-red-700 border-red-300">
              <XCircle className="w-4 h-4 mr-1" />
              Error: {errorMessage}
            </Badge>
          )}
        </div>
      </div>

      {/* Account Management Card */}
      <Card className="bg-gradient-to-br from-white to-blue-50 border-blue-200 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-xl text-gray-800">Account Management</CardTitle>
              <p className="text-sm text-gray-600">Manage user accounts and authentication settings</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Minimum Password Length</label>
              <Input 
                type="number" 
                value={minPasswordLength} 
                onChange={(e) => setMinPasswordLength(Number(e.target.value))} 
                className="w-24 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Password Expiry (days)</label>
              <Input 
                type="number" 
                value={passwordExpiryDays} 
                onChange={(e) => setPasswordExpiryDays(Number(e.target.value))} 
                className="w-24 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Lockout Threshold (attempts)</label>
              <Input 
                type="number" 
                value={lockoutThreshold} 
                onChange={(e) => setLockoutThreshold(Number(e.target.value))} 
                className="w-24 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Lockout Duration (minutes)</label>
              <Input 
                type="number" 
                value={lockoutDuration} 
                onChange={(e) => setLockoutDuration(Number(e.target.value))} 
                className="w-24 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors cursor-pointer">
              <Checkbox 
                id="uppercase" 
                checked={requireUppercase} 
                onCheckedChange={(v) => setRequireUppercase(!!v)}
                className="text-blue-600"
              />
              <div>
                <div className="font-medium text-gray-800">Require Uppercase Letters</div>
                <div className="text-sm text-gray-600">Passwords must contain at least one uppercase letter</div>
              </div>
              <InfoIcon tooltip="Enforces stronger password requirements" />
            </label>
            
            <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors cursor-pointer">
              <Checkbox 
                id="numbers" 
                checked={requireNumbers} 
                onCheckedChange={(v) => setRequireNumbers(!!v)}
                className="text-blue-600"
              />
              <div>
                <div className="font-medium text-gray-800">Require Numbers</div>
                <div className="text-sm text-gray-600">Passwords must contain at least one number</div>
              </div>
              <InfoIcon tooltip="Enforces stronger password requirements" />
            </label>
            
            <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors cursor-pointer">
              <Checkbox 
                checked={autoApproveVendors} 
                onCheckedChange={(v) => setAutoApproveVendors(!!v)}
                className="text-blue-600"
              />
              <div>
                <div className="font-medium text-gray-800">Automatically Approve Vendors</div>
                <div className="text-sm text-gray-600">Skip manual review for vendor applications</div>
              </div>
              <InfoIcon tooltip="Automatically approves vendor applications without manual review." />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* User Info Card */}
      <Card className="bg-gradient-to-br from-white to-green-50 border-green-200 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <User className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-xl text-gray-800">User Information</CardTitle>
              <p className="text-sm text-gray-600">Update your personal account details</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Display Name</label>
              <Input 
                placeholder="Display Name" 
                value={displayName} 
                onChange={(e) => setDisplayName(e.target.value)}
                className="border-gray-300 focus:border-green-500 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Email Address</label>
              <Input 
                placeholder="Email" 
                type="email"
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="border-gray-300 focus:border-green-500 focus:ring-green-500"
              />
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Current Password</label>
              <Input 
                type="password" 
                placeholder="Current Password" 
                value={passwordOld} 
                onChange={(e) => setPasswordOld(e.target.value)}
                className="border-gray-300 focus:border-green-500 focus:ring-green-500"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">New Password</label>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"}
                    placeholder="New Password" 
                    value={passwordNew} 
                    onChange={(e) => setPasswordNew(e.target.value)}
                    className="border-gray-300 focus:border-green-500 focus:ring-green-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Confirm New Password</label>
                <Input 
                  type="password" 
                  placeholder="Confirm New Password" 
                  value={passwordConfirm} 
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="border-gray-300 focus:border-green-500 focus:ring-green-500"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications Card */}
      <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Bell className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-xl text-gray-800">Notification Preferences</CardTitle>
              <p className="text-sm text-gray-600">Configure your notification settings</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-200 hover:bg-purple-50 transition-colors cursor-pointer">
              <Checkbox 
                checked={notifyNewUser} 
                onCheckedChange={(v) => setNotifyNewUser(!!v)}
                className="text-purple-600"
              />
              <div>
                <div className="font-medium text-gray-800">New User Registration</div>
                <div className="text-sm text-gray-600">Receive alerts when a new user registers</div>
              </div>
              <InfoIcon tooltip="Receive alerts when a new user registers." />
            </label>
            
            <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-200 hover:bg-purple-50 transition-colors cursor-pointer">
              <Checkbox 
                checked={notifyFlaggedReview} 
                onCheckedChange={(v) => setNotifyFlaggedReview(!!v)}
                className="text-purple-600"
              />
              <div>
                <div className="font-medium text-gray-800">Flagged Reviews</div>
                <div className="text-sm text-gray-600">Be alerted when a review is flagged</div>
              </div>
              <InfoIcon tooltip="Be alerted when a review is flagged." />
            </label>
            
            <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-200 hover:bg-purple-50 transition-colors cursor-pointer">
              <Checkbox 
                checked={weeklySummary} 
                onCheckedChange={(v) => setWeeklySummary(!!v)}
                className="text-purple-600"
              />
              <div>
                <div className="font-medium text-gray-800">Weekly Summary</div>
                <div className="text-sm text-gray-600">Get a weekly digest of key activity</div>
              </div>
              <InfoIcon tooltip="Get a weekly digest of key activity." />
            </label>
            
            <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-200 hover:bg-purple-50 transition-colors cursor-pointer">
              <Checkbox 
                checked={alertVendorDeactivation} 
                onCheckedChange={(v) => setAlertVendorDeactivation(!!v)}
                className="text-purple-600"
              />
              <div>
                <div className="font-medium text-gray-800">Vendor Deactivation</div>
                <div className="text-sm text-gray-600">Alert when vendors are deactivated</div>
              </div>
              <InfoIcon tooltip="Alert when vendors are deactivated." />
            </label>
            
            <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-200 hover:bg-purple-50 transition-colors cursor-pointer">
              <Checkbox 
                checked={alertFailedLogins} 
                onCheckedChange={(v) => setAlertFailedLogins(!!v)}
                className="text-purple-600"
              />
              <div>
                <div className="font-medium text-gray-800">Failed Login Attempts</div>
                <div className="text-sm text-gray-600">Notify on failed login attempts</div>
              </div>
              <InfoIcon tooltip="Notify on failed login attempts." />
            </label>
            
            <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-200 hover:bg-purple-50 transition-colors cursor-pointer">
              <Checkbox 
                checked={auditLogAccess} 
                onCheckedChange={(v) => setAuditLogAccess(!!v)}
                className="text-purple-600"
              />
              <div>
                <div className="font-medium text-gray-800">Audit Log Access</div>
                <div className="text-sm text-gray-600">Allow access to platform audit records</div>
              </div>
              <InfoIcon tooltip="Allow access to platform audit records." />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Appearance Card */}
      <Card className="bg-gradient-to-br from-white to-orange-50 border-orange-200 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Palette className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-xl text-gray-800">Appearance & Display</CardTitle>
              <p className="text-sm text-gray-600">Customize your interface preferences</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Theme</label>
              <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark")}> 
                <SelectTrigger className="border-gray-300 focus:border-orange-500 focus:ring-orange-500">
                  <div className="flex items-center gap-2">
                    {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    {theme}
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4" />
                      Light
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4" />
                      Dark
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Font Size</label>
              <Select value={fontSize} onValueChange={(v) => setFontSize(v as "small" | "normal" | "large")}> 
                <SelectTrigger className="border-gray-300 focus:border-orange-500 focus:ring-orange-500">
                  <div className="flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    {fontSize}
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Card */}
      <Card className="bg-gradient-to-br from-white to-red-50 border-red-200 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Shield className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-xl text-gray-800">Security Settings</CardTitle>
              <p className="text-sm text-gray-600">Manage your account security preferences</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-red-200 hover:bg-red-50 transition-colors cursor-pointer">
              <Checkbox 
                checked={enable2FA} 
                onCheckedChange={(v) => setEnable2FA(!!v)}
                className="text-red-600"
              />
              <div>
                <div className="font-medium text-gray-800">Two-Factor Authentication</div>
                <div className="text-sm text-gray-600">Adds extra security to your account</div>
              </div>
              <InfoIcon tooltip="Adds two-factor authentication for extra security." />
            </label>
            
            <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-red-200 hover:bg-red-50 transition-colors cursor-pointer">
              <Checkbox 
                checked={publicProfile} 
                onCheckedChange={(v) => setPublicProfile(!!v)}
                className="text-red-600"
              />
              <div>
                <div className="font-medium text-gray-800">Public Profile</div>
                <div className="text-sm text-gray-600">Control visibility of your public profile</div>
              </div>
              <InfoIcon tooltip="Control visibility of your public profile." />
            </label>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">Auto-logout after (minutes)</label>
            <Input 
              type="number" 
              value={autoLogoutMinutes} 
              onChange={(e) => setAutoLogoutMinutes(Number(e.target.value))} 
              className="w-24 border-gray-300 focus:border-red-500 focus:ring-red-500"
            />
            <InfoIcon tooltip="Automatically logs out users after inactivity." />
          </div>
        </CardContent>
      </Card>

      {/* Billing Card */}
      <Card className="bg-gradient-to-br from-white to-emerald-50 border-emerald-200 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CreditCard className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-xl text-gray-800">Billing & Subscriptions</CardTitle>
              <p className="text-sm text-gray-600">Manage your payment methods and subscriptions</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-emerald-200 hover:bg-emerald-50 transition-colors cursor-pointer">
            <Checkbox 
              checked={enablePaidFeatures} 
              onCheckedChange={(v) => setEnablePaidFeatures(!!v)}
              className="text-emerald-600"
            />
            <div>
              <div className="font-medium text-gray-800">Enable Premium Features</div>
              <div className="text-sm text-gray-600">Activates premium billing and subscriptions</div>
            </div>
            <InfoIcon tooltip="Activates premium billing and subscriptions." />
          </label>
          
          {enablePaidFeatures && (
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Payment Method</label>
              <Input 
                placeholder="Payment Method" 
                value={paymentMethod} 
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="pt-4">
        <Button 
          onClick={saveSettings}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200"
          disabled={loading}
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save All Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
} 