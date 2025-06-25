export default function Home() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <DashboardCard icon="👥" label="Total Users" value="1,250" />
        <DashboardCard icon="🏢" label="Total Vendors" value="89" />
        <DashboardCard icon="⭐" label="Total Reviews" value="5,670" />
        <DashboardCard icon="📈" label="Growth" value="+12%" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-6 shadow">
          <h2 className="font-semibold mb-4">User Growth</h2>
          <div className="h-48 flex items-center justify-center text-gray-400">[User Growth Chart]</div>
        </div>
        <div className="bg-white rounded-lg p-6 shadow">
          <h2 className="font-semibold mb-4">Revenue Trend</h2>
          <div className="h-48 flex items-center justify-center text-gray-400">[Revenue Trend Chart]</div>
        </div>
      </div>
    </div>
  );
}

function DashboardCard({ icon, label, value }: any) {
  return (
    <div className="bg-white rounded-lg p-6 flex flex-col items-center shadow">
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-lg font-semibold">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}