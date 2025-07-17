"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function SupportPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Link href="/vendor/dashboard" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Support</h1>
          <p className="text-gray-600">Get help with your account, services, and platform features</p>
        </div>

        <div className="grid gap-6">
          {/* Quick Help Section */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Help</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Getting Started</h3>
                  <p className="text-sm text-gray-600 mb-3">Complete your profile and start accepting jobs</p>
                  <Link href="/vendor/profile" className="text-blue-600 text-sm hover:underline">
                    Complete Profile →
                  </Link>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Payment Setup</h3>
                  <p className="text-sm text-gray-600 mb-3">Set up your payment methods and billing</p>
                  <Link href="/vendor/billing" className="text-blue-600 text-sm hover:underline">
                    Setup Payments →
                  </Link>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Service Management</h3>
                  <p className="text-sm text-gray-600 mb-3">Add and manage your services</p>
                  <Link href="/vendor/profile" className="text-blue-600 text-sm hover:underline">
                    Manage Services →
                  </Link>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Job Management</h3>
                  <p className="text-sm text-gray-600 mb-3">Learn how to manage jobs and clients</p>
                  <Link href="/vendor/jobs" className="text-blue-600 text-sm hover:underline">
                    View Jobs →
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold mb-1">Email Support</h4>
                  <p className="text-gray-600">support@reliance.com</p>
                  <p className="text-gray-500">Response within 24 hours</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Phone Support</h4>
                  <p className="text-gray-600">1-800-RELIANCE</p>
                  <p className="text-gray-500">Mon-Fri 9AM-6PM EST</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Live Chat</h4>
                  <p className="text-gray-600">Available 24/7</p>
                  <p className="text-gray-500">Instant response</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 