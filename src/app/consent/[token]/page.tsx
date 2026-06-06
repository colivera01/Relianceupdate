'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';

type ConsentData = {
  vendorName: string;
  serviceName: string;
  bookingName: string;
  scheduledDate: string;
  customerName: string;
  createdAt: string;
  status: string;
};

function ConsentPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = String(params?.token || '');
  const returnTo = String(searchParams?.get('returnTo') || '').trim();
  const mediaSessionId = String(searchParams?.get('mediaSessionId') || '').trim();
  const returnLinkLabel = (() => {
    if (!returnTo) return 'Back to service page';
    try {
      const parsed = new URL(returnTo, 'http://localhost');
      return parsed.searchParams.get('returnTo') === '/reviews'
        ? 'Back to review detail'
        : 'Back to service page';
    } catch {
      return returnTo.includes('returnTo=%2Freviews') || returnTo.includes('returnTo=/reviews')
        ? 'Back to review detail'
        : 'Back to service page';
    }
  })();
  const helpReturnLabel = returnLinkLabel;
  const customerHelpHref = `/help?role=customer&returnTo=${encodeURIComponent(
    returnTo || '/my-bookings'
  )}&returnLabel=${encodeURIComponent(helpReturnLabel)}`;

  const [data, setData] = useState<ConsentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [returnLaterSelected, setReturnLaterSelected] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Unable to load consent.');
      setLoading(false);
      return;
    }

    fetch(`/api/consent/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          const consent = res.consent || {};
          setData({
            vendorName:
              consent?.vendor?.businessName ||
              consent?.vendor?.name ||
              'Service Provider',
            serviceName: consent?.booking?.service?.name || consent?.booking?.title || 'Service',
            bookingName: consent?.booking?.title || consent?.booking?.id || 'Booking',
            scheduledDate: consent?.booking?.scheduledFor || '',
            customerName: consent?.booking?.clientName || '',
            createdAt: consent?.requestedAt || consent?.createdAt || '',
            status: consent?.status || '',
          });
          const normalizedStatus = String(consent?.status || '').trim().toLowerCase();
          setAccepted(normalizedStatus === 'accepted');
          setDeclined(normalizedStatus === 'declined');
        } else {
          setError('Unable to load consent.');
        }
      })
      .catch(() => setError('Connection error'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    setError('');
    setAccepting(true);

    try {
      const res = await fetch('/api/consent/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const json = await res.json();

      if (json.success) {
        setAccepted(true);
        setDeclined(false);
        setReturnLaterSelected(false);
        setData((previous) =>
          previous
            ? {
                ...previous,
                status: 'accepted',
              }
            : previous
        );
        if (returnTo) {
          const redirectUrl = new URL(returnTo, window.location.origin);
          redirectUrl.searchParams.set('consentAccepted', '1');
          redirectUrl.searchParams.set('consentToken', token);
          if (mediaSessionId) {
            redirectUrl.searchParams.set('mediaSessionId', mediaSessionId);
          }
          window.location.href = `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
          return;
        }
      } else {
        setError('Failed to accept consent.');
      }
    } catch {
      setError('Error submitting consent.');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    setError('');
    setDeclining(true);

    try {
      const res = await fetch('/api/consent/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const json = await res.json();

      if (json.success) {
        setDeclined(true);
        setAccepted(false);
        setData((previous) =>
          previous
            ? {
                ...previous,
                status: 'declined',
              }
            : previous
        );
      } else {
        setError('Failed to decline consent.');
      }
    } catch {
      setError('Error submitting decline request.');
    } finally {
      setDeclining(false);
    }
  };

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;

  if (error) return <div style={{ padding: 40, color: 'red' }}>{error}</div>;

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ marginBottom: 20 }}>
        <h1>{data?.vendorName || 'Your vendor'} is requesting your approval</h1>
        <p style={{ color: '#555' }}>
          This request is related to your service with <strong>{data?.vendorName || 'your vendor'}</strong>.
        </p>
      </div>

      <div style={{ background: '#eef6ff', padding: 16, borderRadius: 8 }}>
        <p>
          <strong>{data?.vendorName || 'Your vendor'}</strong> uses Reliance to securely record and share service videos so you can review them afterward.
        </p>
      </div>

      <div style={{ marginTop: 20, padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
        <p><strong>Vendor:</strong> {data?.vendorName || 'Unavailable'}</p>
        <p><strong>Service:</strong> {data?.serviceName || data?.bookingName || 'Unavailable'}</p>
        <p>
          <strong>Scheduled date:</strong>{' '}
          {data?.scheduledDate ? new Date(data.scheduledDate).toLocaleDateString() : 'Unavailable'}
        </p>
        {data?.customerName ? <p><strong>Customer:</strong> {data.customerName}</p> : null}
        <p><strong>Requested:</strong> {new Date(data?.createdAt || '').toLocaleString()}</p>
      </div>

      <div style={{ marginTop: 20, padding: 16, background: '#f0fdf4', borderRadius: 8 }}>
        <p><strong>Access after approval</strong></p>
        <ul>
          <li>If you already have a Reliance account, sign in after approving</li>
          <li>If not, you can create one when you are ready</li>
          <li>Your service videos stay securely stored in Reliance</li>
        </ul>
      </div>

      <div style={{ marginTop: 20, padding: 16, background: '#f6f8fa', borderRadius: 8 }}>
        <p><strong>Why this is needed</strong></p>
        <p style={{ fontSize: 14, color: '#555', marginTop: 6 }}>
          {data?.vendorName || 'Your vendor'} may capture recording steps as part of documenting your service.
        </p>
        <ul style={{ marginTop: 8, paddingLeft: 20, color: '#374151' }}>
          <li>Intro Video - before work begins (condition overview)</li>
          <li>In-Progress Video - during the service (work being performed)</li>
          <li>Completion Video - after the service (final results)</li>
        </ul>
        <p style={{ marginTop: 12, fontSize: 14, color: '#374151' }}>
          Your response is securely logged with verification details for compliance, fraud prevention, and dispute protection.
        </p>
      </div>

      <div style={{ marginTop: 10 }}>
        <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a> |{' '}
        <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {returnTo ? (
          <Link href={returnTo} style={{ color: '#2563eb', textDecoration: 'underline' }}>
            {returnLinkLabel}
          </Link>
        ) : null}
        <Link href={customerHelpHref} style={{ color: '#2563eb', textDecoration: 'underline' }}>
          Open Help Center
        </Link>
      </div>

      {!accepted && !declined ? (
        <div style={{ marginTop: 30 }}>
          <button
            onClick={handleAccept}
            disabled={accepting || declining}
            style={{
              background: '#2563eb',
              color: '#fff',
              padding: '10px 20px',
              border: 'none',
              borderRadius: 6,
              marginRight: 10,
            }}
          >
            {accepting ? 'Processing...' : 'Approve access'}
          </button>

          <button
            onClick={handleDecline}
            disabled={accepting || declining}
            style={{ padding: '10px 20px' }}
          >
            {declining ? 'Processing...' : 'Decline'}
          </button>
        </div>
      ) : accepted ? (
        <div
          style={{
            marginTop: 30,
            padding: 16,
            borderRadius: 8,
            border: '1px solid #bbf7d0',
            background: '#f0fdf4',
          }}
        >
          <h2 style={{ margin: 0, color: '#14532d' }}>Consent Accepted</h2>
          <p style={{ marginTop: 10, color: '#166534' }}>
            Your consent has been securely recorded. Your provider may now proceed with the service video workflow.
          </p>

          <div style={{ marginTop: 16 }}>
            <p style={{ margin: 0 }}><strong>What happens next</strong></p>
            <ul style={{ marginTop: 8, paddingLeft: 20, color: '#14532d' }}>
              <li>If you already have a Reliance account, you can sign in to access your service-related content when available</li>
              <li>If you do not yet have an account, you may be asked to create one later to securely access your service video</li>
              <li>You will only be able to view content that has been approved and made available to you</li>
            </ul>
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link
              href="/auth/login"
              style={{
                background: '#2563eb',
                color: '#fff',
                padding: '10px 16px',
                borderRadius: 6,
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Sign In
            </Link>
            <Link
              href="/auth/register?type=user"
              style={{
                background: '#1f2937',
                color: '#fff',
                padding: '10px 16px',
                borderRadius: 6,
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Create Account
            </Link>
            <button
              type="button"
              onClick={() => setReturnLaterSelected(true)}
              style={{
                background: '#fff',
                color: '#374151',
                border: '1px solid #d1d5db',
                padding: '10px 16px',
                borderRadius: 6,
              }}
            >
              Return later
            </button>
          </div>
          {returnLaterSelected && (
            <p style={{ marginTop: 12, marginBottom: 0, color: '#4b5563', fontSize: 14 }}>
              You do not need to stay on this page. Your response has already been recorded.
            </p>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 30, color: '#b45309' }}>
          Consent declined. Video access remains unavailable unless a new consent request is sent.
        </div>
      )}

      {data?.status ? (
        <div style={{ marginTop: 12, color: '#666' }}>
          Current status: <strong>{data.status}</strong>
        </div>
      ) : null}
    </div>
  );
}

function ConsentPageFallback() {
  return <div style={{ padding: 40 }}>Loading...</div>;
}

export default function ConsentPage() {
  return (
    <Suspense fallback={<ConsentPageFallback />}>
      <ConsentPageContent />
    </Suspense>
  );
}
