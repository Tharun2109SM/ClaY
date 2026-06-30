"use server";

import {
  DeleteObjectsCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSiteUrl } from "@/lib/env";
import { getImageDimensions } from "@/lib/images";
import {
  assertR2Configured,
  getR2BucketName,
  getR2Client,
  R2ConfigurationError,
} from "@/lib/storage/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isEmailLike(value: string) {
  return /^\S+@\S+\.\S+$/.test(value.trim());
}

type SupabaseIssue = {
  message: string;
  details: string | null;
  hint: string | null;
  code: string | null;
};

function toSupabaseIssue(error: {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}): SupabaseIssue {
  return {
    message: error.message ?? "Unknown Supabase error.",
    details: error.details ?? null,
    hint: error.hint ?? null,
    code: error.code ?? null,
  };
}

function logSupabaseIssue(label: string, error: {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}) {
  const issue = toSupabaseIssue(error);

  console.warn(label, {
    message: issue.message,
    details: issue.details,
    hint: issue.hint,
    code: issue.code,
  });
}

function logCreateRoomStep(
  step: string,
  details: Record<string, string | number | boolean | null>,
) {
  console.info("[createRoomAction]", { step, ...details });
}

function redirectCreateRoomFailure({
  message,
  code,
  details,
  hint,
}: {
  message: string;
  code: string;
  details?: string | null;
  hint?: string | null;
}): never {
  const params = new URLSearchParams({
    message,
    code,
  });

  if (details) {
    params.set("details", details);
  }

  if (hint) {
    params.set("hint", hint);
  }

  redirect(`/rooms/new?${params.toString()}`);
}

function getSafeNextPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

function getAuthFailurePath(path: "/auth/sign-in" | "/auth/sign-up", {
  message,
  next,
}: {
  message: string;
  next: string;
}) {
  const params = new URLSearchParams({ message });

  if (next !== "/dashboard") {
    params.set("next", next);
  }

  return `${path}?${params.toString()}`;
}

const maxUploadSize = 15 * 1024 * 1024;
const maxThumbnailSize = 3 * 1024 * 1024;
const maxUploadCount = 12;
const maxImageLongEdge = 2400;
const maxThumbnailLongEdge = 600;
const allowedImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);
const coverFonts = new Set([
  "editorial-serif",
  "modern-sans",
  "minimal-light",
  "cinematic-condensed",
  "soft-script",
]);
const coverTextColors = new Set([
  "ivory",
  "ink",
  "clay",
  "sage",
  "rose",
]);
const hexColorPattern = /^#[0-9a-fA-F]{6}$/;
const coverTextPositions = new Set([
  "top-left",
  "top-center",
  "center",
  "bottom-left",
  "bottom-center",
]);
const coverOverlayStyles = new Set(["none", "soft", "deep", "film"]);

async function deleteR2Objects(keys: string[]) {
  const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));

  if (uniqueKeys.length === 0) {
    return;
  }

  assertR2Configured();

  const r2 = getR2Client();
  const bucket = getR2BucketName();
  const batchSize = 1000;

  for (let index = 0; index < uniqueKeys.length; index += batchSize) {
    const batch = uniqueKeys.slice(index, index + batchSize);

    const result = await r2.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch.map((key) => ({ Key: key })),
          Quiet: true,
        },
      }),
    );

    if (result.Errors && result.Errors.length > 0) {
      throw new Error(
        `R2 reported ${result.Errors.length} object deletion error${
          result.Errors.length === 1 ? "" : "s"
        }.`,
      );
    }
  }
}

function getUploadErrorRedirect(roomId: string, message: string): never {
  redirect(`/rooms/${roomId}?upload=error&message=${message}`);
}

function getMissingR2Redirect(roomId: string, missingVariable: string): never {
  redirect(
    `/rooms/${roomId}?upload=error&message=missing-r2-env&missing=${encodeURIComponent(
      missingVariable,
    )}`,
  );
}

function buildStorageKeys({
  roomId,
  userId,
  extension,
}: {
  roomId: string;
  userId: string;
  extension: string;
}) {
  const timestamp = Date.now();
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  const base = `${timestamp}-${random}`;

  return {
    storageKey: `rooms/${roomId}/uploads/${userId}/${base}.${extension}`,
    thumbnailStorageKey: `rooms/${roomId}/thumbs/${userId}/${base}.webp`,
  };
}

export async function signInAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect("/auth/sign-in?message=missing-config");
  }

  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const nextPath = getSafeNextPath(getString(formData, "next") || "/dashboard");

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(
      getAuthFailurePath("/auth/sign-in", {
        message: "invalid-credentials",
        next: nextPath,
      }),
    );
  }

  redirect(nextPath);
}

export async function signUpAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect("/auth/sign-up?message=missing-config");
  }

  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const displayName = getString(formData, "display_name");
  const nextPath = getSafeNextPath(getString(formData, "next") || "/dashboard");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        name: displayName,
        full_name: displayName,
      },
      emailRedirectTo: `${getSiteUrl()}${nextPath}`,
    },
  });

  if (error) {
    redirect(
      getAuthFailurePath("/auth/sign-up", {
        message: "unable-to-create-account",
        next: nextPath,
      }),
    );
  }

  if (data.user && displayName && !isEmailLike(displayName)) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ display_name: displayName, email })
      .eq("id", data.user.id);

    if (profileError) {
      logSupabaseIssue("Unable to update profile display name after sign up", profileError);
    }
  }

  redirect(nextPath);
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/");
}

export async function createRoomAction(formData: FormData) {
  logCreateRoomStep("called", {
    hasName: Boolean(getString(formData, "name")),
    hasOccasion: Boolean(getString(formData, "occasion")),
    hasLocation: Boolean(getString(formData, "location")),
    hasDateLabel: Boolean(getString(formData, "date_label")),
  });

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    logCreateRoomStep("supabase-client-missing", {
      configured: false,
    });
    redirectCreateRoomFailure({
      message: "missing-config",
      code: "missing_config",
      hint: "Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!user) {
    logCreateRoomStep("current-user-missing", {
      loaded: false,
      hasSession: Boolean(session),
    });
    redirect("/auth/sign-in");
  }

  logCreateRoomStep("current-user-loaded", {
    loaded: true,
    userId: user.id,
    hasEmail: Boolean(user.email),
    hasSession: Boolean(session),
  });

  const { data: hasProfile, error: profileError } = await supabase.rpc(
    "ensure_current_user_profile",
  );

  if (profileError) {
    const issue = toSupabaseIssue(profileError);
    logSupabaseIssue("Unable to confirm profile before creating room", profileError);
    redirectCreateRoomFailure({
      message: "profile-check-failed",
      code: issue.code ?? "profile_check_failed",
      details: issue.message,
      hint: issue.hint,
    });
  }

  logCreateRoomStep("profile-check-result", {
    hasProfile: Boolean(hasProfile),
  });

  if (!hasProfile) {
    console.warn("Unable to confirm profile before creating room", {
      message: "No matching profile row for authenticated user.",
      details: "ensure_current_user_profile returned false.",
      hint: "Apply the latest schema.sql so profile repair RPC is available.",
      code: "profile_missing",
    });
    redirectCreateRoomFailure({
      message: "profile-check-failed",
      code: "profile_missing",
      details: "ensure_current_user_profile returned false.",
      hint: "Apply the latest schema.sql so profile repair RPC is available.",
    });
  }

  const inviteToken = crypto.randomUUID().replaceAll("-", "");
  const room = {
    name: getString(formData, "name"),
    occasion: getString(formData, "occasion") || null,
    location: getString(formData, "location") || null,
    date_label: getString(formData, "date_label") || null,
    created_by: user.id,
    invite_token: inviteToken,
  };

  logCreateRoomStep("room-insert-start", {
    hasName: Boolean(room.name),
    hasOccasion: Boolean(room.occasion),
    hasLocation: Boolean(room.location),
    hasDateLabel: Boolean(room.date_label),
    hasCreatedBy: Boolean(room.created_by),
    hasInviteToken: Boolean(room.invite_token),
  });

  logCreateRoomStep("room-insert-payload", {
    name: room.name,
    occasion: room.occasion,
    location: room.location,
    date_label: room.date_label,
    created_by: room.created_by,
    invite_token: room.invite_token,
    createdByEqualsUserId: room.created_by === user.id,
  });

  const { data: roomId, error } = await supabase.rpc(
    "create_room_for_current_user",
    {
      room_name: room.name,
      room_occasion: room.occasion,
      room_location: room.location,
      room_date_label: room.date_label,
      room_invite_token: room.invite_token,
    },
  );

  if (error || !roomId) {
    if (error) {
      const issue = toSupabaseIssue(error);
      logSupabaseIssue("Unable to create room via RPC", error);
      redirectCreateRoomFailure({
        message: "unable-to-create-room",
        code: issue.code ?? "create_room_rpc_failed",
        details: issue.message,
        hint: issue.hint,
      });
    } else {
      console.warn("Unable to create room", {
        message: "Room create RPC succeeded but returned no room id.",
        details: "Expected create_room_for_current_user() to return the created room id.",
        hint: "Confirm the latest create_room_for_current_user RPC in schema.sql is applied.",
        code: "create_room_rpc_no_data",
      });
      redirectCreateRoomFailure({
        message: "unable-to-create-room",
        code: "create_room_rpc_no_data",
        details: "Room create RPC succeeded but returned no room id.",
        hint: "Confirm the latest create_room_for_current_user RPC in schema.sql is applied.",
      });
    }
  }

  logCreateRoomStep("room-insert-result", {
    created: true,
    roomId,
  });

  const { data: membership, error: membershipReadError } = await supabase
    .from("room_members")
    .select("id, role")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipReadError) {
    logSupabaseIssue("Unable to read room owner membership after room create", membershipReadError);
  }

  logCreateRoomStep("room-members-trigger-check", {
    foundMembership: Boolean(membership),
    role: membership?.role ?? null,
  });

  if (!membership) {
    logCreateRoomStep("room-members-manual-insert-start", {
      roomId,
      role: "owner",
    });

    const { data: insertedMembership, error: membershipInsertError } =
      await supabase
        .from("room_members")
        .insert({
          room_id: roomId,
          user_id: user.id,
          role: "owner",
        })
        .select("id, role")
        .single();

    if (membershipInsertError || !insertedMembership) {
      if (membershipInsertError) {
        const issue = toSupabaseIssue(membershipInsertError);
        logSupabaseIssue("Unable to create room owner membership", membershipInsertError);
        redirectCreateRoomFailure({
          message: "owner-membership-failed",
          code: issue.code ?? "owner_membership_failed",
          details: issue.message,
          hint: issue.hint,
        });
      }

      redirectCreateRoomFailure({
        message: "owner-membership-failed",
        code: "owner_membership_no_data",
        details: "Room owner membership insert returned no row.",
        hint: "Confirm room_members insert policy in schema.sql is applied.",
      });
    }

    logCreateRoomStep("room-members-manual-insert-result", {
      created: true,
      role: insertedMembership.role,
    });
  }

  revalidatePath("/dashboard");
  logCreateRoomStep("redirect", {
    target: `/rooms/${roomId}`,
  });
  redirect(`/rooms/${roomId}`);
}

export async function joinRoomAction(formData: FormData) {
  const token = getString(formData, "token");
  const displayName = getString(formData, "display_name");
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect(`/auth/sign-in?message=missing-config&next=/invite/${token}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/sign-in?next=/invite/${token}`);
  }

  await supabase.rpc("ensure_current_user_profile");

  if (displayName && !isEmailLike(displayName)) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        email: user.email ?? null,
      })
      .eq("id", user.id);

    if (profileError) {
      logSupabaseIssue("Unable to update profile display name before joining room", profileError);
    }
  }

  const { data: roomId, error: roomError } = await supabase.rpc(
    "join_room_by_invite",
    { token },
  );

  if (roomError || !roomId) {
    if (roomError) {
      const issue = toSupabaseIssue(roomError);
      logSupabaseIssue("Unable to join room by invite", roomError);
      redirect(
        `/invite/${token}?message=join-failed&code=${encodeURIComponent(
          issue.code ?? "join_room_failed",
        )}&details=${encodeURIComponent(issue.message)}`,
      );
    }

    console.warn("Unable to join room by invite", {
      message: "Invite RPC returned no room id.",
      details: "join_room_by_invite returned null or empty data.",
      hint: "Confirm the invite token exists and the RPC grants are applied.",
      code: "join_room_no_data",
    });
    redirect(`/invite/${token}?message=invalid-invite`);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/rooms/${roomId}`);
  redirect(`/rooms/${roomId}`);
}

export async function deleteRoomAction(roomId: string): Promise<{
  ok: false;
  message: string;
  code: string;
}> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured.",
      code: "missing_config",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      message: "You must be signed in to delete this room.",
      code: "not_authenticated",
    };
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, created_by")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    if (roomError) {
      logSupabaseIssue("Unable to load room before permanent delete", roomError);
    }

    return {
      ok: false,
      message: "We could not find this room.",
      code: roomError?.code ?? "room_not_found",
    };
  }

  if (room.created_by !== user.id) {
    return {
      ok: false,
      message: "Only the room host can delete this room.",
      code: "not_room_host",
    };
  }

  const { data: photos, error: photosError } = await supabase
    .from("photos")
    .select("storage_key, thumbnail_storage_key")
    .eq("room_id", roomId);

  if (photosError) {
    logSupabaseIssue("Unable to load room photo storage keys", photosError);

    return {
      ok: false,
      message: photosError.message,
      code: photosError.code ?? "photo_key_lookup_failed",
    };
  }

  const storageKeys = (photos ?? []).flatMap((photo) => [
    photo.storage_key,
    photo.thumbnail_storage_key,
  ]);

  try {
    await deleteR2Objects(storageKeys);
  } catch (error) {
    const message =
      error instanceof R2ConfigurationError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Cloudflare R2 could not delete the room files.";

    console.warn("Unable to delete room files from R2", {
      message,
      keyCount: storageKeys.filter(Boolean).length,
    });

    return {
      ok: false,
      message,
      code: "r2_delete_failed",
    };
  }

  const { data, error } = await supabase.rpc("delete_room_for_current_user", {
    target_room_id: roomId,
  });

  if (error || !data) {
    const issue = error
      ? toSupabaseIssue(error)
      : {
          message: "The delete room RPC returned no result.",
          details: null,
          hint: null,
          code: "delete_room_no_data",
        };

    if (error) {
      logSupabaseIssue("Unable to permanently delete room database rows", error);
    }

    return {
      ok: false,
      message: issue.message,
      code: issue.code ?? "delete_room_failed",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/rooms/${roomId}`);
  redirect("/dashboard");
}

export async function uploadPhotosAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const roomId = getString(formData, "room_id");

  if (!roomId) {
    redirect("/dashboard");
  }

  if (!supabase) {
    getUploadErrorRedirect(roomId, "missing-config");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const { data: isMember, error: membershipError } = await supabase.rpc(
    "is_room_member",
    { target_room_id: roomId },
  );

  if (membershipError || !isMember) {
    getUploadErrorRedirect(roomId, "not-a-member");
  }

  const files = formData
    .getAll("photos")
    .filter((file): file is File => file instanceof File && file.size > 0);
  const thumbnails = formData
    .getAll("thumbnails")
    .filter((file): file is File => file instanceof File && file.size > 0);
  const originalFileNames = formData
    .getAll("original_file_names")
    .map((value) => (typeof value === "string" ? value.trim() : ""));

  if (files.length === 0) {
    getUploadErrorRedirect(roomId, "no-files");
  }

  if (files.length !== thumbnails.length || files.length !== originalFileNames.length) {
    getUploadErrorRedirect(roomId, "mismatched-files");
  }

  if (files.length > maxUploadCount) {
    getUploadErrorRedirect(roomId, "too-many-files");
  }

  let r2: S3Client;
  let bucket: string;

  try {
    assertR2Configured();
    r2 = getR2Client();
    bucket = getR2BucketName();
  } catch (error) {
    if (error instanceof R2ConfigurationError) {
      const [firstMissingVariable] = error.missingVariables;

      console.warn("Cloudflare R2 configuration is incomplete", {
        missingVariables: error.missingVariables,
        checkedVariables: [
          "CLOUDFLARE_R2_ACCOUNT_ID",
          "CLOUDFLARE_R2_ACCESS_KEY_ID",
          "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
          "CLOUDFLARE_R2_BUCKET_NAME",
          "CLOUDFLARE_R2_PUBLIC_BASE_URL",
        ],
        envLoadedByServerAction: true,
      });

      getMissingR2Redirect(
        roomId,
        firstMissingVariable ?? "CLOUDFLARE_R2_PUBLIC_BASE_URL",
      );
    }

    console.error("R2 is not configured", error);
    getUploadErrorRedirect(roomId, "storage-config");
  }

  const rows = [];

  for (const [index, file] of files.entries()) {
    const thumbnail = thumbnails[index];
    const originalFileName = originalFileNames[index] || file.name;
    const extension = allowedImageTypes.get(file.type);

    if (!extension) {
      getUploadErrorRedirect(roomId, "unsupported-type");
    }

    if (!thumbnail || thumbnail.type !== "image/webp") {
      getUploadErrorRedirect(roomId, "unsupported-thumbnail");
    }

    if (file.size > maxUploadSize) {
      getUploadErrorRedirect(roomId, "file-too-large");
    }

    if (thumbnail.size > maxThumbnailSize) {
      getUploadErrorRedirect(roomId, "thumbnail-too-large");
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
      getUploadErrorRedirect(roomId, "invalid-dimensions");
    }

    if (
      !thumbnailDimensions.width ||
      !thumbnailDimensions.height ||
      Math.max(thumbnailDimensions.width, thumbnailDimensions.height) >
        maxThumbnailLongEdge
    ) {
      getUploadErrorRedirect(roomId, "invalid-thumbnail-dimensions");
    }

    const { storageKey, thumbnailStorageKey } = buildStorageKeys({
      roomId,
      userId: user.id,
      extension,
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
      console.error("Unable to upload photo to R2", error);
      getUploadErrorRedirect(roomId, "storage-failed");
    }

    rows.push({
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
      created_at: new Date().toISOString(),
    });
  }

  const { error } = await supabase.from("photos").insert(rows);

  if (error) {
    console.error("Unable to save photo metadata", error);
    getUploadErrorRedirect(roomId, "metadata-failed");
  }

  revalidatePath(`/rooms/${roomId}`);
  revalidatePath("/dashboard");
  redirect(`/rooms/${roomId}?upload=success&count=${rows.length}`);
}

export async function togglePhotoFavoriteAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const roomId = getString(formData, "room_id");
  const photoId = getString(formData, "photo_id");

  if (!roomId || !photoId) {
    redirect("/dashboard");
  }

  if (!supabase) {
    redirect(`/rooms/${roomId}?gallery=error&message=missing-config`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const { data: isMember } = await supabase.rpc("is_room_member", {
    target_room_id: roomId,
  });

  if (!isMember) {
    redirect(`/rooms/${roomId}?gallery=error&message=not-a-member`);
  }

  const { data: existing } = await supabase
    .from("photo_favorites")
    .select("photo_id")
    .eq("photo_id", photoId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("photo_favorites")
        .delete()
        .eq("photo_id", photoId)
        .eq("user_id", user.id)
    : await supabase.from("photo_favorites").insert({
        photo_id: photoId,
        room_id: roomId,
        user_id: user.id,
      });

  if (error) {
    console.error("Unable to toggle favorite", error);
    redirect(`/rooms/${roomId}?gallery=error&message=favorite-failed`);
  }

  revalidatePath(`/rooms/${roomId}`);
}

export async function setRoomCoverAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const roomId = getString(formData, "room_id");
  const photoId = getString(formData, "photo_id");

  if (!roomId || !photoId) {
    redirect("/dashboard");
  }

  if (!supabase) {
    redirect(`/rooms/${roomId}?gallery=error&message=missing-config`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const { data: isOwner } = await supabase.rpc("is_room_owner", {
    target_room_id: roomId,
  });

  if (!isOwner) {
    redirect(`/rooms/${roomId}?gallery=error&message=cover-not-allowed`);
  }

  const { data: isMemberPhoto } = await supabase
    .from("photos")
    .select("id")
    .eq("id", photoId)
    .eq("room_id", roomId)
    .single();

  if (!isMemberPhoto) {
    redirect(`/rooms/${roomId}?gallery=error&message=cover-not-found`);
  }

  const { error } = await supabase
    .from("rooms")
    .update({ cover_photo_id: photoId })
    .eq("id", roomId);

  if (error) {
    console.error("Unable to set cover photo", error);
    redirect(`/rooms/${roomId}?gallery=error&message=cover-failed`);
  }

  revalidatePath(`/rooms/${roomId}`);
  revalidatePath("/dashboard");
  redirect(`/rooms/${roomId}?gallery=success&message=cover-updated`);
}

export async function updatePhotobookCoverAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const roomId = getString(formData, "room_id");
  const photobookId = getString(formData, "photobook_id");
  const coverPhotoId = getString(formData, "cover_photo_id") || null;
  const coverTitle = getString(formData, "cover_title").slice(0, 120);
  const coverSubtitle = getString(formData, "cover_subtitle").slice(0, 160);
  const coverFont = getString(formData, "cover_font");
  const coverTextColor = getString(formData, "cover_text_color");
  const coverTextPosition = getString(formData, "cover_text_position");
  const coverOverlayStyle = getString(formData, "cover_overlay_style");

  if (!roomId || !photobookId) {
    redirect("/dashboard");
  }

  if (!supabase) {
    redirect(`/rooms/${roomId}/photobook?message=missing-config`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const { data: isOwner } = await supabase.rpc("is_room_owner", {
    target_room_id: roomId,
  });

  if (!isOwner) {
    redirect(`/rooms/${roomId}/photobook?message=cover-host-only`);
  }

  if (
    !coverFonts.has(coverFont) ||
    (!coverTextColors.has(coverTextColor) &&
      !hexColorPattern.test(coverTextColor)) ||
    !coverTextPositions.has(coverTextPosition) ||
    !coverOverlayStyles.has(coverOverlayStyle)
  ) {
    redirect(`/rooms/${roomId}/photobook?message=invalid-cover-settings`);
  }

  if (coverPhotoId) {
    const { data: photo } = await supabase
      .from("photos")
      .select("id")
      .eq("id", coverPhotoId)
      .eq("room_id", roomId)
      .single();

    if (!photo) {
      redirect(`/rooms/${roomId}/photobook?message=cover-photo-not-found`);
    }
  }

  const { error } = await supabase
    .from("photobook_drafts")
    .update({
      cover_photo_id: coverPhotoId,
      cover_title: coverTitle || "ClaY. by tharun",
      cover_subtitle: coverSubtitle || null,
      cover_font: coverFont,
      cover_text_color: coverTextColor,
      cover_text_position: coverTextPosition,
      cover_overlay_style: coverOverlayStyle,
      updated_at: new Date().toISOString(),
    })
    .eq("id", photobookId)
    .eq("room_id", roomId);

  if (error) {
    console.error("Unable to update photobook cover", error);
    redirect(`/rooms/${roomId}/photobook?message=cover-update-failed`);
  }

  revalidatePath(`/rooms/${roomId}/photobook`);
  redirect(`/rooms/${roomId}/photobook?message=cover-updated`);
}
