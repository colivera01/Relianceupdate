import { notFound } from 'next/navigation';
import MyBookingsPage from '@/app/(user)/my-bookings/page';

export default function CustomerServiceRecordsFixturePage() {
  if (process.env.E2E_VISUAL_FIXTURES !== '1') notFound();
  return <MyBookingsPage />;
}
