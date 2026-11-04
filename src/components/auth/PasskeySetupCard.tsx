'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startRegistration } from '@simplewebauthn/browser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Info, Key, Shield } from 'lucide-react';

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
  headingLevel?: 'h1' | 'h2';
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [isLoadingPasskeys, setIsLoadingPasskeys] = useState(true);
  const [passkeyListError, setPasskeyListError] = useState<string | null>(null);
  const [revokingPasskeyId, setRevokingPasskeyId] = useState<string | null>(null);
  const [pendingRemovalPasskeyId, setPendingRemovalPasskeyId] = useState<string | null>(null);
  const removeButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const confirmRemovalRef = useRef<HTMLButtonElement>(null);
  const statusMessageRef = useRef<HTMLDivElement>(null);
  const shellClassName = props.embedded
    ? 'flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-8 text-white'
    : 'reliance-operator-shell reliance-grid-lines flex min-h-screen items-center justify-center px-4 text-white';
  const mainShellClassName = props.embedded
    ? 'flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-8 text-white'
    : 'reliance-operator-shell reliance-grid-lines flex min-h-screen items-center justify-center px-4 py-12 text-white';
  const showSkipAction = props.showSkipAction !== false;
  const Heading = props.headingLevel || (props.embedded ? 'h2' : 'h1');
  const RegisteredPasskeysHeading = Heading === 'h2' ? 'h3' : 'h2';

  const loadPasskeys = async () => {
    setIsLoadingPasskeys(true);
    setPasskeyListError(null);
    try {
      const response = await fetch('/api/passkey', {
        method: 'GET',
        credentials: 'same-origin',
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(String(data.error || 'Unable to load registered passkeys.'));
      }
      setPasskeys(Array.isArray(data.passkeys) ? data.passkeys as PasskeySummary[] : []);
    } catch (loadError) {
      setPasskeyListError(
        loadError instanceof Error ? loadError.message : 'Unable to load registered passkeys.'
      );
    } finally {
      setIsLoadingPasskeys(false);
    }
  };

  useEffect(() => {
    setIsSupported(window.PublicKeyCredential !== undefined);
    void loadPasskeys();
  }, []);

  useEffect(() => {
    if (!pendingRemovalPasskeyId) return;
    const focusTimer = window.setTimeout(() => confirmRemovalRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [pendingRemovalPasskeyId]);

  const setupPasskey = async () => {
    setIsSettingUp(true);
    setError(null);
    setStatusMessage(null);

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

  const cancelPasskeyRemoval = (passkeyId: string) => {
    setPendingRemovalPasskeyId(null);
    window.setTimeout(() => removeButtonRefs.current.get(passkeyId)?.focus(), 0);
  };

  const revokePasskey = async (passkeyId: string) => {
    if (pendingRemovalPasskeyId !== passkeyId) {
      setPendingRemovalPasskeyId(passkeyId);
      setError(null);
      return;
    }

    setRevokingPasskeyId(passkeyId);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/passkey?passkeyId=${encodeURIComponent(passkeyId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(String(data.error || 'Failed to remove passkey.'));
      }
      const removedLabel = passkeys.find((passkey) => passkey.id === passkeyId)?.label || 'Passkey';
      setPendingRemovalPasskeyId(null);
      setPasskeys((current) => current.filter((passkey) => passkey.id !== passkeyId));
      setStatusMessage(`${removedLabel} removed.`);
      window.setTimeout(() => statusMessageRef.current?.focus(), 0);
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

  if (setupComplete) {
    return (
      <div className={shellClassName}>
        <Card className="reliance-light-card max-w-xl w-full mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-500/15 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <Heading className="text-xl font-semibold leading-none tracking-tight">Passkey Added</Heading>
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
          <Heading className="text-2xl font-semibold leading-none tracking-tight">{props.title}</Heading>
          <CardDescription>{props.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {statusMessage ? (
            <div
              ref={statusMessageRef}
              role="status"
              aria-live="polite"
              tabIndex={-1}
              className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 p-4 text-sm text-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              {statusMessage}
            </div>
          ) : null}
          {isSupported === false ? (
            <div role="status" className="rounded-lg border border-amber-300/30 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                <div>
                  <h3 className="font-medium text-amber-100">Passkey creation is unavailable in this browser</h3>
                  <p className="mt-1 text-sm text-amber-100/80">
                    You can still review and remove existing passkeys below, or use password recovery and security help. Use a passkey-compatible browser to add another device.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
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
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-lg border border-red-300/25 bg-red-500/10 p-4"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-red-100 mb-1">Passkey action failed</h4>
                  <p className="text-sm text-red-100/80">{error}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-3" aria-busy={isLoadingPasskeys}>
            <div className="flex items-center justify-between">
              <RegisteredPasskeysHeading className="font-semibold text-slate-900">Registered passkeys</RegisteredPasskeysHeading>
              <span className="text-sm text-slate-500" aria-live="polite">
                {isLoadingPasskeys ? 'Loading...' : `${passkeys.length} active`}
              </span>
            </div>
            {isLoadingPasskeys ? (
              <div
                role="status"
                className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-300"
              >
                Loading registered passkeys...
              </div>
            ) : passkeyListError ? (
              <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-950">Passkeys could not be loaded.</p>
                <p className="mt-1 text-sm text-amber-900">{passkeyListError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => void loadPasskeys()}
                >
                  Try Again
                </Button>
              </div>
            ) : passkeys.length ? (
              <div className="space-y-3">
                {passkeys.map((passkey) => {
                  const removalPromptId = `passkey-removal-${passkey.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
                  return (
                  <div key={passkey.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{passkey.label}</p>
                        <p className="text-sm text-slate-600">
                          {passkey.deviceType === 'multiDevice' ? 'Synced across devices' : 'Stored on one device'}
                          {passkey.backedUp ? ' · backed up' : ''}
                        </p>
                      </div>
                      <div className="text-left text-xs text-slate-500 sm:text-right">
                        <p>Added {formatWhen(passkey.createdAt)}</p>
                        <p>Last used {formatWhen(passkey.lastUsedAt)}</p>
                      </div>
                    </div>
                    {pendingRemovalPasskeyId === passkey.id ? (
                      <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                        <p id={removalPromptId} className="text-sm text-amber-900">
                          Remove this passkey from the account? The device will stop working for passkey sign-in until you add it again.
                        </p>
                        <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-label={`Cancel removal of ${passkey.label}`}
                            aria-describedby={removalPromptId}
                            onClick={() => cancelPasskeyRemoval(passkey.id)}
                            disabled={isSettingUp || revokingPasskeyId === passkey.id}
                          >
                            Cancel
                          </Button>
                          <Button
                            ref={confirmRemovalRef}
                            type="button"
                            variant="destructive"
                            size="sm"
                            aria-label={`Confirm removal of ${passkey.label}`}
                            aria-describedby={removalPromptId}
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
                          ref={(node) => {
                            if (node) removeButtonRefs.current.set(passkey.id, node);
                            else removeButtonRefs.current.delete(passkey.id);
                          }}
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Remove ${passkey.label}`}
                          onClick={() => revokePasskey(passkey.id)}
                          disabled={isSettingUp || Boolean(revokingPasskeyId)}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/15 bg-white/5 p-4 text-sm text-slate-300">
                No passkeys are registered for this account yet.
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Button
              onClick={setupPasskey}
              className="w-full"
              disabled={isSupported !== true || isSettingUp || isLoadingPasskeys}
              aria-busy={isSettingUp}
            >
              {isSupported === false ? (
                'Add Passkey (unsupported browser)'
              ) : isSettingUp ? (
                <>
                  <div aria-hidden="true" className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
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
