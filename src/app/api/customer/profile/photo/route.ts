import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  deleteBlob,
  generateDownloadUrl,
  getBlobProperties,
  uploadBlobBuffer,
} from "@/lib/azure-blob-storage";
import { addRegisteredUser, registeredUsers, syncRegisteredUsersFromDisk } from "@/lib/dev-registered-users";
import { prisma } from "@/server/db";

const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_ROUTE = "/api/customer/profile/photo";

function getCustomerProfilePhotoBlobKey(userId: string) {
  return `customer/${userId}/profile/profile-photo`;
}

function buildCustomerProfilePhotoUrl(version: number = Date.now()) {
  return `${PROFILE_PHOTO_ROUTE}?v=${version}`;
}

async function getAuthenticatedCustomer(request: Request) {
  const userId = await getUserIdFromRequest(request);

  if (!userId) {
    return {
      userId: null,
      user: null,
      response: NextResponse.json(
        { error: "Unauthorized: no customer ID" },
        { status: 401 }
      ),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, profilePhoto: true },
  });

  if (!user) {
    return {
      userId,
      user: null,
      response: NextResponse.json(
        { error: "Customer profile not found" },
        { status: 404 }
      ),
    };
  }

  return { userId, user, response: null as NextResponse | null };
}

function syncProfilePhotoToDevRegistry(userId: string, email: string | null | undefined, profilePhoto: string | null) {
  syncRegisteredUsersFromDisk();
  const registryMatch = registeredUsers.find(
    (candidate) =>
      String(candidate?.id || "").trim() === String(userId).trim() ||
      (email &&
        candidate?.email &&
        String(candidate.email).trim().toLowerCase() === String(email).trim().toLowerCase())
  );

  if (!registryMatch) return;

  addRegisteredUser({
    ...registryMatch,
    id: userId,
    email: email || registryMatch.email || "",
    profilePhoto,
    avatar: profilePhoto,
  });
}

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedCustomer(request);
    if (auth.response || !auth.user) {
      return auth.response ?? NextResponse.json({ error: "Customer profile not found" }, { status: 404 });
    }

    const { user } = auth;

    if (!user?.profilePhoto) {
      return NextResponse.json(
        { code: "CUSTOMER_PROFILE_PHOTO_NOT_FOUND", error: "No customer profile photo uploaded" },
        { status: 404 }
      );
    }

    const blobKey = getCustomerProfilePhotoBlobKey(user.id);
    const blob = await getBlobProperties(blobKey);
    if (!blob?.exists) {
      return NextResponse.json(
        {
          code: "CUSTOMER_PROFILE_PHOTO_NOT_FOUND",
          error: "Customer profile photo metadata exists, but the stored image is unavailable.",
        },
        { status: 404 }
      );
    }

    let downloadUrl: string;
    try {
      downloadUrl = await generateDownloadUrl(blobKey, 15);
    } catch (error: any) {
      console.error("Customer profile photo download URL error:", error);
      return NextResponse.json(
        {
          code: "CUSTOMER_PROFILE_PHOTO_STORAGE_UNAVAILABLE",
          error: "Customer profile photo storage is temporarily unavailable. Please retry.",
        },
        { status: 503 }
      );
    }

    return NextResponse.redirect(downloadUrl, 307);
  } catch (err) {
    console.error("Customer profile photo GET error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedCustomer(request);
    if (auth.response || !auth.user) {
      return auth.response ?? NextResponse.json({ error: "Customer profile not found" }, { status: 404 });
    }

    const { user } = auth;
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

    const blobKey = getCustomerProfilePhotoBlobKey(user.id);
    const fileBytes = Buffer.from(await file.arrayBuffer());

    try {
      await uploadBlobBuffer(blobKey, fileBytes, {
        contentType: file.type,
        cacheControl: "private, max-age=300",
        metadata: {
          userId: user.id,
          uploadKind: "customer-profile-photo",
          uploadedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error("Customer profile photo upload storage error:", error);
      return NextResponse.json(
        {
          code: "CUSTOMER_PROFILE_PHOTO_STORAGE_UNAVAILABLE",
          error:
            "Customer profile photo upload is temporarily unavailable because storage is not configured or not reachable.",
          details: error?.message || String(error),
        },
        { status: 503 }
      );
    }

    const photoUrl = buildCustomerProfilePhotoUrl();

    await prisma.user.update({
      where: { id: user.id },
      data: { profilePhoto: photoUrl },
    });

    syncProfilePhotoToDevRegistry(user.id, user.email, photoUrl);

    return NextResponse.json({ success: true, photoUrl, url: photoUrl });
  } catch (err) {
    console.error("Customer profile photo upload error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAuthenticatedCustomer(request);
    if (auth.response || !auth.user) {
      return auth.response ?? NextResponse.json({ error: "Customer profile not found" }, { status: 404 });
    }

    const { user } = auth;
    const blobKey = getCustomerProfilePhotoBlobKey(user.id);
    const storageDeleted = await deleteBlob(blobKey);

    await prisma.user.update({
      where: { id: user.id },
      data: { profilePhoto: null },
    });

    syncProfilePhotoToDevRegistry(user.id, user.email, null);

    return NextResponse.json({
      success: true,
      removed: true,
      ...(storageDeleted
        ? {}
        : {
            warning:
              "The saved profile photo reference was removed, but storage cleanup could not be confirmed.",
          }),
    });
  } catch (err) {
    console.error("Customer profile photo delete error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
