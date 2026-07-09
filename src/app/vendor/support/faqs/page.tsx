"use client";

import { useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  Briefcase,
  ChevronDown,
  ChevronUp,
  LifeBuoy,
  Rocket,
  Search,
  Star,
  User,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  HAS_LAUNCH_SUPPORT_EMAIL,
  LAUNCH_SUPPORT_EMAIL,
  LAUNCH_SUPPORT_MAILTO,
} from '@/lib/support';

type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

type FaqCategory = {
  id: string;
  title: string;
  icon: LucideIcon;
  faqs: FaqItem[];
};

const faqCategories: FaqCategory[] = [
  {
    id: 'account',
    title: 'Account & Profile',
    icon: User,
    faqs: [
      {
        id: 'account-1',
        question: 'How do I complete my vendor profile?',
        answer:
          'Go to your Profile page to keep business details, service area, contact details, reminder preferences, and security preferences current. Use Services Offered for service-specific descriptions and reference prices.',
      },
      {
        id: 'account-2',
        question: 'Can I change my business name or contact information?',
        answer:
          'Yes. You can update saved business and contact details from your Profile page. If a change affects launch approval or public listing details, Reliance may follow up through your existing operator contact.',
      },
      {
        id: 'account-3',
        question: 'How do I verify my email address?',
        answer:
          'Use the verification link sent to the email address connected to your Reliance sign-in. If you cannot access that inbox, use the published Reliance launch support path for your environment.',
      },
    ],
  },
  {
    id: 'free-launch',
    title: 'Free Launch',
    icon: Rocket,
    faqs: [
      {
        id: 'free-launch-1',
        question: 'Does Reliance process payments in this launch?',
        answer:
          'No. Reliance is free for vendors and customers in this launch. In-app payment processing, payouts, platform fees, and billing dashboards are deferred.',
      },
      {
        id: 'free-launch-2',
        question: 'Should I still list service prices?',
        answer:
          'Yes, service prices can still help customers understand what a service may cost. They are informational and do not mean Reliance is collecting or distributing payments.',
      },
      {
        id: 'free-launch-3',
        question: 'Are there platform fees right now?',
        answer: 'No. Reliance is not charging platform fees on this launch.',
      },
    ],
  },
  {
    id: 'jobs',
    title: 'Manage Jobs',
    icon: Briefcase,
    faqs: [
      {
        id: 'jobs-1',
        question: 'How do I manage work records?',
        answer:
          'Use Manage Jobs to review work records and available actions. The launch workflow focuses on employee assignment, customer consent when needed, required video stages, and manager review; live in-app customer messaging is not available on this launch.',
      },
      {
        id: 'jobs-2',
        question: 'What happens if I need to reschedule work?',
        answer:
          'Coordinate rescheduling through your normal customer contact process for now, then keep the work status current in Reliance when the schedule changes. Reliance does not provide live in-app messaging during this launch.',
      },
      {
        id: 'jobs-3',
        question: 'How do I mark a job as completed?',
        answer:
          'Follow the job detail workflow: employees submit the required video stages, then a manager reviews and approves or rejects the completed work. Customer review prompts are tied to the video-backed completion flow.',
      },
    ],
  },
  {
    id: 'reviews',
    title: 'Reviews & Ratings',
    icon: Star,
    faqs: [
      {
        id: 'reviews-1',
        question: 'How do customers leave reviews?',
        answer:
          'Reviews are tied to completed video-backed service records. After eligible work is completed, customers can leave a review through the customer video and review flow.',
      },
      {
        id: 'reviews-2',
        question: 'Can I manage or respond to reviews from the vendor area?',
        answer:
          'Not in this launch. Vendor-side review response and review-management tools are deferred, so the best current action is to keep job videos complete and service quality clear.',
      },
      {
        id: 'reviews-3',
        question: 'How do reviews affect my visibility?',
        answer:
          'Approved public reviews can help customers evaluate your services. Reliance does not currently expose a vendor control for boosting placement or managing ranking.',
      },
    ],
  },
  {
    id: 'support',
    title: 'Launch Support',
    icon: LifeBuoy,
    faqs: [
      {
        id: 'support-1',
        question: "What if I can't log into my account?",
        answer:
          'Try the available password reset and sign-in recovery flow first. If you still cannot access your account, use the published Reliance launch support path for your environment while in-app support tickets remain offline.',
      },
      {
        id: 'support-2',
        question: 'Is there a mobile app to install?',
        answer:
          'No app-store mobile app is part of this launch. Use the Reliance web app in your browser for vendor profile, services, jobs, employees, media, and storage pages.',
      },
      {
        id: 'support-3',
        question: 'Which support channels are active?',
        answer:
          'The visible help pages are available for self-service guidance. Live chat, phone support, billing helpdesk, and in-app ticket handling are deferred for this launch.',
      },
    ],
  },
];

export default function FAQsPage() {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const toggleItem = (itemId: string) => {
    const nextExpanded = new Set(expandedItems);
    if (nextExpanded.has(itemId)) {
      nextExpanded.delete(itemId);
    } else {
      nextExpanded.add(itemId);
    }
    setExpandedItems(nextExpanded);
  };

  const filteredCategories = faqCategories
    .map((category) => ({
      ...category,
      faqs: category.faqs.filter(
        (faq) =>
          faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
          faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    }))
    .filter((category) => category.faqs.length > 0);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/vendor/support"
                className="inline-flex items-center gap-2 text-blue-100/78 transition-colors hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Support
              </Link>
            </div>
          </div>
          <h1 className="mb-2 text-3xl font-bold text-white">Frequently Asked Questions</h1>
          <p className="text-blue-100/72">
            Find answers to common questions about using the Reliance vendor tools.
          </p>
        </div>

        <Card className="reliance-operator-surface mb-6 rounded-[28px] border-white/10">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Need direct launch help?</h2>
                <p className="text-sm text-blue-100/70">
                  Contact launch support for login, jobs, media, consent, and approval questions.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {HAS_LAUNCH_SUPPORT_EMAIL ? (
                  <Button asChild>
                    <a href={LAUNCH_SUPPORT_MAILTO}>{LAUNCH_SUPPORT_EMAIL}</a>
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-blue-100/56" />
            <input
              type="text"
              placeholder="Search FAQs..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-2xl border border-white/12 bg-white/6 py-3 pl-10 pr-4 text-white placeholder:text-blue-100/44 focus:border-blue-300/70 focus:outline-none focus:ring-2 focus:ring-blue-400/55"
            />
          </div>
        </div>

        <div className="space-y-6">
          {filteredCategories.map((category) => (
            <Card key={category.id} className="reliance-operator-surface rounded-[28px] border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-white">
                  <category.icon className="h-5 w-5 text-blue-200" />
                  {category.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {category.faqs.map((faq) => (
                    <div
                      key={faq.id}
                      className="border-b border-white/10 pb-4 last:border-b-0 last:pb-0"
                    >
                      <button
                        onClick={() => toggleItem(faq.id)}
                        className="flex w-full items-center justify-between rounded-2xl p-3 text-left transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70"
                      >
                        <h3 className="pr-4 font-medium text-white">{faq.question}</h3>
                        {expandedItems.has(faq.id) ? (
                          <ChevronUp className="h-5 w-5 flex-shrink-0 text-blue-100/72" />
                        ) : (
                          <ChevronDown className="h-5 w-5 flex-shrink-0 text-blue-100/72" />
                        )}
                      </button>
                      {expandedItems.has(faq.id) ? (
                        <div className="px-3 pb-3">
                          <p className="leading-relaxed text-blue-100/70">{faq.answer}</p>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

      </div>
    </div>
  );
}
