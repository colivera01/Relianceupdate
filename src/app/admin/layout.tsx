import SidebarLayout from '../SidebarLayout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <SidebarLayout>{children}</SidebarLayout>;
} 