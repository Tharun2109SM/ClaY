"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";
import { Check, Type } from "lucide-react";
import { updatePhotobookCoverAction } from "@/app/actions";
import {
  EditableTextBox,
  type EditableTextGeometry,
  type PhotobookTextObject,
  type PhotobookTextObjectRole,
} from "@/components/photobook/editable-text-box";
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

type CoverEditableTextSettings = PhotobookTextObject;

type SavedCoverTextSettings = {
  version?: 3;
  titleText?: Partial<CoverEditableTextSettings>;
  subtitleText?: Partial<CoverEditableTextSettings>;
  customTextObjects?: Partial<CoverEditableTextSettings>[];
};

type LegacySavedCoverTextSettings = CoverTextCoordinates & {
  scale?: number;
  width?: number;
};

const minTextScale = 0.35;
const maxTextScale = 2.8;
const defaultTitleText: EditableTextGeometry = {
  x: 0.5,
  y: 0.45,
  scale: 1,
  width: 0.65,
};
const defaultSubtitleText: EditableTextGeometry = {
  x: 0.5,
  y: 0.56,
  scale: 0.55,
  width: 0.45,
};
const defaultCustomText: EditableTextGeometry = {
  x: 0.5,
  y: 0.68,
  scale: 0.75,
  width: 0.45,
};
const minTextBoxWidth = 0.12;
const maxTextBoxWidth = 0.98;

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

function isSavedCoverTextSettings(value: unknown): value is SavedCoverTextSettings {
  if (!value || typeof value !== "object") {
    return false;
  }

  const settings = value as Partial<SavedCoverTextSettings>;

  return Boolean(settings.titleText || settings.subtitleText || settings.customTextObjects);
}

function resolveTextColor(color: string) {
  return color.startsWith("#") ? color : legacyColorValues[color] ?? "#fff8e7";
}

function getFontClass(font: CoverFont) {
  return fontOptions.find((option) => option.value === font)?.className ?? "font-serif";
}

function clampTextBoxWidth(width: number) {
  return clamp(width, minTextBoxWidth, maxTextBoxWidth);
}

function createClientId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function normalizeTextSettings(
  value: Partial<CoverEditableTextSettings> | null | undefined,
  fallbackGeometry: EditableTextGeometry,
  fallbackFont: CoverFont,
  fallbackColor: string,
  fallbackText: string,
  fallbackId: string,
  fallbackRole: PhotobookTextObjectRole,
): CoverEditableTextSettings {
  const savedFont = value?.font;
  const savedRole = value?.role;
  const scale =
    typeof value?.scale === "number" && Number.isFinite(value.scale)
      ? clamp(value.scale, minTextScale, maxTextScale)
      : fallbackGeometry.scale;
  const x =
    typeof value?.x === "number" && Number.isFinite(value.x)
      ? clamp(value.x, 0.05, 0.95)
      : fallbackGeometry.x;

  return {
    id: typeof value?.id === "string" && value.id ? value.id : fallbackId,
    text: typeof value?.text === "string" ? value.text : fallbackText,
    role:
      savedRole === "title" ||
      savedRole === "subtitle" ||
      savedRole === "name" ||
      savedRole === "custom"
        ? savedRole
        : fallbackRole,
    x,
    y:
      typeof value?.y === "number" && Number.isFinite(value.y)
        ? clamp(value.y, 0.05, 0.95)
        : fallbackGeometry.y,
    scale,
    width:
      typeof value?.width === "number" && Number.isFinite(value.width)
        ? clampTextBoxWidth(value.width)
        : fallbackGeometry.width,
    font: fontOptions.some((option) => option.value === savedFont)
      ? (savedFont as CoverFont)
      : fallbackFont,
    color: resolveTextColor(
      typeof value?.color === "string" ? value.color : fallbackColor,
    ),
  };
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
  const initialTextColor = resolveTextColor(photobook.cover_text_color);
  const [titleText, setTitleText] = useState<CoverEditableTextSettings>(
    normalizeTextSettings(
      {
        ...defaultTitleText,
        id: "cover-title",
        text: photobook.cover_title,
        role: "title",
        font: photobook.cover_font,
        color: initialTextColor,
      },
      defaultTitleText,
      photobook.cover_font,
      initialTextColor,
      photobook.cover_title,
      "cover-title",
      "title",
    ),
  );
  const [subtitleText, setSubtitleText] = useState<CoverEditableTextSettings>(
    normalizeTextSettings(
      {
        ...defaultSubtitleText,
        id: "cover-subtitle",
        text: photobook.cover_subtitle ?? "",
        role: "subtitle",
        font: photobook.cover_font,
        color: initialTextColor,
      },
      defaultSubtitleText,
      photobook.cover_font,
      initialTextColor,
      photobook.cover_subtitle ?? "",
      "cover-subtitle",
      "subtitle",
    ),
  );
  const [customTextObjects, setCustomTextObjects] = useState<
    CoverEditableTextSettings[]
  >([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<CoverOverlayStyle>(
    photobook.cover_overlay_style,
  );
  const [titleCustomColor, setTitleCustomColor] = useState(initialTextColor);
  const [subtitleCustomColor, setSubtitleCustomColor] = useState(initialTextColor);
  const [customTextCustomColor, setCustomTextCustomColor] =
    useState(initialTextColor);
  const titleColorInputRef = useRef<HTMLInputElement>(null);
  const subtitleColorInputRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const hasLoadedSavedPositionRef = useRef(false);
  const storageKey = `clay-cover-text-position:${photobook.id}`;
  const customTextColorInputRef = useRef<HTMLInputElement>(null);

  const selectedPhoto = useMemo(
    () => photos.find((photo) => photo.id === coverPhotoId) ?? photos[0],
    [coverPhotoId, photos],
  );
  const isCustomTitleColor =
    titleText.color.startsWith("#") &&
    !colorOptions.some(
      (option) => option.value.toLowerCase() === titleText.color.toLowerCase(),
    );
  const isCustomSubtitleColor =
    subtitleText.color.startsWith("#") &&
    !colorOptions.some(
      (option) => option.value.toLowerCase() === subtitleText.color.toLowerCase(),
    );
  const selectedCustomText =
    customTextObjects.find((textObject) => textObject.id === selectedTextId) ?? null;
  const selectedCustomTextIsCustomColor =
    Boolean(selectedCustomText?.color.startsWith("#")) &&
    !colorOptions.some(
      (option) =>
        option.value.toLowerCase() === selectedCustomText?.color.toLowerCase(),
    );
  const title = titleText.text;
  const subtitle = subtitleText.text;

  const controlSectionClass =
    "grid gap-4 border-b border-border/35 pb-6 last:border-b-0 last:pb-0 dark:border-white/[0.08]";
  const controlLabelClass =
    "text-[0.66rem] uppercase tracking-[0.24em] text-muted-foreground/75";
  const controlSubLabelClass = "text-xs text-muted-foreground/80";
  const inspectorInputClass =
    "h-12 rounded-2xl border-border/50 bg-background/65 px-4 text-sm shadow-none transition-all duration-200 placeholder:text-muted-foreground/45 hover:border-foreground/20 hover:bg-background/80 focus-visible:border-foreground/35 focus-visible:ring-2 focus-visible:ring-foreground/10 focus-visible:ring-offset-0 dark:border-white/[0.09] dark:bg-white/[0.045] dark:hover:border-white/20 dark:hover:bg-white/[0.065]";
  const pillClass =
    "h-8 rounded-full border px-3.5 text-xs font-normal shadow-none transition-all duration-200 active:scale-[0.98]";
  const selectedPillClass =
    "border-foreground bg-foreground text-background shadow-[inset_0_1px_0_rgb(255_255_255_/_0.18),0_8px_24px_rgb(0_0_0_/_0.08)] hover:bg-foreground/90 dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/90";
  const idlePillClass =
    "border-border/55 bg-background/35 text-muted-foreground hover:border-foreground/30 hover:bg-muted/45 hover:text-foreground dark:border-white/[0.09] dark:bg-white/[0.035] dark:hover:bg-white/[0.075]";
  const legacyPosition = getLegacyPositionFromCoordinates(titleText);

  function handleCoverPointerDown(event: PointerEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target : null;

    if (!target?.closest("[data-photobook-editable='true']")) {
      setSelectedTextId(null);
    }
  }

  function resetTitleText() {
    setTitleText((current) => ({ ...current, ...defaultTitleText }));
    setSelectedTextId("cover-title");
  }

  function resetSubtitleText() {
    setSubtitleText((current) => ({ ...current, ...defaultSubtitleText }));
    setSelectedTextId("cover-subtitle");
  }

  function resetAllText() {
    resetTitleText();
    setSubtitleText((current) => ({ ...current, ...defaultSubtitleText }));
    setCustomTextObjects((current) =>
      current.map((textObject, index) => ({
        ...textObject,
        x: clamp(0.5 + ((index % 3) - 1) * 0.12, 0.16, 0.84),
        y: clamp(0.68 + Math.floor(index / 3) * 0.08, 0.18, 0.9),
        scale: defaultCustomText.scale,
        width: defaultCustomText.width,
      })),
    );
  }

  function addCoverTextBox() {
    const id = createClientId("cover-text");
    const offset = customTextObjects.length;

    setCustomTextObjects((current) => [
      ...current,
      {
        ...defaultCustomText,
        id,
        text: "New text",
        font: titleText.font,
        color: titleText.color,
        role: "custom",
        x: clamp(0.5 + ((offset % 3) - 1) * 0.1, 0.16, 0.84),
        y: clamp(0.68 + Math.floor(offset / 3) * 0.08, 0.18, 0.9),
      },
    ]);
    setSelectedTextId(id);
  }

  function updateCustomTextObject(
    id: string,
    updater: (textObject: CoverEditableTextSettings) => CoverEditableTextSettings,
  ) {
    setCustomTextObjects((current) =>
      current.map((textObject) =>
        textObject.id === id ? updater(textObject) : textObject,
      ),
    );
  }

  function deleteCustomTextObject(id: string) {
    setCustomTextObjects((current) =>
      current.filter((textObject) => textObject.id !== id),
    );
    setSelectedTextId((current) => (current === id ? null : current));
  }

  function renderFontControls(
    value: CoverFont,
    onChange: (font: CoverFont) => void,
  ) {
    return (
      <div className="flex flex-wrap gap-2">
        {fontOptions.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              pillClass,
              value === option.value ? selectedPillClass : idlePillClass,
              option.className,
            )}
            onClick={() => onChange(option.value)}
            disabled={!isHost}
          >
            {option.label}
          </Button>
        ))}
      </div>
    );
  }

  function renderColorControls({
    value,
    customValue,
    isCustom,
    inputRef,
    onCustomValueChange,
    onChange,
    ariaLabel,
  }: {
    value: string;
    customValue: string;
    isCustom: boolean;
    inputRef: RefObject<HTMLInputElement | null>;
    onCustomValueChange: (color: string) => void;
    onChange: (color: string) => void;
    ariaLabel: string;
  }) {
    return (
      <div className="flex flex-wrap gap-2.5">
        {colorOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-label={option.label}
            title={option.label}
            className={cn(
              "grid size-7 place-items-center rounded-full border shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.2),0_3px_12px_rgb(0_0_0_/_0.08)] transition-all duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50",
              value.toLowerCase() === option.value.toLowerCase()
                ? "border-foreground ring-2 ring-foreground/20 ring-offset-2 ring-offset-background"
                : "border-border/60 hover:border-foreground/40",
            )}
            style={{ backgroundColor: option.value }}
            onClick={() => onChange(option.value)}
            disabled={!isHost}
          >
            {value.toLowerCase() === option.value.toLowerCase() ? (
              <Check
                className={cn(
                  "size-3",
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
            "grid size-7 place-items-center rounded-full border bg-[conic-gradient(from_0deg,#ff4d4d,#ffc457,#9ff3d4,#32dcdc,#8fd3ff,#b9a7ff,#ff4d4d)] shadow-[0_3px_12px_rgb(0_0_0_/_0.08)] transition-all duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50",
            isCustom
              ? "border-foreground ring-2 ring-foreground/20 ring-offset-2 ring-offset-background"
              : "border-border/60 hover:border-foreground/40",
          )}
          onClick={() => inputRef.current?.click()}
          disabled={!isHost}
        >
          {isCustom ? <Check className="size-3 text-black" /> : null}
        </button>
        <input
          ref={inputRef}
          type="color"
          value={customValue}
          className="sr-only"
          onChange={(event) => {
            const nextColor = event.currentTarget.value;

            onCustomValueChange(nextColor);
            onChange(nextColor);
          }}
          disabled={!isHost}
          aria-label={ariaLabel}
        />
      </div>
    );
  }

  useEffect(() => {
    hasLoadedSavedPositionRef.current = false;
    const savedPosition = localStorage.getItem(storageKey);
    let nextTitleText: CoverEditableTextSettings | null = null;
    let nextSubtitleText: CoverEditableTextSettings | null = null;
    let nextCustomTextObjects: CoverEditableTextSettings[] = [];

    if (savedPosition) {
      try {
        const parsedPosition: unknown = JSON.parse(savedPosition);

        if (isSavedCoverTextSettings(parsedPosition)) {
          nextTitleText = normalizeTextSettings(
            parsedPosition.titleText,
            defaultTitleText,
            photobook.cover_font,
            initialTextColor,
            photobook.cover_title,
            "cover-title",
            "title",
          );
          nextSubtitleText = normalizeTextSettings(
            parsedPosition.subtitleText,
            defaultSubtitleText,
            photobook.cover_font,
            initialTextColor,
            photobook.cover_subtitle ?? "",
            "cover-subtitle",
            "subtitle",
          );
          nextCustomTextObjects = Array.isArray(parsedPosition.customTextObjects)
            ? parsedPosition.customTextObjects.map((textObject, index) =>
                normalizeTextSettings(
                  textObject,
                  {
                    ...defaultCustomText,
                    x: clamp(0.5 + ((index % 3) - 1) * 0.1, 0.16, 0.84),
                    y: clamp(0.68 + Math.floor(index / 3) * 0.08, 0.18, 0.9),
                  },
                  photobook.cover_font,
                  initialTextColor,
                  "New text",
                  typeof textObject.id === "string"
                    ? textObject.id
                    : `cover-text-${index + 1}`,
                  "custom",
                ),
              )
            : [];
        } else if (isCoverTextCoordinates(parsedPosition)) {
          const savedSettings = parsedPosition as LegacySavedCoverTextSettings;

          nextTitleText = normalizeTextSettings(
            {
              x: savedSettings.x,
              y: savedSettings.y,
              scale: savedSettings.scale,
              width: savedSettings.width,
              font: photobook.cover_font,
              color: initialTextColor,
            },
            defaultTitleText,
            photobook.cover_font,
            initialTextColor,
            photobook.cover_title,
            "cover-title",
            "title",
          );
          nextSubtitleText = normalizeTextSettings(
            {
              x: nextTitleText.x,
              y: clamp(nextTitleText.y + 0.11, 0.08, 0.92),
              scale: 0.55,
              width: Math.min(nextTitleText.width, defaultSubtitleText.width),
              font: nextTitleText.font,
              color: nextTitleText.color,
            },
            defaultSubtitleText,
            photobook.cover_font,
            initialTextColor,
            photobook.cover_subtitle ?? "",
            "cover-subtitle",
            "subtitle",
          );
        }
      } catch {
        localStorage.removeItem(storageKey);
      }
    }

    queueMicrotask(() => {
      if (nextTitleText) {
        setTitleText(nextTitleText);
        setTitleCustomColor(nextTitleText.color);
      }

      if (nextSubtitleText) {
        setSubtitleText(nextSubtitleText);
        setSubtitleCustomColor(nextSubtitleText.color);
      }

      setCustomTextObjects(nextCustomTextObjects);
      hasLoadedSavedPositionRef.current = true;
    });
  }, [
    initialTextColor,
    photobook.cover_font,
    photobook.cover_subtitle,
    photobook.cover_title,
    storageKey,
  ]);

  useEffect(() => {
    if (!isHost || !hasLoadedSavedPositionRef.current) {
      return;
    }

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 3,
        titleText,
        subtitleText,
        customTextObjects,
      }),
    );
  }, [isHost, storageKey, titleText, subtitleText, customTextObjects]);

  return (
    <section className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start xl:gap-14">
      <div className="grid min-h-[72vh] w-full min-w-0 place-items-center rounded-[2rem] border border-black/[0.08] bg-card/20 p-4 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.22)] dark:border-white/[0.07] dark:bg-white/[0.018] dark:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04)] sm:p-5 xl:p-7">
        <div
          data-photobook-page="true"
          data-photobook-page-id="cover"
          data-photobook-page-label="cover page"
          data-photobook-page-order="1"
          ref={coverRef}
          className="relative mx-auto aspect-[4/5] w-full max-w-[42rem] overflow-hidden rounded-[1.35rem] border border-black/[0.10] bg-muted shadow-[0_18px_52px_rgb(0_0_0_/_0.10)] dark:border-white/[0.10] dark:shadow-[0_22px_70px_rgb(0_0_0_/_0.46)]"
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
          <EditableTextBox
            id="cover-title"
            canvasRef={coverRef}
            geometry={titleText}
            selected={selectedTextId === "cover-title"}
            editable={isHost}
            color={resolveTextColor(titleText.color)}
            ariaLabel="Drag cover title"
            className="z-20 rounded-lg p-0"
            chromeRadiusClassName="rounded-lg"
            minScale={minTextScale}
            maxScale={maxTextScale}
            minWidth={minTextBoxWidth}
            maxWidth={maxTextBoxWidth}
            onGeometryChange={(geometry) =>
              setTitleText((current) => ({ ...current, ...geometry }))
            }
            onSelect={setSelectedTextId}
          >
            <h2
              className={cn(
                "w-full max-w-none whitespace-pre-wrap text-left text-4xl leading-none md:text-6xl",
                getFontClass(titleText.font),
              )}
              style={{ overflowWrap: "normal", wordBreak: "normal" }}
            >
              {titleText.text || "ClaY. by tharun"}
            </h2>
          </EditableTextBox>
          {subtitle ? (
            <EditableTextBox
              id="cover-subtitle"
              canvasRef={coverRef}
              geometry={subtitleText}
              selected={selectedTextId === "cover-subtitle"}
              editable={isHost}
              color={resolveTextColor(subtitleText.color)}
              ariaLabel="Drag cover subtitle"
              className="z-30 rounded-lg p-0"
              chromeRadiusClassName="rounded-lg"
              minScale={minTextScale}
              maxScale={maxTextScale}
              minWidth={minTextBoxWidth}
              maxWidth={maxTextBoxWidth}
              onGeometryChange={(geometry) =>
                setSubtitleText((current) => ({ ...current, ...geometry }))
              }
              onSelect={setSelectedTextId}
            >
              <p
                className={cn(
                  "w-full max-w-none whitespace-pre-wrap text-left text-sm font-medium uppercase leading-tight tracking-[0.22em] md:text-base",
                  getFontClass(subtitleText.font),
                )}
                style={{ overflowWrap: "normal", wordBreak: "normal" }}
              >
                {subtitleText.text}
              </p>
            </EditableTextBox>
          ) : null}
          {customTextObjects.map((textObject) => (
            <EditableTextBox
              key={textObject.id}
              id={textObject.id}
              canvasRef={coverRef}
              geometry={textObject}
              selected={selectedTextId === textObject.id}
              editable={isHost}
              color={resolveTextColor(textObject.color)}
              ariaLabel={`Drag ${textObject.text || "cover text"}`}
              className="z-40 rounded-lg p-0"
              chromeRadiusClassName="rounded-lg"
              minScale={minTextScale}
              maxScale={maxTextScale}
              minWidth={minTextBoxWidth}
              maxWidth={maxTextBoxWidth}
              onGeometryChange={(geometry) =>
                updateCustomTextObject(textObject.id, (current) => ({
                  ...current,
                  ...geometry,
                }))
              }
              onSelect={setSelectedTextId}
              onDelete={() => deleteCustomTextObject(textObject.id)}
            >
              <p
                className={cn(
                  "w-full max-w-none whitespace-pre-wrap text-left text-xl leading-tight md:text-2xl",
                  getFontClass(textObject.font),
                )}
                style={{ overflowWrap: "normal", wordBreak: "normal" }}
              >
                {textObject.text}
              </p>
            </EditableTextBox>
          ))}
        </div>
      </div>
      <form
        action={updatePhotobookCoverAction}
        className="grid w-full gap-6 rounded-[2rem] border border-border/45 bg-card/90 p-5 shadow-[0_22px_70px_rgb(0_0_0_/_0.055)] backdrop-blur-xl [scrollbar-width:none] dark:border-white/[0.09] dark:bg-[#050505]/92 dark:shadow-[0_24px_80px_rgb(0_0_0_/_0.34)] sm:p-6 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:w-[420px] xl:max-w-[420px] xl:shrink-0 xl:overflow-y-auto [&::-webkit-scrollbar]:hidden"
      >
        <input type="hidden" name="room_id" value={roomId} />
        <input type="hidden" name="photobook_id" value={photobook.id} />
        <input type="hidden" name="cover_photo_id" value={coverPhotoId} />
        <input type="hidden" name="cover_font" value={titleText.font} />
        <input type="hidden" name="cover_text_color" value={titleText.color} />
        <input type="hidden" name="cover_text_position" value={legacyPosition} />
        <input type="hidden" name="cover_overlay_style" value={overlay} />

        <div className={controlSectionClass}>
          <span className={controlLabelClass}>Content</span>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="cover_title" className={controlSubLabelClass}>
                Cover title
              </Label>
              <Input
                id="cover_title"
                name="cover_title"
                value={title}
                onChange={(event) => {
                  const nextText = event.currentTarget.value;

                  setTitleText((current) => ({
                    ...current,
                    text: nextText,
                  }));
                }}
                disabled={!isHost}
                className={inspectorInputClass}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cover_subtitle" className={controlSubLabelClass}>
                Subtitle/date
              </Label>
              <Input
                id="cover_subtitle"
                name="cover_subtitle"
                value={subtitle}
                onChange={(event) => {
                  const nextText = event.currentTarget.value;

                  setSubtitleText((current) => ({
                    ...current,
                    text: nextText,
                  }));
                }}
                disabled={!isHost}
                className={inspectorInputClass}
              />
            </div>
          </div>
        </div>

        <div className={controlSectionClass}>
          <span className={cn(controlLabelClass, "flex items-center gap-2")}>
            <Type className="size-3.5" />
            Title style
          </span>
          <div className="grid gap-4">
            <div className="grid gap-2.5">
              <span className={controlSubLabelClass}>Title font</span>
              {renderFontControls(titleText.font, (nextFont) =>
                setTitleText((current) => ({ ...current, font: nextFont })),
              )}
            </div>
            <div className="grid gap-2.5">
              <span className={controlSubLabelClass}>Title color</span>
              {renderColorControls({
                value: titleText.color,
                customValue: titleCustomColor,
                isCustom: isCustomTitleColor,
                inputRef: titleColorInputRef,
                onCustomValueChange: setTitleCustomColor,
                onChange: (nextColor) =>
                  setTitleText((current) => ({ ...current, color: nextColor })),
                ariaLabel: "Choose custom title color",
              })}
            </div>
            <p className="text-xs text-muted-foreground/75">Drag title on canvas.</p>
          </div>
        </div>

        <div className={controlSectionClass}>
          <span className={controlLabelClass}>Date style</span>
          <div className="grid gap-4">
            <div className="grid gap-2.5">
              <span className={controlSubLabelClass}>Date font</span>
              {renderFontControls(subtitleText.font, (nextFont) =>
                setSubtitleText((current) => ({ ...current, font: nextFont })),
              )}
            </div>
            <div className="grid gap-2.5">
              <span className={controlSubLabelClass}>Date color</span>
              {renderColorControls({
                value: subtitleText.color,
                customValue: subtitleCustomColor,
                isCustom: isCustomSubtitleColor,
                inputRef: subtitleColorInputRef,
                onCustomValueChange: setSubtitleCustomColor,
                onChange: (nextColor) =>
                  setSubtitleText((current) => ({ ...current, color: nextColor })),
                ariaLabel: "Choose custom date color",
              })}
            </div>
            <p className="text-xs text-muted-foreground/75">Drag date on canvas.</p>
          </div>
        </div>

        <div className={controlSectionClass}>
          <span className={controlLabelClass}>Text boxes</span>
          <div className="grid gap-3">
            <Button
              type="button"
              variant="outline"
              className={cn(pillClass, "h-10 w-fit px-4", idlePillClass)}
              disabled={!isHost}
              onClick={addCoverTextBox}
            >
              + Add text box
            </Button>
            {selectedCustomText ? (
              <div className="grid gap-4 rounded-2xl border border-border/30 bg-background/45 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
                <div className="grid gap-2">
                  <Label
                    htmlFor="cover_custom_text"
                    className={controlSubLabelClass}
                  >
                    Selected text
                  </Label>
                  <Input
                    id="cover_custom_text"
                    value={selectedCustomText.text}
                    onChange={(event) => {
                      const nextText = event.currentTarget.value;

                      updateCustomTextObject(selectedCustomText.id, (current) => ({
                        ...current,
                        text: nextText,
                      }));
                    }}
                    disabled={!isHost}
                    className={inspectorInputClass}
                  />
                </div>
                <div className="grid gap-2.5">
                  <span className={controlSubLabelClass}>Font</span>
                  {renderFontControls(selectedCustomText.font, (nextFont) =>
                    updateCustomTextObject(selectedCustomText.id, (current) => ({
                      ...current,
                      font: nextFont,
                    })),
                  )}
                </div>
                <div className="grid gap-2.5">
                  <span className={controlSubLabelClass}>Color</span>
                  {renderColorControls({
                    value: selectedCustomText.color,
                    customValue: customTextCustomColor,
                    isCustom: selectedCustomTextIsCustomColor,
                    inputRef: customTextColorInputRef,
                    onCustomValueChange: setCustomTextCustomColor,
                    onChange: (nextColor) =>
                      updateCustomTextObject(selectedCustomText.id, (current) => ({
                        ...current,
                        color: nextColor,
                      })),
                    ariaLabel: "Choose custom text color",
                  })}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    pillClass,
                    "w-fit border-red-500/25 text-red-500 hover:border-red-500/45 hover:bg-red-500/10",
                  )}
                  disabled={!isHost}
                  onClick={() => deleteCustomTextObject(selectedCustomText.id)}
                >
                  Delete text box
                </Button>
              </div>
            ) : (
              <p className="text-xs leading-5 text-muted-foreground/75">
                Add a text box, then select it on the cover to edit its words,
                font, and color.
              </p>
            )}
          </div>
        </div>

        <div className={controlSectionClass}>
          <span className={controlLabelClass}>Placement</span>
          <div className="flex flex-col gap-3 rounded-2xl border border-border/30 bg-background/45 px-3.5 py-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
            <p className="text-sm leading-6 text-muted-foreground/90">
              Select text on the cover. Drag to move, pull corners to resize, side handles stretch width.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(pillClass, "w-fit", idlePillClass)}
                disabled={!isHost}
                onClick={resetTitleText}
              >
                Reset title
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(pillClass, "w-fit", idlePillClass)}
                disabled={!isHost}
                onClick={resetSubtitleText}
              >
                Reset date
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(pillClass, "w-fit", idlePillClass)}
                disabled={!isHost}
                onClick={resetAllText}
              >
                Reset all text
              </Button>
            </div>
          </div>
        </div>

        <div className={controlSectionClass}>
          <span className={controlLabelClass}>Image</span>
          <div className="grid gap-4">
            <div className="grid gap-2.5">
              <span className={controlSubLabelClass}>Cover photo</span>
              <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    className={cn(
                      "relative h-24 w-[4.5rem] shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-muted shadow-[0_8px_22px_rgb(0_0_0_/_0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/35 hover:shadow-[0_12px_30px_rgb(0_0_0_/_0.09)] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.09] dark:shadow-[0_8px_24px_rgb(0_0_0_/_0.24)]",
                      coverPhotoId === photo.id
                        ? "border-foreground ring-2 ring-foreground/25 ring-offset-2 ring-offset-background"
                        : "",
                    )}
                    onClick={() => setCoverPhotoId(photo.id)}
                    disabled={!isHost}
                  >
                    {photo.thumbnail_public_url ? (
                      <Image
                        src={photo.thumbnail_public_url}
                        alt={photo.original_file_name}
                        fill
                        sizes="72px"
                        className="object-cover transition-transform duration-300 hover:scale-105"
                        crossOrigin="anonymous"
                        unoptimized
                      />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2.5">
              <span className={controlSubLabelClass}>Mood/filter</span>
              <div className="flex flex-wrap gap-2">
                {overlayOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      pillClass,
                      overlay === option.value ? selectedPillClass : idlePillClass,
                    )}
                    onClick={() => setOverlay(option.value)}
                    disabled={!isHost}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={controlSectionClass}>
          <span className={controlLabelClass}>Action</span>
          <Button
            type="submit"
            disabled={!isHost}
            className="h-12 w-full rounded-full border border-foreground bg-foreground text-background shadow-[0_14px_34px_rgb(0_0_0_/_0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-foreground/90 hover:shadow-[0_18px_42px_rgb(0_0_0_/_0.16)] active:translate-y-0 active:scale-[0.99] disabled:translate-y-0 disabled:scale-100 disabled:shadow-none dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/90"
          >
            Save cover
          </Button>
        </div>
      </form>
    </section>
  );
}
