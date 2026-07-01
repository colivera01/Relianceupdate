import type { Metadata } from "next";
import { getBetaGateConfig, sanitizeBetaReturnTo } from "@/lib/beta-gate";
import { BetaAccessForm } from "./BetaAccessForm";

export const metadata: Metadata = {
  title: "Reliance Private Beta Access",
  robots: {
    index: false,
    follow: false,
  },
};

type BetaAccessPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSingleParam(
  params: Record<string, string | string[] | undefined>,
  key: string
): string {
  const value = params[key];
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function BetaAccessPage({ searchParams }: BetaAccessPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const returnTo = sanitizeBetaReturnTo(readSingleParam(resolvedSearchParams, "returnTo"));
  const hasError = readSingleParam(resolvedSearchParams, "error") === "1";
  const betaGate = getBetaGateConfig();
  const isMisconfigured = betaGate.enabled && !betaGate.password;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#173b7a_0,#08111f_36%,#04070d_100%)] px-4 py-10 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/80 shadow-[0_30px_90px_rgba(2,6,23,0.45)] md:grid-cols-[0.9fr_1.1fr]">
          <div className="border-b border-white/10 bg-blue-950/30 p-8 md:border-b-0 md:border-r">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-200">
              Reliance private beta
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight">
              Beta access required
            </h1>
            <p className="mt-4 text-sm leading-7 text-blue-100/78">
              This preview is for approved Reliance beta testers only. Enter the beta access
              password first, then continue with your normal Reliance account sign-in.
            </p>
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-blue-50/78">
              Normal customer, vendor, employee, manager, and admin permissions still apply after
              this gate.
            </div>
          </div>

          <div className="p-8">
            {isMisconfigured ? (
              <div className="rounded-2xl border border-amber-300/35 bg-amber-500/12 p-5 text-amber-50">
                <h2 className="text-xl font-semibold">Beta access is not configured yet</h2>
                <p className="mt-3 text-sm leading-6 text-amber-50/82">
                  BETA_GATE_ENABLED is on, but BETA_GATE_PASSWORD is missing. Set the beta password
                  before pointing DNS or inviting testers.
                </p>
              </div>
            ) : (
              <BetaAccessForm returnTo={returnTo} hasError={hasError} />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
