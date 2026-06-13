import { redirect } from "next/navigation";

export default function LegacyAdminUsersPage() {
  redirect("/admin/accounts?tab=customers");
}
