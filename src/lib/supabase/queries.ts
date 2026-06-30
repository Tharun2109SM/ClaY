import { getPhotoPublicUrl } from "@/lib/storage/r2";
import type {
  PhotoAsset,
  PhotobookDraft,
  RoomMember,
  RoomSummary,
} from "@/lib/types";
import { createSupabaseServerClient } from "./server";

type QueryIssue = {
  message: string;
  details: string | null;
  hint: string | null;
  code: string | null;
};

function toQueryIssue(error: {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}): QueryIssue {
  return {
    message: error.message ?? "Unknown Supabase query error.",
    details: error.details ?? null,
    hint: error.hint ?? null,
    code: error.code ?? null,
  };
}

function logQueryIssue(label: string, issue: QueryIssue) {
  console.warn(label, {
    message: issue.message,
    details: issue.details,
    hint: issue.hint,
    code: issue.code,
  });
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function getMyRooms(): Promise<{
  rooms: RoomSummary[];
  error: QueryIssue | null;
}> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      rooms: [],
      error: {
        message: "Supabase is not configured.",
        details: null,
        hint: "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        code: "missing_config",
      },
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { rooms: [], error: null };
  }

  const { data, error } = await supabase
    .from("room_summaries")
    .select(
      "id, name, occasion, location, date_label, invite_token, cover_photo_id, cover_photo_storage_key, created_at, user_id, role, member_count, photo_count",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    const issue = toQueryIssue(error);
    logQueryIssue("Unable to load rooms", issue);

    return { rooms: [], error: issue };
  }

  const rooms = ((data ?? []) as Omit<RoomSummary, "cover_photo_public_url">[]).map(
    (room) => ({
      ...room,
      cover_photo_public_url: room.cover_photo_storage_key
        ? getPhotoPublicUrl(room.cover_photo_storage_key)
        : null,
    }),
  );

  return { rooms, error: null };
}

export async function getRoom(roomId: string) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("rooms")
    .select(
      "id, name, occasion, location, date_label, invite_token, cover_photo_id, created_at, created_by",
    )
    .eq("id", roomId)
    .is("deleted_at", null)
    .single();

  if (error) {
    return null;
  }

  const coverPhoto = data.cover_photo_id
    ? await supabase
        .from("photos")
        .select("storage_key")
        .eq("id", data.cover_photo_id)
        .single()
    : null;

  return {
    ...data,
    cover_photo_public_url: coverPhoto?.data?.storage_key
      ? getPhotoPublicUrl(coverPhoto.data.storage_key)
      : null,
  };
}

export async function getRoomMembers(roomId: string): Promise<{
  members: RoomMember[];
  error: string | null;
}> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { members: [], error: "Supabase is not configured." };
  }

  const { data, error } = await supabase
    .from("room_members_with_profiles")
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });

  if (error) {
    const issue = toQueryIssue(error);
    logQueryIssue("Unable to load members", issue);

    return {
      members: [],
      error: "We could not load the room members. Try refreshing the room.",
    };
  }

  const members = ((data ?? []) as Omit<
    RoomMember,
    "latest_thumbnail_url"
  >[]).map((member) => ({
    ...member,
    latest_thumbnail_url: member.latest_thumbnail_storage_key
      ? getPhotoPublicUrl(member.latest_thumbnail_storage_key)
      : null,
  }));

  return { members, error: null };
}

export async function getRoomPhotos(roomId: string): Promise<{
  photos: PhotoAsset[];
  error: string | null;
}> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { photos: [], error: "Supabase is not configured." };
  }

  const { data, error } = await supabase
    .from("room_photos_with_uploaders")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });

  if (error) {
    const issue = toQueryIssue(error);
    logQueryIssue("Unable to load photos", issue);

    return {
      photos: [],
      error: "We could not load the gallery. Try refreshing the room.",
    };
  }

  const photos = ((data ?? []) as Omit<
    PhotoAsset,
    "public_url" | "thumbnail_public_url"
  >[]).map((photo) => ({
      ...photo,
      public_url: getPhotoPublicUrl(photo.storage_key),
      thumbnail_public_url: getPhotoPublicUrl(photo.thumbnail_storage_key),
    }));

  return { photos, error: null };
}

export async function getOrCreateRoomPhotobook(
  roomId: string,
): Promise<PhotobookDraft | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data: existing, error } = await supabase
    .from("photobook_drafts")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle();

  if (existing) {
    return existing as PhotobookDraft;
  }

  if (error) {
    console.error("Unable to load photobook", error);
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: isOwner } = await supabase.rpc("is_room_owner", {
    target_room_id: roomId,
  });

  if (!isOwner) {
    return null;
  }

  const room = await getRoom(roomId);

  const { data: created, error: createError } = await supabase
    .from("photobook_drafts")
    .insert({
      room_id: roomId,
      created_by: user.id,
      title: room?.name ?? "ClaY photobook",
      cover_photo_id: room?.cover_photo_id ?? null,
      cover_title: room?.name ?? "ClaY photobook",
      cover_subtitle: room?.date_label ?? room?.occasion ?? null,
    })
    .select("*")
    .single();

  if (createError) {
    console.error("Unable to create photobook", createError);
    return null;
  }

  return created as PhotobookDraft;
}
