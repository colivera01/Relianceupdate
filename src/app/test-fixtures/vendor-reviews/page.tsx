import { notFound } from "next/navigation";
import VendorReviewsPage from "@/app/vendor/reviews/page";

export default function VendorReviewsFixturePage() {
  if (process.env.E2E_VISUAL_FIXTURES !== "1") notFound();
  return <VendorReviewsPage />;
}
