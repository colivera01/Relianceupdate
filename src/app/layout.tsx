import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import SidebarLayout from './SidebarLayout';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Reliance Admin',
  description: 'Admin interface for the Reliance platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SidebarLayout>{children}</SidebarLayout>
      </body>
    </html>
  );
} 