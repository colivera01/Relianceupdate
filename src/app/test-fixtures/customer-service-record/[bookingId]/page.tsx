import { notFound } from 'next/navigation';
import BookingMediaDetailPage from '@/app/(user)/my-bookings/[bookingId]/page';

export default function CustomerServiceRecordFixturePage() {
  if (process.env.E2E_VISUAL_FIXTURES !== '1') notFound();
  return <BookingMediaDetailPage />;
}
