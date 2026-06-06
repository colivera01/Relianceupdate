'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Smartphone, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  AlertCircle,
  QrCode 
} from "lucide-react";

// Helper function to detect device name from user agent
function detectDeviceName(): string {
  if (typeof window === 'undefined') return 'Unknown Device';
  
  const ua = navigator.userAgent;
  
  // iOS devices
  if (/iPhone/.test(ua)) {
    const match = ua.match(/iPhone\s*OS\s*(\d+)/);
    const version = match ? match[1].replace('_', '.') : '';
    return `iPhone${version ? ` (iOS ${version})` : ''}`;
  }
  if (/iPad/.test(ua)) {
    const match = ua.match(/iPad.*OS\s*(\d+)/);
    const version = match ? match[1].replace('_', '.') : '';
    return `iPad${version ? ` (iOS ${version})` : ''}`;
  }
  
  // Android devices
  if (/Android/.test(ua)) {
    const match = ua.match(/Android\s*([\d.]+)/);
    const version = match ? match[1] : '';
    const deviceMatch = ua.match(/;\s*([^;)]+)\s*\)/);
    const device = deviceMatch ? deviceMatch[1].trim() : 'Android Device';
    return `${device}${version ? ` (Android ${version})` : ''}`;
  }
  
  // Desktop browsers
  if (/Windows/.test(ua)) {
    return 'Windows Device';
  }
  if (/Mac/.test(ua)) {
    return 'Mac Device';
  }
  if (/Linux/.test(ua)) {
    return 'Linux Device';
  }
  
  return 'Unknown Device';
}

// Helper function to detect device type
function detectDeviceType(): "PHONE" | "HEADSET" {
  if (typeof window === 'undefined') return "PHONE";
  
  const ua = navigator.userAgent;
  
  // Only mark as headset for specific XR/headset platforms.
  if (/oculus|meta quest|quest browser|hololens|magic leap|vision pro|steamvr|openxr/i.test(ua)) {
    return "HEADSET";
  }
  
  // Default to phone for mobile devices
  if (/iPhone|iPad|Android|Mobile/.test(ua)) {
    return "PHONE";
  }
  
  // Default to phone for desktop (could be a web app)
  return "PHONE";
}

function resolveOrCreateDeviceUid(): string {
  if (typeof window === 'undefined') return '';
  const key = 'reliance_device_uid';
  const existing = localStorage.getItem(key);
  if (existing && existing.trim()) return existing.trim();
  const generated =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(key, generated);
  return generated;
}

export default function DevicePairPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [deviceType, setDeviceType] = useState<"PHONE" | "HEADSET">("PHONE");
  const [deviceUid, setDeviceUid] = useState("");
  const [returnCountdown, setReturnCountdown] = useState<number | null>(null);
  const [openedFromLink, setOpenedFromLink] = useState(false);
  const [invitePreviewName, setInvitePreviewName] = useState<string | null>(null);
  const [invitePreviewLoading, setInvitePreviewLoading] = useState(false);
  const [invitePreviewMaskedCode, setInvitePreviewMaskedCode] = useState<string | null>(null);

  const completePairingFlow = () => {
    try {
      if (window.opener && !window.opener.closed) {
        window.close();
        return;
      }
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
    } catch {
      // Ignore navigation fallback errors below.
    }

    const hasSessionToken =
      typeof window !== "undefined" &&
      Boolean(localStorage.getItem("authToken") || localStorage.getItem("auth_token"));
    if (hasSessionToken) {
      router.replace("/employee/jobs?paired=1");
    }
  };

  // Detect device info on mount
  useEffect(() => {
    setDeviceName(detectDeviceName());
    setDeviceType(detectDeviceType());
    setDeviceUid(resolveOrCreateDeviceUid());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const inviteFromLink = String(params.get("invite") || "").trim();
    const codeFromLink = String(params.get("code") || "").trim();
    if (inviteFromLink) {
      setOpenedFromLink(true);
      setInviteToken(inviteFromLink);
      setError(null);
      setInvitePreviewLoading(true);
      void fetch(`/api/device/pairing/preview?invite=${encodeURIComponent(inviteFromLink)}`, {
        cache: "no-store",
      })
        .then(async (res) => {
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(json.error || `Status ${res.status}`);
          }
          setInvitePreviewName(String(json.vendorName || "").trim() || null);
          setInvitePreviewMaskedCode(String(json.maskedCode || "").trim() || null);
        })
        .catch((previewError) => {
          setOpenedFromLink(false);
          setInviteToken("");
          setError(previewError instanceof Error ? previewError.message : "Invalid or expired pairing link");
        })
        .finally(() => {
          setInvitePreviewLoading(false);
        });
      return;
    }
    if (/^\d{6}$/.test(codeFromLink)) {
      setOpenedFromLink(true);
      setCode(codeFromLink);
      setError(null);
    }
  }, []);

  useEffect(() => {
    if (!success) {
      setReturnCountdown(null);
      return;
    }

    setReturnCountdown(3);
    const countdownTimer = window.setInterval(() => {
      setReturnCountdown((current) => {
        if (current == null) return 3;
        return current > 1 ? current - 1 : 0;
      });
    }, 1000);

    const completeTimer = window.setTimeout(() => {
      completePairingFlow();
    }, 3000);

    return () => {
      window.clearInterval(countdownTimer);
      window.clearTimeout(completeTimer);
    };
  }, [router, success]);

  async function handlePair() {
    // Reset states
    setError(null);
    setSuccess(false);
    
    // Validate code
    if (!inviteToken && !/^\d{6}$/.test(code.trim())) {
      setError("Please enter a valid 6-digit pairing code");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/device/pairing/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: inviteToken ? undefined : code.toUpperCase().trim(),
          inviteToken: inviteToken || undefined,
          deviceName,
          deviceType,
          deviceUid,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Failed to pair device (${res.status})`);
      }

      if (data.success) {
        setSuccess(true);
        setCode(""); // Clear the code on success
      } else {
        throw new Error("Pairing failed - invalid response");
      }
    } catch (err) {
      setError(
        err instanceof Error 
          ? err.message 
          : "Failed to pair device. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading && code.length >= 4) {
      handlePair();
    }
  };

  return (
    <div className="reliance-marketplace-shell reliance-grid-lines min-h-screen flex items-center justify-center p-4">
      <Card className="reliance-light-card w-full max-w-md rounded-[32px] border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.34)]">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 p-3 shadow-[0_18px_40px_rgba(36,107,255,0.34)]">
              <Smartphone className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            {openedFromLink ? "Pair This Phone" : "Pair Your Device"}
          </CardTitle>
          <CardDescription className="text-white/72">
            {openedFromLink
              ? "Open on the phone you want to use for Reliance videos, then confirm below."
              : "Enter the pairing code from your vendor dashboard to connect this device."}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Device Info Display */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-1 text-sm text-white/72">Device Information</div>
            <div className="font-medium text-white">{deviceName}</div>
            <div className="mt-1 text-xs text-white/56">Type: {deviceType}</div>
          </div>

          {/* Pairing Code Input */}
          <div className="space-y-2">
            {openedFromLink ? (
              <div className="rounded-2xl border border-blue-200/70 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                This link already contains the pairing approval for this phone, so you do not need to type the backup code manually.
              </div>
            ) : (
              <>
                <label htmlFor="pairing-code" className="text-sm font-medium text-white/82">
                  Pairing Code
                </label>
                <div className="relative">
                  <Input
                    id="pairing-code"
                    value={code}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setCode(value);
                      setError(null); // Clear error when user types
                    }}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="h-14 border-2 border-white/12 bg-slate-950/55 text-center font-mono text-2xl tracking-widest text-white placeholder:text-white/32 focus:border-blue-500"
                    disabled={loading || success}
                  />
                  {code.length > 0 ? (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <QrCode className="w-5 h-5 text-white/38" />
                    </div>
                  ) : null}
                </div>
                <div className="text-xs text-white/48 text-center">
                  {code.length}/6 digits
                </div>
              </>
            )}
          </div>

          {openedFromLink ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/74">
              {invitePreviewLoading ? (
                <div>Checking this pairing link...</div>
              ) : (
                <div>
                  <div className="font-medium text-white">
                    {invitePreviewName ? `Ready to pair with ${invitePreviewName}` : "Ready to pair this phone"}
                  </div>
                  <div className="mt-1">
                    {invitePreviewMaskedCode
                      ? `Backup code ending ${invitePreviewMaskedCode} is still available if the employee needs it.`
                      : "The backup code is still available if the employee needs it."}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Error Message */}
          {error && (
            <div className="rounded-2xl border border-red-200/70 bg-red-50/80 p-4 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-red-800">Pairing Failed</div>
                <div className="text-sm text-red-600 mt-1">{error}</div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="rounded-2xl border border-green-200/70 bg-green-50/80 p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-green-800">Device Paired Successfully!</div>
                <div className="text-sm text-green-600 mt-1">
                  Your device is now connected. Returning you automatically
                  {returnCountdown != null ? ` in ${returnCountdown}...` : "..."}
                </div>
              </div>
            </div>
          )}

          {/* Pair Button */}
          <Button
            onClick={handlePair}
            disabled={loading || success || (!inviteToken && !/^\d{6}$/.test(code)) || invitePreviewLoading}
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Pairing Device...
              </>
            ) : success ? (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Paired!
              </>
            ) : (
              <>
                <Smartphone className="w-5 h-5 mr-2" />
                {openedFromLink
                  ? invitePreviewName
                    ? `Pair This Phone to ${invitePreviewName}`
                    : "Pair This Phone"
                  : "Pair Device"}
              </>
            )}
          </Button>

          {success ? (
            <Button
              type="button"
              variant="outline"
              onClick={completePairingFlow}
              className="w-full"
            >
              Done
            </Button>
          ) : null}

          {/* Help Text */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-start gap-2 text-xs text-white/66">
              <AlertCircle className="w-4 h-4 text-white/38 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium mb-1">Need help?</div>
                <div>
                  {openedFromLink
                    ? "If this is the correct phone, tap Pair This Phone above. If the link was opened on the wrong device, close it and reopen it on the employee phone."
                    : "Open the pairing link from your vendor or enter the 6-digit code from the vendor dashboard. Codes expire after 5 minutes."}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
