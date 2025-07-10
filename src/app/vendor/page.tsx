import { redirect } from 'next/navigation';

export default function VendorRootRedirect() {
  redirect('/vendor/dashboard');
  return null;
} 