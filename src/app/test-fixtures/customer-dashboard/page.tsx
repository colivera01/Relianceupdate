import { notFound } from 'next/navigation';
import UserDashboardPage from '@/app/(user)/user-dashboard/page';

export default function CustomerDashboardFixture() {
  if (process.env.E2E_VISUAL_FIXTURES !== '1') notFound();
  return <div className="reliance-operator-shell min-h-screen p-4"><UserDashboardPage /></div>;
}
