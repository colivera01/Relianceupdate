import { notFound } from "next/navigation";

import AdminReviewsPage from "@/app/admin/reviews/page";

export default function AdminReviewModerationFixturePage() {
  if (process.env.E2E_VISUAL_FIXTURES !== "1") notFound();
  return <AdminReviewsPage />;
}
