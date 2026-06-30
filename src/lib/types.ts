export type RoomRole = "owner" | "member";

export type RoomSummary = {
  id: string;
  name: string;
  occasion: string | null;
  location: string | null;
  date_label: string | null;
  invite_token: string;
  cover_photo_id: string | null;
  cover_photo_storage_key: string | null;
  cover_photo_public_url: string | null;
  created_at: string;
  member_count: number;
  photo_count: number;
  role: RoomRole;
};

export type RoomMember = {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: RoomRole;
  joined_at: string;
  photo_count: number;
  latest_thumbnail_storage_key: string | null;
  latest_thumbnail_url: string | null;
};

export type PhotoAsset = {
  id: string;
  room_id: string;
  uploader_id: string;
  storage_key: string;
  thumbnail_storage_key: string;
  original_file_name: string;
  content_type: string;
  thumbnail_content_type: string;
  file_size: number;
  thumbnail_file_size: number;
  width: number | null;
  height: number | null;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
  caption: string | null;
  created_at: string;
  uploader_display_name: string | null;
  uploader_email: string | null;
  favorite_count: number;
  is_favorited: boolean;
  public_url: string | null;
  thumbnail_public_url: string | null;
};

export type CoverFont =
  | "editorial-serif"
  | "modern-sans"
  | "minimal-light"
  | "cinematic-condensed"
  | "soft-script";

export type CoverTextPosition =
  | "top-left"
  | "top-center"
  | "center"
  | "bottom-left"
  | "bottom-center";

export type CoverOverlayStyle = "none" | "soft" | "deep" | "film";

export type PhotobookDraft = {
  id: string;
  room_id: string;
  created_by: string;
  title: string;
  status: "draft" | "ready";
  cover_photo_id: string | null;
  cover_title: string;
  cover_subtitle: string | null;
  cover_font: CoverFont;
  cover_text_color: string;
  cover_text_position: CoverTextPosition;
  cover_overlay_style: CoverOverlayStyle;
  created_at: string;
  updated_at: string;
};
