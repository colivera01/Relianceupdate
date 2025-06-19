import Link from 'next/link';

export default function Home() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Reliance Admin Dashboard</h1>
      <nav className="space-y-2">
        <Link href="/users" className="block text-blue-600 hover:underline">
          User Management
        </Link>
      </nav>
    </div>
  );
} 