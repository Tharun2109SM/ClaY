"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Heart,
  ImageIcon,
  Star,
  X,
} from "lucide-react";
import {
  setRoomCoverAction,
  togglePhotoFavoriteAction,
} from "@/app/actions";
import { EmptyGallery } from "@/components/rooms/empty-gallery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PhotoAsset, RoomMember } from "@/lib/types";

type GallerySelection =
  | { type: "people" }
  | { type: "member"; memberId: string }
  | { type: "all" };

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatPhotoDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getUploaderName(photo: PhotoAsset) {
  const displayName = photo.uploader_display_name?.trim();

  return displayName && !isEmailLike(displayName)
    ? displayName
    : photo.uploader_email ?? "a room member";
}

function isEmailLike(value: string) {
  return /^\S+@\S+\.\S+$/.test(value.trim());
}

function getMemberName(member: RoomMember) {
  const displayName = member.display_name?.trim();

  return displayName && !isEmailLike(displayName) ? displayName : "Room member";
}

function getPossessiveName(name: string) {
  return name.endsWith("s") ? `${name}' photos` : `${name}'s photos`;
}

function PhotoImage({
  photo,
  priority = false,
  variant = "full",
}: {
  photo: PhotoAsset;
  priority?: boolean;
  variant?: "full" | "thumbnail";
}) {
  const imageUrl =
    variant === "thumbnail"
      ? photo.thumbnail_public_url ?? photo.public_url
      : photo.public_url;

  if (!imageUrl) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <ImageIcon className="size-7" />
        <p className="px-6 text-center text-xs">
          Add `CLOUDFLARE_R2_PUBLIC_BASE_URL` to display this photo.
        </p>
      </div>
    );
  }

  return (
    <Image
      src={imageUrl}
      alt={photo.caption || photo.original_file_name}
      fill
      sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
      className="object-cover"
      priority={priority}
      crossOrigin="anonymous"
      unoptimized
    />
  );
}

export function PhotoGallery({
  roomId,
  members,
  photos,
  error,
  isHost,
  coverPhotoId,
}: {
  roomId: string;
  members: RoomMember[];
  photos: PhotoAsset[];
  error: string | null;
  isHost: boolean;
  coverPhotoId: string | null;
}) {
  const [selection, setSelection] = useState<GallerySelection>({ type: "people" });
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);

  const memberSummaries = useMemo(
    () =>
      members.map((member) => {
        const memberPhotos = photos.filter(
          (photo) => photo.uploader_id === member.user_id,
        );
        const latestPhoto = memberPhotos[0] ?? null;

        return {
          ...member,
          resolvedPhotoCount: member.photo_count ?? memberPhotos.length,
          resolvedLatestThumbnailUrl:
            member.latest_thumbnail_url ??
            latestPhoto?.thumbnail_public_url ??
            latestPhoto?.public_url ??
            null,
        };
      }),
    [members, photos],
  );

  const selectedMember = useMemo(
    () =>
      selection.type === "member"
        ? memberSummaries.find((member) => member.user_id === selection.memberId) ??
          null
        : null,
    [memberSummaries, selection],
  );

  const filteredPhotos = useMemo(
    () =>
      selection.type === "all"
        ? photos
        : selection.type === "member"
          ? photos.filter((photo) => photo.uploader_id === selection.memberId)
          : [],
    [photos, selection],
  );

  const photoViewTitle =
    selection.type === "all"
      ? "All photos"
      : selectedMember
        ? getPossessiveName(getMemberName(selectedMember))
        : "Photos";

  const activeIndex = activePhotoId
    ? filteredPhotos.findIndex((photo) => photo.id === activePhotoId)
    : -1;
  const activePhoto = activeIndex >= 0 ? filteredPhotos[activeIndex] : null;

  useEffect(() => {
    if (!activePhoto) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActivePhotoId(null);
      }

      if (event.key === "ArrowRight") {
        setActivePhotoId(
          filteredPhotos[(activeIndex + 1) % filteredPhotos.length]?.id ?? null,
        );
      }

      if (event.key === "ArrowLeft") {
        setActivePhotoId(
          filteredPhotos[
            (activeIndex - 1 + filteredPhotos.length) % filteredPhotos.length
          ]?.id ?? null,
        );
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, activePhoto, filteredPhotos]);

  if (error) {
    return (
      <Card className="border-destructive/20 bg-destructive/5">
        <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
          <AlertCircle className="size-6 text-destructive" />
          <div>
            <h2 className="text-base font-semibold">Perspectives unavailable</h2>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (members.length === 0 && photos.length === 0) {
    return <EmptyGallery />;
  }

  return (
    <section className="grid gap-4">
      {selection.type === "people" ? (
        <>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Perspectives
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Perspectives</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Open each person&apos;s collection to see the room through their lens.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={photos.length === 0}
              onClick={() => {
                setSelection({ type: "all" });
                setActivePhotoId(null);
              }}
            >
              All photos
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {memberSummaries.map((member) => (
              <Card
                key={member.id}
                className="overflow-hidden py-0 transition hover:border-foreground/20"
              >
                <button
                  type="button"
                  className="grid w-full text-left"
                  onClick={() => {
                    setSelection({ type: "member", memberId: member.user_id });
                    setActivePhotoId(null);
                  }}
                >
                  <div className="relative aspect-[16/10] bg-muted">
                    {member.resolvedLatestThumbnailUrl ? (
                      <Image
                        src={member.resolvedLatestThumbnailUrl}
                        alt={`${getMemberName(member)} latest upload`}
                        fill
                        sizes="(min-width: 1024px) 360px, 100vw"
                        className="object-cover"
                        crossOrigin="anonymous"
                        unoptimized
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-[linear-gradient(135deg,var(--muted),var(--card))] text-muted-foreground">
                        <ImageIcon className="size-8" />
                      </div>
                    )}
                    {member.role === "owner" ? (
                      <Badge className="absolute left-3 top-3">Host</Badge>
                    ) : null}
                  </div>
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {getMemberName(member)}
                      </p>
                      {member.email ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 rounded-full border px-3 py-1 text-xs text-muted-foreground">
                      {member.resolvedPhotoCount} photo
                      {member.resolvedPhotoCount === 1 ? "" : "s"}
                    </div>
                  </CardContent>
                </button>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-3 mb-2"
                onClick={() => {
                  setSelection({ type: "people" });
                  setActivePhotoId(null);
                }}
              >
                <ChevronLeft className="size-4" />
                Back to people
              </Button>
              <h2 className="text-2xl font-semibold">{photoViewTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {filteredPhotos.length} photo
                {filteredPhotos.length === 1 ? "" : "s"} in this view
              </p>
            </div>
            {selection.type !== "all" ? (
              <Button
                type="button"
                variant="outline"
                disabled={photos.length === 0}
                onClick={() => {
                  setSelection({ type: "all" });
                  setActivePhotoId(null);
                }}
              >
                All photos
              </Button>
            ) : null}
          </div>

      {filteredPhotos.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-44 flex-col items-center justify-center gap-2 text-center">
            <ImageIcon className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">No photos from this member yet</p>
            <p className="text-sm text-muted-foreground">
              Switch back to all photos or invite them to add a few.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredPhotos.map((photo) => (
            <Card key={photo.id} className="overflow-hidden py-0">
              <button
                type="button"
                className="relative aspect-[4/5] w-full bg-muted text-left"
                onClick={() => setActivePhotoId(photo.id)}
              >
                <PhotoImage photo={photo} variant="thumbnail" />
                {coverPhotoId === photo.id ? (
                  <Badge className="absolute left-3 top-3 gap-1">
                    <Star className="size-3" />
                    Cover
                  </Badge>
                ) : null}
              </button>
              <CardContent className="grid gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {photo.caption || photo.original_file_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Uploaded by {getUploaderName(photo)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatPhotoDate(photo.created_at)} ·{" "}
                  {formatBytes(photo.file_size)}
                  {photo.width && photo.height
                    ? ` · ${photo.width} x ${photo.height}`
                    : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <form action={togglePhotoFavoriteAction}>
                    <input type="hidden" name="room_id" value={roomId} />
                    <input type="hidden" name="photo_id" value={photo.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant={photo.is_favorited ? "default" : "outline"}
                    >
                      <Heart
                        className={cn(
                          "size-4",
                          photo.is_favorited ? "fill-current" : "",
                        )}
                      />
                      {photo.favorite_count}
                    </Button>
                  </form>
                  {isHost ? (
                    <form action={setRoomCoverAction}>
                      <input type="hidden" name="room_id" value={roomId} />
                      <input type="hidden" name="photo_id" value={photo.id} />
                      <Button
                        type="submit"
                        size="sm"
                        variant={
                          coverPhotoId === photo.id ? "secondary" : "outline"
                        }
                        disabled={coverPhotoId === photo.id}
                      >
                        <Star className="size-4" />
                        {coverPhotoId === photo.id ? "Cover" : "Set cover"}
                      </Button>
                    </form>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
        </>
      )}

      {activePhoto ? (
        <div
          className="fixed inset-0 z-50 grid bg-foreground/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
        >
          <div className="relative m-auto grid max-h-[calc(100vh-2rem)] w-full max-w-6xl overflow-hidden rounded-lg border bg-card shadow-2xl lg:grid-cols-[1fr_320px]">
            <div className="relative min-h-[55vh] bg-black lg:min-h-[80vh]">
              <PhotoImage photo={activePhoto} priority />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute left-4 top-1/2 -translate-y-1/2"
                onClick={() =>
                  setActivePhotoId(
                    filteredPhotos[
                      (activeIndex - 1 + filteredPhotos.length) %
                        filteredPhotos.length
                    ]?.id ?? null,
                  )
                }
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute right-4 top-1/2 -translate-y-1/2"
                onClick={() =>
                  setActivePhotoId(
                    filteredPhotos[(activeIndex + 1) % filteredPhotos.length]
                      ?.id ?? null,
                  )
                }
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            <aside className="grid content-between gap-6 p-5">
              <div className="grid gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Photo
                    </p>
                    <h2 className="mt-2 text-xl font-semibold">
                      {activePhoto.caption || activePhoto.original_file_name}
                    </h2>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setActivePhotoId(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>

                {activePhoto.caption ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    {activePhoto.caption}
                  </p>
                ) : null}

                <div className="grid gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Uploaded by</p>
                    <p className="font-medium">{getUploaderName(activePhoto)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Upload date</p>
                    <p className="font-medium">
                      {formatPhotoDate(activePhoto.created_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">File name</p>
                    <p className="break-all font-medium">
                      {activePhoto.original_file_name}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {activeIndex + 1} of {filteredPhotos.length}
                </span>
                <span>Esc to close</span>
              </div>
            </aside>
          </div>
        </div>
      ) : null}
    </section>
  );
}
