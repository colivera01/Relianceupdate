'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function ConsentTokenPage() {
  const params = useParams();
  const token = String(params?.token || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [consent, setConsent] = useState<any>(null);
  const [electronicAccepted, setElectronicAccepted] = useState(false);
  const [reviewFlowAccepted, setReviewFlowAccepted] = useState(false);
  const [smsAccepted, setSmsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('Missing consent token in URL.');
      setErrorCode('CONSENT_TOKEN_MISSING');
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      setErrorCode(null);
      const res = await fetch(`/api/consent/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || 'Failed to load consent');
        setErrorCode(json?.code || (res.status === 404 ? 'CONSENT_NOT_FOUND' : null));
        setConsent(null);
      } else {
        setConsent(json?.consent || null);
      }
      setLoading(false);
    })();
  }, [token]);

  const submitAccept = async () => {
    if (!electronicAccepted || !reviewFlowAccepted) {
      setMessage('Required checkboxes must be accepted before continuing.');
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const res = await fetch('/api/consent/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        termsVersion: 'terms-draft-v1',
        privacyVersion: 'privacy-draft-v1',
        smsAccepted,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(json?.error || 'Failed to accept consent');
      if (json?.code === 'CONSENT_EXPIRED') setErrorCode('CONSENT_EXPIRED');
    } else {
      setMessage('Consent accepted. You may now access the customer video flow.');
      setConsent(json?.consent || consent);
    }
    setSubmitting(false);
  };

  const submitDecline = async () => {
    setSubmitting(true);
    setMessage(null);
    const res = await fetch('/api/consent/decline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, reason: 'Customer declined terms' }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(json?.error || 'Failed to decline consent');
      if (json?.code === 'CONSENT_EXPIRED') setErrorCode('CONSENT_EXPIRED');
    } else {
      setMessage('Consent declined. Video access remains unavailable.');
      setConsent(json?.consent || consent);
    }
    setSubmitting(false);
  };

  if (loading) return <div className="mx-auto max-w-3xl p-6 text-sm text-gray-600">Loading consent request...</div>;
  if (error && !consent) {
    return (
      <div className="mx-auto max-w-3xl space-y-2 p-6">
        <h1 className="text-xl font-semibold text-gray-900">Consent unavailable</h1>
        <p className="text-sm text-red-600">{error}</p>
        {errorCode ? <p className="text-xs text-gray-500">Code: {errorCode}</p> : null}
      </div>
    );
  }
  if (!consent) {
    return <div className="mx-auto max-w-3xl p-6 text-sm text-gray-600">Consent request not found.</div>;
  }

  const canRespond = Boolean(consent.canRespond);
  const blocked = consent.respondBlockedReason as string | null | undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-bold text-gray-900">Service Video Consent</h1>
      <div className="rounded border bg-white p-4 text-sm">
        <p><span className="font-medium">Vendor:</span> {consent.vendor?.businessName || consent.vendor?.name || consent.vendor?.id}</p>
        <p><span className="font-medium">Booking:</span> {consent.booking?.title || consent.booking?.id}</p>
        <p><span className="font-medium">Service:</span> {consent.booking?.service?.name || 'Service'}</p>
        {consent.mediaSessionId ? (
          <p><span className="font-medium">Media session:</span> {consent.mediaSessionId}</p>
        ) : null}
      </div>
      {!canRespond ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {blocked === 'expired' || consent.status === 'expired'
            ? 'This consent link has expired. Request a new consent link from your service provider.'
            : consent.status === 'accepted'
              ? 'This consent request was already accepted.'
              : consent.status === 'declined'
                ? 'This consent request was declined.'
                : 'This consent request can no longer be updated.'}
        </div>
      ) : null}
      <div className="rounded border bg-white p-4 text-sm space-y-2">
        <p>You are agreeing to customer video access and review-flow acknowledgment for this service.</p>
        <p>
          Links: <a className="text-blue-600 underline" href="/terms" target="_blank" rel="noreferrer">Terms of Use</a> and{' '}
          <a className="text-blue-600 underline" href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
        </p>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={electronicAccepted} onChange={(e) => setElectronicAccepted(e.target.checked)} disabled={!canRespond} />
          <span>I accept electronic records and signatures (required).</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={reviewFlowAccepted} onChange={(e) => setReviewFlowAccepted(e.target.checked)} disabled={!canRespond} />
          <span>I acknowledge video access and review flow terms (required).</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={smsAccepted} onChange={(e) => setSmsAccepted(e.target.checked)} disabled={!canRespond} />
          <span>I opt into SMS updates (optional).</span>
        </label>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => void submitAccept()}
          disabled={submitting || !canRespond}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Accept
        </button>
        <button
          onClick={() => void submitDecline()}
          disabled={submitting || !canRespond}
          className="rounded border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
      {message ? <p className="text-sm text-gray-700">{message}</p> : null}
    </div>
  );
}
