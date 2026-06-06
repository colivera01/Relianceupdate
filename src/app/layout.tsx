import './globals.css';
import type { Metadata } from 'next';
import { Manrope, Sora } from 'next/font/google';
import ClientProviders from '@/components/ClientProviders';
import { QueryProvider } from '../providers/QueryProvider';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
});

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'Reliance',
  description: 'Find trusted local professionals and manage Reliance service work.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${sora.variable} ${manrope.className}`}>
        <QueryProvider>
          <ClientProviders>
            {children}
          </ClientProviders>
        </QueryProvider>
      </body>
    </html>
  );
} 
