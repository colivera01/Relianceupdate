import { NextResponse } from 'next/server';

// TODO: BACKEND DEVELOPER - Replace this mock implementation with actual database queries
// This endpoint provides monthly user growth data for the dashboard charts

export async function GET() {
  try {
    // TODO: Replace with actual database queries
    // Example queries your backend should implement:
    
    // const monthlyData = await db.users.groupBy({
    //   by: ['createdAt'],
    //   _count: {
    //     id: true
    //   },
    //   where: {
    //     createdAt: {
    //       gte: new Date(new Date().getFullYear(), 0, 1) // Start of current year
    //     }
    //   }
    // });
    
    // const activeUsersData = await db.users.groupBy({
    //   by: ['lastLoginAt'],
    //   _count: {
    //     id: true
    //   },
    //   where: {
    //     lastLoginAt: {
    //       gte: new Date(new Date().getFullYear(), 0, 1)
    //     },
    //     status: 'active'
    //   }
    // });

    // Mock data showing realistic user growth patterns
    const mockData = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [
        {
          label: 'New Users',
          data: [120, 145, 180, 220, 280, 320, 380, 420, 480, 520, 580, 650],
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
        },
        {
          label: 'Active Users',
          data: [800, 850, 920, 1050, 1180, 1320, 1480, 1650, 1820, 2000, 2180, 2350],
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
        }
      ]
    };

    return NextResponse.json(mockData);
  } catch (error) {
    console.error('User growth data error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user growth data' },
      { status: 500 }
    );
  }
}

// TODO: BACKEND DEVELOPER - Helper functions you might need

// Example function to aggregate monthly data
// async function aggregateMonthlyData(data: any[], dateField: string) {
//   const monthlyCounts = new Array(12).fill(0);
//   
//   data.forEach(item => {
//     const date = new Date(item[dateField]);
//     const month = date.getMonth();
//     monthlyCounts[month]++;
//   });
//   
//   return monthlyCounts;
// }

// Example function to get user growth metrics
// async function getUserGrowthMetrics() {
//   const currentYear = new Date().getFullYear();
//   
//   // New user registrations by month
//   const newUsers = await db.users.count({
//     where: {
//       createdAt: {
//         gte: new Date(currentYear, 0, 1),
//         lt: new Date(currentYear + 1, 0, 1)
//       }
//     }
//   });
//   
//   // Active users (logged in within last 30 days)
//   const activeUsers = await db.users.count({
//     where: {
//       lastLoginAt: {
//         gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
//       },
//       status: 'active'
//     }
//   });
//   
//   return { newUsers, activeUsers };
// } 