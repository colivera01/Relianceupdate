import { notFound } from 'next/navigation';
import CustomerFavoritesPage from '@/app/(user)/favorites/page';

export default function CustomerFavoritesFixturePage() {
  if (process.env.E2E_VISUAL_FIXTURES !== '1') notFound();
  return <CustomerFavoritesPage />;
}
