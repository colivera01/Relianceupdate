import { notFound } from "next/navigation";

import Epic7LifecycleVisualFixture from "./Epic7LifecycleVisualFixture";

export default function Epic7LifecycleVisualFixturePage() {
  if (process.env.E2E_VISUAL_FIXTURES !== "1") notFound();
  return <Epic7LifecycleVisualFixture />;
}
