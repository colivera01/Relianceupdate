import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const mockUser = {
  name: 'Jane Doe',
  email: 'jane.doe@email.com',
  recentActivity: [
    'Requested support for order #1234',
    'Left a review for Bright Electric',
    'Updated profile information',
    'Viewed invoice #5678',
  ],
  notifications: [
    'Your support ticket #1234 has been updated.',
    'New offer from Spark HVAC!',
    'Your subscription renews in 3 days.',
  ],
};

export default function UserDashboard() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Welcome, {mockUser.name}!</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-gray-700 space-y-2">
              {mockUser.recentActivity.map((item, i) => (
                <li key={i}>• {item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-gray-700 space-y-2">
              {mockUser.notifications.map((note, i) => (
                <li key={i}>• {note}</li>
              ))}
            </ul>
            <Button className="mt-4 w-full" variant="outline" asChild>
              <a href="/support">Go to Support</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 