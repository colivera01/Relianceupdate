import { notFound } from "next/navigation";

import ContentReportingFixture from "./ContentReportingFixture";

export default function ContentReportingFixturePage() {
  if (process.env.E2E_VISUAL_FIXTURES !== "1") notFound();
  return <ContentReportingFixture />;
}
