'use client';

import { useState, useEffect } from "react";
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
  
  // Check for headset indicators (this is a placeholder - adjust based on your actual headset detection)
  if (/headset|vr|ar|oculus|quest/i.test(ua)) {
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
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [deviceType, setDeviceType] = useState<"PHONE" | "HEADSET">("PHONE");
  const [deviceUid, setDeviceUid] = useState("");

  // Detect device info on mount
  useEffect(() => {
    setDeviceName(detectDeviceName());
    setDeviceType(detectDeviceType());
    setDeviceUid(resolveOrCreateDeviceUid());
  }, []);

  async function handlePair() {
    // Reset states
    setError(null);
    setSuccess(false);
    
    // Validate code
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Please enter a valid 6-digit pairing code");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/device/pairing/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.toUpperCase().trim(),
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
        // Auto-hide success message after 5 seconds
        setTimeout(() => {
          setSuccess(false);
        }, 5000);
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-2">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full">
              <Smartphone className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800">
            Pair Your Device
          </CardTitle>
          <CardDescription className="text-gray-600">
            Enter the pairing code from your vendor dashboard to connect this device
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Device Info Display */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Device Information</div>
            <div className="font-medium text-gray-800">{deviceName}</div>
            <div className="text-xs text-gray-500 mt-1">Type: {deviceType}</div>
          </div>

          {/* Pairing Code Input */}
          <div className="space-y-2">
            <label htmlFor="pairing-code" className="text-sm font-medium text-gray-700">
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
                className="text-center text-2xl font-mono tracking-widest h-14 border-2 focus:border-blue-500"
                disabled={loading || success}
              />
              {code.length > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <QrCode className="w-5 h-5 text-gray-400" />
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 text-center">
              {code.length}/6 digits
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-red-800">Pairing Failed</div>
                <div className="text-sm text-red-600 mt-1">{error}</div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-green-800">Device Paired Successfully!</div>
                <div className="text-sm text-green-600 mt-1">
                  Your device is now connected to your vendor account.
                </div>
              </div>
            </div>
          )}

          {/* Pair Button */}
          <Button
            onClick={handlePair}
            disabled={loading || success || !/^\d{6}$/.test(code)}
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
                Pair Device
              </>
            )}
          </Button>

          {/* Help Text */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-start gap-2 text-xs text-gray-600">
              <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium mb-1">Need help?</div>
                <div>Get the pairing code from your vendor dashboard. Codes expire after 5 minutes.</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
