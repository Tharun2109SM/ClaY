import { revalidatePath } from "next/cache";
import {
  getErrorLogDetails,
  getSupabaseIssue,
  getUploadContext,
  isRecord,
  jsonFailure,
  maxUploadCount,
  parseFinalizePhotoMetadata,
  type FinalizePhotoMetadata,
} from "../_upload-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

type FinalizeRequest = {
  photos: FinalizePhotoMetadata[];
};

function parseFinalizeRequest(
  value: unknown,
  roomId: string,
  userId: string,
): FinalizeRequest | null {
  if (!isRecord(value) || !Array.isArray(value.photos)) {
    return null;
  }

  const photos = value.photos.map((photo) =>
    parseFinalizePhotoMetadata(photo, roomId, userId),
  );

  if (photos.some((photo) => !photo)) {
    return null;
  }

  return {
    photos: photos as FinalizePhotoMetadata[],
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;

  try {
    const context = await getUploadContext(roomId);

    if ("response" in context) {
      return context.response;
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonFailure("Invalid upload request.", "invalid_json", 400);
    }

    const parsed = parseFinalizeRequest(body, roomId, context.user.id);

    if (!parsed) {
      return jsonFailure("Invalid upload metadata.", "invalid_metadata", 400);
    }

    if (parsed.photos.length === 0) {
      return jsonFailure("Choose at least one image to upload.", "no_files", 400);
    }

    if (parsed.photos.length > maxUploadCount) {
      return jsonFailure("Upload up to 12 photos at a time.", "too_many_files", 400);
    }

    console.error("[finalize-start]", {
      roomId,
      userId: context.user.id,
      photoCount: parsed.photos.length,
    });

    const insertPayload = parsed.photos.map((photo) => ({
      id: photo.photoId,
      room_id: roomId,
      uploader_id: context.user.id,
      storage_key: photo.storageKey,
      thumbnail_storage_key: photo.thumbnailStorageKey,
      original_file_name: photo.originalFileName,
      content_type: photo.contentType,
      thumbnail_content_type: photo.thumbnailContentType,
      file_size: photo.fileSize,
      thumbnail_file_size: photo.thumbnailFileSize,
      width: photo.width,
      height: photo.height,
      thumbnail_width: photo.thumbnailWidth,
      thumbnail_height: photo.thumbnailHeight,
      caption: null,
      created_at: new Date().toISOString(),
    }));

    const { error } = await context.supabase.from("photos").insert(insertPayload);

    if (error) {
      console.error("[finalize-db-error]", getSupabaseIssue(error));

      return jsonFailure(
        "Your photo uploaded, but we could not save it. Try again.",
        "db_insert_failed",
        500,
      );
    }

    revalidatePath(`/rooms/${roomId}`);
    revalidatePath("/dashboard");

    return Response.json({
      success: true,
      count: parsed.photos.length,
    });
  } catch (error) {
    console.error("[finalize-error]", {
      roomId,
      error: getErrorLogDetails(error),
    });

    return jsonFailure(
      "Your photo uploaded, but we could not save it. Try again.",
      "finalize_failed",
      500,
    );
  }
}
