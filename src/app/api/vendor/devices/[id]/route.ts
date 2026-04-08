import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getVendorIdFromRequest } from "@/lib/auth";

interface RouteParams {
  params: { id: string };
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const vendorId = await getVendorIdFromRequest(request);

    if (!vendorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const device = await (prisma as any).device.findUnique({
      where: { id },
    });

    if (!device || device.vendorId !== vendorId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await (prisma as any).device.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/vendor/devices/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

