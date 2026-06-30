"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { Check, Move, Type } from "lucide-react";
import { updatePhotobookCoverAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  CoverFont,
  CoverOverlayStyle,
  CoverTextPosition,
  PhotoAsset,
  PhotobookDraft,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const fontOptions: { value: CoverFont; label: string; className: string }[] = [
  {
    value: "editorial-serif",
    label: "Editorial Serif",
    className: "font-serif",
  },
  { value: "modern-sans", label: "Modern Sans", className: "font-sans" },
  {
    value: "minimal-light",
    label: "Minimal Light",
    className: "font-sans font-light",
  },
  {
    value: "cinematic-condensed",
    label: "Cinematic Condensed",
    className: "font-sans uppercase tracking-[0.16em]",
  },
  {
    value: "soft-script",
    label: "Soft Script",
    className: "font-serif italic",
  },
];

const colorOptions = [
  { value: "#ffffff", label: "White" },
  { value: "#050505", label: "Black" },
  { value: "#fff4dc", label: "Warm cream" },
  { value: "#b8b8b8", label: "Soft gray" },
  { value: "#ffc457", label: "Amber" },
  { value: "#ff8060", label: "Coral" },
  { value: "#e53935", label: "Red" },
  { value: "#f7b6c8", label: "Blush pink" },
  { value: "#b9a7ff", label: "Lavender" },
  { value: "#8fd3ff", label: "Sky blue" },
  { value: "#32dcdc", label: "Cyan" },
  { value: "#9ff3d4", label: "Mint" },
  { value: "#9caf88", label: "Sage green" },
];

const legacyColorValues: Record<string, string> = {
  ivory: "#fff8e7",
  ink: "#171717",
  clay: "#b97155",
  sage: "#dbe8ca",
  rose: "#f3d3c8",
};

const positionOptions: { value: CoverTextPosition; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-center", label: "Top" },
  { value: "center", label: "Center" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom" },
];

const overlayOptions: { value: CoverOverlayStyle; label: string }[] = [
  { value: "none", label: "None" },
  { value: "soft", label: "Soft" },
  { value: "deep", label: "Deep" },
  { value: "film", label: "Film" },
];

function getPositionClass(position: CoverTextPosition) {
  const classes: Record<CoverTextPosition, string> = {
    "top-left": "items-start justify-start text-left",
    "top-center": "items-center justify-start text-center",
    center: "items-center justify-center text-center",
    "bottom-left": "items-start justify-end text-left",
    "bottom-center": "items-center justify-end text-center",
  };

  return classes[position];
}

function getOverlayClass(overlay: CoverOverlayStyle) {
  const classes: Record<CoverOverlayStyle, string> = {
    none: "",
    soft: "bg-black/20",
    deep: "bg-black/45",
    film: "bg-[linear-gradient(180deg,rgba(0,0,0,.10),rgba(0,0,0,.55))]",
  };

  return classes[overlay];
}

export function CoverCustomizer({
  roomId,
  photobook,
  photos,
  isHost,
}: {
  roomId: string;
  photobook: PhotobookDraft;
  photos: PhotoAsset[];
  isHost: boolean;
}) {
  const [coverPhotoId, setCoverPhotoId] = useState(
    photobook.cover_photo_id ?? photos[0]?.id ?? "",
  );
  const [title, setTitle] = useState(photobook.cover_title);
  const [subtitle, setSubtitle] = useState(photobook.cover_subtitle ?? "");
  const [font, setFont] = useState<CoverFont>(photobook.cover_font);
  const [color, setColor] = useState(photobook.cover_text_color);
  const [position, setPosition] = useState<CoverTextPosition>(
    photobook.cover_text_position,
  );
  const [overlay, setOverlay] = useState<CoverOverlayStyle>(
    photobook.cover_overlay_style,
  );
  const [customColor, setCustomColor] = useState(
    photobook.cover_text_color.startsWith("#")
      ? photobook.cover_text_color
      : "#ffffff",
  );
  const colorInputRef = useRef<HTMLInputElement>(null);

  const selectedPhoto = useMemo(
    () => photos.find((photo) => photo.id === coverPhotoId) ?? photos[0],
    [coverPhotoId, photos],
  );
  const fontClass =
    fontOptions.find((option) => option.value === font)?.className ?? "font-serif";
  const selectedColorValue = color.startsWith("#")
    ? color
    : legacyColorValues[color] ?? "#fff8e7";
  const isCustomColor =
    color.startsWith("#") &&
    !colorOptions.some((option) => option.value.toLowerCase() === color.toLowerCase());

  const controlSectionClass = "grid gap-3";
  const controlLabelClass =
    "text-xs uppercase tracking-[0.18em] text-muted-foreground";
  const pillClass =
    "h-9 rounded-full border px-3 text-xs font-normal transition-all duration-200 hover:border-foreground/30";

  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(480px,1fr)_minmax(380px,440px)] lg:items-start">
      <div className="grid min-h-[70vh] place-items-center rounded-[2rem] border bg-muted/20 p-4 sm:p-6 lg:p-8">
        <div
          data-photobook-page="true"
          data-photobook-page-id="cover"
          data-photobook-page-label="cover page"
          data-photobook-page-order="1"
          className="relative mx-auto aspect-[4/5] w-full max-w-[34rem] overflow-hidden rounded-[1.25rem] border bg-muted shadow-[0_28px_90px_rgb(0_0_0_/_0.16)] dark:shadow-[0_28px_90px_rgb(0_0_0_/_0.55)]"
        >
          {selectedPhoto?.public_url ? (
            <Image
              src={selectedPhoto.public_url}
              alt={selectedPhoto.original_file_name}
              fill
              priority
              sizes="(min-width: 768px) 720px, 100vw"
              className="object-cover"
              crossOrigin="anonymous"
              unoptimized
            />
          ) : (
            <div className="grid size-full place-items-center text-sm text-muted-foreground">
              Choose a room photo
            </div>
          )}
          <div className={cn("absolute inset-0", getOverlayClass(overlay))} />
          <div
            className={cn(
              "absolute inset-0 flex p-8 md:p-12",
              getPositionClass(position),
            )}
          >
            <div className="max-w-[82%]" style={{ color: selectedColorValue }}>
              <h2 className={cn("text-4xl leading-none md:text-6xl", fontClass)}>
                {title || "ClaY. by tharun"}
              </h2>
              {subtitle ? (
                <p className="mt-4 text-sm font-medium uppercase tracking-[0.22em] md:text-base">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <form
        action={updatePhotobookCoverAction}
        className="grid w-full gap-6 rounded-[2rem] border bg-card p-5 shadow-none lg:sticky lg:top-28"
      >
        <input type="hidden" name="room_id" value={roomId} />
        <input type="hidden" name="photobook_id" value={photobook.id} />
        <input type="hidden" name="cover_photo_id" value={coverPhotoId} />
        <input type="hidden" name="cover_font" value={font} />
        <input type="hidden" name="cover_text_color" value={color} />
        <input type="hidden" name="cover_text_position" value={position} />
        <input type="hidden" name="cover_overlay_style" value={overlay} />

        <div className={controlSectionClass}>
          <span className={controlLabelClass}>Text</span>
          <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="cover_title" className="text-sm text-muted-foreground">
              Cover title
            </Label>
            <Input
              id="cover_title"
              name="cover_title"
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
              disabled={!isHost}
              className="h-11 rounded-2xl bg-transparent"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cover_subtitle" className="text-sm text-muted-foreground">
              Subtitle/date
            </Label>
            <Input
              id="cover_subtitle"
              name="cover_subtitle"
              value={subtitle}
              onChange={(event) => setSubtitle(event.currentTarget.value)}
              disabled={!isHost}
              className="h-11 rounded-2xl bg-transparent"
            />
          </div>
          </div>
        </div>

        <div className={controlSectionClass}>
          <span className={cn(controlLabelClass, "flex items-center gap-2")}>
            <Type className="size-4" />
            Font
          </span>
          <div className="flex flex-wrap gap-2">
            {fontOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={font === option.value ? "default" : "outline"}
                size="sm"
                className={cn(pillClass, option.className)}
                onClick={() => setFont(option.value)}
                disabled={!isHost}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className={controlSectionClass}>
          <span className={controlLabelClass}>Text color</span>
          <div className="flex flex-wrap gap-2.5">
            {colorOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-label={option.label}
                title={option.label}
                className={cn(
                  "grid size-9 place-items-center rounded-full border transition-all duration-200",
                  color.toLowerCase() === option.value.toLowerCase()
                    ? "border-foreground ring-2 ring-foreground/25"
                    : "border-border hover:border-foreground/40",
                )}
                style={{ backgroundColor: option.value }}
                onClick={() => setColor(option.value)}
                disabled={!isHost}
              >
                {color.toLowerCase() === option.value.toLowerCase() ? (
                  <Check
                    className={cn(
                      "size-4",
                      option.value === "#050505" ? "text-white" : "text-black",
                    )}
                  />
                ) : null}
              </button>
            ))}
            <button
              type="button"
              aria-label="Custom color"
              title="Custom"
              className={cn(
                "grid size-9 place-items-center rounded-full border bg-[conic-gradient(from_0deg,#ff4d4d,#ffc457,#9ff3d4,#32dcdc,#8fd3ff,#b9a7ff,#ff4d4d)] transition-all duration-200",
                isCustomColor
                  ? "border-foreground ring-2 ring-foreground/25"
                  : "border-border hover:border-foreground/40",
              )}
              onClick={() => colorInputRef.current?.click()}
              disabled={!isHost}
            >
              {isCustomColor ? <Check className="size-4 text-black" /> : null}
            </button>
            <input
              ref={colorInputRef}
              type="color"
              value={customColor}
              className="sr-only"
              onChange={(event) => {
                setCustomColor(event.currentTarget.value);
                setColor(event.currentTarget.value);
              }}
              disabled={!isHost}
              aria-label="Choose custom text color"
            />
          </div>
        </div>

        <div className={controlSectionClass}>
          <span className={cn(controlLabelClass, "flex items-center gap-2")}>
            <Move className="size-4" />
            Position
          </span>
          <div className="flex flex-wrap gap-2">
            {positionOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={position === option.value ? "default" : "outline"}
                size="sm"
                className={pillClass}
                onClick={() => setPosition(option.value)}
                disabled={!isHost}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className={controlSectionClass}>
          <span className={controlLabelClass}>Cover photo</span>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                className={cn(
                  "relative h-20 w-16 shrink-0 overflow-hidden rounded-xl border bg-muted transition-all duration-200 hover:border-foreground/40",
                  coverPhotoId === photo.id ? "ring-2 ring-ring" : "",
                )}
                onClick={() => setCoverPhotoId(photo.id)}
                disabled={!isHost}
              >
                {photo.thumbnail_public_url ? (
                  <Image
                    src={photo.thumbnail_public_url}
                    alt={photo.original_file_name}
                    fill
                    sizes="64px"
                    className="object-cover"
                    crossOrigin="anonymous"
                    unoptimized
                  />
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className={controlSectionClass}>
          <span className={controlLabelClass}>Mood/filter</span>
          <div className="flex flex-wrap gap-2">
            {overlayOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={overlay === option.value ? "default" : "outline"}
                size="sm"
                className={pillClass}
                onClick={() => setOverlay(option.value)}
                disabled={!isHost}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <Button
          type="submit"
          disabled={!isHost}
          className="h-11 w-full rounded-full"
        >
          Save cover
        </Button>
      </form>
    </section>
  );
}
