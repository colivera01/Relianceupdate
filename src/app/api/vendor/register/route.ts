import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { trySetVendorApprovalStatus } from "@/lib/vendor-status";

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const businessName = String(body?.businessName || "").trim();
    const rawBusinessType = String(body?.businessType || "").trim();
    const customBusinessType = String(body?.customBusinessType || "").trim();
    const businessType =
      rawBusinessType.toLowerCase() === "other" ? customBusinessType : rawBusinessType;

    if (!businessName || !businessType) {
      return NextResponse.json(
        { error: "Business name and business type are required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existingManagerMembership = await (prisma as any).vendorMembership.findFirst({
      where: {
        userId,
        role: "MANAGER",
      },
      include: {
        vendor: true,
      },
      orderBy: [{ requestedAt: "desc" }],
    });

    if (existingManagerMembership?.status === "ACTIVE") {
      return NextResponse.json({
        success: true,
        message: "Vendor registration already approved.",
        vendorId: String(existingManagerMembership.vendorId),
        membershipId: String(existingManagerMembership.id),
        requiresApproval: false,
        approved: true,
      });
    }

    let vendorId: string;
    let membershipId: string;

    if (existingManagerMembership) {
      const updated = await (prisma as any).$transaction(async (tx: any) => {
        await tx.vendor.update({
          where: { id: existingManagerMembership.vendorId },
          data: {
            name: businessName,
            businessName,
            businessType,
            category: businessType,
          },
        });

        const membership = await tx.vendorMembership.update({
          where: { id: existingManagerMembership.id },
          data: {
            status: "PENDING",
            deniedAt: null,
            deniedByUserId: null,
            revokedAt: null,
            revokedByUserId: null,
            approvedAt: null,
            approvedByUserId: null,
          },
        });

        return {
          vendorId: String(existingManagerMembership.vendorId),
          membershipId: String(membership.id),
        };
      });

      vendorId = updated.vendorId;
      membershipId = updated.membershipId;
    } else {
      const created = await (prisma as any).$transaction(async (tx: any) => {
        const vendor = await tx.vendor.create({
          data: {
            name: businessName,
            businessName,
            businessType,
            category: businessType,
            firstName: user.name || null,
            email: user.email || null,
            phone: user.phone || null,
          },
        });

        const membership = await tx.vendorMembership.create({
          data: {
            vendorId: vendor.id,
            userId,
            role: "MANAGER",
            status: "PENDING",
          },
        });

        return { vendorId: String(vendor.id), membershipId: String(membership.id) };
      });

      vendorId = created.vendorId;
      membershipId = created.membershipId;
    }

    await trySetVendorApprovalStatus(vendorId, "PENDING");

    return NextResponse.json({
      success: true,
      message: "Vendor registered successfully. Vendor account pending approval.",
      vendorId,
      membershipId,
      requiresApproval: true,
      approved: false,
    });
  } catch (error) {
    console.error("Vendor registration error:", error);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}