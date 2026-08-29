import { notFound } from "next/navigation";

import CustomerSupportPage from "@/app/(user)/customer/support/page";
import VendorSupportPage from "@/app/vendor/support/page";

export default async function Rv8SupportFixturePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.E2E_VISUAL_FIXTURES !== "1") notFound();
  const params = searchParams ? await searchParams : {};
  const role = String(params.role || "").trim().toLowerCase();

  if (role === "customer") return <CustomerSupportPage />;
  if (role === "vendor") return <VendorSupportPage />;
  notFound();
}
