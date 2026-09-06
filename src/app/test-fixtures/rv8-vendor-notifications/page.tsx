import { notFound } from "next/navigation";

import VendorNotificationsPage from "@/app/vendor/notifications/page";

export default function Rv8VendorNotificationsFixturePage() {
  if (process.env.E2E_VISUAL_FIXTURES !== "1") notFound();
  return <div className="reliance-operator-shell min-h-screen p-4"><VendorNotificationsPage /></div>;
}
