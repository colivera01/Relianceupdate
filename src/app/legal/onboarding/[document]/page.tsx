import { Download, FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  BETA_ONBOARDING_DOCUMENT_LABELS,
  BETA_ONBOARDING_LEGAL_PACKAGE,
  betaOnboardingDocument,
  type BetaOnboardingDocumentId,
} from "@/lib/legal/beta-onboarding-content";

export default async function OnboardingLegalDocumentPage(props: {
  params: Promise<{ document: string }>;
}) {
  const { document } = await props.params;
  let entry;
  try {
    entry = betaOnboardingDocument(document);
  } catch {
    notFound();
  }
  const documentId = entry.documentId as BetaOnboardingDocumentId;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 sm:py-12">
      <article className="mx-auto max-w-4xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-blue-700">Exact beta onboarding version</p>
            <h1 className="mt-2 text-3xl font-bold">{BETA_ONBOARDING_DOCUMENT_LABELS[documentId]}</h1>
            <p className="mt-3 text-sm text-slate-600">
              Package {BETA_ONBOARDING_LEGAL_PACKAGE.packageKey}
            </p>
          </div>
          <Link
            href={`/api/legal/onboarding/${documentId}?download=1`}
            className="inline-flex items-center justify-center gap-2 border border-blue-700 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download exact version
          </Link>
        </div>

        <div className="mt-7 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <FileText className="h-4 w-4 text-blue-700" aria-hidden="true" />
          Version {entry.version}
        </div>
        <pre className="mt-5 whitespace-pre-wrap font-sans text-sm leading-7 text-slate-800">
          {entry.contentSnapshot}
        </pre>
        <p className="mt-8 break-all border-t border-slate-200 pt-5 text-xs text-slate-500">
          SHA-256 {entry.contentHash}
        </p>
      </article>
    </main>
  );
}
