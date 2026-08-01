import { NextResponse } from "next/server";

import { prisma } from "@/server/db";
import {
  actionLinkAvailability,
  findPermissionByActionSecret,
} from "@/lib/consent/lookup";

type Context = { params: Promise<{ token: string }> };

export async function POST(_request: Request, context: Context) {
  const { token } = await context.params;
  const link = await findPermissionByActionSecret(String(token || ""));
  if (!actionLinkAvailability(link).active) {
    return NextResponse.json({ success: true, state: "not_available" });
  }
  const now = new Date();
  await prisma.$transaction([
    (prisma as any).consentRequestLink.updateMany({
      where: { consentRecordId: link.consentRecordId, revokedAt: null },
      data: { revokedAt: now, revocationReason: "wrong_recipient" },
    }),
    (prisma as any).consentRecord.update({
      where: { id: link.consentRecordId },
      data: {
        lifecycleStatus: "WRONG_RECIPIENT",
        status: "wrong_recipient",
        wrongRecipientAt: now,
      },
    }),
    (prisma as any).consentEvent.create({
      data: {
        consentRecordId: link.consentRecordId,
        eventType: "wrong_recipient",
        metadata: JSON.stringify({ generation: link.generation }),
      },
    }),
  ]);
  return NextResponse.json({ success: true, state: "wrong_recipient" });
}
