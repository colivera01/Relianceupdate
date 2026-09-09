import { notFound } from "next/navigation";

import UserSidebar from "@/components/UserSidebar";

export default function CustomerMobileNavigationFixture() {
  if (process.env.E2E_VISUAL_FIXTURES !== "1") notFound();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <UserSidebar />
      <main className="mx-auto max-w-xl p-6 pb-28">
        <h1 className="text-2xl font-semibold">Customer navigation fixture</h1>
      </main>
    </div>
  );
}
