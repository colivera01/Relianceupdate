'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startRegistration } from '@simplewebauthn/browser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Info, Key, Shield, XCircle } from 'lucide-react';

type PasskeySummary = {
  id: string;
  label: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

function formatWhen(value: string | null) {
  if (!value) return 'Not used yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not used yet';
  return date.toLocaleString();
}

export function PasskeySetupCard(props: {
  title: string;
  description: string;
  redirectPath: string;
  skipLabel: string;
  embedded?: boolean;
  showSkipAction?: boolean;
  secondaryActions?: Array<{
    label: string;
    href: string;
  }>;
}) {
  const router = useRouter();
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [isLoadingPasskeys, setIsLoadingPasskeys] = useState(true);
  const [revokingPasskeyId, setRevokingPasskeyId] = useState<string | null>(null);
  const [pendingRemovalPasskeyId, setPendingRemovalPasskeyId] = useState<string | null>(null);
  const shellClassName = props.embedded
    ? 'flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-8 text-white'
    : 'reliance-operator-shell reliance-grid-lines flex min-h-screen items-center justify-center px-4 text-white';
  const mainShellClassName = props.embedded
    ? 'flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-8 text-white'
    : 'reliance-operator-shell reliance-grid-lines flex min-h-screen items-center justify-center px-4 py-12 text-white';
  const showSkipAction = props.showSkipAction !== false;

  const loadPasskeys = async () => {
    setIsLoadingPasskeys(true);
    try {
      const response = await fetch('/api/passkey', {
        method: 'GET',
        credentials: 'same-origin',
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (response.ok && Array.isArray(data.passkeys)) {
        setPasskeys(data.passkeys as PasskeySummary[]);
      }
    } finally {
      setIsLoadingPasskeys(false);
    }
  };

  useEffect(() => {
    setIsSupported(window.PublicKeyCredential !== undefined);
    void loadPasskeys();
  }, []);

  const setupPasskey = async () => {
    setIsSettingUp(true);
    setError(null);

    try {
      const optionsResponse = await fetch('/api/passkey/register-options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
      });

      const optionsData = (await optionsResponse.json().catch(() => ({}))) as Record<string, unknown>;
      if (!optionsResponse.ok) {
        throw new Error(String(optionsData.error || 'Failed to start passkey setup.'));
      }

      const challengeId = String(optionsData.challengeId || '');
      const options = optionsData.options;
      if (!challengeId || !options || typeof options !== 'object') {
        throw new Error('Passkey registration options were incomplete.');
      }

      const response = await startRegistration({
        optionsJSON: options as any,
      });

      const registerResponse = await fetch('/api/passkey/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          challengeId,
          response,
        }),
      });

      const registerData = (await registerResponse.json().catch(() => ({}))) as Record<string, unknown>;
      if (!registerResponse.ok) {
        throw new Error(String(registerData.error || 'Failed to register passkey.'));
      }

      setSetupComplete(true);
      setPendingRemovalPasskeyId(null);
      await loadPasskeys();
      window.setTimeout(() => {
        router.push(props.redirectPath);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up passkey.');
    } finally {
      setIsSettingUp(false);
    }
  };

  const skipPasskey = () => {
    router.push(props.redirectPath);
  };

  const revokePasskey = async (passkeyId: string) => {
    if (pendingRemovalPasskeyId !== passkeyId) {
      setPendingRemovalPasskeyId(passkeyId);
      setError(null);
      return;
    }

    setRevokingPasskeyId(passkeyId);
    setError(null);

    try {
      const response = await fetch(`/api/passkey?passkeyId=${encodeURIComponent(passkeyId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(String(data.error || 'Failed to remove passkey.'));
      }
      setPendingRemovalPasskeyId(null);
      await loadPasskeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove passkey.');
    } finally {
      setRevokingPasskeyId(null);
    }
  };

  if (isSupported === null) {
    return (
      <div className={shellClassName}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-slate-300">Checking browser support...</p>
        </div>
      </div>
    );
  }

  if (!isSupported) {
    return (
      <div className={shellClassName}>
        <Card className="reliance-light-card max-w-xl w-full mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-500/15 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle className="text-xl">Passkeys Not Supported</CardTitle>
            <CardDescription>
              This browser cannot create or use passkeys. You can keep using your password and email code sign-in.
            </CardDescription>
          </CardHeader>
          {showSkipAction ? (
            <CardContent className="text-center">
              <Button onClick={skipPasskey} className="w-full">
                {props.skipLabel}
              </Button>
            </CardContent>
          ) : null}
        </Card>
      </div>
    );
  }

  if (setupComplete) {
    return (
      <div className={shellClassName}>
        <Card className="reliance-light-card max-w-xl w-full mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-500/15 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle className="text-xl">Passkey Added</CardTitle>
            <CardDescription>
              This account can now sign in with a passkey. Redirecting you back now.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className={mainShellClassName}>
      <Card className="reliance-light-card max-w-2xl w-full mx-4 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-500/15 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">{props.title}</CardTitle>
          <CardDescription>{props.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-blue-300/25 bg-blue-500/10 p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-100 mb-1">What this adds</h4>
                <p className="text-sm text-blue-100/80">
                  A passkey lets this account sign in with your device security instead of typing a password. On supported devices it can replace the password plus email-code step.
                </p>
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-300/25 bg-red-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-red-100 mb-1">Passkey setup failed</h4>
                  <p className="text-sm text-red-100/80">{error}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Registered passkeys</h3>
              <span className="text-sm text-slate-500">
                {isLoadingPasskeys ? 'Loading...' : `${passkeys.length} active`}
              </span>
            </div>
            {passkeys.length ? (
              <div className="space-y-3">
                {passkeys.map((passkey) => (
                  <div key={passkey.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{passkey.label}</p>
                        <p className="text-sm text-slate-600">
                          {passkey.deviceType === 'multiDevice' ? 'Synced across devices' : 'Stored on one device'}
                          {passkey.backedUp ? ' · backed up' : ''}
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <p>Added {formatWhen(passkey.createdAt)}</p>
                        <p>Last used {formatWhen(passkey.lastUsedAt)}</p>
                      </div>
                    </div>
                    {pendingRemovalPasskeyId === passkey.id ? (
                      <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                        <p className="text-sm text-amber-900">
                          Remove this passkey from the account? The device will stop working for passkey sign-in until you add it again.
                        </p>
                        <div className="mt-3 flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPendingRemovalPasskeyId(null)}
                            disabled={isSettingUp || revokingPasskeyId === passkey.id}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => revokePasskey(passkey.id)}
                            disabled={isSettingUp || revokingPasskeyId === passkey.id}
                          >
                            {revokingPasskeyId === passkey.id ? 'Removing...' : 'Confirm Remove'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => revokePasskey(passkey.id)}
                          disabled={isSettingUp || Boolean(revokingPasskeyId)}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/15 bg-white/5 p-4 text-sm text-slate-300">
                No passkeys are registered for this account yet.
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Button onClick={setupPasskey} className="w-full" disabled={isSettingUp}>
              {isSettingUp ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Setting up passkey...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4 mr-2" />
                  Add Passkey
                </>
              )}
            </Button>
            {showSkipAction ? (
              <Button variant="outline" onClick={skipPasskey} className="w-full" disabled={isSettingUp}>
                {props.skipLabel}
              </Button>
            ) : null}
            {props.secondaryActions?.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {props.secondaryActions.map((action) => (
                  <Button
                    key={action.href}
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => router.push(action.href)}
                    disabled={isSettingUp}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
