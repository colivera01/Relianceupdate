import { notFound } from 'next/navigation';
import CustomerReviewsPage from '@/app/(user)/reviews/page';

export default function CustomerReviewsFixturePage() {
  if (process.env.E2E_VISUAL_FIXTURES !== '1') notFound();
  return <div className="reliance-operator-shell min-h-screen p-4"><CustomerReviewsPage /></div>;
}
