"use client";
import { useState, useRef } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("");
}

export default function AdminProfilePage() {
  // Mock admin data
  const [profile, setProfile] = useState({
    name: "Admin User",
    email: "admin@reliance.com",
    role: "Admin",
    avatar: "",
    lastLogin: "2024-06-01 09:15 AM",
    twoFA: true,
  });
  const [edit, setEdit] = useState(profile);
  const [password, setPassword] = useState({ old: "", new: "", confirm: "" });
  const [activity] = useState([
    { action: "Logged in from new device", timestamp: "2024-06-01 09:15 AM", device: "Chrome/Windows", location: "NY, USA" },
    { action: "Changed password", timestamp: "2024-05-30 14:22 PM", device: "Safari/MacOS", location: "Remote" },
    { action: "Reviewed vendor application", timestamp: "2024-05-29 10:10 AM", device: "Chrome/Windows", location: "NY, USA" },
    { action: "Suspended user #5678", timestamp: "2024-05-28 16:45 PM", device: "Firefox/Linux", location: "London, UK" },
    { action: "Approved content upload", timestamp: "2024-05-27 11:05 AM", device: "Chrome/Windows", location: "NY, USA" },
  ]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [twoFASaving, setTwoFASaving] = useState(false);
  const [twoFAStatus, setTwoFAStatus] = useState<"idle" | "success" | "error">("idle");
  const [twoFAError, setTwoFAError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handlers
  const handleProfileSave = () => {
    setSaving(true);
    setSaveStatus("idle");
    setSaveError("");
    setTimeout(() => {
      if (!edit.name || !edit.email) {
        setSaveStatus("error");
        setSaveError("Name and email are required.");
        setSaving(false);
        return;
      }
      setProfile({ ...profile, ...edit });
      setSaving(false);
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 1000);
  };
  const handlePasswordChange = () => {
    setSaving(true);
    setSaveStatus("idle");
    setSaveError("");
    setTimeout(() => {
      if (!password.old || !password.new || !password.confirm) {
        setSaveStatus("error");
        setSaveError("All password fields are required.");
        setSaving(false);
        return;
      }
      if (password.new !== password.confirm) {
        setSaveStatus("error");
        setSaveError("New passwords do not match.");
        setSaving(false);
        return;
      }
      setPassword({ old: "", new: "", confirm: "" });
      setSaving(false);
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 1000);
  };
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setEdit((prev) => ({ ...prev, avatar: ev.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };
  const handleToggle2FA = () => {
    setTwoFASaving(true);
    setTwoFAStatus("idle");
    setTwoFAError("");
    setTimeout(() => {
      // Simulate random error for demo
      if (Math.random() < 0.15) {
        setTwoFAStatus("error");
        setTwoFAError("Failed to update 2FA. Please try again.");
        setTwoFASaving(false);
        return;
      }
      setEdit((prev) => ({ ...prev, twoFA: !prev.twoFA }));
      setProfile((prev) => ({ ...prev, twoFA: !prev.twoFA }));
      setTwoFAStatus("success");
      setTwoFASaving(false);
      setTimeout(() => setTwoFAStatus("idle"), 2000);
    }, 1000);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <h2 className="text-2xl font-bold mb-2">My Profile</h2>
      <Card>
        <CardHeader>
          <CardTitle>Profile Overview</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="relative group">
            {edit.avatar ? (
              <img
                src={edit.avatar}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover border-2 border-gray-300 cursor-pointer"
                onClick={handleAvatarClick}
              />
            ) : (
              <div
                className="w-20 h-20 rounded-full bg-yellow-400 flex items-center justify-center text-3xl font-bold text-[#232946] cursor-pointer"
                onClick={handleAvatarClick}
              >
                {getInitials(profile.name)}
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              className="hidden"
              onChange={handleAvatarChange}
            />
            <div className="absolute bottom-0 left-0 right-0 text-center opacity-0 group-hover:opacity-100 transition bg-black bg-opacity-50 text-white text-xs py-1 rounded-b cursor-pointer">
              Change Photo
            </div>
          </div>
          <div>
            <div className="font-semibold text-lg">{profile.name}</div>
            <div className="text-gray-600">{profile.email}</div>
            <Badge variant="secondary" className="mt-2">{profile.role}</Badge>
            <div className="text-xs text-gray-500 mt-2">Last login: {profile.lastLogin}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit Personal Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block text-sm font-medium">Name</label>
          <Input value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} />
          <label className="block text-sm font-medium">Email</label>
          <Input value={edit.email} onChange={e => setEdit({ ...edit, email: e.target.value })} />
          <Button onClick={handleProfileSave} disabled={saving} className="mt-2">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          {saveStatus === "success" && <span className="ml-3 text-green-600 text-sm">Saved ✓</span>}
          {saveStatus === "error" && <span className="ml-3 text-red-600 text-sm">{saveError}</span>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="password" placeholder="Old Password" value={password.old} onChange={e => setPassword({ ...password, old: e.target.value })} />
          <Input type="password" placeholder="New Password" value={password.new} onChange={e => setPassword({ ...password, new: e.target.value })} />
          <Input type="password" placeholder="Confirm New Password" value={password.confirm} onChange={e => setPassword({ ...password, confirm: e.target.value })} />
          <Button onClick={handlePasswordChange} disabled={saving} className="mt-2">
            {saving ? "Saving..." : "Change Password"}
          </Button>
          {saveStatus === "success" && <span className="ml-3 text-green-600 text-sm">Password updated ✓</span>}
          {saveStatus === "error" && <span className="ml-3 text-red-600 text-sm">{saveError}</span>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">Two-Factor Authentication:</span>
            <Badge variant={edit.twoFA ? "default" : "destructive"}>{edit.twoFA ? "Enabled" : "Disabled"}</Badge>
            <Button size="sm" variant="outline" className="ml-2" onClick={handleToggle2FA} disabled={twoFASaving}>
              {twoFASaving ? (edit.twoFA ? "Disabling..." : "Enabling...") : (edit.twoFA ? "Disable 2FA" : "Enable 2FA")}
            </Button>
            {twoFAStatus === "success" && <span className="ml-2 text-green-600 text-xs">Updated ✓</span>}
            {twoFAStatus === "error" && <span className="ml-2 text-red-600 text-xs">{twoFAError}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-2">
            {activity.map((a, idx) => (
              <li key={idx}>
                <span className="font-medium">{a.action}</span>
                <span className="ml-2 text-gray-500">({a.timestamp}, {a.device}, {a.location})</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Developer Notes for Backend Integration */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">📋 Developer Notes</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <p><strong>Endpoints Needed:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><code>GET /api/profile</code> - Fetch admin profile data</li>
            <li><code>PATCH /api/profile</code> - Update name/email/avatar</li>
            <li><code>POST /api/profile/change-password</code> - Change password</li>
            <li><code>POST /api/profile/toggle-2fa</code> - Enable/disable 2FA</li>
            <li><code>GET /api/profile/activity</code> - Recent admin activity (with timestamp, device, location)</li>
          </ul>
          <p><strong>Expected format:</strong> <code>{`{ name, email, role, avatar, lastLogin, twoFA, activity: { action, timestamp, device, location }[] }`}</code></p>
          <p className="mt-2"><strong>Current Mock Data:</strong> Shows realistic admin profile and activity for reference</p>
        </div>
      </div>
    </div>
  );
} 