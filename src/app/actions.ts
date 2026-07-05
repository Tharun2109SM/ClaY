"use server";

import {
  DeleteObjectsCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSiteUrl } from "@/lib/env";
import { getImageDimensions } from "@/lib/images";
import {
  assertR2Configured,
  getR2Env,
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

function logPhotobookCoverSaveIssue(stage: string, error: {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}) {
  const issue = toSupabaseIssue(error);

  console.error("[photobook-cover-save]", {
    stage,
    message: issue.message,
    details: issue.details,
    hint: issue.hint,
    code: issue.code,
  });
  console.error("[cover-save-error]", {
    stage,
    message: issue.message,
    details: issue.details,
    hint: issue.hint,
    code: issue.code,
  });
}

function logCoverSaveDebug(label: string, value: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.error(label, value);
  }
}

function logUploadEvent(label: string, value: unknown) {
  console.error(label, value);
}

function isRpcSignatureError(error: {
  message?: string;
  code?: string | null;
} | null) {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    message.includes("could not find the function") ||
    message.includes("does not exist")
  );
}

function getInviteJoinRoomId(result: unknown) {
  if (typeof result === "string" && result) {
    return result;
  }

  if (result && typeof result === "object" && !Array.isArray(result)) {
    const roomId = (result as { room_id?: unknown }).room_id;

    if (typeof roomId === "string" && roomId) {
      return roomId;
    }
  }

  return null;
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

async function getAuthRedirectOrigin() {
  const headersList = await headers();
  const origin = headersList.get("origin");

  if (origin) {
    return origin;
  }

  const host =
    headersList.get("x-forwarded-host") ?? headersList.get("host");

  if (host) {
    const protocol =
      headersList.get("x-forwarded-proto") ??
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");

    return `${protocol}://${host}`;
  }

  return getSiteUrl();
}

async function getEmailRedirectTo(nextPath: string) {
  const origin = await getAuthRedirectOrigin();
  const params = new URLSearchParams({ next: nextPath });

  return `${origin}/auth/callback?${params.toString()}`;
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

type UploadActionResult =
  | {
      success: false;
      error: string;
      code: string;
    }
  | {
      success: true;
      count: number;
    };

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

function getMissingUploadEnvironmentWarnings() {
  const warnings: string[] = [];

  if (process.env.VERCEL && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    warnings.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (
    process.env.VERCEL &&
    !process.env.NEXT_PUBLIC_SITE_URL &&
    !process.env.VERCEL_PROJECT_PRODUCTION_URL &&
    !process.env.VERCEL_URL
  ) {
    warnings.push("NEXT_PUBLIC_SITE_URL");
  }

  return warnings;
}

function getUploadFailure(error: string, code: string): UploadActionResult {
  return {
    success: false,
    error,
    code,
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
      code: errorWithCode.Code ?? errorWithCode.code ?? null,
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
      code: errorRecord.Code ?? errorRecord.code ?? null,
      statusCode:
        typeof errorRecord.$metadata?.httpStatusCode === "number"
          ? errorRecord.$metadata.httpStatusCode
          : null,
    };
  }

  return {
    message: String(error),
    name: null,
    code: null,
    statusCode: null,
  };
}

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
  const nextPath = getSafeNextPath(getString(formData, "next") || "/dashboard");
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect(
      getAuthFailurePath("/auth/sign-in", {
        message: "missing-config",
        next: nextPath,
      }),
    );
  }

  const email = getString(formData, "email");
  const password = getString(formData, "password");

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
  const nextPath = getSafeNextPath(getString(formData, "next") || "/dashboard");
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect(
      getAuthFailurePath("/auth/sign-up", {
        message: "missing-config",
        next: nextPath,
      }),
    );
  }

  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const displayName = getString(formData, "display_name");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        name: displayName,
        full_name: displayName,
      },
      emailRedirectTo: await getEmailRedirectTo(nextPath),
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

  if (!data.session) {
    redirect(
      getAuthFailurePath("/auth/sign-up", {
        message: "confirm-email",
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
  const { error } = supabase
    ? await supabase.auth.signOut()
    : { error: null };

  if (error) {
    logSupabaseIssue("Unable to sign out", error);
  }

  redirect("/auth/sign-in");
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

export async function joinRoomByInviteAction(
  inviteCode: string,
  displayName: string,
) {
  const token = inviteCode.trim();
  const safeDisplayName = displayName.trim();

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect(`/auth/sign-in?message=missing-config&next=/invite/${token}`);
  }

  if (!token) {
    redirect("/dashboard");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/sign-in?next=/invite/${token}`);
  }

  const { error: ensureProfileError } = await supabase.rpc(
    "ensure_current_user_profile",
  );

  if (ensureProfileError) {
    logSupabaseIssue(
      "Unable to ensure profile before joining room",
      ensureProfileError,
    );
  }

  if (safeDisplayName && !isEmailLike(safeDisplayName)) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        display_name: safeDisplayName,
        email: user.email ?? null,
      })
      .eq("id", user.id);

    if (profileError) {
      logSupabaseIssue(
        "Unable to update profile display name before joining room",
        profileError,
      );
    }
  }

  let { data: joinResult, error: roomError } = await supabase.rpc(
    "join_room_by_invite",
    {
      invite_code: token,
      display_name: safeDisplayName || null,
    },
  );

  if (isRpcSignatureError(roomError)) {
    const legacyJoinResult = await supabase.rpc("join_room_by_invite", {
      token,
    });

    joinResult = legacyJoinResult.data;
    roomError = legacyJoinResult.error;
  }

  const roomId = getInviteJoinRoomId(joinResult);

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

export async function joinRoomAction(formData: FormData) {
  const token = getString(formData, "token");
  const displayName = getString(formData, "display_name");

  await joinRoomByInviteAction(token, displayName);
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

export async function uploadPhotosAction(
  formData: FormData,
): Promise<UploadActionResult> {
  try {
    const roomId = getString(formData, "room_id");
    const files = formData
      .getAll("photos")
      .filter((file): file is File => file instanceof File && file.size > 0);
    const thumbnails = formData
      .getAll("thumbnails")
      .filter((file): file is File => file instanceof File && file.size > 0);
    const originalFileNames = formData
      .getAll("original_file_names")
      .map((value) => (typeof value === "string" ? value.trim() : ""));

    logUploadEvent("[upload-runtime]", process.env.VERCEL ? "vercel" : "local");
    logUploadEvent("[upload-server-start]", {
      roomId,
      fileCount: files.length,
    });
    const uploadEnvironmentDebug = {
      runtime: process.env.VERCEL ? "vercel" : "local",
      nodeEnv: process.env.NODE_ENV,
      hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasSupabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      hasR2AccountId: Boolean(getR2Env("CLOUDFLARE_R2_ACCOUNT_ID")),
      hasR2AccessKeyId: Boolean(getR2Env("CLOUDFLARE_R2_ACCESS_KEY_ID")),
      hasR2SecretAccessKey: Boolean(
        getR2Env("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
      ),
      hasR2BucketName: Boolean(getR2Env("CLOUDFLARE_R2_BUCKET_NAME")),
      hasR2PublicBaseUrl: Boolean(getR2Env("CLOUDFLARE_R2_PUBLIC_BASE_URL")),
    };

    logUploadEvent("[upload-prod-debug]", uploadEnvironmentDebug);
    logUploadEvent("[upload-env-check]", uploadEnvironmentDebug);

    if (!roomId) {
      return getUploadFailure("Missing room id for upload.", "missing_room_id");
    }

    const missingEnv = getMissingUploadEnvironment();
    const missingEnvWarnings = getMissingUploadEnvironmentWarnings();

    if (missingEnvWarnings.length > 0) {
      logUploadEvent("[upload-env-warning]", missingEnvWarnings);
    }

    if (missingEnv.length > 0) {
      const message = `Missing production upload configuration: ${missingEnv.join(", ")}`;

      logUploadEvent("[upload-missing-env]", missingEnv);

      return getUploadFailure(message, "missing_upload_config");
    }

    const supabase = await createSupabaseServerClient();

    if (!supabase) {
      logUploadEvent("[upload-missing-env]", [
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      ]);

      return getUploadFailure(
        "Missing production upload configuration: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "missing_supabase_env",
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    logUploadEvent("[upload-server-user]", {
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
    });

    if (!user) {
      return getUploadFailure("Please sign in to upload photos.", "auth_required");
    }

    const { data: isMember, error: membershipError } = await supabase.rpc(
      "is_room_member",
      { target_room_id: roomId },
    );
    const membership = {
      isMember: Boolean(isMember),
      error: membershipError ? toSupabaseIssue(membershipError) : null,
    };

    logUploadEvent("[upload-server-membership]", membership);

    if (membershipError) {
      return getUploadFailure(
        "We could not confirm your room membership. Try again.",
        "membership_check_failed",
      );
    }

    if (!isMember) {
      return getUploadFailure(
        "Only room members can upload photos here.",
        "not_a_member",
      );
    }

    logUploadEvent("[upload-attempt]", {
      roomId,
      userId: user.id,
      fileCount: files.length,
    });

    if (files.length === 0) {
      return getUploadFailure("Choose at least one image to upload.", "no_files");
    }

    if (
      files.length !== thumbnails.length ||
      files.length !== originalFileNames.length
    ) {
      return getUploadFailure(
        "The optimized files did not match their thumbnails.",
        "mismatched_files",
      );
    }

    if (files.length > maxUploadCount) {
      return getUploadFailure(
        "Upload up to 12 photos at a time.",
        "too_many_files",
      );
    }

    let r2: S3Client;
    let bucket: string;

    try {
      assertR2Configured();
      r2 = getR2Client();
      bucket = getR2BucketName();
    } catch (error) {
      const errorDetails = getErrorLogDetails(error);

      logUploadEvent("[upload-r2-error]", errorDetails);
      logUploadEvent("[upload-r2-put-error]", errorDetails);
      return getUploadFailure(
        "Upload failed. Check production upload configuration.",
        "missing_upload_config",
      );
    }

    logUploadEvent("[upload-r2-config]", { bucketName: bucket });

    const insertPayload = [];

    for (const [index, file] of files.entries()) {
      const thumbnail = thumbnails[index];
      const originalFileName = originalFileNames[index] || file.name;
      const extension = allowedImageTypes.get(file.type);

      if (!extension) {
        return getUploadFailure(
          "Only browser-optimizable image files are supported.",
          "unsupported_type",
        );
      }

      if (!thumbnail || thumbnail.type !== "image/webp") {
        return getUploadFailure(
          "A thumbnail could not be generated.",
          "unsupported_thumbnail",
        );
      }

      if (file.size > maxUploadSize) {
        return getUploadFailure(
          "Each optimized photo must be 15 MB or smaller.",
          "file_too_large",
        );
      }

      if (thumbnail.size > maxThumbnailSize) {
        return getUploadFailure(
          "Each thumbnail must be 3 MB or smaller.",
          "thumbnail_too_large",
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
        return getUploadFailure(
          "The optimized image dimensions were too large.",
          "invalid_dimensions",
        );
      }

      if (
        !thumbnailDimensions.width ||
        !thumbnailDimensions.height ||
        Math.max(thumbnailDimensions.width, thumbnailDimensions.height) >
          maxThumbnailLongEdge
      ) {
        return getUploadFailure(
          "The thumbnail dimensions were too large.",
          "invalid_thumbnail_dimensions",
        );
      }

      const { storageKey, thumbnailStorageKey } = buildStorageKeys({
        roomId,
        userId: user.id,
        extension,
      });

      logUploadEvent("[upload-storage-key]", storageKey);
      logUploadEvent("[upload-thumbnail-key]", thumbnailStorageKey);
      logUploadEvent("[upload-r2-start]", {
        bucketName: bucket,
        storageKey,
        thumbnailStorageKey,
        contentType: file.type,
        fileSize: file.size,
      });
      logUploadEvent("[upload-r2-put-start]", {
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
        const errorDetails = getErrorLogDetails(error);

        console.error("Unable to upload photo to R2", errorDetails);
        logUploadEvent("[upload-r2-error]", errorDetails);
        logUploadEvent("[upload-r2-put-error]", errorDetails);
        return getUploadFailure(
          "We could not upload your photo to storage. Try again.",
          "r2_upload_failed",
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

    logUploadEvent("[upload-db-payload]", insertPayload);
    logUploadEvent("[upload-db-insert-payload]", insertPayload);

    const { data, error } = await supabase
      .from("photos")
      .insert(insertPayload)
      .select("id");

    logUploadEvent("[upload-db-insert-result]", {
      data,
      error: error ? toSupabaseIssue(error) : null,
    });

    if (error) {
      logUploadEvent("[upload-db-error]", toSupabaseIssue(error));

      return getUploadFailure(
        "The files uploaded, but the photo metadata could not be saved.",
        "db_insert_failed",
      );
    }

    revalidatePath(`/rooms/${roomId}`);
    revalidatePath("/dashboard");

    return {
      success: true,
      count: insertPayload.length,
    };
  } catch (error) {
    console.error("[upload-server-catch]", getErrorLogDetails(error));
    return getUploadFailure(
      "We could not upload your photos. Try again.",
      "upload_unhandled_error",
    );
  }
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

export async function deletePhotoAction(formData: FormData): Promise<
  | { ok: true }
  | {
      ok: false;
      message: string;
      code: string;
    }
> {
  const supabase = await createSupabaseServerClient();
  const roomId = getString(formData, "room_id");
  const photoId = getString(formData, "photo_id");

  if (!roomId || !photoId) {
    return {
      ok: false,
      message: "Photo details are missing.",
      code: "missing_photo",
    };
  }

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
      message: "You must be signed in to delete photos.",
      code: "not_authenticated",
    };
  }

  const { data: photo, error: photoError } = await supabase
    .from("photos")
    .select("id, room_id, uploader_id, storage_key, thumbnail_storage_key")
    .eq("id", photoId)
    .eq("room_id", roomId)
    .single();

  if (photoError || !photo) {
    if (photoError) {
      logSupabaseIssue("Unable to load photo before delete", photoError);
    }

    return {
      ok: false,
      message: "We could not find that photo.",
      code: photoError?.code ?? "photo_not_found",
    };
  }

  const { data: isOwner, error: ownerError } = await supabase.rpc(
    "is_room_owner",
    { target_room_id: roomId },
  );

  if (ownerError) {
    logSupabaseIssue("Unable to check room owner before photo delete", ownerError);
  }

  if (photo.uploader_id !== user.id && !isOwner) {
    return {
      ok: false,
      message: "Only the uploader or room host can delete this photo.",
      code: "delete_photo_not_allowed",
    };
  }

  const storageKeys = [photo.storage_key, photo.thumbnail_storage_key];

  try {
    await deleteR2Objects(storageKeys);
  } catch (error) {
    const message =
      error instanceof R2ConfigurationError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Cloudflare R2 could not delete this photo.";

    console.warn("Unable to delete photo files from R2", {
      message,
      keyCount: storageKeys.filter(Boolean).length,
    });

    return {
      ok: false,
      message,
      code: "r2_delete_failed",
    };
  }

  const { data: deleted, error: deleteError } = await supabase.rpc(
    "delete_photo_for_current_user",
    { target_photo_id: photoId },
  );

  if (deleteError || !deleted) {
    if (deleteError) {
      logSupabaseIssue("Unable to delete photo database rows via RPC", deleteError);
    }

    return {
      ok: false,
      message: deleteError?.message ?? "The photo delete RPC returned no result.",
      code: deleteError?.code ?? "photo_delete_rpc_failed",
    };
  }

  revalidatePath(`/rooms/${roomId}`);
  revalidatePath(`/rooms/${roomId}/photobook`);
  revalidatePath("/dashboard");

  return { ok: true };
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
  const coverSettingsRaw = getString(formData, "cover_settings");

  if (coverSettingsRaw) {
    try {
      logCoverSaveDebug("[cover-save-server-input]", JSON.parse(coverSettingsRaw));
    } catch (error) {
      logCoverSaveDebug("[cover-save-server-error]", {
        stage: "cover-settings-json-parse",
        error,
      });
    }
  } else {
    logCoverSaveDebug("[cover-save-server-input]", {
      cover_photo_id: coverPhotoId,
      cover_title: coverTitle,
      cover_subtitle: coverSubtitle,
      cover_font: coverFont,
      cover_text_color: coverTextColor,
      cover_text_position: coverTextPosition,
      cover_overlay_style: coverOverlayStyle,
    });
  }

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

  const { data: isOwner, error: ownerError } = await supabase.rpc("is_room_owner", {
    target_room_id: roomId,
  });

  if (ownerError) {
    logPhotobookCoverSaveIssue("owner-check", ownerError);
    redirect(`/rooms/${roomId}/photobook?message=cover-update-failed`);
  }

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
    const { data: photo, error: photoError } = await supabase
      .from("photos")
      .select("id")
      .eq("id", coverPhotoId)
      .eq("room_id", roomId)
      .maybeSingle();

    if (photoError) {
      logPhotobookCoverSaveIssue("cover-photo-lookup", photoError);
      redirect(`/rooms/${roomId}/photobook?message=cover-update-failed`);
    }

    if (!photo) {
      redirect(`/rooms/${roomId}/photobook?message=cover-photo-not-found`);
    }
  }

  const coverPayload = {
    cover_photo_id: coverPhotoId,
    cover_title: coverTitle || "ClaY. by tharun",
    cover_subtitle: coverSubtitle || null,
    cover_font: coverFont,
    cover_text_color: coverTextColor,
    cover_text_position: coverTextPosition,
    cover_overlay_style: coverOverlayStyle,
    updated_at: new Date().toISOString(),
  };

  const { data: updatedDraft, error: updateError } = await supabase
    .from("photobook_drafts")
    .update(coverPayload)
    .eq("room_id", roomId)
    .select("id")
    .maybeSingle();

  logCoverSaveDebug("[cover-save-server-result]", {
    operation: "update",
    updatedDraft,
    error: updateError,
  });

  if (updateError) {
    logPhotobookCoverSaveIssue("draft-update", updateError);
    redirect(`/rooms/${roomId}/photobook?message=cover-update-failed`);
  }

  if (!updatedDraft) {
    const { data: insertedDraft, error: insertError } = await supabase
      .from("photobook_drafts")
      .insert({
        room_id: roomId,
        created_by: user.id,
        title: coverTitle || "ClaY photobook",
        ...coverPayload,
      })
      .select("id")
      .single();

    logCoverSaveDebug("[cover-save-server-result]", {
      operation: "insert",
      insertedDraft,
      error: insertError,
    });

    if (insertError) {
      logPhotobookCoverSaveIssue("draft-create", insertError);
      redirect(`/rooms/${roomId}/photobook?message=cover-update-failed`);
    }
  }

  const { data: savedRow, error: afterReadError } = await supabase
    .from("photobook_drafts")
    .select(
      "id, room_id, cover_photo_id, cover_title, cover_subtitle, cover_font, cover_text_color, cover_text_position, cover_overlay_style, updated_at",
    )
    .eq("room_id", roomId)
    .maybeSingle();

  if (afterReadError) {
    logCoverSaveDebug("[cover-save-server-error]", {
      stage: "after-read",
      error: afterReadError,
    });
  }

  logCoverSaveDebug("[cover-save-after-read]", savedRow);

  revalidatePath(`/rooms/${roomId}/photobook`);
  redirect(`/rooms/${roomId}/photobook?message=cover-updated`);
}
