import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  buildStorageKeys,
  getErrorLogDetails,
  getUploadContext,
  isRecord,
  jsonFailure,
  maxUploadCount,
  parseUploadMetadata,
  presignedUrlExpiresInSeconds,
  type UploadMetadata,
} from "../_upload-utils";
import { getR2BucketName, getR2Client } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const maxDuration = 60;

type PresignRequest = {
  files: UploadMetadata[];
};

function parsePresignRequest(value: unknown): PresignRequest | null {
  if (!isRecord(value) || !Array.isArray(value.files)) {
    return null;
  }

  const files = value.files.map(parseUploadMetadata);

  if (files.some((file) => !file)) {
    return null;
  }

  return {
    files: files as UploadMetadata[],
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;

  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonFailure("Invalid upload request.", "invalid_json", 400);
    }

    const parsed = parsePresignRequest(body);

    if (!parsed) {
      return jsonFailure("Invalid upload metadata.", "invalid_metadata", 400);
    }

    if (parsed.files.length === 0) {
      return jsonFailure("Choose at least one image to upload.", "no_files", 400);
    }

    if (parsed.files.length > maxUploadCount) {
      return jsonFailure("Upload up to 12 photos at a time.", "too_many_files", 400);
    }

    const context = await getUploadContext(roomId);

    if ("response" in context) {
      return context.response;
    }

    console.error("[presign-start]", {
      roomId,
      userId: context.user.id,
      fileCount: parsed.files.length,
      fileSizes: parsed.files.map((file) => file.fileSize),
      thumbnailFileSizes: parsed.files.map((file) => file.thumbnailFileSize),
    });

    const r2 = getR2Client();
    const bucket = getR2BucketName();
    const uploads = [];

    for (const file of parsed.files) {
      const photoId = crypto.randomUUID();
      const { storageKey, thumbnailStorageKey } = buildStorageKeys({
        roomId,
        userId: context.user.id,
        photoId,
      });

      const uploadUrl = await getSignedUrl(
        r2,
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          ContentType: file.contentType,
        }),
        { expiresIn: presignedUrlExpiresInSeconds },
      );
      const thumbnailUploadUrl = await getSignedUrl(
        r2,
        new PutObjectCommand({
          Bucket: bucket,
          Key: thumbnailStorageKey,
          ContentType: file.thumbnailContentType,
        }),
        { expiresIn: presignedUrlExpiresInSeconds },
      );

      uploads.push({
        photoId,
        storageKey,
        thumbnailStorageKey,
        uploadUrl,
        thumbnailUploadUrl,
      });
    }

    return Response.json({
      success: true,
      uploads,
    });
  } catch (error) {
    console.error("[presign-error]", {
      roomId,
      error: getErrorLogDetails(error),
    });

    return jsonFailure(
      "We could not prepare your upload. Try again.",
      "presign_failed",
      500,
    );
  }
}
