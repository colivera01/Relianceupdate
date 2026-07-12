"use client";
import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  HAS_LAUNCH_SUPPORT_EMAIL,
  LAUNCH_SUPPORT_EMAIL,
  LAUNCH_SUPPORT_GMAIL_COMPOSE_URL,
  LAUNCH_SUPPORT_MAILTO,
  LAUNCH_SUPPORT_RESPONSE_TIME,
} from '@/lib/support';
import Link from 'next/link';

function SupportPageContent() {
  return (
    <div className="space-y-8 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="reliance-operator-hero rounded-[32px] px-6 py-7">
          <div className="reliance-kicker border border-white/10 bg-white/6 text-white/64">
            Vendor support
          </div>
          <div className="mt-5 max-w-3xl space-y-4">
            <h1 className="font-display text-4xl font-semibold text-white sm:text-5xl">
              Help your team manage services, jobs, and service videos without leaving the launch flow
            </h1>
          </div>
        </header>

        <div className="grid gap-6">
          <Card className="reliance-operator-surface rounded-[28px] border-white/10">
            <CardHeader>
              <CardTitle>Launch Help Resources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h3 className="font-semibold mb-2">Frequently Asked Questions</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Short answers about profile setup, jobs, reviews, launch billing status, and available support channels.
                  </p>
                  <Link href="/vendor/support/faqs" className="text-[var(--reliance-blue-soft)] text-sm hover:text-white">
                    Read FAQs
                  </Link>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h3 className="font-semibold mb-2">Help Articles</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Browse practical guides for using the vendor pages that are active today.
                  </p>
                  <Link href="/vendor/support/help-articles" className="text-[var(--reliance-blue-soft)] text-sm hover:text-white">
                    Browse Articles
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="reliance-operator-surface rounded-[28px] border-white/10">
            <CardHeader>
              <CardTitle>Support Channels</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                {HAS_LAUNCH_SUPPORT_EMAIL ? (
                <a
                  href={LAUNCH_SUPPORT_GMAIL_COMPOSE_URL || LAUNCH_SUPPORT_MAILTO}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-blue-300/35 hover:bg-blue-500/10"
                >
                  <h4 className="font-semibold mb-1">Launch Follow-up</h4>
                  <p className="text-gray-600">
                    Email <span className="text-[var(--reliance-blue-soft)]">{LAUNCH_SUPPORT_EMAIL}</span> for account access, jobs, media, consent, or approval questions.
                  </p>
                  <p className="text-gray-500">Expected follow-up is {LAUNCH_SUPPORT_RESPONSE_TIME}. Use the published launch support path while the in-app ticket form remains offline.</p>
                </a>
                ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h4 className="font-semibold mb-1">Launch Follow-up</h4>
                  <p className="text-gray-600">
                    A dedicated vendor launch inbox has not been published yet.
                  </p>
                  <p className="text-gray-500">Set a support email before wider vendor onboarding so operational questions do not route to a personal inbox.</p>
                </div>
                )}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h4 className="font-semibold mb-1">Phone Support</h4>
                  <p className="text-gray-600">Not available in this launch.</p>
                  <p className="text-gray-500">No public support line is active.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h4 className="font-semibold mb-1">Live Chat</h4>
                  <p className="text-gray-600">Not available in this launch.</p>
                  <p className="text-gray-500">There is no live agent queue or simulated chat.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SupportPageFallback() {
  return (
    <div className="space-y-8 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="reliance-operator-hero rounded-[32px] px-6 py-7">
          <div className="reliance-kicker border border-white/10 bg-white/6 text-white/64">
            Vendor support
          </div>
          <h1 className="mt-5 font-display text-4xl font-semibold text-white sm:text-5xl">
            Preparing vendor help resources...
          </h1>
        </header>
      </div>
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<SupportPageFallback />}>
      <SupportPageContent />
    </Suspense>
  );
}
