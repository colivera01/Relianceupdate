import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getVendorIdFromRequest } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const vendorId = await getVendorIdFromRequest(request);

    if (!vendorId) {
      return NextResponse.json(
        { error: "Unauthorized: no vendor ID" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    // TODO: For now, we'll use a placeholder URL
    // In production, you would:
    // 1. Upload to S3/Azure Blob Storage/etc.
    // 2. Get the public URL
    // 3. Store that URL in the database
    // For now, using a placeholder that includes the vendor ID for uniqueness
    const photoUrl = `https://placehold.co/400x400?text=Vendor+${vendorId.slice(0, 8)}`;

    // Update vendor profilePhoto in database
    await prisma.vendor.update({
      where: { id: vendorId },
      data: { profilePhoto: photoUrl },
    });

    return NextResponse.json({ url: photoUrl });
  } catch (err) {
    console.error("Photo upload error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}



