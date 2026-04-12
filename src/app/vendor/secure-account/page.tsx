'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Shield, 
  CheckCircle, 
  XCircle, 
  ArrowRight, 
  Smartphone,
  Key,
  AlertCircle,
  Info,
  Building
} from 'lucide-react';

export default function VendorSecureAccountPage() {
  const router = useRouter();
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if WebAuthn is supported
    const checkSupport = () => {
      const supported = window.PublicKeyCredential !== undefined;
      setIsSupported(supported);
    };

    checkSupport();
  }, []);

  const setupPasskey = async () => {
    setIsSettingUp(true);
    setError(null);

    try {
      // Step 1: Get registration options from server
      const optionsResponse = await fetch('/api/passkey/register-options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userType: 'vendor'
        }),
      });

      if (!optionsResponse.ok) {
        throw new Error('Failed to get registration options');
      }

      const options = await optionsResponse.json();

      // Step 2: Create credential
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: new Uint8Array(options.challenge),
          rp: {
            name: options.rp.name,
            id: options.rp.id,
          },
          user: {
            id: new Uint8Array(options.user.id),
            name: options.user.name,
            displayName: options.user.displayName,
          },
          pubKeyCredParams: options.pubKeyCredParams,
          timeout: options.timeout,
          attestation: options.attestation,
          authenticatorSelection: options.authenticatorSelection,
        },
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to create credential');
      }

      const attestation = credential.response as AuthenticatorAttestationResponse;

      // Step 3: Send credential to server
      const credentialData = {
        id: credential.id,
        type: credential.type,
        rawId: Array.from(new Uint8Array(credential.rawId)),
        response: {
          clientDataJSON: Array.from(new Uint8Array(attestation.clientDataJSON)),
          attestationObject: Array.from(new Uint8Array(attestation.attestationObject)),
        },
      };

      const registerResponse = await fetch('/api/passkey/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential: credentialData,
          userType: 'vendor'
        }),
      });

      if (!registerResponse.ok) {
        throw new Error('Failed to register passkey');
      }

      setSetupComplete(true);
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/vendor/dashboard');
      }, 2000);

    } catch (err) {
      console.error('Passkey setup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to set up passkey');
    } finally {
      setIsSettingUp(false);
    }
  };

  const skipPasskey = () => {
    router.push('/vendor/dashboard');
  };

  if (isSupported === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking browser support...</p>
        </div>
      </div>
    );
  }

  if (!isSupported) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle className="text-xl">Passkeys Not Supported</CardTitle>
            <CardDescription>
              Your browser doesn't support passkeys. You can still use your account with password authentication.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={skipPasskey} className="w-full">
              Continue to Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (setupComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle className="text-xl">Passkey Set Up Successfully!</CardTitle>
            <CardDescription>
              Your business account is now secured with a passkey. Redirecting to dashboard...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
      <Card className="max-w-md w-full mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
            <Building className="w-6 h-6 text-purple-600" />
          </div>
          <CardTitle className="text-xl">Secure Your Business Account</CardTitle>
          <CardDescription>
            Set up a passkey for faster, more secure sign-ins to your vendor dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Benefits */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Faster Access</h4>
                <p className="text-sm text-gray-600">Quick access to your business dashboard without typing passwords</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Enhanced Security</h4>
                <p className="text-sm text-gray-600">Protect your business data with device-level security</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Business Ready</h4>
                <p className="text-sm text-gray-600">Secure authentication suitable for professional use</p>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-purple-900 mb-1">How it works</h4>
                <p className="text-sm text-purple-800">
                  When you tap "Set Up Passkey", your browser will ask you to authenticate using your device's 
                  built-in security (fingerprint, face ID, or PIN). This creates a unique credential that's 
                  stored securely on your device and linked to your business account.
                </p>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-red-900 mb-1">Setup Failed</h4>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              onClick={setupPasskey} 
              className="w-full bg-purple-600 hover:bg-purple-700" 
              disabled={isSettingUp}
            >
              {isSettingUp ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Setting Up Passkey...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4 mr-2" />
                  Set Up Passkey
                </>
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={skipPasskey} 
              className="w-full"
              disabled={isSettingUp}
            >
              Skip for Now
            </Button>
          </div>

          {/* Additional Info */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              You can always set up a passkey later in your business account settings
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 