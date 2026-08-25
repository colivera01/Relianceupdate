import { notFound } from "next/navigation";

import Rv8PackageVisibilityFixture from "./Rv8PackageVisibilityFixture";

export default function Rv8PackageVisibilityFixturePage() {
  if (process.env.E2E_VISUAL_FIXTURES !== "1") notFound();
  return <Rv8PackageVisibilityFixture />;
}
