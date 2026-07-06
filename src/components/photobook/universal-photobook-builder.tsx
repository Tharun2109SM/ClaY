"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  ImagePlus,
  Layers,
  Palette,
  Plus,
  Save,
  Trash2,
  Type,
} from "lucide-react";
import { updatePhotobookCoverAction } from "@/app/actions";
import { DownloadPdfButton } from "@/components/photobook/download-pdf-button";
import {
  EditableTextBox,
  type EditableTextGeometry,
  type PhotobookTextObject,
  type PhotobookTextObjectRole,
} from "@/components/photobook/editable-text-box";
import { PhotoPages } from "@/components/photobook/photo-pages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  CoverFont,
  CoverOverlayStyle,
  CoverTextPosition,
  PhotoAsset,
  PhotobookDraft,
  RoomMember,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type PageLayout =
  | "blank"
  | "single"
  | "split"
  | "grid"
  | "collage"
  | "polaroid"
  | "caption";
type CustomPageKind = "text" | "photo";
type PhotoObjectFit = "cover" | "contain" | "fill";
type ResizeHandle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";
type SelectablePageType = "cover" | "people" | "custom";

type PhotoBlock = {
  id: string;
  photoId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  objectFit: PhotoObjectFit;
  zIndex: number;
};

type CustomPage = {
  id: string;
  type: CustomPageKind;
  backgroundColor: string;
  textColor: string;
  overlay: CoverOverlayStyle;
  layout: PageLayout;
  title: string;
  caption: string;
  font: CoverFont;
  textObjects: PhotobookTextObject[];
  photoBlocks: PhotoBlock[];
};

type PeopleSettings = {
  version?: 3;
  customColor: string;
  backgroundColor: string;
  overlay: CoverOverlayStyle;
  textObjects: PhotobookTextObject[];
  photoBlocks: PhotoBlock[];
};

type SavedCoverSettings = {
  version?: 5;
  title: string;
  subtitle: string;
  titleText: PhotobookTextObject;
  subtitleText: PhotobookTextObject;
  customTextObjects: PhotobookTextObject[];
  selectedPhotoId: string | null;
  filter: CoverOverlayStyle;
};

type Selection =
  | {
      pageId: "cover";
      pageType: "cover";
      objectType: "page";
      objectId?: undefined;
    }
  | {
      pageId: "cover";
      pageType: "cover";
      objectType: "text";
      objectId: string;
    }
  | {
      pageId: "people";
      pageType: "people";
      objectType: "page" | "text" | "photo";
      objectId?: string;
    }
  | {
      pageId: string;
      pageType: "custom";
      objectType: "page" | "text" | "photo";
      objectId?: string;
    };

type ReorderPagePreview = {
  id: string;
  label: string;
  typeLabel: string;
  pageNumber: number;
  locked: boolean;
  backgroundColor: string;
  textColor: string;
  overlay: CoverOverlayStyle;
  coverPhoto?: PhotoAsset;
  textObjects: PhotobookTextObject[];
  photoBlocks: PhotoBlock[];
};

const fontOptions: { value: CoverFont; label: string; className: string }[] = [
  { value: "editorial-serif", label: "Editorial Serif", className: "font-serif" },
  { value: "modern-sans", label: "Modern Sans", className: "font-sans" },
  { value: "minimal-light", label: "Minimal Light", className: "font-sans font-light" },
  {
    value: "cinematic-condensed",
    label: "Cinematic Condensed",
    className: "font-sans uppercase tracking-[0.16em]",
  },
  { value: "soft-script", label: "Soft Script", className: "font-serif italic" },
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

const backgroundColors = [
  "#050505",
  "#ffffff",
  "#f6f1e8",
  "#dbe8ca",
  "#f3d3c8",
  "#d7ecf4",
  "#1b1b1b",
  "#2b211f",
  "#111827",
];

const overlayOptions: { value: CoverOverlayStyle; label: string }[] = [
  { value: "none", label: "None" },
  { value: "soft", label: "Soft" },
  { value: "deep", label: "Deep" },
  { value: "film", label: "Film" },
];

const layoutOptions: { value: PageLayout; label: string }[] = [
  { value: "blank", label: "Blank" },
  { value: "single", label: "Single" },
  { value: "split", label: "Split" },
  { value: "grid", label: "Grid" },
  { value: "collage", label: "Collage" },
  { value: "polaroid", label: "Polaroid" },
  { value: "caption", label: "Caption" },
];

const maxPhotosByLayout: Record<PageLayout, number> = {
  blank: 8,
  single: 1,
  split: 2,
  grid: 4,
  collage: 3,
  polaroid: 4,
  caption: 1,
};

const layoutFrames: Record<PageLayout, Omit<PhotoBlock, "id" | "photoId">[]> = {
  blank: [],
  single: [
    { x: 5, y: 5, width: 90, height: 90, rotation: 0, objectFit: "cover", zIndex: 1 },
  ],
  split: [
    { x: 5, y: 5, width: 43.5, height: 90, rotation: 0, objectFit: "cover", zIndex: 1 },
    {
      x: 51.5,
      y: 5,
      width: 43.5,
      height: 90,
      rotation: 0,
      objectFit: "cover",
      zIndex: 2,
    },
  ],
  grid: [
    { x: 5, y: 5, width: 43.5, height: 43.5, rotation: 0, objectFit: "cover", zIndex: 1 },
    {
      x: 51.5,
      y: 5,
      width: 43.5,
      height: 43.5,
      rotation: 0,
      objectFit: "cover",
      zIndex: 2,
    },
    {
      x: 5,
      y: 51.5,
      width: 43.5,
      height: 43.5,
      rotation: 0,
      objectFit: "cover",
      zIndex: 3,
    },
    {
      x: 51.5,
      y: 51.5,
      width: 43.5,
      height: 43.5,
      rotation: 0,
      objectFit: "cover",
      zIndex: 4,
    },
  ],
  collage: [
    { x: 5, y: 5, width: 90, height: 55, rotation: 0, objectFit: "cover", zIndex: 1 },
    { x: 5, y: 63, width: 43.5, height: 32, rotation: 0, objectFit: "cover", zIndex: 2 },
    {
      x: 51.5,
      y: 63,
      width: 43.5,
      height: 32,
      rotation: 0,
      objectFit: "cover",
      zIndex: 3,
    },
  ],
  polaroid: [
    { x: 7, y: 12, width: 48, height: 58, rotation: -6, objectFit: "cover", zIndex: 1 },
    { x: 45, y: 18, width: 48, height: 58, rotation: 5, objectFit: "cover", zIndex: 2 },
    { x: 14, y: 49, width: 48, height: 58, rotation: 3, objectFit: "cover", zIndex: 3 },
    { x: 43, y: 54, width: 48, height: 58, rotation: -3, objectFit: "cover", zIndex: 4 },
  ],
  caption: [
    { x: 5, y: 5, width: 90, height: 68, rotation: 0, objectFit: "cover", zIndex: 1 },
  ],
};

const defaultTitleText: PhotobookTextObject = {
  id: "cover-title",
  text: "Untitled room",
  role: "title",
  x: 0.5,
  y: 0.45,
  width: 0.65,
  scale: 1,
  font: "editorial-serif",
  color: "#ffffff",
};

const defaultSubtitleText: PhotobookTextObject = {
  id: "cover-subtitle",
  text: "",
  role: "subtitle",
  x: 0.5,
  y: 0.56,
  width: 0.45,
  scale: 0.55,
  font: "minimal-light",
  color: "#ffffff",
};

const defaultPeopleTitle: PhotobookTextObject = {
  id: "people-title",
  text: "The People Who Made It",
  role: "title",
  x: 0.28,
  y: 0.25,
  width: 0.48,
  scale: 1,
  font: "editorial-serif",
  color: "#ffffff",
};

const minTextScale = 0.35;
const maxTextScale = 2.8;
const minTextBoxWidth = 0.12;
const maxTextBoxWidth = 0.98;
const exportPageWidth = 1200;
const exportPageHeight = 1500;

const panelClass =
  "sticky top-24 grid max-h-[calc(100vh-7rem)] gap-5 overflow-y-auto rounded-[2rem] border border-border/45 bg-card/92 p-5 shadow-[0_22px_70px_rgb(0_0_0_/_0.055)] backdrop-blur-xl dark:border-white/[0.09] dark:bg-[#050505]/94 dark:shadow-[0_24px_80px_rgb(0_0_0_/_0.36)]";
const sectionClass =
  "grid gap-3 border-b border-border/35 pb-5 last:border-b-0 last:pb-0 dark:border-white/[0.08]";
const labelClass =
  "flex items-center gap-2 text-[0.66rem] uppercase tracking-[0.22em] text-muted-foreground/75";
const inputClass =
  "h-11 rounded-2xl border-border/50 bg-background/65 px-4 text-sm shadow-none transition-all duration-200 placeholder:text-muted-foreground/45 hover:border-foreground/20 hover:bg-background/80 focus-visible:border-foreground/35 focus-visible:ring-2 focus-visible:ring-foreground/10 focus-visible:ring-offset-0 dark:border-white/[0.09] dark:bg-white/[0.045] dark:hover:border-white/20 dark:hover:bg-white/[0.065]";
const chipBase =
  "rounded-full border px-3 text-xs font-normal shadow-none transition-all duration-200 active:scale-[0.98]";
const chipSelected = "border-foreground/70 bg-foreground text-background hover:bg-foreground/90";
const chipIdle =
  "border-border/55 bg-background/45 text-muted-foreground hover:border-foreground/25 hover:bg-background/75 hover:text-foreground dark:border-white/[0.09] dark:bg-white/[0.035] dark:hover:border-white/22 dark:hover:bg-white/[0.07]";
const emptyClass =
  "rounded-2xl border border-dashed border-border/45 bg-background/35 p-4 text-sm leading-6 text-muted-foreground/75 dark:border-white/[0.08] dark:bg-white/[0.025]";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createClientId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function getPhotoUrl(photo: PhotoAsset) {
  return getPhotoField(photo, [
    "public_url",
    "publicUrl",
    "signedUrl",
    "url",
    "thumbnail_public_url",
    "thumbnailUrl",
    "thumbnail_url",
    "signedThumbnailUrl",
    "thumbnailSignedUrl",
  ]);
}

function getPhotoThumbnailUrl(photo: PhotoAsset) {
  return getPhotoField(photo, [
    "thumbnail_public_url",
    "thumbnailUrl",
    "thumbnail_url",
    "signedThumbnailUrl",
    "thumbnailSignedUrl",
    "public_url",
    "publicUrl",
    "signedUrl",
    "url",
  ]);
}

function getPhotoField(photo: PhotoAsset, keys: string[]) {
  const record = photo as unknown as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return null;
}

function getFontClass(font: CoverFont) {
  return fontOptions.find((option) => option.value === font)?.className ?? "font-serif";
}

function getOverlayClass(overlay: CoverOverlayStyle, cover = false) {
  if (cover) {
    const classes: Record<CoverOverlayStyle, string> = {
      none: "",
      soft: "bg-black/20",
      deep: "bg-black/45",
      film: "bg-[linear-gradient(180deg,rgba(0,0,0,.10),rgba(0,0,0,.55))]",
    };

    return classes[overlay];
  }

  const classes: Record<CoverOverlayStyle, string> = {
    none: "",
    soft: "bg-white/[0.035]",
    deep: "bg-black/[0.12]",
    film: "bg-[linear-gradient(180deg,transparent,rgba(127,127,127,.14))]",
  };

  return classes[overlay];
}

function isCoverFont(value: unknown): value is CoverFont {
  return fontOptions.some((option) => option.value === value);
}

function isOverlay(value: unknown): value is CoverOverlayStyle {
  return overlayOptions.some((option) => option.value === value);
}

function isLayout(value: unknown): value is PageLayout {
  return layoutOptions.some((option) => option.value === value);
}

function isTextRole(value: unknown): value is PhotobookTextObjectRole {
  return value === "title" || value === "subtitle" || value === "name" || value === "custom";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isDarkColor(color: string) {
  const hex = color.replace("#", "");

  if (hex.length !== 6) return true;

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);

  return (red * 299 + green * 587 + blue * 114) / 1000 < 150;
}

function normalizeTextObject(
  value: Partial<PhotobookTextObject> | null | undefined,
  fallback: PhotobookTextObject,
): PhotobookTextObject {
  return {
    id: typeof value?.id === "string" && value.id ? value.id : fallback.id,
    text: typeof value?.text === "string" ? value.text : fallback.text,
    role: isTextRole(value?.role) ? value.role : fallback.role,
    x: isFiniteNumber(value?.x) ? clamp(value.x, 0.05, 0.95) : fallback.x,
    y: isFiniteNumber(value?.y) ? clamp(value.y, 0.05, 0.95) : fallback.y,
    width: isFiniteNumber(value?.width)
      ? clamp(value.width, minTextBoxWidth, maxTextBoxWidth)
      : fallback.width,
    scale: isFiniteNumber(value?.scale)
      ? clamp(value.scale, minTextScale, maxTextScale)
      : fallback.scale,
    font: isCoverFont(value?.font) ? value.font : fallback.font,
    color: typeof value?.color === "string" ? value.color : fallback.color,
  };
}

function normalizePhotoBlock(
  value: Partial<PhotoBlock> | null | undefined,
  fallback: PhotoBlock,
): PhotoBlock {
  return {
    ...fallback,
    ...value,
    id: typeof value?.id === "string" && value.id ? value.id : fallback.id,
    photoId:
      typeof value?.photoId === "string" && value.photoId ? value.photoId : fallback.photoId,
    x: isFiniteNumber(value?.x) ? clamp(value.x, 0, 100) : fallback.x,
    y: isFiniteNumber(value?.y) ? clamp(value.y, 0, 100) : fallback.y,
    width: isFiniteNumber(value?.width) ? clamp(value.width, 8, 100) : fallback.width,
    height: isFiniteNumber(value?.height) ? clamp(value.height, 8, 100) : fallback.height,
    rotation: isFiniteNumber(value?.rotation) ? value.rotation : fallback.rotation,
    objectFit:
      value?.objectFit === "contain" || value?.objectFit === "cover" || value?.objectFit === "fill"
        ? value.objectFit
        : fallback.objectFit,
    zIndex: isFiniteNumber(value?.zIndex) ? value.zIndex : fallback.zIndex,
  };
}

function createTextObject(
  id: string,
  text = "New text",
  index = 0,
  font: CoverFont = "editorial-serif",
  color = "#ffffff",
  role: PhotobookTextObjectRole = "custom",
): PhotobookTextObject {
  return {
    id,
    text,
    role,
    x: clamp(0.5 + ((index % 3) - 1) * 0.12, 0.14, 0.86),
    y: clamp(0.5 + Math.floor(index / 3) * 0.08, 0.18, 0.9),
    width: role === "name" ? 0.28 : 0.48,
    scale: role === "name" ? 0.9 : 1,
    font,
    color,
  };
}

function createBlock(
  photoId: string,
  index: number,
  layout: PageLayout,
  id = `photo-block-${index + 1}-${photoId}`,
): PhotoBlock {
  const frame = layoutFrames[layout][index] ?? {
    x: 18 + ((index * 7) % 24),
    y: 18 + ((index * 9) % 28),
    width: 56,
    height: 42,
    rotation: 0,
    objectFit: "cover" as PhotoObjectFit,
    zIndex: index + 1,
  };

  return { id, photoId, ...frame };
}

function createCustomPage(
  index: number,
  photos: PhotoAsset[] = [],
  id = `custom-page-${index + 1}`,
): CustomPage {
  const firstPhotoId = photos[0]?.id;
  const layout: PageLayout = firstPhotoId ? "single" : "blank";

  return {
    id,
    type: "photo",
    backgroundColor: "#050505",
    textColor: "#ffffff",
    overlay: "none",
    layout,
    title: "",
    caption: "",
    font: "editorial-serif",
    textObjects: [],
    photoBlocks: firstPhotoId
      ? [createBlock(firstPhotoId, 0, layout, `${id}-photo-block-1-${firstPhotoId}`)]
      : [],
  };
}

function createTextPage(index: number, id = `custom-text-page-${index + 1}`): CustomPage {
  return {
    id,
    type: "text",
    backgroundColor: "#050505",
    textColor: "#ffffff",
    overlay: "none",
    layout: "blank",
    title: "",
    caption: "",
    font: "editorial-serif",
    textObjects: [
      {
        id: `${id}-text-1`,
        text: "Double click to edit",
        role: "custom",
        x: 0.5,
        y: 0.5,
        width: 0.65,
        scale: 1,
        font: "editorial-serif",
        color: "#ffffff",
      },
    ],
    photoBlocks: [],
  };
}

function normalizeCustomPage(page: Partial<CustomPage>, fallback: CustomPage): CustomPage {
  const pageType: CustomPageKind = page.type === "text" ? "text" : "photo";
  const textObjects = Array.isArray(page.textObjects)
    ? page.textObjects.map((textObject, index) =>
        normalizeTextObject(
          textObject,
          createTextObject(`text-object-${index + 1}`, "New text", index),
        ),
      )
    : [];
  const legacyTextObjects: PhotobookTextObject[] = [];

  if (!textObjects.length && typeof page.title === "string" && page.title.trim()) {
    legacyTextObjects.push({
      id: `${fallback.id}-title`,
      text: page.title,
      role: "title",
      x: 0.5,
      y: 0.72,
      width: 0.72,
      scale: 1,
      font: isCoverFont(page.font) ? page.font : "editorial-serif",
      color: typeof page.textColor === "string" ? page.textColor : "#ffffff",
    });
  }

  if (!textObjects.length && typeof page.caption === "string" && page.caption.trim()) {
    legacyTextObjects.push({
      id: `${fallback.id}-caption`,
      text: page.caption,
      role: "subtitle",
      x: 0.5,
      y: 0.84,
      width: 0.68,
      scale: 0.65,
      font: isCoverFont(page.font) ? page.font : "editorial-serif",
      color: typeof page.textColor === "string" ? page.textColor : "#ffffff",
    });
  }

  return {
    ...fallback,
    ...page,
    type: pageType,
    backgroundColor:
      typeof page.backgroundColor === "string" ? page.backgroundColor : fallback.backgroundColor,
    textColor: typeof page.textColor === "string" ? page.textColor : fallback.textColor,
    overlay: isOverlay(page.overlay) ? page.overlay : fallback.overlay,
    layout: isLayout(page.layout) ? page.layout : fallback.layout,
    title: typeof page.title === "string" ? page.title : "",
    caption: typeof page.caption === "string" ? page.caption : "",
    font: isCoverFont(page.font) ? page.font : fallback.font,
    textObjects: textObjects.length ? textObjects : legacyTextObjects,
    photoBlocks: Array.isArray(page.photoBlocks)
      ? page.photoBlocks
          .filter((block) => typeof block.photoId === "string" && block.photoId)
          .map((block, index) =>
            normalizePhotoBlock(block, createBlock(block.photoId ?? "", index, fallback.layout)),
          )
      : fallback.photoBlocks,
  };
}

function arrangeBlocks(blocks: PhotoBlock[], layout: PageLayout) {
  const frames = layoutFrames[layout];

  return blocks.slice(0, maxPhotosByLayout[layout]).map((block, index) => ({
    ...block,
    ...(frames[index] ?? {
      x: clamp(16 + index * 6, 2, 84),
      y: clamp(16 + index * 7, 2, 84),
      width: 50,
      height: 38,
      rotation: 0,
      objectFit: block.objectFit,
      zIndex: index + 1,
    }),
  }));
}

function orderCustomPagesByIds(pages: CustomPage[], pageIds: string[]) {
  const pageMap = new Map(pages.map((page) => [page.id, page]));
  const orderedPages = pageIds
    .map((pageId) => pageMap.get(pageId))
    .filter((page): page is CustomPage => Boolean(page));
  const missingPages = pages.filter((page) => !pageIds.includes(page.id));

  return [...orderedPages, ...missingPages];
}

function defaultCustomPageOrderIds(pages: CustomPage[]) {
  return pages
    .map((page, index) => ({ page, index }))
    .sort((first, second) => {
      if (first.page.type !== second.page.type) {
        return first.page.type === "text" ? -1 : 1;
      }

      return first.index - second.index;
    })
    .map(({ page }) => page.id);
}

function movePageId(pageIds: string[], pageId: string, direction: "up" | "down") {
  const fromIndex = pageIds.indexOf(pageId);

  if (fromIndex === -1) return pageIds;

  const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;

  if (toIndex < 0 || toIndex >= pageIds.length) return pageIds;

  const nextIds = [...pageIds];
  const [movedPageId] = nextIds.splice(fromIndex, 1);
  nextIds.splice(toIndex, 0, movedPageId);

  return nextIds;
}

function resizeBlock(
  block: PhotoBlock,
  handle: ResizeHandle,
  deltaXPercent: number,
  deltaYPercent: number,
) {
  const isCorner = ["nw", "ne", "sw", "se"].includes(handle);
  let x = block.x;
  let y = block.y;
  let width = block.width;
  let height = block.height;

  if (handle.includes("e")) width += deltaXPercent;
  if (handle.includes("s")) height += deltaYPercent;
  if (handle.includes("w")) {
    x += deltaXPercent;
    width -= deltaXPercent;
  }
  if (handle.includes("n")) {
    y += deltaYPercent;
    height -= deltaYPercent;
  }

  if (isCorner) {
    const ratio = block.width / block.height;

    if (Math.abs(deltaXPercent) > Math.abs(deltaYPercent)) {
      height = width / ratio;
    } else {
      width = height * ratio;
    }

    if (handle.includes("w")) x = block.x + block.width - width;
    if (handle.includes("n")) y = block.y + block.height - height;
  }

  width = clamp(width, 8, 100);
  height = clamp(height, 8, 100);
  x = clamp(x, 0, 100 - width);
  y = clamp(y, 0, 100 - height);

  return { ...block, x, y, width, height };
}

function legacyPositionFromGeometry(geometry: EditableTextGeometry): CoverTextPosition {
  if (geometry.y < 0.34) {
    return geometry.x < 0.35 ? "top-left" : "top-center";
  }

  if (geometry.y > 0.66) {
    return geometry.x < 0.35 ? "bottom-left" : "bottom-center";
  }

  return "center";
}

function getDefaultNameText(index: number, name: string): PhotobookTextObject {
  return {
    id: `people-name-${index + 1}`,
    text: name,
    role: "name",
    x: clamp(0.5 + ((index % 3) - 1) * 0.16, 0.14, 0.86),
    y: clamp(0.55 + Math.floor(index / 3) * 0.08, 0.34, 0.88),
    width: 0.26,
    scale: 1,
    font: "minimal-light",
    color: "#ffffff",
  };
}

function loadJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function serializeCoverSettings({
  titleText,
  subtitleText,
  customTextObjects,
  selectedPhotoId,
  filter,
}: {
  titleText: PhotobookTextObject;
  subtitleText: PhotobookTextObject;
  customTextObjects: PhotobookTextObject[];
  selectedPhotoId: string | null;
  filter: CoverOverlayStyle;
}): SavedCoverSettings {
  return {
    version: 5,
    title: titleText.text,
    subtitle: subtitleText.text,
    titleText,
    subtitleText,
    customTextObjects,
    selectedPhotoId,
    filter,
  };
}

function logCoverDebug(label: string, value: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.log(label, value);
  }
}

function logPhotoPickerDebug(label: string, value: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.log(label, value);
  }
}

function EditablePhotoBlock({
  block,
  photo,
  selected,
  onSelect,
  onChange,
}: {
  block: PhotoBlock;
  photo: PhotoAsset | undefined;
  selected: boolean;
  onSelect: () => void;
  onChange: (block: PhotoBlock) => void;
}) {
  const photoUrl = photo ? getPhotoUrl(photo) : null;

  function startInteraction(
    event: ReactPointerEvent<HTMLDivElement | HTMLButtonElement>,
    mode: "drag" | ResizeHandle,
  ) {
    event.preventDefault();
    event.stopPropagation();
    onSelect();

    const pageElement = event.currentTarget.closest<HTMLElement>(
      "[data-photobook-editor-canvas='true']",
    );
    const rect = pageElement?.getBoundingClientRect();

    if (!rect) return;

    const pageRect = rect;
    const startX = event.clientX;
    const startY = event.clientY;
    const startBlock = { ...block };
    const target = event.currentTarget;

    target.setPointerCapture(event.pointerId);

    function handlePointerMove(moveEvent: PointerEvent) {
      const deltaX = ((moveEvent.clientX - startX) / pageRect.width) * 100;
      const deltaY = ((moveEvent.clientY - startY) / pageRect.height) * 100;

      if (mode === "drag") {
        onChange({
          ...startBlock,
          x: clamp(startBlock.x + deltaX, 0, 100 - startBlock.width),
          y: clamp(startBlock.y + deltaY, 0, 100 - startBlock.height),
        });
        return;
      }

      onChange(resizeBlock(startBlock, mode, deltaX, deltaY));
    }

    function handlePointerUp(upEvent: PointerEvent) {
      if (target.hasPointerCapture(upEvent.pointerId)) {
        target.releasePointerCapture(upEvent.pointerId);
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  return (
    <div
      data-photobook-editable="true"
      className="group/photo absolute touch-none select-none overflow-visible cursor-grab active:cursor-grabbing"
      style={{
        left: `${block.x}%`,
        top: `${block.y}%`,
        width: `${block.width}%`,
        height: `${block.height}%`,
        transform: `rotate(${block.rotation}deg)`,
        zIndex: block.zIndex,
      }}
      onPointerDown={(event) => startInteraction(event, "drag")}
    >
      <div className="relative size-full overflow-hidden rounded-2xl border border-black/[0.08] bg-white/[0.04] dark:border-white/[0.10]">
        {photo && photoUrl ? (
          <Image
            src={photoUrl}
            alt={photo.original_file_name}
            fill
            sizes="(min-width: 1024px) 520px, 90vw"
            className="pointer-events-none"
            style={{ objectFit: block.objectFit }}
            crossOrigin="anonymous"
            draggable={false}
            unoptimized
          />
        ) : (
          <div className="grid size-full place-items-center text-white/45">
            <ImagePlus className="size-6" />
          </div>
        )}
      </div>

      {selected ? (
        <div className="photobook-editor-chrome pointer-events-none absolute inset-0">
          <div className="absolute inset-0 rounded-2xl border border-black/[0.24] shadow-[0_0_0_1px_rgb(255_255_255_/_0.04)] dark:border-white/[0.35] dark:shadow-[0_0_0_1px_rgb(0_0_0_/_0.18)]" />
          {(["nw", "ne", "sw", "se", "n", "s", "e", "w"] as ResizeHandle[]).map(
            (handle) => (
              <button
                key={handle}
                type="button"
                aria-label={`Resize ${handle}`}
                className={cn(
                  "pointer-events-auto absolute grid size-5 place-items-center transition duration-200 hover:scale-110 active:scale-95",
                  handle === "nw" && "-left-2.5 -top-2.5 cursor-nwse-resize",
                  handle === "ne" && "-right-2.5 -top-2.5 cursor-nesw-resize",
                  handle === "sw" && "-bottom-2.5 -left-2.5 cursor-nesw-resize",
                  handle === "se" && "-bottom-2.5 -right-2.5 cursor-nwse-resize",
                  handle === "n" &&
                    "left-1/2 -top-2.5 -translate-x-1/2 cursor-ns-resize",
                  handle === "s" &&
                    "-bottom-2.5 left-1/2 -translate-x-1/2 cursor-ns-resize",
                  handle === "e" &&
                    "-right-2.5 top-1/2 -translate-y-1/2 cursor-ew-resize",
                  handle === "w" &&
                    "-left-2.5 top-1/2 -translate-y-1/2 cursor-ew-resize",
                )}
                onPointerDown={(event) => startInteraction(event, handle)}
              >
                <span className="size-[7px] rounded-full border border-white/80 bg-black/85 shadow-[0_1px_5px_rgb(0_0_0_/_0.22)] dark:border-black/55 dark:bg-white/90" />
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

function PhotobookCanvas({
  pageId,
  pageType,
  label,
  order,
  backgroundColor,
  textColor,
  overlay,
  textObjects,
  photoBlocks,
  photosById,
  selected,
  onSelectPage,
  onSelectText,
  onUpdateText,
  onDeleteText,
  onSelectPhoto,
  onUpdatePhoto,
}: {
  pageId: string;
  pageType: SelectablePageType;
  label: string;
  order: number;
  backgroundColor: string;
  textColor: string;
  overlay: CoverOverlayStyle;
  textObjects: PhotobookTextObject[];
  photoBlocks: PhotoBlock[];
  photosById: Map<string, PhotoAsset>;
  selected: Selection;
  onSelectPage: () => void;
  onSelectText: (id: string | null) => void;
  onUpdateText: (textObject: PhotobookTextObject) => void;
  onDeleteText: (id: string) => void;
  onSelectPhoto: (id: string | null) => void;
  onUpdatePhoto: (photoBlock: PhotoBlock) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const darkBackground = isDarkColor(backgroundColor);

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target : null;

    if (!target?.closest("[data-photobook-editable='true']")) {
      onSelectText(null);
      onSelectPhoto(null);
      onSelectPage();
    }
  }

  return (
    <div
      ref={canvasRef}
      data-photobook-page="true"
      data-photobook-page-id={pageId}
      data-photobook-page-label={label}
      data-photobook-page-order={String(order)}
      data-photobook-page-kind={pageType === "custom" ? "custom" : pageType}
      data-photobook-editor-canvas="true"
      data-photobook-photo-blocks={JSON.stringify(
        photoBlocks.map(({ id, x, y, width, height, objectFit, zIndex }) => ({
          id,
          x,
          y,
          width,
          height,
          objectFit,
          zIndex,
        })),
      )}
      className={cn(
        "relative mx-auto aspect-[4/5] w-full max-w-[44rem] touch-none overflow-hidden rounded-[1.35rem] border shadow-[0_18px_52px_rgb(0_0_0_/_0.10)] transition dark:shadow-[0_22px_70px_rgb(0_0_0_/_0.42)] 2xl:max-w-[48rem]",
        selected.pageId === pageId && selected.objectType === "page"
          ? "ring-1 ring-foreground/35"
          : "",
        darkBackground ? "border-white/[0.10]" : "border-black/[0.10]",
      )}
      style={{ backgroundColor, color: textColor }}
      onPointerDown={handleCanvasPointerDown}
    >
      {overlay !== "none" ? (
        <div aria-hidden="true" className={cn("absolute inset-0", getOverlayClass(overlay))} />
      ) : null}

      {photoBlocks.map((block) => (
        <EditablePhotoBlock
          key={block.id}
          block={block}
          photo={photosById.get(block.photoId)}
          selected={selected.pageId === pageId && selected.objectType === "photo" && selected.objectId === block.id}
          onSelect={() => onSelectPhoto(block.id)}
          onChange={onUpdatePhoto}
        />
      ))}

      {textObjects.map((textObject) => (
        <EditableTextBox
          key={textObject.id}
          id={textObject.id}
          canvasRef={canvasRef}
          geometry={textObject}
          selected={
            selected.pageId === pageId &&
            selected.objectType === "text" &&
            selected.objectId === textObject.id
          }
          color={textObject.color}
          ariaLabel={`Drag ${textObject.text || "text"}`}
          className="z-[1000] rounded-lg p-0"
          chromeRadiusClassName="rounded-lg"
          minScale={minTextScale}
          maxScale={maxTextScale}
          minWidth={minTextBoxWidth}
          maxWidth={maxTextBoxWidth}
          onGeometryChange={(geometry) => onUpdateText({ ...textObject, ...geometry })}
          onSelect={onSelectText}
          onDelete={
            textObject.role === "title" ? undefined : () => onDeleteText(textObject.id)
          }
        >
          <span
            className={cn(
              "block w-full max-w-none whitespace-pre-wrap text-left leading-tight",
              textObject.role === "title"
                ? "text-4xl md:text-5xl"
                : textObject.role === "subtitle"
                  ? "text-lg md:text-2xl"
                  : "text-xl md:text-3xl",
              getFontClass(textObject.font),
            )}
            style={{ overflowWrap: "normal", wordBreak: "normal" }}
          >
            {textObject.text}
          </span>
        </EditableTextBox>
      ))}
    </div>
  );
}

function CoverCanvas({
  coverPhoto,
  overlay,
  textObjects,
  selected,
  onSelectPage,
  onSelectText,
  onUpdateText,
  onDeleteText,
}: {
  coverPhoto: PhotoAsset | undefined;
  overlay: CoverOverlayStyle;
  textObjects: PhotobookTextObject[];
  selected: Selection;
  onSelectPage: () => void;
  onSelectText: (id: string | null) => void;
  onUpdateText: (textObject: PhotobookTextObject) => void;
  onDeleteText: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const coverUrl = coverPhoto ? getPhotoUrl(coverPhoto) : null;

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target : null;

    if (!target?.closest("[data-photobook-editable='true']")) {
      onSelectText(null);
      onSelectPage();
    }
  }

  return (
    <div
      ref={canvasRef}
      data-photobook-page="true"
      data-photobook-page-id="cover"
      data-photobook-page-label="cover page"
      data-photobook-page-order="1"
      data-photobook-page-kind="cover"
      data-photobook-editor-canvas="true"
      className={cn(
        "relative mx-auto aspect-[4/5] w-full max-w-[44rem] touch-none overflow-hidden rounded-[1.35rem] border border-white/[0.10] bg-[#050505] shadow-[0_22px_70px_rgb(0_0_0_/_0.34)] transition 2xl:max-w-[48rem]",
        selected.pageId === "cover" && selected.objectType === "page"
          ? "ring-1 ring-foreground/35"
          : "",
      )}
      onPointerDown={handleCanvasPointerDown}
    >
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt={coverPhoto?.original_file_name ?? "Cover photo"}
          fill
          sizes="(min-width: 1280px) 640px, 92vw"
          className="object-cover"
          crossOrigin="anonymous"
          priority
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(145deg,#050505,#1b1b1b_45%,#32251d)]" />
      )}
      {overlay !== "none" ? (
        <div
          aria-hidden="true"
          className={cn("absolute inset-0", getOverlayClass(overlay, true))}
        />
      ) : null}

      {textObjects.map((textObject) => (
        <EditableTextBox
          key={textObject.id}
          id={textObject.id}
          canvasRef={canvasRef}
          geometry={textObject}
          selected={
            selected.pageId === "cover" &&
            selected.objectType === "text" &&
            selected.objectId === textObject.id
          }
          color={textObject.color}
          ariaLabel={`Drag ${textObject.text || "cover text"}`}
          className="z-[1000] rounded-lg p-0 text-white drop-shadow-[0_2px_18px_rgb(0_0_0_/_0.35)]"
          chromeRadiusClassName="rounded-lg"
          minScale={minTextScale}
          maxScale={maxTextScale}
          minWidth={minTextBoxWidth}
          maxWidth={maxTextBoxWidth}
          onGeometryChange={(geometry) => onUpdateText({ ...textObject, ...geometry })}
          onSelect={onSelectText}
          onDelete={
            textObject.role === "custom" ? () => onDeleteText(textObject.id) : undefined
          }
        >
          <span
            className={cn(
              "block w-full max-w-none whitespace-pre-wrap text-left leading-tight",
              textObject.role === "title"
                ? "text-5xl md:text-6xl"
                : textObject.role === "subtitle"
                  ? "text-xl md:text-2xl"
                  : "text-2xl md:text-4xl",
              getFontClass(textObject.font),
            )}
            style={{ overflowWrap: "normal", wordBreak: "normal" }}
          >
            {textObject.text}
          </span>
        </EditableTextBox>
      ))}
    </div>
  );
}

function SwatchGrid({
  selectedColor,
  onSelect,
}: {
  selectedColor: string;
  onSelect: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {colorOptions.map((color) => (
        <button
          key={color.value}
          type="button"
          aria-label={color.label}
          className={cn(
            "grid size-8 place-items-center rounded-full border transition hover:scale-105",
            selectedColor === color.value
              ? "border-foreground/55 bg-background shadow-[0_0_0_2px_rgb(127_127_127_/_0.14)]"
              : "border-transparent",
          )}
          onClick={() => onSelect(color.value)}
        >
          <span
            className="size-5 rounded-full border border-black/10 shadow-sm"
            style={{ backgroundColor: color.value }}
          />
        </button>
      ))}
    </div>
  );
}

function FontChips({
  selectedFont,
  onSelect,
}: {
  selectedFont: CoverFont;
  onSelect: (font: CoverFont) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {fontOptions.map((font) => (
        <Button
          key={font.value}
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            chipBase,
            font.className,
            selectedFont === font.value ? chipSelected : chipIdle,
          )}
          onClick={() => onSelect(font.value)}
        >
          {font.label}
        </Button>
      ))}
    </div>
  );
}

function OverlayChips({
  selectedOverlay,
  onSelect,
}: {
  selectedOverlay: CoverOverlayStyle;
  onSelect: (overlay: CoverOverlayStyle) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {overlayOptions.map((overlay) => (
        <Button
          key={overlay.value}
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            chipBase,
            selectedOverlay === overlay.value ? chipSelected : chipIdle,
          )}
          onClick={() => onSelect(overlay.value)}
        >
          {overlay.label}
        </Button>
      ))}
    </div>
  );
}

function BackgroundSwatches({
  selectedColor,
  onSelect,
}: {
  selectedColor: string;
  onSelect: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {backgroundColors.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Use ${color} background`}
          className={cn(
            "grid size-8 place-items-center rounded-full border transition hover:scale-105",
            selectedColor === color
              ? "border-foreground/55 bg-background shadow-[0_0_0_2px_rgb(127_127_127_/_0.14)]"
              : "border-transparent",
          )}
          onClick={() => onSelect(color)}
        >
          <span
            className="size-5 rounded-full border border-black/10 shadow-sm"
            style={{ backgroundColor: color }}
          />
        </button>
      ))}
    </div>
  );
}

function PhotoPicker({
  photos,
  selectedPhotoId,
  onSelect,
}: {
  photos: PhotoAsset[];
  selectedPhotoId?: string | null;
  onSelect: (photoId: string) => void;
}) {
  logPhotoPickerDebug("[cover-photo-picker-photos]", photos);
  logPhotoPickerDebug("[cover-photo-picker-first-photo]", photos[0]);

  if (photos.length === 0) {
    return <div className={emptyClass}>Upload photos to use one as the cover.</div>;
  }

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {photos.map((photo) => {
        const photoUrl = getPhotoThumbnailUrl(photo);

        return (
          <button
            key={photo.id}
            type="button"
            className={cn(
              "relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border bg-muted transition hover:-translate-y-0.5",
              selectedPhotoId === photo.id
                ? "border-foreground/70 ring-2 ring-foreground/15"
                : "border-border/45 dark:border-white/[0.09]",
            )}
            onClick={() => onSelect(photo.id)}
          >
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt={photo.original_file_name || "Room photo"}
                width={80}
                height={80}
                className="size-full object-cover"
                crossOrigin="anonymous"
                unoptimized
              />
            ) : (
              <span className="grid size-full place-items-center bg-background/45 text-muted-foreground">
                <ImagePlus className="size-4" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function getPreviewTextSize(textObject: PhotobookTextObject, cover = false) {
  if (cover) {
    if (textObject.role === "title") return 9.6;
    if (textObject.role === "subtitle") return 4.1;
    return 5.9;
  }

  if (textObject.role === "title") return 7.6;
  if (textObject.role === "subtitle") return 3.9;
  if (textObject.role === "name") return 3.9;
  return 5;
}

function PagePreviewText({
  textObject,
  cover = false,
}: {
  textObject: PhotobookTextObject;
  cover?: boolean;
}) {
  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: `${textObject.x * 100}%`,
        top: `${textObject.y * 100}%`,
        width: `${textObject.width * 100}%`,
        transform: `translate(-50%, -50%) scale(${textObject.scale})`,
        transformOrigin: "center",
        color: textObject.color,
        zIndex: textObject.role === "title" ? 20 : 21,
        maxHeight: "100%",
        contain: "paint",
        isolation: "isolate",
      }}
    >
      <span
        className={cn(
          "block w-full max-w-none whitespace-pre-wrap text-left leading-tight",
          cover ? "drop-shadow-[0_1px_8px_rgb(0_0_0_/_0.42)]" : "",
          getFontClass(textObject.font),
        )}
        style={{
          fontSize: `calc(${getPreviewTextSize(textObject, cover)}cqw)`,
          overflowWrap: "normal",
          wordBreak: "normal",
        }}
      >
        {textObject.text}
      </span>
    </div>
  );
}

function PagePreviewPhotoBlock({
  block,
  photo,
  variant = "card",
}: {
  block: PhotoBlock;
  photo: PhotoAsset | undefined;
  variant?: "card" | "detail";
}) {
  const photoUrl = photo
    ? (getPhotoThumbnailUrl(photo) ?? getPhotoUrl(photo))
    : null;

  return (
    <div
      className="absolute overflow-hidden rounded-[0.45rem] bg-neutral-100 dark:bg-[#111111]"
      style={{
        left: `${block.x}%`,
        top: `${block.y}%`,
        width: `${block.width}%`,
        height: `${block.height}%`,
        transform: `rotate(${block.rotation}deg)`,
        zIndex: block.zIndex,
        contain: "paint",
        isolation: "isolate",
      }}
    >
      {photo && photoUrl ? (
        <Image
          src={photoUrl}
          alt={photo.original_file_name}
          fill
          sizes={variant === "detail" ? "360px" : "180px"}
          className="pointer-events-none"
          style={{ objectFit: block.objectFit }}
          crossOrigin="anonymous"
          draggable={false}
          unoptimized
        />
      ) : (
        <div className="grid size-full place-items-center text-black/25 dark:text-white/25">
          <ImagePlus className={variant === "detail" ? "size-5" : "size-3"} />
        </div>
      )}
    </div>
  );
}

function PageThumbnailPreview({
  page,
  photosById,
  variant = "card",
}: {
  page: ReorderPagePreview;
  photosById: Map<string, PhotoAsset>;
  variant?: "card" | "detail";
}) {
  const coverUrl = page.coverPhoto
    ? (getPhotoThumbnailUrl(page.coverPhoto) ?? getPhotoUrl(page.coverPhoto))
    : null;
  const isCover = page.typeLabel === "Cover";

  return (
    <div
      className={cn(
        "relative aspect-[3/4] w-full overflow-hidden rounded-[1rem] border shadow-[0_14px_40px_rgb(0_0_0_/_0.18)]",
        isDarkColor(page.backgroundColor) ? "border-white/[0.12]" : "border-black/[0.12]",
        variant === "detail" ? "rounded-[1.35rem]" : "",
      )}
      style={{
        backgroundColor: page.backgroundColor,
        color: page.textColor,
        clipPath: variant === "detail" ? "inset(0 round 1.35rem)" : "inset(0 round 1rem)",
        contain: "paint",
        containerType: "size",
        isolation: "isolate",
        overflow: "hidden",
      }}
    >
      {isCover && coverUrl ? (
        <Image
          src={coverUrl}
          alt={page.coverPhoto?.original_file_name ?? "Cover photo"}
          fill
          sizes={variant === "detail" ? "420px" : "180px"}
          className="object-cover"
          crossOrigin="anonymous"
          unoptimized
        />
      ) : null}
      {page.overlay !== "none" ? (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0",
            getOverlayClass(page.overlay, isCover),
          )}
        />
      ) : null}
      {page.photoBlocks.map((block) => (
        <PagePreviewPhotoBlock
          key={block.id}
          block={block}
          photo={photosById.get(block.photoId)}
          variant={variant}
        />
      ))}
      {page.textObjects.map((textObject) => (
        <PagePreviewText
          key={textObject.id}
          textObject={textObject}
          cover={isCover}
        />
      ))}
    </div>
  );
}

function ReorderPageCard({
  page,
  selected,
  dragging,
  movableCount,
  movableIndex,
  photosById,
  onSelect,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onMoveUp,
  onMoveDown,
}: {
  page: ReorderPagePreview;
  selected: boolean;
  dragging: boolean;
  movableCount: number;
  movableIndex: number;
  photosById: Map<string, PhotoAsset>;
  onSelect: () => void;
  onDragStart?: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  onDragOver?: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDrop?: (event: ReactDragEvent<HTMLDivElement>) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <div
      draggable={!page.locked}
      onClick={onSelect}
      onDragStart={page.locked ? undefined : onDragStart}
      onDragEnd={page.locked ? undefined : onDragEnd}
      onDragOver={page.locked ? undefined : onDragOver}
      onDrop={page.locked ? undefined : onDrop}
      className={cn(
        "group isolate grid cursor-pointer gap-3 overflow-hidden rounded-[1.45rem] border bg-white p-3 text-left shadow-[0_18px_44px_rgb(0_0_0_/_0.10)] transition duration-200 [contain:paint] hover:-translate-y-0.5 hover:border-black/25 hover:bg-neutral-50 dark:bg-[#050505] dark:shadow-[0_18px_44px_rgb(0_0_0_/_0.28)] dark:hover:border-white/25 dark:hover:bg-[#080808]",
        selected
          ? "border-black/45 ring-2 ring-black/10 dark:border-white/45 dark:ring-white/10"
          : "border-black/[0.10] dark:border-white/[0.10]",
        dragging ? "scale-[0.98] opacity-50" : "",
        !page.locked ? "cursor-grab active:cursor-grabbing" : "",
      )}
    >
      <PageThumbnailPreview page={page} photosById={photosById} />
      <div className="flex items-start gap-2">
        {!page.locked ? (
          <GripVertical className="mt-0.5 size-4 shrink-0 text-black/45 dark:text-white/45" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-black dark:text-white">{page.typeLabel}</p>
          <p className="text-xs text-black/50 dark:text-white/50">Page {page.pageNumber}</p>
        </div>
        {page.locked ? (
          <span className="rounded-full border border-black/10 bg-neutral-50 px-2 py-1 text-[0.58rem] uppercase tracking-[0.16em] text-black/55 dark:border-white/10 dark:bg-[#080808] dark:text-white/55">
            Locked
          </span>
        ) : (
          <div className="flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 rounded-full border-black/10 bg-neutral-50 text-black hover:bg-neutral-100 dark:border-white/10 dark:bg-[#080808] dark:text-white dark:hover:bg-[#111111]"
              onClick={(event) => {
                event.stopPropagation();
                onMoveUp?.();
              }}
              disabled={movableIndex === 0}
              aria-label={`Move ${page.typeLabel} page up`}
            >
              <ArrowUp className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 rounded-full border-black/10 bg-neutral-50 text-black hover:bg-neutral-100 dark:border-white/10 dark:bg-[#080808] dark:text-white dark:hover:bg-[#111111]"
              onClick={(event) => {
                event.stopPropagation();
                onMoveDown?.();
              }}
              disabled={movableIndex === movableCount - 1}
              aria-label={`Move ${page.typeLabel} page down`}
            >
              <ArrowDown className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function getExportTextSize(textObject: PhotobookTextObject, cover = false) {
  if (cover) {
    if (textObject.role === "title") return 104;
    if (textObject.role === "subtitle") return 44;
    return 64;
  }

  if (textObject.role === "title") return 82;
  if (textObject.role === "subtitle") return 42;
  if (textObject.role === "name") return 42;
  return 54;
}

function ExportTextObject({
  textObject,
  cover = false,
}: {
  textObject: PhotobookTextObject;
  cover?: boolean;
}) {
  return (
    <div
      className="absolute"
      style={{
        left: `${textObject.x * 100}%`,
        top: `${textObject.y * 100}%`,
        width: `${textObject.width * 100}%`,
        transform: `translate(-50%, -50%) scale(${textObject.scale})`,
        transformOrigin: "center",
        color: textObject.color,
        zIndex: textObject.role === "title" ? 20 : 21,
      }}
    >
      <span
        className={cn(
          "block w-full max-w-none whitespace-pre-wrap text-left leading-tight",
          cover ? "drop-shadow-[0_3px_22px_rgb(0_0_0_/_0.35)]" : "",
          getFontClass(textObject.font),
        )}
        style={{
          fontSize: `${getExportTextSize(textObject, cover)}px`,
          overflowWrap: "normal",
          wordBreak: "normal",
        }}
      >
        {textObject.text}
      </span>
    </div>
  );
}

function ExportPhotoBlock({
  block,
  photo,
}: {
  block: PhotoBlock;
  photo: PhotoAsset | undefined;
}) {
  const photoUrl = photo ? getPhotoUrl(photo) : null;

  return (
    <div
      className="absolute overflow-hidden rounded-[32px] bg-neutral-900"
      style={{
        left: `${block.x}%`,
        top: `${block.y}%`,
        width: `${block.width}%`,
        height: `${block.height}%`,
        transform: `rotate(${block.rotation}deg)`,
        zIndex: block.zIndex,
      }}
    >
      {photo && photoUrl ? (
        <Image
          src={photoUrl}
          alt={photo.original_file_name}
          fill
          sizes={`${exportPageWidth}px`}
          className="pointer-events-none"
          style={{ objectFit: block.objectFit }}
          crossOrigin="anonymous"
          draggable={false}
          loading="eager"
          unoptimized
        />
      ) : null}
    </div>
  );
}

function ExportPageShell({
  pageId,
  label,
  order,
  kind,
  backgroundColor,
  textColor,
  overlay,
  children,
}: {
  pageId: string;
  label: string;
  order: number;
  kind: string;
  backgroundColor: string;
  textColor: string;
  overlay: CoverOverlayStyle;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      data-photobook-page="true"
      data-photobook-export-copy="true"
      data-photobook-page-id={pageId}
      data-photobook-page-label={label}
      data-photobook-page-order={String(order)}
      data-photobook-page-kind={kind}
      className="pointer-events-none fixed left-[-20000px] top-0 overflow-hidden"
      style={{
        width: `${exportPageWidth}px`,
        height: `${exportPageHeight}px`,
        backgroundColor,
        color: textColor,
      }}
    >
      {overlay !== "none" ? (
        <div aria-hidden="true" className={cn("absolute inset-0", getOverlayClass(overlay))} />
      ) : null}
      {children}
    </div>
  );
}

function CoverExportPage({
  coverPhoto,
  overlay,
  textObjects,
}: {
  coverPhoto: PhotoAsset | undefined;
  overlay: CoverOverlayStyle;
  textObjects: PhotobookTextObject[];
}) {
  const coverUrl = coverPhoto ? getPhotoUrl(coverPhoto) : null;

  return (
    <ExportPageShell
      pageId="cover"
      label="cover page"
      order={1}
      kind="cover"
      backgroundColor="#050505"
      textColor="#ffffff"
      overlay="none"
    >
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt={coverPhoto?.original_file_name ?? "Cover photo"}
          fill
          sizes={`${exportPageWidth}px`}
          className="object-cover"
          crossOrigin="anonymous"
          loading="eager"
          priority
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-[#050505]" />
      )}
      {overlay !== "none" ? (
        <div
          aria-hidden="true"
          className={cn("absolute inset-0", getOverlayClass(overlay, true))}
        />
      ) : null}
      {textObjects.map((textObject) => (
        <ExportTextObject key={textObject.id} textObject={textObject} cover />
      ))}
    </ExportPageShell>
  );
}

function PhotobookStateExportPages({
  coverPhoto,
  coverOverlay,
  coverTextObjects,
  peopleBackgroundColor,
  peopleOverlay,
  peopleTextObjects,
  peoplePhotoBlocks,
  customPages,
  photosById,
}: {
  coverPhoto: PhotoAsset | undefined;
  coverOverlay: CoverOverlayStyle;
  coverTextObjects: PhotobookTextObject[];
  peopleBackgroundColor: string;
  peopleOverlay: CoverOverlayStyle;
  peopleTextObjects: PhotobookTextObject[];
  peoplePhotoBlocks: PhotoBlock[];
  customPages: CustomPage[];
  photosById: Map<string, PhotoAsset>;
}) {
  const peopleTextColor = isDarkColor(peopleBackgroundColor) ? "#ffffff" : "#050505";
  let nextOrder = 3;

  return (
    <div aria-hidden="true" className="photobook-export-root">
      <CoverExportPage
        coverPhoto={coverPhoto}
        overlay={coverOverlay}
        textObjects={coverTextObjects}
      />
      <ExportPageShell
        pageId="people"
        label="people page"
        order={2}
        kind="people"
        backgroundColor={peopleBackgroundColor}
        textColor={peopleTextColor}
        overlay={peopleOverlay}
      >
        {peoplePhotoBlocks.map((block) => (
          <ExportPhotoBlock key={block.id} block={block} photo={photosById.get(block.photoId)} />
        ))}
        {peopleTextObjects.map((textObject) => (
          <ExportTextObject key={textObject.id} textObject={textObject} />
        ))}
      </ExportPageShell>
      {customPages.map((page) => {
        const order = nextOrder++;

        return (
          <ExportPageShell
            key={page.id}
            pageId={page.id}
            label={`${page.type === "text" ? "text" : "photo"} page ${order - 2}`}
            order={order}
            kind={page.type}
            backgroundColor={page.backgroundColor}
            textColor={page.textColor}
            overlay={page.overlay}
          >
            {page.photoBlocks.map((block) => (
              <ExportPhotoBlock
                key={block.id}
                block={block}
                photo={photosById.get(block.photoId)}
              />
            ))}
            {page.textObjects.map((textObject) => (
              <ExportTextObject key={textObject.id} textObject={textObject} />
            ))}
          </ExportPageShell>
        );
      })}
    </div>
  );
}

function ReorderPagesModal({
  open,
  coverPhoto,
  coverOverlay,
  coverTextObjects,
  peopleBackgroundColor,
  peopleOverlay,
  peopleTextObjects,
  peoplePhotoBlocks,
  customPages,
  draftOrderedPages,
  draggedPageId,
  selectedPageId,
  photosById,
  onSelectPage,
  onCancel,
  onReset,
  onSave,
  onMovePage,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  open: boolean;
  coverPhoto: PhotoAsset | undefined;
  coverOverlay: CoverOverlayStyle;
  coverTextObjects: PhotobookTextObject[];
  peopleBackgroundColor: string;
  peopleOverlay: CoverOverlayStyle;
  peopleTextObjects: PhotobookTextObject[];
  peoplePhotoBlocks: PhotoBlock[];
  customPages: CustomPage[];
  draftOrderedPages: CustomPage[];
  draggedPageId: string | null;
  selectedPageId: string;
  photosById: Map<string, PhotoAsset>;
  onSelectPage: (pageId: string) => void;
  onCancel: () => void;
  onReset: () => void;
  onSave: () => void;
  onMovePage: (pageId: string, direction: "up" | "down") => void;
  onDragStart: (event: ReactDragEvent<HTMLDivElement>, pageId: string) => void;
  onDragEnd: () => void;
  onDrop: (event: ReactDragEvent<HTMLDivElement>, pageId: string) => void;
}) {
  if (!open) return null;

  const lockedPages: ReorderPagePreview[] = [
    {
      id: "cover",
      label: "Cover",
      typeLabel: "Cover",
      pageNumber: 1,
      locked: true,
      backgroundColor: "#050505",
      textColor: "#ffffff",
      overlay: coverOverlay,
      coverPhoto,
      textObjects: coverTextObjects,
      photoBlocks: [],
    },
    {
      id: "people",
      label: "People",
      typeLabel: "People",
      pageNumber: 2,
      locked: true,
      backgroundColor: peopleBackgroundColor,
      textColor: isDarkColor(peopleBackgroundColor) ? "#ffffff" : "#050505",
      overlay: peopleOverlay,
      textObjects: peopleTextObjects,
      photoBlocks: peoplePhotoBlocks,
    },
  ];
  const movablePages: ReorderPagePreview[] = draftOrderedPages.map((page, index) => ({
    id: page.id,
    label: page.type === "text" ? "Story page" : "Design page",
    typeLabel: page.type === "text" ? "Text" : "Photo",
    pageNumber: index + 3,
    locked: false,
    backgroundColor: page.backgroundColor,
    textColor: page.textColor,
    overlay: page.overlay,
    textObjects: page.textObjects,
    photoBlocks: page.photoBlocks,
  }));
  const allPages = [...lockedPages, ...movablePages];
  const selectedPage = allPages.find((page) => page.id === selectedPageId) ?? allPages[0];
  const selectedMovableIndex = movablePages.findIndex((page) => page.id === selectedPage.id);

  return (
    <div
      className="fixed inset-0 z-50 grid bg-white px-3 py-4 dark:bg-black sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-label="Reorder photobook pages"
    >
      <div className="mx-auto grid h-full w-full max-w-[1380px] overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-[0_36px_120px_rgb(0_0_0_/_0.22)] dark:border-white/10 dark:bg-black dark:shadow-[0_36px_120px_rgb(0_0_0_/_0.82)]">
        <div className="flex flex-col gap-4 border-b border-black/10 bg-white px-5 py-5 dark:border-white/10 dark:bg-black sm:flex-row sm:items-start sm:justify-between sm:px-7">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
              Photobook order
            </p>
            <h2 className="mt-2 text-2xl font-light text-black dark:text-white sm:text-3xl">
              Reorder photobook
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-black/58 dark:text-white/55">
              Drag pages into the order you want. Cover and People stay fixed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-black/10 bg-neutral-50 text-black hover:bg-neutral-100 dark:border-white/10 dark:bg-[#080808] dark:text-white dark:hover:bg-[#111111]"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-full bg-[#050505] text-white hover:bg-black dark:bg-[#f7efe0] dark:text-[#050505] dark:hover:bg-white"
              onClick={onSave}
            >
              Save order
            </Button>
          </div>
        </div>

        <div className="isolate grid min-h-0 gap-5 overflow-y-auto bg-white p-5 dark:bg-black lg:grid-cols-[minmax(0,1fr)_330px] lg:overflow-hidden lg:p-7 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-h-0 overflow-y-auto rounded-[1.7rem] border border-black/10 bg-neutral-50 p-3 pr-3 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.9)] dark:border-white/10 dark:bg-[#050505] dark:shadow-none lg:p-4 lg:pr-4">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 xl:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
              {lockedPages.map((page) => (
                <ReorderPageCard
                  key={page.id}
                  page={page}
                  selected={selectedPage.id === page.id}
                  dragging={false}
                  movableCount={movablePages.length}
                  movableIndex={-1}
                  photosById={photosById}
                  onSelect={() => onSelectPage(page.id)}
                />
              ))}
              {movablePages.map((page, index) => (
                <ReorderPageCard
                  key={page.id}
                  page={page}
                  selected={selectedPage.id === page.id}
                  dragging={draggedPageId === page.id}
                  movableCount={movablePages.length}
                  movableIndex={index}
                  photosById={photosById}
                  onSelect={() => onSelectPage(page.id)}
                  onDragStart={(event) => onDragStart(event, page.id)}
                  onDragEnd={onDragEnd}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => onDrop(event, page.id)}
                  onMoveUp={() => onMovePage(page.id, "up")}
                  onMoveDown={() => onMovePage(page.id, "down")}
                />
              ))}
            </div>
            {customPages.length === 0 ? (
              <div className="mt-5 rounded-[1.5rem] border border-dashed border-black/15 bg-white p-5 text-sm text-black/60 dark:border-white/15 dark:bg-[#080808] dark:text-white/60">
                Add story or photo pages to reorder.
              </div>
            ) : customPages.length === 1 ? (
              <div className="mt-5 rounded-[1.5rem] border border-black/10 bg-white p-5 text-sm text-black/60 dark:border-white/10 dark:bg-[#080808] dark:text-white/60">
                Add more pages to rearrange your photobook.
              </div>
            ) : null}
          </div>

          <aside className="isolate grid gap-4 overflow-hidden rounded-[1.7rem] border border-black/10 bg-white p-4 shadow-[0_22px_70px_rgb(0_0_0_/_0.12),inset_0_1px_0_rgb(255_255_255_/_0.9)] dark:border-white/10 dark:bg-[#050505] dark:shadow-[0_22px_70px_rgb(0_0_0_/_0.44)] lg:sticky lg:top-0 lg:max-h-full lg:overflow-y-auto">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.64rem] uppercase tracking-[0.22em] text-black/40 dark:text-white/40">
                  Selected
                </p>
                <h3 className="mt-1 text-xl font-light text-black dark:text-white">
                  {selectedPage.label}
                </h3>
              </div>
              <span className="rounded-full border border-black/10 bg-neutral-50 px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.16em] text-black/55 dark:border-white/10 dark:bg-[#080808] dark:text-white/55">
                Page {selectedPage.pageNumber}
              </span>
            </div>
            <PageThumbnailPreview
              page={selectedPage}
              photosById={photosById}
              variant="detail"
            />
            <div className="grid gap-2 text-sm leading-6 text-black/58 dark:text-white/55">
              <p>
                {selectedPage.locked
                  ? "This page is fixed in the book."
                  : "This page can move anywhere after the People page."}
              </p>
              <p className="text-xs uppercase tracking-[0.18em] text-black/35 dark:text-white/35">
                {selectedPage.typeLabel} · {selectedPage.locked ? "Locked" : "Movable"}
              </p>
            </div>
            {!selectedPage.locked ? (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-black/10 bg-neutral-50 text-black hover:bg-neutral-100 dark:border-white/10 dark:bg-[#080808] dark:text-white dark:hover:bg-[#111111]"
                  onClick={() => onMovePage(selectedPage.id, "up")}
                  disabled={selectedMovableIndex <= 0}
                >
                  <ArrowUp className="size-4" />
                  Move up
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-black/10 bg-neutral-50 text-black hover:bg-neutral-100 dark:border-white/10 dark:bg-[#080808] dark:text-white dark:hover:bg-[#111111]"
                  onClick={() => onMovePage(selectedPage.id, "down")}
                  disabled={
                    selectedMovableIndex === -1 ||
                    selectedMovableIndex >= movablePages.length - 1
                  }
                >
                  <ArrowDown className="size-4" />
                  Move down
                </Button>
              </div>
            ) : null}
          </aside>
        </div>

        <div className="flex flex-col gap-3 border-t border-black/10 bg-white px-5 py-4 dark:border-white/10 dark:bg-black sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <p className="text-xs leading-5 text-black/45 dark:text-white/45">
            PDF download follows this saved order: Cover, People, then your reordered pages.
          </p>
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-black/10 bg-neutral-50 text-black hover:bg-neutral-100 dark:border-white/10 dark:bg-[#080808] dark:text-white dark:hover:bg-[#111111]"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-black/10 bg-neutral-50 text-black hover:bg-neutral-100 dark:border-white/10 dark:bg-[#080808] dark:text-white dark:hover:bg-[#111111]"
              onClick={onReset}
            >
              Reset order
            </Button>
            <Button
              type="button"
              className="rounded-full bg-[#050505] text-white hover:bg-black dark:bg-[#f7efe0] dark:text-[#050505] dark:hover:bg-white"
              onClick={onSave}
            >
              Save order
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreditPage() {
  return (
    <div
      data-photobook-page="true"
      data-photobook-page-id="credit"
      data-photobook-page-label="credit page"
      data-photobook-page-order="9999"
      data-photobook-page-kind="credit"
      className="fixed left-[-10000px] top-0 grid aspect-[4/5] w-[420px] place-items-center border border-black/[0.10] bg-white text-[#050505] dark:border-white/[0.14] dark:bg-[#050505] dark:text-[#f7efe0]"
    >
      <div className="text-center">
        <p className="font-byline text-sm lowercase tracking-[0.24em] opacity-60">made with</p>
        <p className="font-brand text-6xl">ClaY.</p>
        <p className="font-byline text-sm lowercase tracking-[0.24em] opacity-60">
          by tharun
        </p>
      </div>
    </div>
  );
}

export function UniversalPhotobookBuilder({
  roomName,
  photobook,
  photos,
  members,
  isHost,
}: {
  roomName: string;
  photobook: PhotobookDraft;
  photos: PhotoAsset[];
  members: RoomMember[];
  isHost: boolean;
}) {
  const coverFormId = `cover-save-${photobook.id}`;
  const photosById = useMemo(
    () => new Map(photos.map((photo) => [photo.id, photo])),
    [photos],
  );
  const coverStorageKey = `clay-cover-text-position:${photobook.id}`;
  const peopleStorageKey = `clay-people-page:${photobook.id}`;
  const customPagesStorageKey = `clay-custom-pages:${photobook.id}`;

  const [selection, setSelection] = useState<Selection>({
    pageId: "cover",
    pageType: "cover",
    objectType: "page",
  });
  const [coverPhotoId, setCoverPhotoId] = useState(
    photobook.cover_photo_id ?? photos[0]?.id ?? "",
  );
  const [coverOverlay, setCoverOverlay] = useState<CoverOverlayStyle>(
    photobook.cover_overlay_style ?? "soft",
  );
  const [titleText, setTitleText] = useState<PhotobookTextObject>(() =>
    normalizeTextObject(
      {
        text: photobook.cover_title ?? roomName,
        font: photobook.cover_font,
        color: photobook.cover_text_color,
      },
      {
        ...defaultTitleText,
        text: photobook.cover_title ?? roomName,
        font: photobook.cover_font ?? "editorial-serif",
        color: photobook.cover_text_color ?? "#ffffff",
      },
    ),
  );
  const [subtitleText, setSubtitleText] = useState<PhotobookTextObject>(() =>
    normalizeTextObject(
      {
        text: photobook.cover_subtitle ?? "",
        font: photobook.cover_font,
        color: photobook.cover_text_color,
      },
      {
        ...defaultSubtitleText,
        text: photobook.cover_subtitle ?? "",
        font: photobook.cover_font ?? "minimal-light",
        color: photobook.cover_text_color ?? "#ffffff",
      },
    ),
  );
  const [coverCustomText, setCoverCustomText] = useState<PhotobookTextObject[]>([]);
  const [peopleTextObjects, setPeopleTextObjects] = useState<PhotobookTextObject[]>([
    defaultPeopleTitle,
  ]);
  const [peoplePhotoBlocks, setPeoplePhotoBlocks] = useState<PhotoBlock[]>([]);
  const [peopleBackgroundColor, setPeopleBackgroundColor] = useState("#050505");
  const [peopleOverlay, setPeopleOverlay] = useState<CoverOverlayStyle>("none");
  const [newMemberName, setNewMemberName] = useState("");
  const [peopleSaveStatus, setPeopleSaveStatus] = useState<"idle" | "saved" | "unsaved">(
    "idle",
  );
  const [customPages, setCustomPages] = useState<CustomPage[]>(() => [
    createCustomPage(0, photos, "custom-page-1"),
  ]);
  const [customSaveStatus, setCustomSaveStatus] = useState<"idle" | "saved" | "unsaved">(
    "idle",
  );
  const [isReorderOpen, setIsReorderOpen] = useState(false);
  const [draftPageOrder, setDraftPageOrder] = useState<string[]>([]);
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const [selectedReorderPageId, setSelectedReorderPageId] = useState("cover");
  const hasLoadedCoverRef = useRef(false);
  const hasLoadedPeopleRef = useRef(false);
  const hasLoadedCustomRef = useRef(false);
  const coverLoadRef = useRef({
    coverOverlay,
    coverPhotoId,
    coverStorageKey,
    fallbackColor: photobook.cover_text_color,
    fallbackFont: photobook.cover_font,
    subtitleText,
    titleText,
  });

  const coverTextObjects = [titleText, subtitleText, ...coverCustomText];
  const coverPhoto = photosById.get(coverPhotoId);
  const selectedText = getSelectedText();
  const selectedPhoto = getSelectedPhoto();
  const selectedCustomPage = getSelectedCustomPage();
  const selectedPage =
    selection.pageId === "cover"
      ? null
      : selection.pageId === "people"
        ? null
        : selectedCustomPage;
  const coverSettings = serializeCoverSettings({
    titleText,
    subtitleText,
    customTextObjects: coverCustomText,
    selectedPhotoId: coverPhotoId || null,
    filter: coverOverlay,
  });
  const coverSettingsJson = JSON.stringify(coverSettings);
  const draftOrderedPages = orderCustomPagesByIds(customPages, draftPageOrder);

  function persistCoverSettings() {
    logCoverDebug("[cover-save-client-state]", coverSettings);
    logCoverDebug("[cover-save-client-payload]", JSON.parse(coverSettingsJson));
    window.localStorage.setItem(coverStorageKey, coverSettingsJson);
  }

  useEffect(() => {
    const initialCover = coverLoadRef.current;
    const saved = loadJson<Partial<SavedCoverSettings> & {
      titleText?: Partial<PhotobookTextObject>;
      subtitleText?: Partial<PhotobookTextObject>;
      customTextObjects?: Partial<PhotobookTextObject>[];
      selectedPhotoId?: unknown;
      filter?: unknown;
      x?: number;
      y?: number;
      scale?: number;
      width?: number;
    }>(initialCover.coverStorageKey);
    const normalizedFromSaved = saved?.titleText || saved?.subtitleText || saved?.customTextObjects
      ? {
          titleText: normalizeTextObject(saved.titleText, initialCover.titleText),
          subtitleText: normalizeTextObject(saved.subtitleText, initialCover.subtitleText),
          customTextObjects: Array.isArray(saved.customTextObjects)
            ? saved.customTextObjects.map((textObject, index) =>
                normalizeTextObject(
                  textObject,
                  createTextObject(
                    `cover-custom-text-${index + 1}`,
                    "New text",
                    index,
                    initialCover.fallbackFont ?? "editorial-serif",
                    initialCover.fallbackColor ?? "#ffffff",
                  ),
                ),
              )
            : [],
          selectedPhotoId:
            typeof saved.selectedPhotoId === "string"
              ? saved.selectedPhotoId
              : initialCover.coverPhotoId,
          filter: isOverlay(saved.filter) ? saved.filter : initialCover.coverOverlay,
        }
      : null;

    logCoverDebug("[cover-load-raw]", saved);
    logCoverDebug("[cover-load-normalized]", normalizedFromSaved);

    if (normalizedFromSaved) {
      queueMicrotask(() => {
        setTitleText(normalizedFromSaved.titleText);
        setSubtitleText(normalizedFromSaved.subtitleText);
        setCoverCustomText(normalizedFromSaved.customTextObjects);
        setCoverPhotoId(normalizedFromSaved.selectedPhotoId);
        setCoverOverlay(normalizedFromSaved.filter);
        hasLoadedCoverRef.current = true;
      });
    } else if (isFiniteNumber(saved?.x) && isFiniteNumber(saved?.y)) {
      queueMicrotask(() => {
        setTitleText((current) => ({
          ...current,
          x: clamp(saved.x ?? current.x, 0.05, 0.95),
          y: clamp(saved.y ?? current.y, 0.05, 0.95),
          scale: isFiniteNumber(saved.scale) ? saved.scale : current.scale,
          width: isFiniteNumber(saved.width) ? saved.width : current.width,
        }));
        setSubtitleText((current) => ({
          ...current,
          x: clamp(saved.x ?? current.x, 0.05, 0.95),
          y: clamp((saved.y ?? current.y) + 0.11, 0.05, 0.95),
        }));
        hasLoadedCoverRef.current = true;
      });
    } else {
      hasLoadedCoverRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedCoverRef.current) return;

    window.localStorage.setItem(coverStorageKey, coverSettingsJson);
  }, [coverSettingsJson, coverStorageKey]);

  useEffect(() => {
    const saved = loadJson<Partial<PeopleSettings> & { names?: unknown[] }>(peopleStorageKey);

    if (saved) {
      const textObjects = Array.isArray(saved.textObjects)
        ? saved.textObjects.map((textObject, index) =>
            normalizeTextObject(
              textObject,
              index === 0 ? defaultPeopleTitle : createTextObject(`people-text-${index + 1}`),
            ),
          )
        : [defaultPeopleTitle];
      const hasTitle = textObjects.some((textObject) => textObject.role === "title");

      queueMicrotask(() => {
        setPeopleTextObjects(hasTitle ? textObjects : [defaultPeopleTitle, ...textObjects]);
        setPeopleBackgroundColor(
          typeof saved.backgroundColor === "string" ? saved.backgroundColor : "#050505",
        );
        setPeopleOverlay(isOverlay(saved.overlay) ? saved.overlay : "none");
        setPeoplePhotoBlocks(
          Array.isArray(saved.photoBlocks)
            ? saved.photoBlocks
                .filter((block) => typeof block.photoId === "string" && block.photoId)
                .map((block, index) =>
                  normalizePhotoBlock(block, createBlock(block.photoId ?? "", index, "blank")),
                )
            : [],
        );
      });
    }

    hasLoadedPeopleRef.current = true;
  }, [peopleStorageKey]);

  useEffect(() => {
    const saved = loadJson<CustomPage[]>(customPagesStorageKey);

    if (Array.isArray(saved) && saved.length > 0) {
      queueMicrotask(() => {
        setCustomPages(
          saved.map((page, index) =>
            normalizeCustomPage(
              page,
              createCustomPage(index, photos, `custom-page-${index + 1}`),
            ),
          ),
        );
      });
    }

    hasLoadedCustomRef.current = true;
  }, [customPagesStorageKey, photos]);

  function markPeopleUnsaved() {
    if (hasLoadedPeopleRef.current) {
      setPeopleSaveStatus("unsaved");
    }
  }

  function markCustomUnsaved() {
    if (hasLoadedCustomRef.current) {
      setCustomSaveStatus("unsaved");
    }
  }

  function savePeoplePage() {
    window.localStorage.setItem(
      peopleStorageKey,
      JSON.stringify({
        version: 3,
        customColor: "#ffffff",
        backgroundColor: peopleBackgroundColor,
        overlay: peopleOverlay,
        textObjects: peopleTextObjects,
        photoBlocks: peoplePhotoBlocks,
      }),
    );
    setPeopleSaveStatus("saved");
  }

  function saveCustomPages() {
    window.localStorage.setItem(customPagesStorageKey, JSON.stringify(customPages));
    setCustomSaveStatus("saved");
  }

  function openReorderPanel() {
    setDraftPageOrder(customPages.map((page) => page.id));
    setDraggedPageId(null);
    setSelectedReorderPageId("cover");
    setIsReorderOpen(true);
  }

  function cancelReorder() {
    setDraftPageOrder(customPages.map((page) => page.id));
    setDraggedPageId(null);
    setIsReorderOpen(false);
  }

  function resetReorder() {
    setDraftPageOrder(defaultCustomPageOrderIds(customPages));
    setDraggedPageId(null);
  }

  function savePageOrder() {
    setCustomPages((current) => {
      const orderedPages = orderCustomPagesByIds(current, draftPageOrder);

      window.localStorage.setItem(customPagesStorageKey, JSON.stringify(orderedPages));
      return orderedPages;
    });
    setCustomSaveStatus("saved");
    setDraggedPageId(null);
    setIsReorderOpen(false);
  }

  function moveDraftPage(pageId: string, direction: "up" | "down") {
    setDraftPageOrder((current) => movePageId(current, pageId, direction));
    setSelectedReorderPageId(pageId);
  }

  function handleReorderDragStart(
    event: ReactDragEvent<HTMLDivElement>,
    pageId: string,
  ) {
    setDraggedPageId(pageId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", pageId);
  }

  function handleReorderDrop(
    event: ReactDragEvent<HTMLDivElement>,
    targetPageId: string,
  ) {
    event.preventDefault();
    const sourcePageId = draggedPageId ?? event.dataTransfer.getData("text/plain");

    if (!sourcePageId || sourcePageId === targetPageId) {
      setDraggedPageId(null);
      return;
    }

    setDraftPageOrder((current) => {
      const sourceIndex = current.indexOf(sourcePageId);
      const targetIndex = current.indexOf(targetPageId);

      if (sourceIndex === -1 || targetIndex === -1) return current;

      const nextOrder = [...current];
      const [movedPageId] = nextOrder.splice(sourceIndex, 1);
      nextOrder.splice(targetIndex, 0, movedPageId);

      return nextOrder;
    });
    setSelectedReorderPageId(sourcePageId);
    setDraggedPageId(null);
  }

  function saveEditorState() {
    persistCoverSettings();
    savePeoplePage();
    saveCustomPages();
  }

  function updateCoverText(textObject: PhotobookTextObject) {
    if (textObject.id === "cover-title") {
      setTitleText(textObject);
      return;
    }

    if (textObject.id === "cover-subtitle") {
      setSubtitleText(textObject);
      return;
    }

    setCoverCustomText((current) =>
      current.map((item) => (item.id === textObject.id ? textObject : item)),
    );
  }

  function deleteCoverText(textId: string) {
    setCoverCustomText((current) => current.filter((textObject) => textObject.id !== textId));
    setSelection({ pageId: "cover", pageType: "cover", objectType: "page" });
  }

  function updatePeopleText(textObject: PhotobookTextObject) {
    setPeopleTextObjects((current) =>
      current.map((item) => (item.id === textObject.id ? textObject : item)),
    );
    markPeopleUnsaved();
  }

  function deletePeopleText(textId: string) {
    setPeopleTextObjects((current) =>
      current.filter((textObject) => textObject.id !== textId || textObject.role === "title"),
    );
    setSelection({ pageId: "people", pageType: "people", objectType: "page" });
    markPeopleUnsaved();
  }

  function updatePeoplePhoto(block: PhotoBlock) {
    setPeoplePhotoBlocks((current) =>
      current.map((item) => (item.id === block.id ? block : item)),
    );
    markPeopleUnsaved();
  }

  function updateCustomPage(pageId: string, updater: (page: CustomPage) => CustomPage) {
    setCustomPages((current) =>
      current.map((page) => (page.id === pageId ? updater(page) : page)),
    );
    markCustomUnsaved();
  }

  function updateCustomText(pageId: string, textObject: PhotobookTextObject) {
    updateCustomPage(pageId, (page) => ({
      ...page,
      textObjects: page.textObjects.map((item) =>
        item.id === textObject.id ? textObject : item,
      ),
    }));
  }

  function deleteCustomText(pageId: string, textId: string) {
    updateCustomPage(pageId, (page) => ({
      ...page,
      textObjects: page.textObjects.filter((textObject) => textObject.id !== textId),
    }));
    setSelection({ pageId, pageType: "custom", objectType: "page" });
  }

  function updateCustomPhoto(pageId: string, block: PhotoBlock) {
    updateCustomPage(pageId, (page) => ({
      ...page,
      photoBlocks: page.photoBlocks.map((item) => (item.id === block.id ? block : item)),
    }));
  }

  function getSelectedText() {
    if (selection.objectType !== "text" || !selection.objectId) return null;

    if (selection.pageId === "cover") {
      return coverTextObjects.find((textObject) => textObject.id === selection.objectId) ?? null;
    }

    if (selection.pageId === "people") {
      return (
        peopleTextObjects.find((textObject) => textObject.id === selection.objectId) ?? null
      );
    }

    return (
      customPages
        .find((page) => page.id === selection.pageId)
        ?.textObjects.find((textObject) => textObject.id === selection.objectId) ?? null
    );
  }

  function getSelectedPhoto() {
    if (selection.objectType !== "photo" || !selection.objectId) return null;

    if (selection.pageId === "people") {
      return peoplePhotoBlocks.find((block) => block.id === selection.objectId) ?? null;
    }

    if (selection.pageType === "custom") {
      return (
        customPages
          .find((page) => page.id === selection.pageId)
          ?.photoBlocks.find((block) => block.id === selection.objectId) ?? null
      );
    }

    return null;
  }

  function getSelectedCustomPage() {
    if (selection.pageType !== "custom") return null;
    return customPages.find((page) => page.id === selection.pageId) ?? null;
  }

  function setSelectedTextText(text: string) {
    if (!selectedText) return;
    updateSelectedText({ ...selectedText, text });
  }

  function updateSelectedText(textObject: PhotobookTextObject) {
    if (selection.pageId === "cover") {
      updateCoverText(textObject);
    } else if (selection.pageId === "people") {
      updatePeopleText(textObject);
    } else {
      updateCustomText(selection.pageId, textObject);
    }
  }

  function deleteSelectedText() {
    if (!selectedText || selectedText.role === "title") return;

    if (selection.pageId === "cover") {
      deleteCoverText(selectedText.id);
    } else if (selection.pageId === "people") {
      deletePeopleText(selectedText.id);
    } else {
      deleteCustomText(selection.pageId, selectedText.id);
    }
  }

  function resetSelectedText() {
    if (!selectedText) return;
    const resetGeometry: EditableTextGeometry = {
      x: selectedText.role === "title" ? 0.5 : 0.5,
      y: selectedText.role === "title" ? 0.42 : 0.56,
      width: selectedText.role === "title" ? 0.65 : 0.42,
      scale: selectedText.role === "subtitle" ? 0.55 : 1,
    };

    updateSelectedText({ ...selectedText, ...resetGeometry });
  }

  function addCoverTextBox() {
    const id = createClientId("cover-text");
    const nextText = createTextObject(
      id,
      "New text",
      coverCustomText.length,
      titleText.font,
      titleText.color,
    );

    setCoverCustomText((current) => [...current, nextText]);
    setSelection({ pageId: "cover", pageType: "cover", objectType: "text", objectId: id });
  }

  function addPeopleTextBox() {
    const id = createClientId("people-text");
    const nextText = createTextObject(
      id,
      "New text",
      peopleTextObjects.length,
      defaultPeopleTitle.font,
      defaultPeopleTitle.color,
    );

    setPeopleTextObjects((current) => [...current, nextText]);
    setSelection({ pageId: "people", pageType: "people", objectType: "text", objectId: id });
    markPeopleUnsaved();
  }

  function addMemberName() {
    const name = newMemberName.trim();

    if (!name) return;

    const nameCount = peopleTextObjects.filter((textObject) => textObject.role === "name").length;
    const id = createClientId("people-name");
    const nextName = normalizeTextObject(
      { id, text: name },
      getDefaultNameText(nameCount, name),
    );

    setPeopleTextObjects((current) => [...current, nextName]);
    setNewMemberName("");
    setSelection({ pageId: "people", pageType: "people", objectType: "text", objectId: id });
    markPeopleUnsaved();
  }

  function addPhotoToPage(pageId: string, pageType: "people" | "custom", photoId: string) {
    if (pageType === "people") {
      const id = createClientId("people-photo");
      const nextBlock = createBlock(photoId, peoplePhotoBlocks.length, "blank", id);

      setPeoplePhotoBlocks((current) => [...current, nextBlock]);
      setSelection({ pageId: "people", pageType: "people", objectType: "photo", objectId: id });
      markPeopleUnsaved();
      return;
    }

    const page = customPages.find((item) => item.id === pageId);

    if (!page) return;

    const id = createClientId("custom-photo");
    const nextBlock = createBlock(photoId, page.photoBlocks.length, page.layout, id);

    updateCustomPage(pageId, (current) => ({
      ...current,
      type: "photo",
      photoBlocks: [...current.photoBlocks, nextBlock],
    }));
    setSelection({ pageId, pageType: "custom", objectType: "photo", objectId: id });
  }

  function addTextBoxToCustomPage(pageId: string) {
    const page = customPages.find((item) => item.id === pageId);

    if (!page) return;

    const id = createClientId("custom-text");
    const nextText = createTextObject(
      id,
      "New text",
      page.textObjects.length,
      page.font,
      page.textColor,
    );

    updateCustomPage(pageId, (current) => ({
      ...current,
      textObjects: [...current.textObjects, nextText],
    }));
    setSelection({ pageId, pageType: "custom", objectType: "text", objectId: id });
  }

  function addTextPage() {
    const id = createClientId("custom-text-page");
    const page = createTextPage(customPages.length, id);

    setCustomPages((current) => {
      const firstPhotoPageIndex = current.findIndex((item) => item.type === "photo");

      if (firstPhotoPageIndex === -1) {
        return [...current, page];
      }

      return [
        ...current.slice(0, firstPhotoPageIndex),
        page,
        ...current.slice(firstPhotoPageIndex),
      ];
    });
    setSelection({ pageId: id, pageType: "custom", objectType: "text", objectId: page.textObjects[0]?.id });
    markCustomUnsaved();
  }

  function addPhotoPage() {
    const id = createClientId("custom-photo-page");
    const page = createCustomPage(customPages.length, photos, id);

    setCustomPages((current) => [...current, page]);
    setSelection({ pageId: id, pageType: "custom", objectType: "page" });
    markCustomUnsaved();
  }

  function duplicateCustomPage(pageId: string) {
    const page = customPages.find((item) => item.id === pageId);

    if (!page) return;

    const id = createClientId("custom-page-copy");
    const copy: CustomPage = {
      ...page,
      id,
      textObjects: page.textObjects.map((textObject) => ({
        ...textObject,
        id: createClientId("custom-text-copy"),
      })),
      photoBlocks: page.photoBlocks.map((block) => ({
        ...block,
        id: createClientId("custom-photo-copy"),
      })),
    };

    setCustomPages((current) => [...current, copy]);
    setSelection({ pageId: id, pageType: "custom", objectType: "page" });
    markCustomUnsaved();
  }

  function deleteCustomPage(pageId: string) {
    setCustomPages((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter((page) => page.id !== pageId);
    });
    setSelection({ pageId: "people", pageType: "people", objectType: "page" });
    markCustomUnsaved();
  }

  function updateSelectedPhoto(block: PhotoBlock) {
    if (selection.pageId === "people") {
      updatePeoplePhoto(block);
    } else if (selection.pageType === "custom") {
      updateCustomPhoto(selection.pageId, block);
    }
  }

  function deleteSelectedPhoto() {
    if (!selectedPhoto) return;

    if (selection.pageId === "people") {
      setPeoplePhotoBlocks((current) => current.filter((block) => block.id !== selectedPhoto.id));
      setSelection({ pageId: "people", pageType: "people", objectType: "page" });
      markPeopleUnsaved();
      return;
    }

    if (selection.pageType === "custom") {
      updateCustomPage(selection.pageId, (page) => ({
        ...page,
        photoBlocks: page.photoBlocks.filter((block) => block.id !== selectedPhoto.id),
      }));
      setSelection({ pageId: selection.pageId, pageType: "custom", objectType: "page" });
    }
  }

  function moveSelectedPhoto(direction: "forward" | "backward") {
    if (!selectedPhoto) return;
    const delta = direction === "forward" ? 1 : -1;

    updateSelectedPhoto({
      ...selectedPhoto,
      zIndex: clamp(selectedPhoto.zIndex + delta, 1, 100),
    });
  }

  function selectedPageControls() {
    if (selection.pageId === "cover") {
      return (
        <>
          <section className={sectionClass}>
            <p className={labelClass}>
              <ImagePlus className="size-3" />
              Cover photo
            </p>
            <PhotoPicker
              photos={photos}
              selectedPhotoId={coverPhotoId}
              onSelect={setCoverPhotoId}
            />
          </section>
          <section className={sectionClass}>
            <p className={labelClass}>
              <Palette className="size-3" />
              Mood
            </p>
            <OverlayChips selectedOverlay={coverOverlay} onSelect={setCoverOverlay} />
          </section>
          <section className={sectionClass}>
            <p className={labelClass}>
              <Type className="size-3" />
              Text
            </p>
            <Button
              type="button"
              variant="outline"
              className={cn(chipBase, chipIdle, "h-10 justify-center")}
              onClick={addCoverTextBox}
            >
              <Plus className="size-4" />
              Add text box
            </Button>
          </section>
        </>
      );
    }

    if (selection.pageId === "people") {
      return (
        <>
          <section className={sectionClass}>
            <p className={labelClass}>
              <Type className="size-3" />
              Content
            </p>
            <div className="flex gap-2">
              <Input
                value={newMemberName}
                onChange={(event) => setNewMemberName(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addMemberName();
                  }
                }}
                placeholder="Add a name"
                className={inputClass}
              />
              <Button type="button" className="h-11 rounded-full" onClick={addMemberName}>
                Add
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className={cn(chipBase, chipIdle, "h-10 justify-center")}
              onClick={addPeopleTextBox}
            >
              <Plus className="size-4" />
              Add text box
            </Button>
            <p className="text-xs leading-5 text-muted-foreground">
              Names are manual only. {members.length} room member
              {members.length === 1 ? "" : "s"} available.
            </p>
          </section>
          <section className={sectionClass}>
            <p className={labelClass}>
              <ImagePlus className="size-3" />
              Add photo
            </p>
            <PhotoPicker
              photos={photos}
              onSelect={(photoId) => addPhotoToPage("people", "people", photoId)}
            />
          </section>
          <PageBackgroundControls
            color={peopleBackgroundColor}
            overlay={peopleOverlay}
            onColor={(color) => {
              setPeopleBackgroundColor(color);
              markPeopleUnsaved();
            }}
            onOverlay={(overlay) => {
              setPeopleOverlay(overlay);
              markPeopleUnsaved();
            }}
          />
        </>
      );
    }

    if (!selectedPage) {
      return null;
    }

    return (
      <>
        <section className={sectionClass}>
          <p className={labelClass}>
            <Type className="size-3" />
            Content
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className={cn(chipBase, chipIdle, "h-10 justify-center")}
              onClick={() => addTextBoxToCustomPage(selectedPage.id)}
            >
              <Plus className="size-4" />
              Text
            </Button>
            <Button
              type="button"
              variant="outline"
              className={cn(chipBase, chipIdle, "h-10 justify-center")}
              onClick={() => {
                const photo = photos[0];
                if (photo) addPhotoToPage(selectedPage.id, "custom", photo.id);
              }}
              disabled={!photos.length}
            >
              <ImagePlus className="size-4" />
              Photo
            </Button>
          </div>
          <PhotoPicker
            photos={photos}
            onSelect={(photoId) => addPhotoToPage(selectedPage.id, "custom", photoId)}
          />
        </section>
        <section className={sectionClass}>
          <p className={labelClass}>
            <Layers className="size-3" />
            Layout
          </p>
          <div className="flex flex-wrap gap-2">
            {layoutOptions.map((layout) => (
              <Button
                key={layout.value}
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  chipBase,
                  selectedPage.layout === layout.value ? chipSelected : chipIdle,
                )}
                onClick={() =>
                  updateCustomPage(selectedPage.id, (page) => ({
                    ...page,
                    layout: layout.value,
                    photoBlocks: arrangeBlocks(page.photoBlocks, layout.value),
                  }))
                }
              >
                {layout.label}
              </Button>
            ))}
          </div>
        </section>
        <PageBackgroundControls
          color={selectedPage.backgroundColor}
          overlay={selectedPage.overlay}
          onColor={(color) =>
            updateCustomPage(selectedPage.id, (page) => ({
              ...page,
              backgroundColor: color,
              textColor: isDarkColor(color) ? "#ffffff" : "#050505",
            }))
          }
          onOverlay={(overlay) =>
            updateCustomPage(selectedPage.id, (page) => ({ ...page, overlay }))
          }
        />
        <section className={sectionClass}>
          <p className={labelClass}>
            <Layers className="size-3" />
            Page actions
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className={cn(chipBase, chipIdle, "h-10 justify-center")}
              onClick={() => duplicateCustomPage(selectedPage.id)}
            >
              <Copy className="size-4" />
              Duplicate
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full border-destructive/35 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => deleteCustomPage(selectedPage.id)}
              disabled={customPages.length === 1}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <form id={coverFormId} action={updatePhotobookCoverAction} className="hidden">
        <input type="hidden" name="room_id" value={photobook.room_id} />
        <input type="hidden" name="photobook_id" value={photobook.id} />
        <input type="hidden" name="cover_photo_id" value={coverPhotoId} />
        <input type="hidden" name="cover_font" value={titleText.font} />
        <input type="hidden" name="cover_text_color" value={titleText.color} />
        <input
          type="hidden"
          name="cover_text_position"
          value={legacyPositionFromGeometry(titleText)}
        />
        <input type="hidden" name="cover_overlay_style" value={coverOverlay} />
        <input type="hidden" name="cover_title" value={titleText.text} />
        <input type="hidden" name="cover_subtitle" value={subtitleText.text} />
        <input type="hidden" name="cover_settings" value={coverSettingsJson} />
      </form>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start xl:gap-14">
        <div className="grid min-w-0 gap-8">
          <EditorPageFrame
            pageNumber="Page 1"
            title="Cover"
            selected={selection.pageId === "cover" && selection.objectType === "page"}
            onSelect={() =>
              setSelection({ pageId: "cover", pageType: "cover", objectType: "page" })
            }
          >
            {!isHost ? (
              <p className="mb-4 text-sm text-muted-foreground">
                Only the host can customize the room photobook cover.
              </p>
            ) : null}
            <CoverCanvas
              coverPhoto={coverPhoto}
              overlay={coverOverlay}
              textObjects={coverTextObjects}
              selected={selection}
              onSelectPage={() =>
                setSelection({ pageId: "cover", pageType: "cover", objectType: "page" })
              }
              onSelectText={(id) =>
                setSelection(
                  id
                    ? { pageId: "cover", pageType: "cover", objectType: "text", objectId: id }
                    : { pageId: "cover", pageType: "cover", objectType: "page" },
                )
              }
              onUpdateText={updateCoverText}
              onDeleteText={deleteCoverText}
            />
          </EditorPageFrame>

          <EditorPageFrame
            pageNumber="Page 2"
            title="People / index"
            selected={selection.pageId === "people" && selection.objectType === "page"}
            onSelect={() =>
              setSelection({ pageId: "people", pageType: "people", objectType: "page" })
            }
          >
            <PhotobookCanvas
              pageId="people"
              pageType="people"
              label="people page"
              order={2}
              backgroundColor={peopleBackgroundColor}
              textColor={isDarkColor(peopleBackgroundColor) ? "#ffffff" : "#050505"}
              overlay={peopleOverlay}
              textObjects={peopleTextObjects}
              photoBlocks={peoplePhotoBlocks}
              photosById={photosById}
              selected={selection}
              onSelectPage={() =>
                setSelection({ pageId: "people", pageType: "people", objectType: "page" })
              }
              onSelectText={(id) =>
                setSelection(
                  id
                    ? { pageId: "people", pageType: "people", objectType: "text", objectId: id }
                    : { pageId: "people", pageType: "people", objectType: "page" },
                )
              }
              onUpdateText={updatePeopleText}
              onDeleteText={deletePeopleText}
              onSelectPhoto={(id) =>
                setSelection(
                  id
                    ? { pageId: "people", pageType: "people", objectType: "photo", objectId: id }
                    : { pageId: "people", pageType: "people", objectType: "page" },
                )
              }
              onUpdatePhoto={updatePeoplePhoto}
            />
          </EditorPageFrame>

          <section className="grid gap-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.24em] text-muted-foreground/75">
                  Page 3+
                </p>
                <h2 className="mt-2 text-2xl font-light">Custom pages</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(chipBase, chipIdle, "h-10")}
                  onClick={addTextPage}
                >
                  <Plus className="size-4" />
                  Add text page
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(chipBase, chipIdle, "h-10")}
                  onClick={addPhotoPage}
                >
                  <ImagePlus className="size-4" />
                  Add photo page
                </Button>
              </div>
            </div>
            <div className="grid gap-8">
              {customPages.map((page, index) => (
                <EditorPageFrame
                  key={page.id}
                  pageNumber={`Page ${index + 3}`}
                  title={page.type === "text" ? "Story page" : "Design page"}
                  selected={selection.pageId === page.id && selection.objectType === "page"}
                  onSelect={() =>
                    setSelection({ pageId: page.id, pageType: "custom", objectType: "page" })
                  }
                >
                  <PhotobookCanvas
                    pageId={page.id}
                    pageType="custom"
                    label={`${page.type === "text" ? "text" : "custom"} page ${index + 1}`}
                    order={index + 3}
                    backgroundColor={page.backgroundColor}
                    textColor={page.textColor}
                    overlay={page.overlay}
                    textObjects={page.textObjects}
                    photoBlocks={page.photoBlocks}
                    photosById={photosById}
                    selected={selection}
                    onSelectPage={() =>
                      setSelection({ pageId: page.id, pageType: "custom", objectType: "page" })
                    }
                    onSelectText={(id) =>
                      setSelection(
                        id
                          ? {
                              pageId: page.id,
                              pageType: "custom",
                              objectType: "text",
                              objectId: id,
                            }
                          : { pageId: page.id, pageType: "custom", objectType: "page" },
                      )
                    }
                    onUpdateText={(textObject) => updateCustomText(page.id, textObject)}
                    onDeleteText={(textId) => deleteCustomText(page.id, textId)}
                    onSelectPhoto={(id) =>
                      setSelection(
                        id
                          ? {
                              pageId: page.id,
                              pageType: "custom",
                              objectType: "photo",
                              objectId: id,
                            }
                          : { pageId: page.id, pageType: "custom", objectType: "page" },
                      )
                    }
                    onUpdatePhoto={(block) => updateCustomPhoto(page.id, block)}
                  />
                </EditorPageFrame>
              ))}
            </div>
          </section>

          <PhotoPages photos={photos} />
        </div>

        <aside className={panelClass}>
          <section className={sectionClass}>
            <p className={labelClass}>Photobook studio</p>
            <div className="grid gap-2">
              <Button
                type="button"
                className="h-11 rounded-full"
                onClick={saveEditorState}
              >
                <Save className="size-4" />
                Save photobook
              </Button>
              <DownloadPdfButton roomName={roomName} onBeforeDownload={saveEditorState} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className={cn(chipBase, chipIdle, "h-10 justify-center")}
                onClick={addTextPage}
              >
                <Plus className="size-4" />
                Text page
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn(chipBase, chipIdle, "h-10 justify-center")}
                onClick={addPhotoPage}
              >
                <ImagePlus className="size-4" />
                Photo page
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className={cn(chipBase, chipIdle, "h-10 justify-center")}
              onClick={openReorderPanel}
            >
              <GripVertical className="size-4" />
              Reorder pages
            </Button>
          </section>

          {selectedText ? (
            <>
              <section className={sectionClass}>
                <p className={labelClass}>
                  <Type className="size-3" />
                  Selected text
                </p>
                <Input
                  value={selectedText.text}
                  onChange={(event) => {
                    const nextText = event.currentTarget.value;
                    setSelectedTextText(nextText);
                  }}
                  placeholder="Text"
                  className={inputClass}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Drag text on the page. Pull corners to resize. Side handles stretch width.
                </p>
              </section>
              <section className={sectionClass}>
                <p className={labelClass}>
                  <Type className="size-3" />
                  Type
                </p>
                <FontChips
                  selectedFont={selectedText.font}
                  onSelect={(font) => updateSelectedText({ ...selectedText, font })}
                />
              </section>
              <section className={sectionClass}>
                <p className={labelClass}>
                  <Palette className="size-3" />
                  Color
                </p>
                <SwatchGrid
                  selectedColor={selectedText.color}
                  onSelect={(color) => updateSelectedText({ ...selectedText, color })}
                />
              </section>
              <section className={sectionClass}>
                <p className={labelClass}>
                  <Layers className="size-3" />
                  Actions
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(chipBase, chipIdle, "h-10 justify-center")}
                    onClick={resetSelectedText}
                  >
                    Reset
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-full border-destructive/35 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={deleteSelectedText}
                    disabled={selectedText.role === "title"}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                </div>
                {selection.pageId === "cover" ? (
                  <Button
                    type="submit"
                    form={coverFormId}
                    disabled={!isHost}
                    className="h-11 rounded-full"
                    onClick={persistCoverSettings}
                  >
                    Save cover
                  </Button>
                ) : null}
              </section>
            </>
          ) : selectedPhoto ? (
            <>
              <section className={sectionClass}>
                <p className={labelClass}>
                  <ImagePlus className="size-3" />
                  Selected photo
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["contain", "Fit"],
                      ["cover", "Fill"],
                      ["fill", "Stretch"],
                    ] as const
                  ).map(([fit, label]) => (
                    <Button
                      key={fit}
                      type="button"
                      variant="outline"
                      className={cn(
                        chipBase,
                        selectedPhoto.objectFit === fit ? chipSelected : chipIdle,
                      )}
                      onClick={() => updateSelectedPhoto({ ...selectedPhoto, objectFit: fit })}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </section>
              <section className={sectionClass}>
                <p className={labelClass}>
                  <Layers className="size-3" />
                  Layer
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(chipBase, chipIdle, "h-10 justify-center")}
                    onClick={() => moveSelectedPhoto("forward")}
                  >
                    <ArrowUp className="size-4" />
                    Forward
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(chipBase, chipIdle, "h-10 justify-center")}
                    onClick={() => moveSelectedPhoto("backward")}
                  >
                    <ArrowDown className="size-4" />
                    Backward
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-full border-destructive/35 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={deleteSelectedPhoto}
                >
                  <Trash2 className="size-4" />
                  Remove from page
                </Button>
                <p className="text-xs leading-5 text-muted-foreground">
                  This only removes the photo from the photobook page.
                </p>
              </section>
            </>
          ) : (
            <>
              <section className={sectionClass}>
                <p className={labelClass}>
                  <Layers className="size-3" />
                  Selected page
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {selection.pageId === "cover"
                    ? "Cover page"
                    : selection.pageId === "people"
                      ? "People page"
                      : selectedPage?.type === "text"
                        ? "Story page"
                        : "Design page"}
                </p>
              </section>
              {selectedPageControls()}
              <section className={sectionClass}>
                <p className={labelClass}>
                  <Save className="size-3" />
                  Action
                </p>
                {selection.pageId === "cover" ? (
                  <Button
                    type="submit"
                    form={coverFormId}
                    disabled={!isHost}
                    className="h-11 rounded-full"
                    onClick={persistCoverSettings}
                  >
                    Save cover
                  </Button>
                ) : selection.pageId === "people" ? (
                  <Button
                    type="button"
                    className="h-11 rounded-full"
                    onClick={savePeoplePage}
                  >
                    Save page
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="h-11 rounded-full"
                    onClick={saveCustomPages}
                  >
                    Save page
                  </Button>
                )}
                {peopleSaveStatus === "unsaved" && selection.pageId === "people" ? (
                  <p className="text-xs text-muted-foreground">Unsaved changes</p>
                ) : null}
                {peopleSaveStatus === "saved" && selection.pageId === "people" ? (
                  <p className="text-xs text-muted-foreground">Saved</p>
                ) : null}
                {customSaveStatus === "unsaved" && selection.pageType === "custom" ? (
                  <p className="text-xs text-muted-foreground">Unsaved changes</p>
                ) : null}
                {customSaveStatus === "saved" && selection.pageType === "custom" ? (
                  <p className="text-xs text-muted-foreground">Saved</p>
                ) : null}
              </section>
            </>
          )}
        </aside>
      </div>
      <ReorderPagesModal
        open={isReorderOpen}
        coverPhoto={coverPhoto}
        coverOverlay={coverOverlay}
        coverTextObjects={coverTextObjects}
        peopleBackgroundColor={peopleBackgroundColor}
        peopleOverlay={peopleOverlay}
        peopleTextObjects={peopleTextObjects}
        peoplePhotoBlocks={peoplePhotoBlocks}
        customPages={customPages}
        draftOrderedPages={draftOrderedPages}
        draggedPageId={draggedPageId}
        selectedPageId={selectedReorderPageId}
        photosById={photosById}
        onSelectPage={setSelectedReorderPageId}
        onCancel={cancelReorder}
        onReset={resetReorder}
        onSave={savePageOrder}
        onMovePage={moveDraftPage}
        onDragStart={handleReorderDragStart}
        onDragEnd={() => setDraggedPageId(null)}
        onDrop={handleReorderDrop}
      />
      <PhotobookStateExportPages
        coverPhoto={coverPhoto}
        coverOverlay={coverOverlay}
        coverTextObjects={coverTextObjects}
        peopleBackgroundColor={peopleBackgroundColor}
        peopleOverlay={peopleOverlay}
        peopleTextObjects={peopleTextObjects}
        peoplePhotoBlocks={peoplePhotoBlocks}
        customPages={customPages}
        photosById={photosById}
      />
      <CreditPage />
    </>
  );
}

function PageBackgroundControls({
  color,
  overlay,
  onColor,
  onOverlay,
}: {
  color: string;
  overlay: CoverOverlayStyle;
  onColor: (color: string) => void;
  onOverlay: (overlay: CoverOverlayStyle) => void;
}) {
  return (
    <>
      <section className={sectionClass}>
        <p className={labelClass}>
          <Palette className="size-3" />
          Background
        </p>
        <BackgroundSwatches selectedColor={color} onSelect={onColor} />
      </section>
      <section className={sectionClass}>
        <p className={labelClass}>Mood</p>
        <OverlayChips selectedOverlay={overlay} onSelect={onOverlay} />
      </section>
    </>
  );
}

function EditorPageFrame({
  pageNumber,
  title,
  selected,
  children,
  onSelect,
}: {
  pageNumber: string;
  title: string;
  selected: boolean;
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <section
      className={cn(
        "grid gap-4 rounded-[2rem] border bg-card/40 p-4 shadow-[0_20px_70px_rgb(0_0_0_/_0.045)] transition dark:bg-white/[0.018] sm:p-5",
        selected
          ? "border-foreground/28 dark:border-white/20"
          : "border-border/35 dark:border-white/[0.07]",
      )}
      onPointerDown={(event) => {
        const target = event.target instanceof Element ? event.target : null;

        if (!target?.closest("[data-photobook-editable='true']")) {
          onSelect();
        }
      }}
    >
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-muted-foreground/75">
            {pageNumber}
          </p>
          <h2 className="mt-1 text-2xl font-light">{title}</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          {selected ? "Selected" : "Click page to edit"}
        </p>
      </div>
      {children}
    </section>
  );
}
