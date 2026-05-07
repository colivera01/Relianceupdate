"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ArrowLeft, Search } from 'lucide-react';
import { useState } from 'react';

export default function FAQsPage() {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const faqCategories = [
    {
      id: 'account',
      title: 'Account & Profile',
      icon: '👤',
      faqs: [
        {
          id: 'account-1',
          question: 'How do I complete my vendor profile?',
          answer: 'To complete your profile, go to your Profile page and fill in all required fields including business information, services offered, pricing, and upload your business logo. A complete profile increases your visibility to potential clients.'
        },
        {
          id: 'account-2',
          question: 'Can I change my business name or contact information?',
          answer: 'Yes, you can update your business information at any time from your Profile page. Changes to your business name may require verification from our support team.'
        },
        {
          id: 'account-3',
          question: 'How do I verify my email address?',
          answer: 'Check your email inbox for a verification link from Reliance. If you don\'t see it, check your spam folder or request a new verification email from your Profile page.'
        }
      ]
    },
    {
      id: 'payments',
      title: 'Payments & Billing',
      icon: '💰',
      faqs: [
        {
          id: 'payments-1',
          question: 'How do I set up payment methods?',
          answer: 'Go to your Billing page and add your preferred payment methods. We accept major credit cards, bank transfers, and digital wallets. All payment information is securely encrypted.'
        },
        {
          id: 'payments-2',
          question: 'When do I receive payments for completed jobs?',
          answer: 'Payments are typically processed within 2-3 business days after job completion and client approval. You can track payment status in your Billing dashboard.'
        },
        {
          id: 'payments-3',
          question: 'What are the platform fees?',
          answer: 'We charge a 10% platform fee on all completed jobs. This covers payment processing, customer support, and platform maintenance. Fees are automatically deducted from your earnings.'
        }
      ]
    },
    {
      id: 'jobs',
      title: 'Job Management',
      icon: '🔧',
      faqs: [
        {
          id: 'jobs-1',
          question: 'How do I accept or decline job requests?',
          answer: 'When you receive a job request, you\'ll see it in your Jobs dashboard. Click "Accept" to take the job or "Decline" to pass. You can also message the client for more details before deciding.'
        },
        {
          id: 'jobs-2',
          question: 'What happens if I need to reschedule a job?',
          answer: 'Contact the client immediately through the platform messaging system. Most clients are understanding about rescheduling, but frequent changes may affect your rating.'
        },
        {
          id: 'jobs-3',
          question: 'How do I mark a job as completed?',
          answer: 'After finishing the work, go to the job details page and click "Mark Complete". The client will then be prompted to approve the completion and leave a review.'
        }
      ]
    },
    {
      id: 'reviews',
      title: 'Reviews & Ratings',
      icon: '⭐',
      faqs: [
        {
          id: 'reviews-1',
          question: 'How do I request reviews from clients?',
          answer: 'Use the "Request Review" feature in your dashboard for jobs completed within the last 72 hours. You can customize the message and select which review categories to request.'
        },
        {
          id: 'reviews-2',
          question: 'Can I respond to negative reviews?',
          answer: 'Yes, you can respond to all reviews. We encourage professional responses that address concerns and show your commitment to customer satisfaction.'
        },
        {
          id: 'reviews-3',
          question: 'How do reviews affect my visibility?',
          answer: 'Higher ratings and more positive reviews improve your ranking in search results and increase your chances of being selected by potential clients.'
        }
      ]
    },
    {
      id: 'support',
      title: 'Technical Support',
      icon: '🛠️',
      faqs: [
        {
          id: 'support-1',
          question: 'What if I can\'t log into my account?',
          answer: 'Try resetting your password using the "Forgot Password" link. If that doesn\'t work, contact our support team with your email address and we\'ll help you regain access.'
        },
        {
          id: 'support-2',
          question: 'How do I update the mobile app?',
          answer: 'Check your device\'s app store for updates. Enable automatic updates to ensure you always have the latest version with new features and security improvements.'
        },
        {
          id: 'support-3',
          question: 'What should I do if the app crashes?',
          answer: 'Try closing and reopening the app. If the problem persists, restart your device or reinstall the app. Contact support if issues continue.'
        }
      ]
    }
  ];

  const toggleItem = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const filteredCategories = faqCategories.map(category => ({
    ...category,
    faqs: category.faqs.filter(faq => 
      faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.faqs.length > 0);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href="/vendor/support" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800">
                <ArrowLeft className="w-4 h-4" />
                Back to Support
              </Link>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Frequently Asked Questions</h1>
          <p className="text-gray-600">Find answers to common questions about using the Reliance platform</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search FAQs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* FAQ Categories */}
        <div className="space-y-6">
          {filteredCategories.map(category => (
            <Card key={category.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <span className="text-2xl">{category.icon}</span>
                  {category.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {category.faqs.map(faq => (
                    <div key={faq.id} className="border-b border-gray-100 last:border-b-0 pb-4 last:pb-0">
                      <button
                        onClick={() => toggleItem(faq.id)}
                        className="w-full text-left flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <h3 className="font-medium text-gray-900 pr-4">{faq.question}</h3>
                        {expandedItems.has(faq.id) ? (
                          <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                        )}
                      </button>
                      {expandedItems.has(faq.id) && (
                        <div className="px-3 pb-3">
                          <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Contact Support */}
        <Card className="mt-8">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Still need help?</h3>
              <p className="text-gray-600 mb-4">Can't find what you're looking for? Our support team is here to help.</p>
              <div className="flex gap-4 justify-center">
                <Button asChild>
                  <Link href="/vendor/support/contact">Contact Support</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/vendor/support/chat">Open Chat</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 