import { notFound } from "next/navigation";
import Epic6PublicationVisualFixture from "./Epic6PublicationVisualFixture";

export default function Epic6PublicationVisualFixturePage() {
  if (process.env.E2E_VISUAL_FIXTURES !== "1") notFound();
  return <Epic6PublicationVisualFixture />;
}
