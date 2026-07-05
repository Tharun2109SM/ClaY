import { PutObjectCommand } from "@aws-sdk/client-s3";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { getImageDimensions } from "@/lib/images";
import {
  assertR2Configured,
  getR2BucketName,
  getR2Client,
  getR2Env,
} from "@/lib/storage/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const maxUploadSize = 15 * 1024 * 1024;
const maxThumbnailSize = 3 * 1024 * 1024;
const maxUploadCount = 12;
const maxImageLongEdge = 2400;
const maxThumbnailLongEdge = 600;

type UploadApiResult =
  | {
      success: true;
      count: number;
      photos?: { id: string }[];
    }
  | {
      success: false;
      error: string;
      code: string;
    };

function jsonFailure(error: string, code: string, status: number) {
  return NextResponse.json<UploadApiResult>(
    {
      success: false,
      error,
      code,
    },
    { status },
  );
}

function getSupabaseIssue(error: {
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

function getErrorLogDetails(error: unknown) {
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

function getMissingUploadEnvironment() {
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

function getUploadEnvironmentDebug() {
  return {
    runtime: process.env.VERCEL ? "vercel" : "local",
    nodeEnv: process.env.NODE_ENV,
    hasR2AccountId: Boolean(getR2Env("CLOUDFLARE_R2_ACCOUNT_ID")),
    hasR2AccessKeyId: Boolean(getR2Env("CLOUDFLARE_R2_ACCESS_KEY_ID")),
    hasR2SecretAccessKey: Boolean(getR2Env("CLOUDFLARE_R2_SECRET_ACCESS_KEY")),
    hasR2BucketName: Boolean(getR2Env("CLOUDFLARE_R2_BUCKET_NAME")),
    hasR2PublicBaseUrl: Boolean(getR2Env("CLOUDFLARE_R2_PUBLIC_BASE_URL")),
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasSupabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };
}

function getFiles(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((file): file is File => file instanceof File && file.size > 0);
}

function getOriginalFileNames(formData: FormData) {
  return formData
    .getAll("original_file_names")
    .map((value) => (typeof value === "string" ? value.trim() : ""));
}

function buildStorageKeys({
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  let userId: string | null = null;

  try {
    console.error("[api-upload-start]", {
      roomId,
      userId,
    });
    console.error("[upload-prod-debug]", getUploadEnvironmentDebug());

    const missingEnv = getMissingUploadEnvironment();

    if (missingEnv.length > 0) {
      console.error("[api-upload-missing-env]", missingEnv);

      return jsonFailure(
        `Missing production upload configuration: ${missingEnv.join(", ")}`,
        "missing_upload_config",
        500,
      );
    }

    const supabase = await createSupabaseServerClient();

    if (!supabase) {
      return jsonFailure(
        "Upload failed. Check production upload configuration.",
        "missing_upload_config",
        500,
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    userId = user?.id ?? null;
    console.error("[api-upload-user]", { roomId, userId });

    if (!user) {
      return jsonFailure("Please sign in to upload photos.", "auth_required", 401);
    }

    const { data: isMember, error: membershipError } = await supabase.rpc(
      "is_room_member",
      { target_room_id: roomId },
    );

    console.error("[api-upload-membership]", {
      roomId,
      userId: user.id,
      isMember: Boolean(isMember),
      error: membershipError ? getSupabaseIssue(membershipError) : null,
    });

    if (membershipError) {
      return jsonFailure(
        "We could not confirm your room membership. Try again.",
        "membership_check_failed",
        500,
      );
    }

    if (!isMember) {
      return jsonFailure(
        "Only room members can upload photos here.",
        "not_member",
        403,
      );
    }

    let formData: FormData;

    try {
      formData = await request.formData();
    } catch (error) {
      console.error("[api-upload-formdata-error]", getErrorLogDetails(error));

      return jsonFailure(
        "Upload failed before ClaY could read the files. Try a smaller photo.",
        "invalid_multipart",
        400,
      );
    }

    const files = getFiles(formData, "photos");
    const thumbnails = getFiles(formData, "thumbnails");
    const originalFileNames = getOriginalFileNames(formData);

    console.error("[api-upload-files]", {
      fileCount: files.length,
      fileSizes: files.map((file) => file.size),
      thumbnailSizes: thumbnails.map((file) => file.size),
      fileTypes: files.map((file) => file.type),
    });

    if (files.length === 0) {
      return jsonFailure("Choose at least one image to upload.", "no_files", 400);
    }

    if (
      files.length !== thumbnails.length ||
      files.length !== originalFileNames.length
    ) {
      return jsonFailure(
        "The optimized files did not match their thumbnails.",
        "mismatched_files",
        400,
      );
    }

    if (files.length > maxUploadCount) {
      return jsonFailure("Upload up to 12 photos at a time.", "too_many_files", 400);
    }

    let bucket: string;

    try {
      assertR2Configured();
      bucket = getR2BucketName();
    } catch (error) {
      console.error("[api-upload-r2-error]", getErrorLogDetails(error));

      return jsonFailure(
        "Upload failed. Check production upload configuration.",
        "missing_upload_config",
        500,
      );
    }

    const r2 = getR2Client();
    const insertPayload = [];

    for (const [index, file] of files.entries()) {
      const thumbnail = thumbnails[index];
      const originalFileName = originalFileNames[index] || file.name;

      if (file.type !== "image/webp") {
        return jsonFailure(
          "Upload failed before optimization finished. Try choosing the photo again.",
          "expected_optimized_webp",
          400,
        );
      }

      if (!thumbnail || thumbnail.type !== "image/webp") {
        return jsonFailure(
          "A thumbnail could not be generated.",
          "unsupported_thumbnail",
          400,
        );
      }

      if (file.size > maxUploadSize) {
        return jsonFailure(
          "Each optimized photo must be 15 MB or smaller.",
          "file_too_large",
          413,
        );
      }

      if (thumbnail.size > maxThumbnailSize) {
        return jsonFailure(
          "Each thumbnail must be 3 MB or smaller.",
          "thumbnail_too_large",
          413,
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const thumbnailBuffer = Buffer.from(await thumbnail.arrayBuffer());
      const dimensions = getImageDimensions(buffer);
      const thumbnailDimensions = getImageDimensions(thumbnailBuffer);

      if (
        !dimensions.width ||
        !dimensions.height ||
        Math.max(dimensions.width, dimensions.height) > maxImageLongEdge
      ) {
        return jsonFailure(
          "The optimized image dimensions were too large.",
          "invalid_dimensions",
          400,
        );
      }

      if (
        !thumbnailDimensions.width ||
        !thumbnailDimensions.height ||
        Math.max(thumbnailDimensions.width, thumbnailDimensions.height) >
          maxThumbnailLongEdge
      ) {
        return jsonFailure(
          "The thumbnail dimensions were too large.",
          "invalid_thumbnail_dimensions",
          400,
        );
      }

      const photoId = crypto.randomUUID();
      const { storageKey, thumbnailStorageKey } = buildStorageKeys({
        roomId,
        userId: user.id,
        photoId,
      });

      console.error("[api-upload-r2-start]", {
        bucketName: bucket,
        storageKey,
        thumbnailStorageKey,
        contentType: file.type,
        fileSize: file.size,
      });

      try {
        await r2.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: storageKey,
            Body: buffer,
            ContentType: file.type,
          }),
        );
        await r2.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: thumbnailStorageKey,
            Body: thumbnailBuffer,
            ContentType: thumbnail.type,
          }),
        );
      } catch (error) {
        console.error("[api-upload-r2-error]", getErrorLogDetails(error));

        return jsonFailure(
          "We could not upload your photo to storage. Try again.",
          "r2_upload_failed",
          500,
        );
      }

      insertPayload.push({
        room_id: roomId,
        uploader_id: user.id,
        storage_key: storageKey,
        thumbnail_storage_key: thumbnailStorageKey,
        original_file_name: originalFileName,
        content_type: file.type,
        thumbnail_content_type: thumbnail.type,
        file_size: file.size,
        thumbnail_file_size: thumbnail.size,
        width: dimensions.width,
        height: dimensions.height,
        thumbnail_width: thumbnailDimensions.width,
        thumbnail_height: thumbnailDimensions.height,
        caption: null,
        created_at: new Date().toISOString(),
      });
    }

    console.error("[api-upload-db-payload]", insertPayload);

    const { data, error: dbError } = await supabase
      .from("photos")
      .insert(insertPayload)
      .select("id");

    if (dbError) {
      console.error("[api-upload-db-error]", getSupabaseIssue(dbError));

      return jsonFailure(
        "The files uploaded, but the photo metadata could not be saved.",
        "db_insert_failed",
        500,
      );
    }

    revalidatePath(`/rooms/${roomId}`);
    revalidatePath("/dashboard");

    return NextResponse.json<UploadApiResult>({
      success: true,
      count: insertPayload.length,
      photos: data ?? [],
    });
  } catch (error) {
    console.error("[api-upload-unhandled-error]", {
      roomId,
      userId,
      error: getErrorLogDetails(error),
    });

    return jsonFailure(
      "We could not upload your photos. Try again.",
      "unhandled_upload_error",
      500,
    );
  }
}
