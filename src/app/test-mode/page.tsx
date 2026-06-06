import { notFound } from "next/navigation";
import TestModeClient from "./TestModeClient";

export default function TestModePage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <TestModeClient />;
}
