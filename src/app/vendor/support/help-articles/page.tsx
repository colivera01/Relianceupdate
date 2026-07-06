"use client";

import { useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  Clock,
  Megaphone,
  Rocket,
  Search,
  Star,
  User,
  Wallet,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  HAS_LAUNCH_SUPPORT_EMAIL,
  LAUNCH_SUPPORT_EMAIL,
  LAUNCH_SUPPORT_MAILTO,
} from '@/lib/support';

type Category = {
  id: string;
  name: string;
  icon: LucideIcon;
};

type Article = {
  id: string;
  title: string;
  category: string;
  categoryName: string;
  description: string;
  readTime: string;
  difficulty: string;
  tags: string[];
  actionHref: string;
  actionLabel: string;
};

const categories: Category[] = [
  { id: 'all', name: 'All Articles', icon: BookOpen },
  { id: 'getting-started', name: 'Getting Started', icon: Rocket },
  { id: 'profile', name: 'Profile & Settings', icon: User },
  { id: 'jobs', name: 'Manage Jobs', icon: Briefcase },
  { id: 'free-launch', name: 'Free Launch', icon: Wallet },
  { id: 'marketing', name: 'Marketing & Growth', icon: Megaphone },
  { id: 'best-practices', name: 'Best Practices', icon: Star },
];

const articles: Article[] = [
  {
    id: 'complete-profile',
    title: 'How to Complete Your Vendor Profile',
    category: 'profile',
    categoryName: 'Profile & Settings',
    description:
      'Keep business details, contact information, address, reminders, and security preferences current.',
    readTime: '5 min read',
    difficulty: 'Beginner',
    tags: ['profile', 'verification', 'trust'],
    actionHref: '/vendor/profile',
    actionLabel: 'Open Profile',
  },
  {
    id: 'first-job',
    title: 'Managing Your First Work Record',
    category: 'jobs',
    categoryName: 'Manage Jobs',
    description:
      'Use Manage Jobs to review service records, required video stages, employee assignment, and manager approval status.',
    readTime: '8 min read',
    difficulty: 'Beginner',
    tags: ['first job', 'acceptance', 'completion'],
    actionHref: '/vendor/jobs',
    actionLabel: 'View Manage Jobs',
  },
  {
    id: 'pricing-strategy',
    title: 'Setting Competitive Reference Prices for Services Offered',
    category: 'profile',
    categoryName: 'Profile & Settings',
    description:
      'Strategies for setting informational service prices while Reliance payments are deferred.',
    readTime: '12 min read',
    difficulty: 'Intermediate',
    tags: ['pricing', 'strategy', 'competition'],
    actionHref: '/vendor/services',
    actionLabel: 'Manage Services Offered',
  },
  {
    id: 'client-communication',
    title: 'Effective Client Communication Best Practices',
    category: 'best-practices',
    categoryName: 'Best Practices',
    description:
      'Coordinate customer details through your normal process while Reliance messaging is deferred.',
    readTime: '10 min read',
    difficulty: 'Intermediate',
    tags: ['communication', 'customers', 'professionalism'],
    actionHref: '/vendor/jobs',
    actionLabel: 'View Manage Jobs',
  },
  {
    id: 'reviews-success',
    title: 'Understanding Video-Backed Reviews',
    category: 'marketing',
    categoryName: 'Marketing & Growth',
    description:
      'How approved public reviews connect to completed video-backed service records during launch.',
    readTime: '7 min read',
    difficulty: 'Beginner',
    tags: ['reviews', 'reputation', 'feedback'],
    actionHref: '/vendor/jobs',
    actionLabel: 'Review Job Videos',
  },
  {
    id: 'availability-management',
    title: 'Managing Your Availability and Schedule',
    category: 'jobs',
    categoryName: 'Manage Jobs',
    description:
      'Use the current vendor tools to keep team access and job ownership clear.',
    readTime: '6 min read',
    difficulty: 'Beginner',
    tags: ['availability', 'schedule', 'time management'],
    actionHref: '/vendor/employees',
    actionLabel: 'Manage Employees',
  },
  {
    id: 'payment-setup',
    title: 'Billing During the Free Launch',
    category: 'free-launch',
    categoryName: 'Free Launch',
    description:
      'What vendors should know while billing and payment processing are deferred.',
    readTime: '9 min read',
    difficulty: 'Beginner',
    tags: ['free launch', 'billing deferred', 'payments'],
    actionHref: '/vendor/support/faqs',
    actionLabel: 'Read Free Launch FAQs',
  },
  {
    id: 'service-expansion',
    title: 'Updating Your Service Catalog',
    category: 'marketing',
    categoryName: 'Marketing & Growth',
    description:
      'Add or revise saved services and reference estimates without implying live payment setup.',
    readTime: '11 min read',
    difficulty: 'Advanced',
    tags: ['expansion', 'services', 'growth'],
    actionHref: '/vendor/services',
    actionLabel: 'Manage Services Offered',
  },
];

export default function HelpArticlesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredArticles = articles.filter((article) => {
    const matchesSearch =
      article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory =
      selectedCategory === 'all' || article.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/vendor/support"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Support
              </Link>
            </div>
          </div>
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Help Articles</h1>
          <p className="text-gray-600">
            Short launch guides that point to vendor pages you can use today.
          </p>
        </div>

        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Need direct launch help?</h2>
                <p className="text-sm text-gray-600">
                  These guides are self-service. Use the support hub for launch workflows, or reach
                  out if you need help with login, jobs, approvals, or media.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" asChild>
                  <Link href="/vendor/support">Open Support Hub</Link>
                </Button>
                {HAS_LAUNCH_SUPPORT_EMAIL ? (
                  <Button asChild>
                    <a href={LAUNCH_SUPPORT_MAILTO}>{LAUNCH_SUPPORT_EMAIL}</a>
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <category.icon className="h-4 w-4" />
                  {category.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredArticles.map((article) => (
            <Card key={article.id} className="transition-shadow hover:shadow-lg">
              <CardHeader>
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600">
                    {article.categoryName}
                  </span>
                </div>
                <CardTitle className="text-lg leading-tight">{article.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 line-clamp-3 text-sm text-gray-600">{article.description}</p>

                <div className="mb-4 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{article.readTime}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{article.difficulty}</span>
                    </div>
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-1">
                  {article.tags.map((tag) => (
                    <span key={tag} className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                      {tag}
                    </span>
                  ))}
                </div>

                <Button asChild className="w-full">
                  <Link href={article.actionHref}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    {article.actionLabel}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredArticles.length === 0 ? (
          <Card>
            <CardContent className="pb-12 pt-12 text-center">
              <BookOpen className="mx-auto mb-4 h-12 w-12 text-gray-400" />
              <h3 className="mb-2 text-lg font-semibold">No articles found</h3>
              <p className="mb-4 text-gray-600">
                Try adjusting your search terms or category filter.
              </p>
              <Button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                }}
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card className="mt-8 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="mb-2 text-lg font-semibold">New to Reliance?</h3>
              <p className="mb-4 text-gray-600">
                Start by completing your vendor profile and service catalog so your business details
                are ready for launch review.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button asChild>
                  <Link href="/vendor/profile">Open Vendor Profile</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/vendor/support/faqs">Read FAQs</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
