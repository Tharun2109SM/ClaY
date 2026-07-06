"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Heart,
  ImageIcon,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  deletePhotoAction,
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

function getPhotoImageUrl(photo: PhotoAsset, variant: "full" | "thumbnail") {
  return variant === "thumbnail"
    ? photo.thumbnail_public_url ?? photo.public_url
    : photo.public_url;
}

function PhotoImage({
  photo,
  priority = false,
  variant = "full",
  fit = "cover",
  hoverZoom = true,
}: {
  photo: PhotoAsset;
  priority?: boolean;
  variant?: "full" | "thumbnail";
  fit?: "cover" | "contain";
  hoverZoom?: boolean;
}) {
  const imageUrl = getPhotoImageUrl(photo, variant);

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
      sizes={
        fit === "contain"
          ? "(min-width: 1024px) 900px, 100vw"
          : "(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
      }
      className={cn(
        fit === "contain" ? "object-contain" : "object-cover",
        hoverZoom &&
          "transition duration-700 ease-out group-hover:scale-[1.035]",
      )}
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
  currentUserId,
}: {
  roomId: string;
  members: RoomMember[];
  photos: PhotoAsset[];
  error: string | null;
  isHost: boolean;
  coverPhotoId: string | null;
  currentUserId: string;
}) {
  const router = useRouter();
  const [selection, setSelection] = useState<GallerySelection>({ type: "people" });
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PhotoAsset | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletePending, startDeleteTransition] = useTransition();

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
  const selectedMemberName = selectedMember ? getMemberName(selectedMember) : null;
  const selectedMemberInitials = selectedMemberName
    ? selectedMemberName.slice(0, 2).toUpperCase()
    : "CL";

  const activePhoto =
    activePhotoIndex !== null ? filteredPhotos[activePhotoIndex] ?? null : null;

  const closeLightbox = useCallback(() => {
    setActivePhotoIndex(null);
  }, []);

  const showNextPhoto = useCallback(() => {
    setActivePhotoIndex((current) => {
      if (filteredPhotos.length === 0) {
        return null;
      }

      return current === null ? 0 : (current + 1) % filteredPhotos.length;
    });
  }, [filteredPhotos.length]);

  const showPreviousPhoto = useCallback(() => {
    setActivePhotoIndex((current) => {
      if (filteredPhotos.length === 0) {
        return null;
      }

      return current === null
        ? filteredPhotos.length - 1
        : (current - 1 + filteredPhotos.length) % filteredPhotos.length;
    });
  }, [filteredPhotos.length]);

  function canDeletePhoto(photo: PhotoAsset) {
    return isHost || photo.uploader_id === currentUserId;
  }

  function handleDeletePhoto() {
    const target = deleteTarget;

    if (!target) {
      return;
    }

    const formData = new FormData();
    formData.set("room_id", roomId);
    formData.set("photo_id", target.id);
    setDeleteError(null);

    startDeleteTransition(async () => {
      const result = await deletePhotoAction(formData);

      if (result.ok) {
        if (activePhoto?.id === target.id) {
          closeLightbox();
        }

        setDeleteTarget(null);
        router.refresh();
        return;
      }

      setDeleteError(`${result.code}: ${result.message}`);
    });
  }

  useEffect(() => {
    if (activePhotoIndex === null || filteredPhotos.length <= 1) {
      return;
    }

    const adjacentPhotos = [
      filteredPhotos[(activePhotoIndex + 1) % filteredPhotos.length],
      filteredPhotos[
        (activePhotoIndex - 1 + filteredPhotos.length) % filteredPhotos.length
      ],
    ];

    adjacentPhotos.forEach((photo) => {
      const src = photo ? getPhotoImageUrl(photo, "full") : null;

      if (!src) {
        return;
      }

      const image = new window.Image();
      image.src = src;
    });
  }, [activePhotoIndex, filteredPhotos]);

  useEffect(() => {
    if (!activePhoto) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeLightbox();
      }

      if (event.key === "ArrowRight") {
        showNextPhoto();
      }

      if (event.key === "ArrowLeft") {
        showPreviousPhoto();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePhoto, closeLightbox, showNextPhoto, showPreviousPhoto]);

  const photoGridContent =
    filteredPhotos.length === 0 ? (
      <Card className="rounded-[1.5rem] border-dashed border-foreground/14 bg-background/38">
        <CardContent className="flex min-h-44 flex-col items-center justify-center gap-2 text-center">
          <ImageIcon className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">No photos from this member yet</p>
          <p className="text-sm text-muted-foreground">
            Switch back to all photos or invite them to add a few.
          </p>
        </CardContent>
      </Card>
    ) : (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-4">
        {filteredPhotos.map((photo, index) => (
          <Card
            key={photo.id}
            className="group overflow-hidden rounded-[1.5rem] border-white/10 bg-background/44 py-0 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-foreground/22 hover:shadow-[0_18px_60px_rgb(0_0_0_/_0.18)] dark:bg-black/22"
          >
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
              <button
                type="button"
                className="absolute inset-0 w-full text-left"
                onClick={() => setActivePhotoIndex(index)}
              >
                <PhotoImage photo={photo} variant="thumbnail" />
                <span className="sr-only">Open photo</span>
              </button>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/32 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
              {coverPhotoId === photo.id ? (
                <Badge className="absolute left-3 top-3 gap-1 rounded-full border border-white/15 bg-black/45 text-white/88 backdrop-blur">
                  <Star className="size-3" />
                  Cover
                </Badge>
              ) : null}
              {canDeletePhoto(photo) ? (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  aria-label="Delete photo"
                  className="absolute right-3 top-3 z-10 size-9 rounded-full border border-black/10 bg-white/85 text-muted-foreground shadow-sm backdrop-blur transition duration-200 hover:border-destructive/30 hover:bg-destructive hover:text-destructive-foreground focus-visible:opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100 dark:border-white/10 dark:bg-black/60 dark:hover:border-destructive/40 dark:hover:bg-destructive dark:hover:text-destructive-foreground"
                  onClick={() => {
                    setDeleteTarget(photo);
                    setDeleteError(null);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
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
                {formatPhotoDate(photo.created_at)} · {formatBytes(photo.file_size)}
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
                    className="rounded-full"
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
                      variant={coverPhotoId === photo.id ? "secondary" : "outline"}
                      disabled={coverPhotoId === photo.id}
                      className="rounded-full"
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
    );

  if (error) {
    return (
      <Card className="rounded-[1.75rem] border-destructive/20 bg-destructive/5">
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
    <section className="grid gap-5 rounded-[2rem] border border-white/10 bg-card/52 p-5 shadow-[0_18px_70px_rgb(0_0_0_/_0.12)] backdrop-blur sm:p-6 dark:bg-white/[0.025]">
      {selection.type === "people" ? (
        <>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Perspectives
              </p>
              <h2 className="mt-2 text-3xl leading-tight">Perspectives</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Open each person&apos;s collection to see the room through their lens.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full border-foreground/12 bg-background/45 px-4 transition duration-300 hover:-translate-y-0.5 hover:border-foreground/24 dark:bg-white/[0.045]"
              disabled={photos.length === 0}
              onClick={() => {
                setSelection({ type: "all" });
                closeLightbox();
              }}
            >
              All photos
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:gap-5">
            {memberSummaries.map((member) => (
              <Card
                key={member.id}
                className="group overflow-hidden rounded-[1.5rem] border-white/10 bg-background/44 py-0 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-foreground/22 hover:shadow-[0_18px_60px_rgb(0_0_0_/_0.18)] dark:bg-black/22"
              >
                <button
                  type="button"
                  className="grid w-full text-left"
                  onClick={() => {
                    setSelection({ type: "member", memberId: member.user_id });
                    closeLightbox();
                  }}
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                    {member.resolvedLatestThumbnailUrl ? (
                      <Image
                        src={member.resolvedLatestThumbnailUrl}
                        alt={`${getMemberName(member)} latest upload`}
                        fill
                        sizes="(min-width: 1024px) 360px, 100vw"
                        className="object-cover transition duration-700 ease-out group-hover:scale-[1.045]"
                        crossOrigin="anonymous"
                        unoptimized
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-[linear-gradient(135deg,var(--muted),var(--card))] text-muted-foreground">
                        <ImageIcon className="size-8" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent opacity-80" />
                    {member.role === "owner" ? (
                      <Badge className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/40 text-white/86 backdrop-blur">
                        Host
                      </Badge>
                    ) : null}
                  </div>
                  <CardContent className="flex items-center justify-between gap-4 p-[1.125rem]">
                    <div className="min-w-0">
                      <p className="truncate text-base">
                        {getMemberName(member)}
                      </p>
                      {member.email ? (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 rounded-full border border-foreground/10 bg-muted/45 px-3 py-1 text-xs text-muted-foreground">
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
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-3 mb-2 rounded-full"
                onClick={() => {
                  setSelection({ type: "people" });
                  closeLightbox();
                }}
              >
                <ChevronLeft className="size-4" />
                Back to people
              </Button>
              <h2 className="text-3xl leading-tight">{photoViewTitle}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {filteredPhotos.length} photo
                {filteredPhotos.length === 1 ? "" : "s"} in this view
              </p>
            </div>
            {selection.type !== "all" ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-full border-foreground/12 bg-background/45 px-4 transition duration-300 hover:-translate-y-0.5 hover:border-foreground/24 dark:bg-white/[0.045]"
                disabled={photos.length === 0}
                onClick={() => {
                  setSelection({ type: "all" });
                  closeLightbox();
                }}
              >
                All photos
              </Button>
            ) : null}
          </div>

          {selection.type === "member" && selectedMember ? (
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">{photoGridContent}</div>
              <aside className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-background/50 p-5 shadow-sm dark:bg-black/22">
                <div className="flex items-start gap-3">
                  <div className="grid size-12 shrink-0 place-items-center rounded-full border border-foreground/10 bg-[#f7efe0] text-sm text-black shadow-sm dark:bg-white/10 dark:text-foreground">
                    {selectedMemberInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Viewing perspective
                    </p>
                    <h3 className="mt-2 truncate text-lg">{selectedMemberName}</h3>
                    {selectedMember.email ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {selectedMember.email}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-foreground/10 bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Photos</p>
                    <p className="mt-1 text-2xl leading-none">
                      {filteredPhotos.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-foreground/10 bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Role</p>
                    <p className="mt-1 truncate text-sm capitalize">
                      {selectedMember.role}
                    </p>
                  </div>
                </div>

                <p className="text-sm leading-6 text-muted-foreground">
                  You&apos;re seeing the room through this person&apos;s uploaded
                  moments.
                </p>

                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-full border-foreground/12 bg-background/45 px-4 transition duration-300 hover:-translate-y-0.5 hover:border-foreground/24 dark:bg-white/[0.045]"
                  disabled={photos.length === 0}
                  onClick={() => {
                    setSelection({ type: "all" });
                    closeLightbox();
                  }}
                >
                  All photos
                </Button>
              </aside>
            </div>
          ) : (
            photoGridContent
          )}
        </>
      )}

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-photo-title"
        >
          <div className="w-full max-w-md rounded-3xl border bg-card p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-full border bg-muted text-destructive">
                <Trash2 className="size-4" />
              </div>
              <div>
                <h2 id="delete-photo-title" className="text-lg font-semibold">
                  Delete this photo?
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  This removes the photo from ClaY and storage. This cannot be
                  undone.
                </p>
              </div>
            </div>

            {deleteError ? (
              <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {deleteError}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isDeletePending}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isDeletePending}
                onClick={handleDeletePhoto}
              >
                {isDeletePending ? "Deleting…" : "Delete photo"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {activePhoto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-3 backdrop-blur-md sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
        >
          <div className="relative grid h-[min(90vh,900px)] w-[min(1240px,calc(100vw-1.5rem))] grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-[1.5rem] border border-white/12 bg-card shadow-2xl lg:w-[min(1240px,calc(100vw-3rem))] lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-none">
            <div className="relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden bg-black">
              <PhotoImage
                photo={activePhoto}
                priority
                fit="contain"
                hoverZoom={false}
              />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                aria-label="Close photo viewer"
                className="absolute right-3 top-3 z-20 rounded-full border border-white/10 bg-black/50 text-white shadow-lg backdrop-blur transition hover:bg-black/70 lg:hidden"
                onClick={closeLightbox}
              >
                <X className="size-4" />
              </Button>
              {filteredPhotos.length > 1 ? (
                <>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    aria-label="Previous photo"
                    className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-black/45 text-white shadow-lg backdrop-blur transition hover:bg-black/70 sm:left-4"
                    onClick={showPreviousPhoto}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    aria-label="Next photo"
                    className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-black/45 text-white shadow-lg backdrop-blur transition hover:bg-black/70 sm:right-4"
                    onClick={showNextPhoto}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </>
              ) : null}
            </div>

            <aside className="grid min-h-0 content-between gap-5 overflow-y-auto border-t border-white/10 bg-card/96 p-5 lg:border-l lg:border-t-0">
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
                    className="hidden rounded-full lg:inline-flex"
                    onClick={closeLightbox}
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
                  {(activePhotoIndex ?? 0) + 1} of {filteredPhotos.length}
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
