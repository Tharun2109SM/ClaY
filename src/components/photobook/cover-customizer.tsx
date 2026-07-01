"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Check, Type } from "lucide-react";
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

const positionCoordinates: Record<CoverTextPosition, CoverTextCoordinates> = {
  "top-left": { x: 0.18, y: 0.18 },
  "top-center": { x: 0.5, y: 0.16 },
  center: { x: 0.5, y: 0.5 },
  "bottom-left": { x: 0.18, y: 0.82 },
  "bottom-center": { x: 0.5, y: 0.82 },
};

const overlayOptions: { value: CoverOverlayStyle; label: string }[] = [
  { value: "none", label: "None" },
  { value: "soft", label: "Soft" },
  { value: "deep", label: "Deep" },
  { value: "film", label: "Film" },
];

function getOverlayClass(overlay: CoverOverlayStyle) {
  const classes: Record<CoverOverlayStyle, string> = {
    none: "",
    soft: "bg-black/20",
    deep: "bg-black/45",
    film: "bg-[linear-gradient(180deg,rgba(0,0,0,.10),rgba(0,0,0,.55))]",
  };

  return classes[overlay];
}

type CoverTextCoordinates = {
  x: number;
  y: number;
};

type CoverTextInteraction =
  | { type: "idle" }
  | { type: "drag" }
  | {
      type: "resize";
      centerX: number;
      centerY: number;
      initialDistance: number;
      initialScale: number;
    }
  | {
      type: "width";
      side: "left" | "right";
      startClientX: number;
      coverWidth: number;
      initialWidth: number;
    };

type SavedCoverTextSettings = CoverTextCoordinates & {
  scale?: number;
  width?: number;
};

const minTextScale = 0.6;
const maxTextScale = 2.2;
const defaultTextBoxWidth = 0.65;
const minTextBoxWidth = 0.25;
const maxTextBoxWidth = 0.9;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isCoverTextCoordinates(value: unknown): value is CoverTextCoordinates {
  if (!value || typeof value !== "object") {
    return false;
  }

  const coordinates = value as Partial<CoverTextCoordinates>;

  return (
    typeof coordinates.x === "number" &&
    Number.isFinite(coordinates.x) &&
    typeof coordinates.y === "number" &&
    Number.isFinite(coordinates.y)
  );
}

function getLegacyPositionFromCoordinates({
  x,
  y,
}: CoverTextCoordinates): CoverTextPosition {
  if (y < 0.34) {
    return x < 0.35 ? "top-left" : "top-center";
  }

  if (y > 0.66) {
    return x < 0.35 ? "bottom-left" : "bottom-center";
  }

  return "center";
}

function clampTextBoxWidth(width: number, x: number, scale: number) {
  const maxWidthForPosition = Math.max(
    minTextBoxWidth,
    Math.min(maxTextBoxWidth, ((Math.min(x, 1 - x) - 0.02) * 2) / scale),
  );

  return clamp(width, minTextBoxWidth, maxWidthForPosition);
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
  const [textPosition, setTextPosition] = useState<CoverTextCoordinates>(
    positionCoordinates[photobook.cover_text_position] ?? positionCoordinates.center,
  );
  const [textScale, setTextScale] = useState(1);
  const [textBoxWidth, setTextBoxWidth] = useState(defaultTextBoxWidth);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [isResizingText, setIsResizingText] = useState(false);
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [overlay, setOverlay] = useState<CoverOverlayStyle>(
    photobook.cover_overlay_style,
  );
  const [customColor, setCustomColor] = useState(
    photobook.cover_text_color.startsWith("#")
      ? photobook.cover_text_color
      : "#ffffff",
  );
  const colorInputRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const textGroupRef = useRef<HTMLDivElement>(null);
  const textInteractionRef = useRef<CoverTextInteraction>({ type: "idle" });
  const hasLoadedSavedPositionRef = useRef(false);
  const storageKey = `clay-cover-text-position:${photobook.id}`;

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
  const legacyPosition = getLegacyPositionFromCoordinates(textPosition);

  function getClampedTextPosition(x: number, y: number): CoverTextCoordinates {
    const safeX = clamp((textBoxWidth * textScale) / 2 + 0.02, 0.05, 0.49);
    const safeY = clamp(0.055 * textScale, 0.06, 0.12);

    return {
      x: clamp(x, safeX, 1 - safeX),
      y: clamp(y, safeY, 1 - safeY),
    };
  }

  function getClampedTextBoxWidth(width: number, x = textPosition.x) {
    return clampTextBoxWidth(width, x, textScale);
  }

  function updateTextPositionFromPointer(event: PointerEvent<HTMLElement>) {
    const coverRect = coverRef.current?.getBoundingClientRect();

    if (!coverRect || coverRect.width === 0 || coverRect.height === 0) {
      return;
    }

    const nextX = (event.clientX - coverRect.left) / coverRect.width;
    const nextY = (event.clientY - coverRect.top) / coverRect.height;

    setTextPosition(getClampedTextPosition(nextX, nextY));
  }

  function clampTextPositionAfterResize(nextScale: number) {
    requestAnimationFrame(() => {
      setTextPosition((currentPosition) => getClampedTextPosition(
        currentPosition.x,
        currentPosition.y,
      ));
    });

    return clamp(nextScale, minTextScale, maxTextScale);
  }

  function updateTextScaleFromPointer(event: PointerEvent<HTMLElement>) {
    const interaction = textInteractionRef.current;

    if (interaction.type !== "resize") {
      return;
    }

    const nextDistance = Math.max(
      1,
      Math.hypot(event.clientX - interaction.centerX, event.clientY - interaction.centerY),
    );
    const nextScale =
      interaction.initialScale * (nextDistance / interaction.initialDistance);

    setTextScale(clampTextPositionAfterResize(nextScale));
  }

  function updateTextBoxWidthFromPointer(event: PointerEvent<HTMLElement>) {
    const interaction = textInteractionRef.current;

    if (interaction.type !== "width") {
      return;
    }

    const deltaX = (event.clientX - interaction.startClientX) / interaction.coverWidth;
    const direction = interaction.side === "right" ? 1 : -1;
    const nextWidth = getClampedTextBoxWidth(
      interaction.initialWidth + deltaX * direction,
    );

    setTextBoxWidth(nextWidth);
    setTextPosition((currentPosition) =>
      getClampedTextPosition(currentPosition.x, currentPosition.y),
    );
  }

  function handleTextPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!isHost) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    textInteractionRef.current = { type: "drag" };
    setIsTextSelected(true);
    setIsDraggingText(true);
    updateTextPositionFromPointer(event);
  }

  function handleCoverPointerDown(event: PointerEvent<HTMLDivElement>) {
    const targetNode = event.target instanceof Node ? event.target : null;

    if (targetNode && !textGroupRef.current?.contains(targetNode)) {
      setIsTextSelected(false);
    }
  }

  function handleTextResizePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!isHost) {
      return;
    }

    const coverRect = coverRef.current?.getBoundingClientRect();

    if (!coverRect || coverRect.width === 0 || coverRect.height === 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const centerX = coverRect.left + textPosition.x * coverRect.width;
    const centerY = coverRect.top + textPosition.y * coverRect.height;
    const initialDistance = Math.max(
      1,
      Math.hypot(event.clientX - centerX, event.clientY - centerY),
    );

    textInteractionRef.current = {
      type: "resize",
      centerX,
      centerY,
      initialDistance,
      initialScale: textScale,
    };
    setIsTextSelected(true);
    setIsResizingText(true);
  }

  function handleTextWidthPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!isHost) {
      return;
    }

    const side = event.currentTarget.dataset.side;
    const coverRect = coverRef.current?.getBoundingClientRect();

    if ((side !== "left" && side !== "right") || !coverRect || coverRect.width === 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    textInteractionRef.current = {
      type: "width",
      side,
      startClientX: event.clientX,
      coverWidth: coverRect.width,
      initialWidth: textBoxWidth,
    };
    setIsTextSelected(true);
    setIsResizingText(true);
  }

  function handleTextPointerMove(event: PointerEvent<HTMLElement>) {
    const interaction = textInteractionRef.current;

    if (interaction.type === "idle") {
      return;
    }

    event.preventDefault();

    if (interaction.type === "drag") {
      updateTextPositionFromPointer(event);
      return;
    }

    if (interaction.type === "resize") {
      updateTextScaleFromPointer(event);
      return;
    }

    updateTextBoxWidthFromPointer(event);
  }

  function handleTextPointerEnd(event: PointerEvent<HTMLElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    textInteractionRef.current = { type: "idle" };
    setIsDraggingText(false);
    setIsResizingText(false);
  }

  useEffect(() => {
    hasLoadedSavedPositionRef.current = false;
    const savedPosition = localStorage.getItem(storageKey);
    let nextPosition: CoverTextCoordinates | null = null;
    let nextScale: number | null = null;
    let nextWidth: number | null = null;

    if (savedPosition) {
      try {
        const parsedPosition: unknown = JSON.parse(savedPosition);

        if (isCoverTextCoordinates(parsedPosition)) {
          const savedSettings = parsedPosition as SavedCoverTextSettings;

          nextPosition = {
            x: clamp(parsedPosition.x, 0.05, 0.95),
            y: clamp(parsedPosition.y, 0.05, 0.95),
          };

          if (
            typeof savedSettings.scale === "number" &&
            Number.isFinite(savedSettings.scale)
          ) {
            nextScale = clamp(savedSettings.scale, minTextScale, maxTextScale);
          }

          if (
            typeof savedSettings.width === "number" &&
            Number.isFinite(savedSettings.width)
          ) {
            nextWidth = clampTextBoxWidth(
              savedSettings.width,
              nextPosition.x,
              nextScale ?? 1,
            );
          }
        }
      } catch {
        localStorage.removeItem(storageKey);
      }
    }

    queueMicrotask(() => {
      if (nextPosition) {
        setTextPosition(nextPosition);
      }

      if (nextScale !== null) {
        setTextScale(nextScale);
      }

      if (nextWidth !== null) {
        setTextBoxWidth(nextWidth);
      }

      hasLoadedSavedPositionRef.current = true;
    });
  }, [storageKey]);

  useEffect(() => {
    if (!isHost || !hasLoadedSavedPositionRef.current) {
      return;
    }

    localStorage.setItem(
      storageKey,
      JSON.stringify({ ...textPosition, scale: textScale, width: textBoxWidth }),
    );
  }, [isHost, storageKey, textPosition, textScale, textBoxWidth]);

  const showTextEditorChrome =
    isHost && (isTextSelected || isDraggingText || isResizingText);

  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(480px,1fr)_minmax(380px,440px)] lg:items-start">
      <div className="grid min-h-[70vh] place-items-center rounded-[2rem] border bg-muted/20 p-4 sm:p-6 lg:p-8">
        <div
          data-photobook-page="true"
          data-photobook-page-id="cover"
          data-photobook-page-label="cover page"
          data-photobook-page-order="1"
          ref={coverRef}
          className="relative mx-auto aspect-[4/5] w-full max-w-[34rem] overflow-hidden rounded-[1.25rem] border bg-muted shadow-[0_28px_90px_rgb(0_0_0_/_0.16)] dark:shadow-[0_28px_90px_rgb(0_0_0_/_0.55)]"
          onPointerDown={handleCoverPointerDown}
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
            ref={textGroupRef}
            role="button"
            tabIndex={isHost ? 0 : -1}
            aria-label="Drag cover title"
            onKeyDown={(event) => {
              if (!isHost) {
                return;
              }

              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setTextPosition(positionCoordinates.center);
                setTextScale(1);
                setTextBoxWidth(defaultTextBoxWidth);
                setIsTextSelected(true);
                return;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                setIsTextSelected(false);
              }
            }}
            className={cn(
              "group absolute select-none rounded-2xl p-3 touch-none transition-[outline-color,box-shadow] duration-200 md:p-4",
              isHost ? "cursor-grab active:cursor-grabbing" : "",
              isDraggingText || isResizingText ? "cursor-grabbing" : "",
            )}
            style={{
              color: selectedColorValue,
              left: `${textPosition.x * 100}%`,
              top: `${textPosition.y * 100}%`,
              width: `${textBoxWidth * 100}%`,
              transform: `translate(-50%, -50%) scale(${textScale})`,
              transformOrigin: "center",
            }}
            onPointerDown={handleTextPointerDown}
            onPointerMove={handleTextPointerMove}
            onPointerUp={handleTextPointerEnd}
            onPointerCancel={handleTextPointerEnd}
          >
            <div
              aria-hidden="true"
              className={cn(
                "photobook-editor-chrome pointer-events-none absolute inset-0 rounded-2xl border border-black/45 opacity-0 shadow-[0_12px_34px_rgb(0_0_0_/_0.08)] transition-opacity duration-200 dark:border-white/55",
                isHost ? "group-hover:opacity-100 group-focus-visible:opacity-100" : "",
                showTextEditorChrome ? "opacity-100" : "",
              )}
            />
            <h2 className={cn("text-4xl leading-none md:text-6xl", fontClass)}>
              {title || "ClaY. by tharun"}
            </h2>
            {subtitle ? (
              <p className="mt-4 text-sm font-medium uppercase tracking-[0.22em] md:text-base">
                {subtitle}
              </p>
            ) : null}
            {isHost
              ? ([
                  ["-left-1 -top-1 cursor-nwse-resize", "Resize cover title"],
                  ["-right-1 -top-1 cursor-nesw-resize", "Resize cover title"],
                  ["-bottom-1 -left-1 cursor-nesw-resize", "Resize cover title"],
                  ["-bottom-1 -right-1 cursor-nwse-resize", "Resize cover title"],
                ] as const).map(([positionClass, label]) => (
                  <button
                    key={positionClass}
                    type="button"
                    aria-label={label}
                    className={cn(
                      "photobook-editor-chrome absolute size-2.5 rounded-full border border-white/90 bg-black/80 opacity-0 shadow-[0_2px_8px_rgb(0_0_0_/_0.28)] transition duration-200 hover:scale-125 dark:border-black/70 dark:bg-white/90",
                      positionClass,
                      "group-hover:opacity-100 group-focus-visible:opacity-100",
                      showTextEditorChrome ? "opacity-100" : "",
                    )}
                    onPointerDown={handleTextResizePointerDown}
                    onPointerMove={handleTextPointerMove}
                    onPointerUp={handleTextPointerEnd}
                    onPointerCancel={handleTextPointerEnd}
                  />
                ))
              : null}
            {isHost
              ? ([
                  ["left", "-left-1 top-1/2 -translate-y-1/2 cursor-ew-resize"],
                  ["right", "-right-1 top-1/2 -translate-y-1/2 cursor-ew-resize"],
                ] as const).map(([side, positionClass]) => (
                  <button
                    key={side}
                    type="button"
                    aria-label={`Adjust cover title ${side} edge`}
                    className={cn(
                      "photobook-editor-chrome absolute h-5 w-2 rounded-full border border-white/90 bg-black/80 opacity-0 shadow-[0_2px_8px_rgb(0_0_0_/_0.28)] transition duration-200 hover:scale-110 dark:border-black/70 dark:bg-white/90",
                      positionClass,
                      "group-hover:opacity-100 group-focus-visible:opacity-100",
                      showTextEditorChrome ? "opacity-100" : "",
                    )}
                    data-side={side}
                    onPointerDown={handleTextWidthPointerDown}
                    onPointerMove={handleTextPointerMove}
                    onPointerUp={handleTextPointerEnd}
                    onPointerCancel={handleTextPointerEnd}
                  />
                ))
              : null}
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
        <input type="hidden" name="cover_text_position" value={legacyPosition} />
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
          <span className={controlLabelClass}>Position</span>
          <div className="rounded-2xl border bg-muted/20 p-3">
            <p className="text-sm leading-6 text-muted-foreground">
              Drag the title to move it. Pull corners to resize, or side handles to change width.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 rounded-full"
              disabled={!isHost}
              onClick={() => {
                setTextPosition(positionCoordinates.center);
                setTextScale(1);
                setTextBoxWidth(defaultTextBoxWidth);
                setIsTextSelected(true);
              }}
            >
              Reset text
            </Button>
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
