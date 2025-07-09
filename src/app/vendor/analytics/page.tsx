'use client';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const mockEmployees = [
  { id: 1, name: 'Maria Lopez', jobs: 8, avgScore: 4.9, reviews: [
    { text: "Great work!", stars: 5 },
    { text: "Very professional.", stars: 5 },
    { text: "Good communication.", stars: 4 },
    { text: "Could be faster.", stars: 3 }
  ] },
  { id: 2, name: 'James Lee', jobs: 5, avgScore: 4.7, reviews: [
    { text: "Quick and efficient.", stars: 5 },
    { text: "Would hire again.", stars: 5 },
    { text: "Average experience.", stars: 3 }
  ] },
];

export default function TeamAnalytics() {
  const [employees] = useState(mockEmployees);
  const [starFilter, setStarFilter] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = () => setExpanded(e => !e);

  return (
    <div className="px-4 md:px-8 py-8 space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <Button variant="outline" asChild>
          <a href="/vendor">Back</a>
        </Button>
        <h2 className="text-2xl font-bold">Employee Analytics</h2>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Team Performance Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-2 items-center">
            <span className="text-sm font-medium">Filter reviews by stars:</span>
            {[5,4,3,2,1].map(star => (
              <Button key={star} size="sm" variant={starFilter === star ? 'default' : 'outline'} onClick={() => setStarFilter(starFilter === star ? null : star)}>
                {star} <span className="text-yellow-500">★</span>
              </Button>
            ))}
            {starFilter && <Button size="sm" variant="ghost" onClick={() => setStarFilter(null)}>Clear</Button>}
            <Button size="sm" variant="outline" onClick={toggleExpand}>
              {expanded ? 'Show Less' : 'Show More'}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {employees.map(emp => {
              const filteredReviews = emp.reviews.filter(r => !starFilter || r.stars === starFilter);
              const reviewsToShow = expanded ? filteredReviews : filteredReviews.slice(0, 3);
              return (
                <div key={emp.id} className="bg-gray-50 rounded p-4">
                  <div className="font-semibold mb-1">{emp.name}</div>
                  <div className="text-xs text-gray-600 mb-1">Jobs Completed: {emp.jobs}</div>
                  <div className="text-xs text-gray-600 mb-1">Avg. Review Score: {emp.avgScore} <span className="text-yellow-500">★</span></div>
                  <div className="text-xs text-gray-600 mb-1">Reviews:</div>
                  <ul className="text-xs text-gray-700 mb-2">
                    {filteredReviews.length === 0 && <li>No reviews for this filter.</li>}
                    {reviewsToShow.map((r, i) => (
                      <li key={i} className="flex items-center gap-2">• {r.text} <span className="text-yellow-500">{Array(r.stars).fill('★').join('')}</span></li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      {/* Backend Developer Notes Section */}
      <div className="mt-10">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded shadow-sm">
          <h3 className="font-bold text-yellow-800 mb-2">Backend Developer Notes</h3>
          <ul className="text-sm text-yellow-900 list-disc pl-5 space-y-1">
            <li>Fetch employee analytics from <b>GET /api/vendor/analytics</b></li>
            <li>Fetch reviews for each employee from <b>GET /api/vendor/employees/:employeeId/reviews</b></li>
            <li>All actions should be authenticated as vendor</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 