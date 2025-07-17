"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Search, BookOpen, Clock, User, Star } from 'lucide-react';
import { useState } from 'react';

export default function HelpArticlesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', name: 'All Articles', icon: '📚' },
    { id: 'getting-started', name: 'Getting Started', icon: '🚀' },
    { id: 'profile', name: 'Profile & Settings', icon: '👤' },
    { id: 'jobs', name: 'Job Management', icon: '🔧' },
    { id: 'payments', name: 'Payments & Billing', icon: '💰' },
    { id: 'marketing', name: 'Marketing & Growth', icon: '📈' },
    { id: 'best-practices', name: 'Best Practices', icon: '⭐' }
  ];

  const articles = [
    {
      id: 'complete-profile',
      title: 'How to Complete Your Vendor Profile',
      category: 'profile',
      categoryName: 'Profile & Settings',
      description: 'Learn how to create a compelling profile that attracts more clients and builds trust.',
      readTime: '5 min read',
      difficulty: 'Beginner',
      rating: 4.8,
      views: 1247,
      tags: ['profile', 'verification', 'trust'],
      content: 'A complete profile is essential for building trust with potential clients...'
    },
    {
      id: 'first-job',
      title: 'Accepting Your First Job: A Complete Guide',
      category: 'jobs',
      categoryName: 'Job Management',
      description: 'Step-by-step guide to accepting and completing your first job on the platform.',
      readTime: '8 min read',
      difficulty: 'Beginner',
      rating: 4.9,
      views: 2156,
      tags: ['first job', 'acceptance', 'completion'],
      content: 'Congratulations on getting your first job request! Here\'s everything you need to know...'
    },
    {
      id: 'pricing-strategy',
      title: 'Setting Competitive Pricing for Your Services',
      category: 'payments',
      categoryName: 'Payments & Billing',
      description: 'Strategies for pricing your services competitively while maintaining profitability.',
      readTime: '12 min read',
      difficulty: 'Intermediate',
      rating: 4.7,
      views: 1893,
      tags: ['pricing', 'strategy', 'competition'],
      content: 'Pricing your services correctly is crucial for business success...'
    },
    {
      id: 'client-communication',
      title: 'Effective Client Communication Best Practices',
      category: 'best-practices',
      categoryName: 'Best Practices',
      description: 'Learn how to communicate professionally with clients to build lasting relationships.',
      readTime: '10 min read',
      difficulty: 'Intermediate',
      rating: 4.6,
      views: 1654,
      tags: ['communication', 'clients', 'professionalism'],
      content: 'Clear and professional communication is key to client satisfaction...'
    },
    {
      id: 'reviews-success',
      title: 'Getting Great Reviews: A Vendor\'s Guide',
      category: 'marketing',
      categoryName: 'Marketing & Growth',
      description: 'Tips and strategies for earning positive reviews and building your reputation.',
      readTime: '7 min read',
      difficulty: 'Beginner',
      rating: 4.8,
      views: 2034,
      tags: ['reviews', 'reputation', 'feedback'],
      content: 'Positive reviews are one of the most powerful tools for growing your business...'
    },
    {
      id: 'availability-management',
      title: 'Managing Your Availability and Schedule',
      category: 'jobs',
      categoryName: 'Job Management',
      description: 'How to set up and manage your availability to maximize job opportunities.',
      readTime: '6 min read',
      difficulty: 'Beginner',
      rating: 4.5,
      views: 1432,
      tags: ['availability', 'schedule', 'time management'],
      content: 'Properly managing your availability helps you get more jobs...'
    },
    {
      id: 'payment-setup',
      title: 'Setting Up Payments and Getting Paid',
      category: 'payments',
      categoryName: 'Payments & Billing',
      description: 'Complete guide to setting up payment methods and understanding the payment process.',
      readTime: '9 min read',
      difficulty: 'Beginner',
      rating: 4.7,
      views: 1789,
      tags: ['payments', 'setup', 'billing'],
      content: 'Setting up your payment methods correctly ensures you get paid on time...'
    },
    {
      id: 'service-expansion',
      title: 'Expanding Your Service Offerings',
      category: 'marketing',
      categoryName: 'Marketing & Growth',
      description: 'How to identify and add new services to grow your business.',
      readTime: '11 min read',
      difficulty: 'Advanced',
      rating: 4.4,
      views: 987,
      tags: ['expansion', 'services', 'growth'],
      content: 'Expanding your service offerings can significantly increase your earning potential...'
    }
  ];

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href="/vendor/dashboard" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Link>
              <span className="text-gray-400">|</span>
              <Link href="/vendor/support" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800">
                <ArrowLeft className="w-4 h-4" />
                Back to Support
              </Link>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Help Articles</h1>
          <p className="text-gray-600">Detailed guides and tutorials to help you succeed on the Reliance platform</p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="mr-2">{category.icon}</span>
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Articles Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredArticles.map(article => (
            <Card key={article.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    {article.categoryName}
                  </span>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span>{article.rating}</span>
                  </div>
                </div>
                <CardTitle className="text-lg leading-tight">{article.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">{article.description}</p>
                
                <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{article.readTime}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>{article.difficulty}</span>
                    </div>
                  </div>
                  <span>{article.views} views</span>
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  {article.tags.map(tag => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {tag}
                    </span>
                  ))}
                </div>

                <Button asChild className="w-full">
                  <Link href={`/vendor/support/help-articles/${article.id}`}>
                    <BookOpen className="w-4 h-4 mr-2" />
                    Read Article
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredArticles.length === 0 && (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No articles found</h3>
              <p className="text-gray-600 mb-4">Try adjusting your search terms or category filter.</p>
              <Button onClick={() => { setSearchTerm(''); setSelectedCategory('all'); }}>
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Featured Article */}
        <Card className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">New to Reliance?</h3>
              <p className="text-gray-600 mb-4">Start with our comprehensive getting started guide</p>
              <Button asChild>
                <Link href="/vendor/support/help-articles/getting-started-guide">
                  Read Getting Started Guide
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 