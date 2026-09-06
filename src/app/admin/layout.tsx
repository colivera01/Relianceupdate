import { headers } from "next/headers";
import SidebarLayout from "../SidebarLayout";
import { readAdminAccess } from "@/lib/admin-auth";
import { AdminAccessRequired } from "@/components/admin/AdminAccessRequired";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const adminAccess = await readAdminAccess(
    new Request("http://localhost/admin", {
      headers: requestHeaders,
    })
  );

  if (!adminAccess.isAdmin) {
    return <AdminAccessRequired />;
  }

  return <SidebarLayout>{children}</SidebarLayout>;
}
