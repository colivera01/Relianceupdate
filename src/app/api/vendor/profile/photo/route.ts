import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import {
  generateDownloadUrl,
  getBlobProperties,
  uploadBlobBuffer,
} from "@/lib/azure-blob-storage";
import { getVendorIdFromRequest } from "@/lib/auth";

const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_ROUTE = "/api/vendor/profile/photo";

function getVendorProfilePhotoBlobKey(vendorId: string) {
  return `vendor/${vendorId}/profile/profile-photo`;
}

function buildVendorProfilePhotoUrl(version: number = Date.now()) {
  return `${PROFILE_PHOTO_ROUTE}?v=${version}`;
}

export async function GET(request: Request) {
  try {
    const vendorId = await getVendorIdFromRequest(request);

    if (!vendorId) {
      return NextResponse.json(
        { error: "Unauthorized: no vendor ID" },
        { status: 401 }
      );
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { profilePhoto: true },
    });

    if (!vendor?.profilePhoto) {
      return NextResponse.json(
        { code: "VENDOR_PROFILE_PHOTO_NOT_FOUND", error: "No vendor profile photo uploaded" },
        { status: 404 }
      );
    }

    const blobKey = getVendorProfilePhotoBlobKey(vendorId);
    const blob = await getBlobProperties(blobKey);
    if (!blob?.exists) {
      return NextResponse.json(
        {
          code: "VENDOR_PROFILE_PHOTO_NOT_FOUND",
          error: "Vendor profile photo metadata exists, but the stored image is unavailable.",
        },
        { status: 404 }
      );
    }

    let downloadUrl: string;
    try {
      downloadUrl = await generateDownloadUrl(blobKey, 15);
    } catch (error: any) {
      console.error("Vendor profile photo download URL error:", error);
      return NextResponse.json(
        {
          code: "VENDOR_PROFILE_PHOTO_STORAGE_UNAVAILABLE",
          error: "Vendor profile photo storage is temporarily unavailable. Please retry.",
        },
        { status: 503 }
      );
    }

    return NextResponse.redirect(downloadUrl, 307);
  } catch (err) {
    console.error("Vendor profile photo GET error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

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

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    const blobKey = getVendorProfilePhotoBlobKey(vendorId);
    const fileBytes = Buffer.from(await file.arrayBuffer());

    try {
      await uploadBlobBuffer(blobKey, fileBytes, {
        contentType: file.type,
        cacheControl: "private, max-age=300",
        metadata: {
          vendorId,
          uploadKind: "vendor-profile-photo",
          uploadedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error("Vendor profile photo upload storage error:", error);
      return NextResponse.json(
        {
          code: "VENDOR_PROFILE_PHOTO_STORAGE_UNAVAILABLE",
          error:
            "Vendor profile photo upload is temporarily unavailable because storage is not configured or not reachable.",
          details: error?.message || String(error),
        },
        { status: 503 }
      );
    }

    const photoUrl = buildVendorProfilePhotoUrl();

    await prisma.vendor.update({
      where: { id: vendorId },
      data: { profilePhoto: photoUrl },
    });

    return NextResponse.json({ url: photoUrl });
  } catch (err) {
    console.error("Vendor profile photo upload error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
