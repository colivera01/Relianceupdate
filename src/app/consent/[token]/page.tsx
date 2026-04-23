'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type ConsentData = {
  vendorName: string;
  serviceName: string;
  bookingName: string;
  createdAt: string;
  status: string;
};

export default function ConsentPage() {
  const params = useParams();
  const token = String(params?.token || '');

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
            serviceName: consent?.booking?.service?.name || 'Service',
            bookingName: consent?.booking?.title || consent?.booking?.id || 'Booking',
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
      {/* HEADER */}
      <div style={{ marginBottom: 20 }}>
        <h1>Review & Approve Your Service Video Access</h1>
        <p style={{ color: '#555' }}>
          Powered by <strong>Reliance</strong> — Secure Service Video Platform
        </p>
      </div>

      {/* CONTEXT */}
      <div style={{ background: '#f6f8fa', padding: 16, borderRadius: 8 }}>
        <p>
          <strong>{data?.vendorName}</strong> completed a service for you and is requesting permission
          to share your service video.
        </p>
      </div>

      {/* DETAILS */}
      <div style={{ marginTop: 20, padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
        <p><strong>Service:</strong> {data?.serviceName}</p>
        <p><strong>Booking:</strong> {data?.bookingName}</p>
        <p><strong>Requested:</strong> {new Date(data?.createdAt || '').toLocaleString()}</p>
      </div>

      {/* ACCESS INFO */}
      <div style={{ marginTop: 20, padding: 16, background: '#eef6ff', borderRadius: 8 }}>
        <p><strong>🔐 Accessing Your Video</strong></p>
        <ul>
          <li>If you already have a Reliance account → log in after accepting</li>
          <li>If not → you will be prompted to create one</li>
          <li>Your video is securely stored and only visible to you</li>
        </ul>
      </div>

      {/* WHAT WILL BE RECORDED */}
      <div style={{ marginTop: 20, padding: 16, background: '#eef6ff', borderRadius: 8 }}>
        <p><strong>🎥 Service Recording Details</strong></p>
        <p style={{ fontSize: 14, color: '#555', marginTop: 6 }}>
          The following recordings may be captured as part of your service experience.
        </p>
        <p>
          Your service provider may record the following as part of your service:
        </p>
        <p>• Intro Video – before work begins (condition overview)</p>
        <p>• In-Progress Video – during the service (work being performed)</p>
        <p>• Completion Video – after the service (final results and proof)</p>
        <p style={{ marginTop: 12 }}>
          By accepting, you grant permission for your service provider to capture these recordings as part of completing and documenting your service.
        </p>
        <p style={{ marginTop: 12 }}>
          These recordings are used for service verification, quality assurance, customer review access, and dispute protection.
        </p>
        <p style={{ marginTop: 12 }}>
          This single consent covers all service-related recordings associated with this booking, including before, during, and after the service.
        </p>
      </div>

      {/* CONSENT & VERIFICATION */}
      <div style={{ marginTop: 20, padding: 16, background: '#f0fdf4', borderRadius: 8 }}>
        <p><strong>🛡️ Consent & Verification</strong></p>
        <p style={{ fontSize: 14, color: '#6b7280', marginTop: 6 }}>
          Your acceptance will be securely recorded for compliance and protection.
        </p>
        <p style={{ fontSize: 14, color: '#374151', marginTop: 8 }}>
          Consent will be recorded with:
        </p>
        <p style={{ fontSize: 14, color: '#374151' }}>• Date & Time</p>
        <p style={{ fontSize: 14, color: '#374151' }}>• Device and browser information</p>
        <p style={{ fontSize: 14, color: '#374151' }}>• IP / security verification details</p>
        <p style={{ fontSize: 14, color: '#374151' }}>• Booking reference</p>
        <p style={{ marginTop: 12, fontSize: 14, color: '#374151' }}>
          This information is used for compliance, fraud prevention, dispute protection, and verification of consent.
        </p>
      </div>

      {/* CONSENT TERMS */}
      <div style={{ marginTop: 20 }}>
        <p><strong>You agree to:</strong></p>
        <ul>
          <li>Receive access to service-related video content</li>
          <li>Participate in the service review process</li>
          <li>Allow secure storage and playback via Reliance</li>
          <li>Acknowledge activity is logged for compliance</li>
        </ul>
      </div>

      {/* LEGAL LINKS */}
      <div style={{ marginTop: 10 }}>
        <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a> |{' '}
        <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
      </div>

      {/* ACTIONS */}
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
              marginRight: 10
            }}
          >
            {accepting ? 'Processing...' : 'Accept & Continue'}
          </button>

          <button
            onClick={handleDecline}
            disabled={accepting || declining}
            style={{ padding: '10px 20px' }}
          >
            {declining ? 'Processing...' : 'Decline Access'}
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
