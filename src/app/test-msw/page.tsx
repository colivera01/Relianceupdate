'use client';

import { EmployeeList } from '@/components/EmployeeList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function TestMSWPage() {
  const apiMode = process.env.NEXT_PUBLIC_API_MODE || 'live';
  const isMockMode = apiMode === 'mock';

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            MSW & Repository Pattern Test
            <Badge variant={isMockMode ? 'default' : 'secondary'}>
              {isMockMode ? 'Mock Mode' : 'Live Mode'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            This page demonstrates the MSW dual-mode and repository pattern implementation.
            {isMockMode ? (
              <span className="text-green-600 font-medium">
                {' '}Currently running in mock mode with MSW intercepting API calls.
              </span>
            ) : (
              <span className="text-blue-600 font-medium">
                {' '}Currently running in live mode with real API calls.
              </span>
            )}
          </p>
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Environment Configuration:</h3>
            <ul className="text-sm space-y-1">
              <li><strong>NEXT_PUBLIC_API_MODE:</strong> {apiMode}</li>
              <li><strong>NEXT_PUBLIC_API_BASE_URL:</strong> {process.env.NEXT_PUBLIC_API_BASE_URL || 'Not set'}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <EmployeeList />
    </div>
  );
}


