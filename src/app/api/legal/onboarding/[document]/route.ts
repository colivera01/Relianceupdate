import { NextResponse } from "next/server";

import {
  BETA_ONBOARDING_DOCUMENT_LABELS,
  BETA_ONBOARDING_LEGAL_PACKAGE,
  betaOnboardingDocument,
  type BetaOnboardingDocumentId,
} from "@/lib/legal/beta-onboarding-content";

export async function GET(
  _request: Request,
  context: { params: Promise<{ document: string }> },
) {
  const { document } = await context.params;
  try {
    const entry = betaOnboardingDocument(document);
    const documentId = entry.documentId as BetaOnboardingDocumentId;
    const body = [
      BETA_ONBOARDING_DOCUMENT_LABELS[documentId],
      `Version: ${entry.version}`,
      `SHA-256: ${entry.contentHash}`,
      `Package: ${BETA_ONBOARDING_LEGAL_PACKAGE.packageKey}`,
      `Package SHA-256: ${BETA_ONBOARDING_LEGAL_PACKAGE.packageSha256}`,
      "",
      entry.contentSnapshot,
    ].join("\n");
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${documentId}-${entry.version}.txt"`,
        "Cache-Control": "public, max-age=300, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Legal document not found." }, { status: 404 });
  }
}
