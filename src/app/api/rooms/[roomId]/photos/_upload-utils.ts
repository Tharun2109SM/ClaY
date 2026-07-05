import { getR2Env } from "@/lib/storage/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxUploadSize = 15 * 1024 * 1024;
export const maxThumbnailSize = 3 * 1024 * 1024;
export const maxUploadCount = 12;
export const maxImageLongEdge = 2400;
export const maxThumbnailLongEdge = 600;
export const presignedUrlExpiresInSeconds = 5 * 60;

export type UploadFailure = {
  success: false;
  error: string;
  code: string;
};

export type UploadMetadata = {
  originalFileName: string;
  contentType: "image/webp";
  thumbnailContentType: "image/webp";
  fileSize: number;
  thumbnailFileSize: number;
  width: number;
  height: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
};

export type FinalizePhotoMetadata = UploadMetadata & {
  photoId: string;
  storageKey: string;
  thumbnailStorageKey: string;
};

export function jsonFailure(error: string, code: string, status: number) {
  return Response.json(
    {
      success: false,
      error,
      code,
    } satisfies UploadFailure,
    { status },
  );
}

export function getSupabaseIssue(error: {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}) {
  return {
    message: error.message ?? "Unknown Supabase error.",
    details: error.details ?? null,
    hint: error.hint ?? null,
    code: error.code ?? null,
  };
}

export function getErrorLogDetails(error: unknown) {
  if (error instanceof Error) {
    const errorWithCode = error as Error & {
      code?: unknown;
      Code?: unknown;
      $metadata?: {
        httpStatusCode?: unknown;
      };
    };

    return {
      name: error.name,
      message: error.message,
      code:
        typeof errorWithCode.Code === "string"
          ? errorWithCode.Code
          : typeof errorWithCode.code === "string"
            ? errorWithCode.code
            : null,
      statusCode:
        typeof errorWithCode.$metadata?.httpStatusCode === "number"
          ? errorWithCode.$metadata.httpStatusCode
          : null,
    };
  }

  if (error && typeof error === "object") {
    const errorRecord = error as {
      message?: unknown;
      name?: unknown;
      code?: unknown;
      Code?: unknown;
      $metadata?: {
        httpStatusCode?: unknown;
      };
    };

    return {
      name: typeof errorRecord.name === "string" ? errorRecord.name : null,
      message:
        typeof errorRecord.message === "string"
          ? errorRecord.message
          : String(error),
      code:
        typeof errorRecord.Code === "string"
          ? errorRecord.Code
          : typeof errorRecord.code === "string"
            ? errorRecord.code
            : null,
      statusCode:
        typeof errorRecord.$metadata?.httpStatusCode === "number"
          ? errorRecord.$metadata.httpStatusCode
          : null,
    };
  }

  return {
    name: null,
    message: String(error),
    code: null,
    statusCode: null,
  };
}

export function getMissingUploadEnvironment() {
  const requiredUploadEnv = [
    {
      label: "NEXT_PUBLIC_SUPABASE_URL",
      value: process.env.NEXT_PUBLIC_SUPABASE_URL,
    },
    {
      label: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
    {
      label: "CLOUDFLARE_R2_ACCOUNT_ID or R2_ACCOUNT_ID",
      value: getR2Env("CLOUDFLARE_R2_ACCOUNT_ID"),
    },
    {
      label: "CLOUDFLARE_R2_ACCESS_KEY_ID or R2_ACCESS_KEY_ID",
      value: getR2Env("CLOUDFLARE_R2_ACCESS_KEY_ID"),
    },
    {
      label: "CLOUDFLARE_R2_SECRET_ACCESS_KEY or R2_SECRET_ACCESS_KEY",
      value: getR2Env("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    },
    {
      label: "CLOUDFLARE_R2_BUCKET_NAME or R2_BUCKET_NAME",
      value: getR2Env("CLOUDFLARE_R2_BUCKET_NAME"),
    },
    {
      label: "CLOUDFLARE_R2_PUBLIC_BASE_URL or R2_PUBLIC_URL",
      value: getR2Env("CLOUDFLARE_R2_PUBLIC_BASE_URL"),
    },
  ];

  return requiredUploadEnv
    .filter((entry) => !entry.value)
    .map((entry) => entry.label);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isWebpContentType(value: unknown): value is "image/webp" {
  return value === "image/webp";
}

export function parseUploadMetadata(value: unknown): UploadMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  const {
    originalFileName,
    contentType,
    thumbnailContentType,
    fileSize,
    thumbnailFileSize,
    width,
    height,
    thumbnailWidth,
    thumbnailHeight,
  } = value;

  if (
    typeof originalFileName !== "string" ||
    !isWebpContentType(contentType) ||
    !isWebpContentType(thumbnailContentType) ||
    !isPositiveInteger(fileSize) ||
    !isPositiveInteger(thumbnailFileSize) ||
    !isPositiveInteger(width) ||
    !isPositiveInteger(height) ||
    !isPositiveInteger(thumbnailWidth) ||
    !isPositiveInteger(thumbnailHeight)
  ) {
    return null;
  }

  if (
    fileSize > maxUploadSize ||
    thumbnailFileSize > maxThumbnailSize ||
    Math.max(width, height) > maxImageLongEdge ||
    Math.max(thumbnailWidth, thumbnailHeight) > maxThumbnailLongEdge
  ) {
    return null;
  }

  return {
    originalFileName: originalFileName.trim() || "photo.webp",
    contentType,
    thumbnailContentType,
    fileSize,
    thumbnailFileSize,
    width,
    height,
    thumbnailWidth,
    thumbnailHeight,
  };
}

export function parseFinalizePhotoMetadata(
  value: unknown,
  roomId: string,
  userId: string,
): FinalizePhotoMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  const metadata = parseUploadMetadata(value);

  if (!metadata) {
    return null;
  }

  if (
    typeof value.photoId !== "string" ||
    typeof value.storageKey !== "string" ||
    typeof value.thumbnailStorageKey !== "string"
  ) {
    return null;
  }

  const expectedStorageKey = `rooms/${roomId}/${userId}/${value.photoId}.webp`;
  const expectedThumbnailStorageKey = `rooms/${roomId}/${userId}/thumbs/${value.photoId}.webp`;

  if (
    value.storageKey !== expectedStorageKey ||
    value.thumbnailStorageKey !== expectedThumbnailStorageKey
  ) {
    return null;
  }

  return {
    ...metadata,
    photoId: value.photoId,
    storageKey: value.storageKey,
    thumbnailStorageKey: value.thumbnailStorageKey,
  };
}

export function buildStorageKeys({
  roomId,
  userId,
  photoId,
}: {
  roomId: string;
  userId: string;
  photoId: string;
}) {
  return {
    storageKey: `rooms/${roomId}/${userId}/${photoId}.webp`,
    thumbnailStorageKey: `rooms/${roomId}/${userId}/thumbs/${photoId}.webp`,
  };
}

export async function getUploadContext(roomId: string) {
  const missingEnv = getMissingUploadEnvironment();

  if (missingEnv.length > 0) {
    console.error("[upload-missing-env]", missingEnv);

    return {
      response: jsonFailure(
        `Missing production upload configuration: ${missingEnv.join(", ")}`,
        "missing_upload_config",
        500,
      ),
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      response: jsonFailure(
        "Upload failed. Check production upload configuration.",
        "missing_upload_config",
        500,
      ),
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: jsonFailure("Please sign in to upload photos.", "auth_required", 401),
    };
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id")
    .eq("id", roomId)
    .is("deleted_at", null)
    .maybeSingle();

  if (roomError) {
    console.error("[upload-room-error]", getSupabaseIssue(roomError));

    return {
      response: jsonFailure(
        "We could not load this room. Try again.",
        "room_lookup_failed",
        500,
      ),
    };
  }

  if (!room) {
    return {
      response: jsonFailure("This room is no longer available.", "room_not_found", 404),
    };
  }

  const { data: isMember, error: membershipError } = await supabase.rpc(
    "is_room_member",
    { target_room_id: roomId },
  );

  if (membershipError) {
    console.error("[upload-membership-error]", getSupabaseIssue(membershipError));

    return {
      response: jsonFailure(
        "We could not confirm your room membership. Try again.",
        "membership_check_failed",
        500,
      ),
    };
  }

  if (!isMember) {
    return {
      response: jsonFailure(
        "Only room members can upload photos here.",
        "not_member",
        403,
      ),
    };
  }

  return {
    supabase,
    user,
  };
}
