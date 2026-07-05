"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { flushSync } from "react-dom";
import {
  Copy,
  ImagePlus,
  Layers,
  LayoutTemplate,
  Palette,
  Plus,
  Trash2,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/photobook/download-pdf-button";
import {
  EditableTextBox,
  type PhotobookTextObject,
} from "@/components/photobook/editable-text-box";
import { Input } from "@/components/ui/input";
import type { CoverFont, PhotoAsset } from "@/lib/types";
import { cn } from "@/lib/utils";

type PageLayout =
  | "blank"
  | "single"
  | "split"
  | "grid"
  | "collage"
  | "polaroid"
  | "caption";
type PageKind = "photo" | "text";
type PhotoObjectFit = "cover" | "contain" | "fill";
type ResizeHandle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

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
  type: PageKind;
  backgroundColor: string;
  textColor: string;
  layout: PageLayout;
  title: string;
  caption: string;
  font: CoverFont;
  textObjects: PhotobookTextObject[];
  photoBlocks: PhotoBlock[];
};

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

const textColors = [
  "#ffffff",
  "#050505",
  "#fff4dc",
  "#b8b8b8",
  "#ffc457",
  "#ff8060",
  "#f7b6c8",
  "#b9a7ff",
  "#8fd3ff",
  "#32dcdc",
  "#9ff3d4",
  "#9caf88",
];

const layoutOptions: { value: PageLayout; label: string }[] = [
  { value: "blank", label: "Blank" },
  { value: "single", label: "Single photo" },
  { value: "split", label: "Two photos" },
  { value: "grid", label: "Four grid" },
  { value: "collage", label: "Collage" },
  { value: "polaroid", label: "Polaroid stack" },
  { value: "caption", label: "Photo with caption" },
];

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

const maxPhotosByLayout: Record<PageLayout, number> = {
  blank: 8,
  single: 1,
  split: 2,
  grid: 4,
  collage: 3,
  polaroid: 4,
  caption: 1,
};

const minTextScale = 0.35;
const maxTextScale = 2.8;
const minTextBoxWidth = 0.12;
const maxTextBoxWidth = 0.98;

const studioPanelClass =
  "grid gap-5 rounded-[2rem] border border-border/45 bg-card/90 p-5 shadow-[0_22px_70px_rgb(0_0_0_/_0.055)] backdrop-blur-xl dark:border-white/[0.09] dark:bg-[#050505]/92 dark:shadow-[0_24px_80px_rgb(0_0_0_/_0.34)]";
const studioSectionClass =
  "grid gap-3 border-b border-border/35 pb-5 last:border-b-0 last:pb-0 dark:border-white/[0.08]";
const studioLabelClass =
  "flex items-center gap-2 text-[0.66rem] uppercase tracking-[0.22em] text-muted-foreground/75";
const studioInputClass =
  "h-11 rounded-2xl border-border/50 bg-background/65 px-4 text-sm shadow-none transition-all duration-200 placeholder:text-muted-foreground/45 hover:border-foreground/20 hover:bg-background/80 focus-visible:border-foreground/35 focus-visible:ring-2 focus-visible:ring-foreground/10 focus-visible:ring-offset-0 dark:border-white/[0.09] dark:bg-white/[0.045] dark:hover:border-white/20 dark:hover:bg-white/[0.065]";
const studioPillClass =
  "rounded-full border px-3 text-xs font-normal shadow-none transition-all duration-200 active:scale-[0.98]";
const studioPillSelectedClass =
  "border-foreground/70 bg-foreground text-background hover:bg-foreground/90";
const studioPillIdleClass =
  "border-border/55 bg-background/45 text-muted-foreground hover:border-foreground/25 hover:bg-background/75 hover:text-foreground dark:border-white/[0.09] dark:bg-white/[0.035] dark:hover:border-white/22 dark:hover:bg-white/[0.07]";
const studioIconButtonClass =
  "rounded-full border-border/55 bg-background/45 text-muted-foreground transition-all duration-200 hover:border-foreground/25 hover:bg-background/75 hover:text-foreground active:scale-95 dark:border-white/[0.09] dark:bg-white/[0.035] dark:hover:border-white/22 dark:hover:bg-white/[0.07]";
const studioEmptyClass =
  "rounded-2xl border border-dashed border-border/45 bg-background/35 p-4 text-sm leading-6 text-muted-foreground/75 dark:border-white/[0.08] dark:bg-white/[0.025]";

const layoutFrames: Record<PageLayout, Omit<PhotoBlock, "id" | "photoId">[]> = {
  blank: [],
  single: [{ x: 5, y: 5, width: 90, height: 90, rotation: 0, objectFit: "cover", zIndex: 1 }],
  split: [
    { x: 5, y: 5, width: 43.5, height: 90, rotation: 0, objectFit: "cover", zIndex: 1 },
    { x: 51.5, y: 5, width: 43.5, height: 90, rotation: 0, objectFit: "cover", zIndex: 2 },
  ],
  grid: [
    { x: 5, y: 5, width: 43.5, height: 43.5, rotation: 0, objectFit: "cover", zIndex: 1 },
    { x: 51.5, y: 5, width: 43.5, height: 43.5, rotation: 0, objectFit: "cover", zIndex: 2 },
    { x: 5, y: 51.5, width: 43.5, height: 43.5, rotation: 0, objectFit: "cover", zIndex: 3 },
    { x: 51.5, y: 51.5, width: 43.5, height: 43.5, rotation: 0, objectFit: "cover", zIndex: 4 },
  ],
  collage: [
    { x: 5, y: 5, width: 90, height: 55, rotation: 0, objectFit: "cover", zIndex: 1 },
    { x: 5, y: 63, width: 43.5, height: 32, rotation: 0, objectFit: "cover", zIndex: 2 },
    { x: 51.5, y: 63, width: 43.5, height: 32, rotation: 0, objectFit: "cover", zIndex: 3 },
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

function createClientId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
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

  return {
    id,
    photoId,
    ...frame,
  };
}

function createPage(
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

function clonePages(pages: CustomPage[]) {
  return pages.map((page) => ({
    ...page,
    textObjects: page.textObjects.map((textObject) => ({ ...textObject })),
    photoBlocks: page.photoBlocks.map((block) => ({ ...block })),
  }));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getPhotoUrl(photo: PhotoAsset) {
  return photo.public_url ?? photo.thumbnail_public_url;
}

function getFontClass(font: CoverFont) {
  return fontOptions.find((option) => option.value === font)?.className ?? "font-serif";
}

function isCoverFont(value: unknown): value is CoverFont {
  return fontOptions.some((option) => option.value === value);
}

function normalizeTextObject(
  value: Partial<PhotobookTextObject> | null | undefined,
  fallback: PhotobookTextObject,
): PhotobookTextObject {
  return {
    id: typeof value?.id === "string" && value.id ? value.id : fallback.id,
    text: typeof value?.text === "string" ? value.text : fallback.text,
    role:
      value?.role === "title" ||
      value?.role === "subtitle" ||
      value?.role === "name" ||
      value?.role === "custom"
        ? value.role
        : fallback.role,
    x:
      typeof value?.x === "number" && Number.isFinite(value.x)
        ? clamp(value.x, 0.05, 0.95)
        : fallback.x,
    y:
      typeof value?.y === "number" && Number.isFinite(value.y)
        ? clamp(value.y, 0.05, 0.95)
        : fallback.y,
    width:
      typeof value?.width === "number" && Number.isFinite(value.width)
        ? clamp(value.width, minTextBoxWidth, maxTextBoxWidth)
        : fallback.width,
    scale:
      typeof value?.scale === "number" && Number.isFinite(value.scale)
        ? clamp(value.scale, minTextScale, maxTextScale)
        : fallback.scale,
    font: isCoverFont(value?.font) ? value.font : fallback.font,
    color: typeof value?.color === "string" ? value.color : fallback.color,
  };
}

function createTextObject(
  id: string,
  text = "New text",
  index = 0,
  font: CoverFont = "editorial-serif",
  color = "#ffffff",
): PhotobookTextObject {
  return {
    id,
    text,
    role: "custom",
    x: clamp(0.5 + ((index % 3) - 1) * 0.12, 0.16, 0.84),
    y: clamp(0.68 + Math.floor(index / 3) * 0.08, 0.2, 0.9),
    width: 0.36,
    scale: 0.9,
    font,
    color,
  };
}

function normalizeCustomPage(page: Partial<CustomPage>, fallback: CustomPage): CustomPage {
  const pageType: PageKind = page.type === "text" ? "text" : "photo";
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
      typeof page.backgroundColor === "string"
        ? page.backgroundColor
        : fallback.backgroundColor,
    textColor: typeof page.textColor === "string" ? page.textColor : fallback.textColor,
    layout: layoutOptions.some((option) => option.value === page.layout)
      ? (page.layout as PageLayout)
      : fallback.layout,
    title: typeof page.title === "string" ? page.title : "",
    caption: typeof page.caption === "string" ? page.caption : "",
    font: isCoverFont(page.font) ? page.font : fallback.font,
    textObjects: textObjects.length ? textObjects : legacyTextObjects,
    photoBlocks: pageType === "text"
      ? []
      : Array.isArray(page.photoBlocks)
      ? page.photoBlocks
          .filter((block) => typeof block.photoId === "string" && block.photoId)
          .map((block, index) => ({
            ...createBlock(block.photoId, index, fallback.layout),
            ...block,
            objectFit:
              block.objectFit === "contain" ||
              block.objectFit === "cover" ||
              block.objectFit === "fill"
                ? block.objectFit
                : "cover",
          }))
      : fallback.photoBlocks,
  };
}

function isDarkColor(color: string) {
  const hex = color.replace("#", "");

  if (hex.length !== 6) return true;

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);

  return (red * 299 + green * 587 + blue * 114) / 1000 < 150;
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

function EditablePhotoBlock({
  block,
  photo,
  selected,
  exportCopy,
  onSelect,
  onChange,
}: {
  block: PhotoBlock;
  photo: PhotoAsset | undefined;
  selected: boolean;
  exportCopy: boolean;
  onSelect: () => void;
  onChange: (block: PhotoBlock) => void;
}) {
  const photoUrl = photo ? getPhotoUrl(photo) : null;

  function startInteraction(
    event: React.PointerEvent<HTMLDivElement | HTMLButtonElement>,
    mode: "drag" | ResizeHandle,
  ) {
    if (exportCopy) return;

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
      target.releasePointerCapture(upEvent.pointerId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  return (
    <div
      className={cn(
        "group/photo absolute touch-none select-none overflow-visible",
        !exportCopy && "cursor-grab active:cursor-grabbing",
      )}
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
      <div
        className={cn(
          "relative size-full overflow-hidden rounded-2xl border border-black/[0.08] bg-white/[0.04] dark:border-white/[0.10]",
          block.rotation ? "shadow-[0_18px_40px_rgb(0_0_0_/_0.18)]" : "",
        )}
      >
        {photo && photoUrl ? (
          <Image
            src={photoUrl}
            alt={photo.original_file_name}
            fill
            sizes="(min-width: 1024px) 420px, 90vw"
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

      {selected && !exportCopy ? (
        <div className="photobook-editor-chrome absolute inset-0 pointer-events-none">
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

function PhotobookPageCanvas({
  page,
  photosById,
  selectedBlockId,
  selectedTextId,
  index,
  exportCopy = false,
  className,
  onSelectBlock,
  onUpdateBlock,
  onSelectText,
  onUpdateText,
  onDeleteText,
}: {
  page: CustomPage;
  photosById: Map<string, PhotoAsset>;
  selectedBlockId?: string | null;
  selectedTextId?: string | null;
  index: number;
  exportCopy?: boolean;
  className?: string;
  onSelectBlock?: (blockId: string | null) => void;
  onUpdateBlock?: (block: PhotoBlock) => void;
  onSelectText?: (textId: string | null) => void;
  onUpdateText?: (textObject: PhotobookTextObject) => void;
  onDeleteText?: (textId: string) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const darkBackground = isDarkColor(page.backgroundColor);

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target : null;

    if (!target?.closest("[data-photobook-editable='true']")) {
      onSelectText?.(null);
    }

    onSelectBlock?.(null);
  }

  return (
    <div
      data-photobook-page={exportCopy ? "true" : undefined}
      data-photobook-page-id={exportCopy ? page.id : undefined}
      data-photobook-page-label={
        exportCopy
          ? `${page.type === "text" ? "text" : "photo"} page ${index + 1}`
          : undefined
      }
      data-photobook-page-order={exportCopy ? String(index + 3) : undefined}
      data-photobook-export-copy={exportCopy ? "true" : undefined}
      data-photobook-page-kind={exportCopy ? page.type : undefined}
      data-photobook-editor-canvas="true"
      data-photobook-photo-blocks={
        exportCopy
          ? JSON.stringify(
              page.photoBlocks.map(({ id, x, y, width, height, objectFit, zIndex }) => ({
                id,
                x,
                y,
                width,
                height,
                objectFit,
                zIndex,
              })),
            )
          : undefined
      }
      className={cn(
        "relative mx-auto aspect-[4/5] w-full max-w-[42rem] overflow-hidden rounded-[1.35rem] border shadow-[0_18px_52px_rgb(0_0_0_/_0.10)] dark:shadow-[0_22px_70px_rgb(0_0_0_/_0.42)]",
        !exportCopy && "touch-none",
        darkBackground ? "border-white/[0.10]" : "border-black/[0.10]",
        className,
      )}
      style={{
        backgroundColor: page.backgroundColor,
        color: page.textColor,
      }}
      ref={canvasRef}
      onPointerDown={handleCanvasPointerDown}
    >
      {page.photoBlocks.map((block) => (
        <EditablePhotoBlock
          key={block.id}
          block={block}
          photo={photosById.get(block.photoId)}
          selected={selectedBlockId === block.id}
          exportCopy={exportCopy}
          onSelect={() => onSelectBlock?.(block.id)}
          onChange={(nextBlock) => onUpdateBlock?.(nextBlock)}
        />
      ))}
      {page.textObjects.map((textObject) => (
        <EditableTextBox
          key={textObject.id}
          id={textObject.id}
          canvasRef={canvasRef}
          geometry={textObject}
          selected={selectedTextId === textObject.id}
          editable={!exportCopy}
          color={textObject.color}
          ariaLabel={`Drag ${textObject.text || "text"}`}
          className="z-[1000] rounded-lg p-0"
          chromeRadiusClassName="rounded-lg"
          minScale={minTextScale}
          maxScale={maxTextScale}
          minWidth={minTextBoxWidth}
          maxWidth={maxTextBoxWidth}
          onGeometryChange={(geometry) =>
            onUpdateText?.({
              ...textObject,
              ...geometry,
            })
          }
          onSelect={onSelectText ?? (() => undefined)}
          onDelete={() => onDeleteText?.(textObject.id)}
        >
          <span
            className={cn(
              "block w-full max-w-none whitespace-pre-wrap text-left leading-tight",
              textObject.role === "title"
                ? "text-4xl md:text-5xl"
                : "text-xl md:text-2xl",
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

function PhotobookCreditPage({ order }: { order: number }) {
  return (
    <div
      data-photobook-page="true"
      data-photobook-page-id="credit"
      data-photobook-page-label="credit page"
      data-photobook-page-order={String(order)}
      data-photobook-page-kind="credit"
      data-photobook-export-copy="true"
      className="photobook-credit-page mx-auto grid aspect-[4/5] w-[34rem] overflow-hidden rounded-[1.35rem] border border-black/[0.10] bg-[#ffffff] text-[#050505] shadow-[0_18px_52px_rgb(0_0_0_/_0.10)] dark:border-white/[0.10] dark:bg-[#050505] dark:text-[#f7efe0]"
    >
      <div className="grid justify-items-center gap-3 text-center">
        <p className="text-sm uppercase tracking-[0.24em] text-[#737373] dark:text-[#a3a3a3]">
          made with
        </p>
        <p className="font-brand text-6xl leading-none text-current md:text-7xl">ClaY.</p>
        <p className="font-byline text-2xl leading-none text-[#737373] dark:text-[#cfc7ba]">
          by tharun
        </p>
      </div>
    </div>
  );
}

export function CustomPhotobookEditor({
  photos,
  roomName,
  photobookId,
}: {
  photos: PhotoAsset[];
  roomName: string;
  photobookId: string;
}) {
  const [pages, setPages] = useState<CustomPage[]>(() => [createPage(0, photos)]);
  const [savedPages, setSavedPages] = useState<CustomPage[]>(() => [
    createPage(0, photos),
  ]);
  const [selectedPageId, setSelectedPageId] = useState(() => pages[0]?.id ?? "");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved",
  );
  const hasLoadedPagesRef = useRef(false);
  const storageKey = `clay-custom-pages:${photobookId}`;
  const selectedIndex = Math.max(
    0,
    pages.findIndex((page) => page.id === selectedPageId),
  );
  const selectedPage = pages[selectedIndex] ?? pages[0];
  const photosById = useMemo(
    () => new Map(photos.map((photo) => [photo.id, photo])),
    [photos],
  );
  const selectedBlock =
    selectedPage?.photoBlocks.find((block) => block.id === selectedBlockId) ?? null;
  const selectedTextObject =
    selectedPage?.textObjects.find((textObject) => textObject.id === selectedTextId) ??
    null;

  useEffect(() => {
    const savedDraft = localStorage.getItem(storageKey);

    if (savedDraft) {
      try {
        const parsedDraft: unknown = JSON.parse(savedDraft);
        const pagesValue =
          parsedDraft &&
          typeof parsedDraft === "object" &&
          Array.isArray((parsedDraft as { pages?: unknown }).pages)
            ? (parsedDraft as { pages: Partial<CustomPage>[] }).pages
            : null;

        if (pagesValue?.length) {
          const normalizedPages = pagesValue.map((page, index) =>
            normalizeCustomPage(page, createPage(index, photos)),
          );

          queueMicrotask(() => {
            setPages(normalizedPages);
            setSavedPages(clonePages(normalizedPages));
            setSelectedPageId(normalizedPages[0]?.id ?? "");
            setSelectedBlockId(null);
            setSelectedTextId(null);
            hasLoadedPagesRef.current = true;
            setHasUnsavedChanges(false);
            setSaveStatus("saved");
          });
          return;
        }
      } catch {
        localStorage.removeItem(storageKey);
      }
    }

    queueMicrotask(() => {
      hasLoadedPagesRef.current = true;
      setHasUnsavedChanges(false);
      setSaveStatus("saved");
    });
  }, [photos, storageKey]);

  function markUnsaved() {
    if (hasLoadedPagesRef.current) {
      setHasUnsavedChanges(true);
      setSaveStatus("unsaved");
    }
  }

  async function savePhotobook({ quiet = false }: { quiet?: boolean } = {}) {
    if (!quiet) {
      setSaveStatus("saving");
    }

    await Promise.resolve();

    const snapshot = clonePages(pages);

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 1,
        pages: snapshot,
      }),
    );

    flushSync(() => {
      setSavedPages(snapshot);
      setHasUnsavedChanges(false);
      setSaveStatus("saved");
    });
  }

  async function saveBeforeDownload() {
    if (hasUnsavedChanges) {
      await savePhotobook({ quiet: true });
    }
  }

  function updateSelectedPage(updater: (page: CustomPage) => CustomPage) {
    markUnsaved();
    setPages((currentPages) =>
      currentPages.map((page) => (page.id === selectedPage.id ? updater(page) : page)),
    );
  }

  function updateTextObject(nextTextObject: PhotobookTextObject) {
    updateSelectedPage((page) => ({
      ...page,
      textObjects: page.textObjects.map((textObject) =>
        textObject.id === nextTextObject.id ? nextTextObject : textObject,
      ),
    }));
  }

  function addTextBox() {
    const id = createClientId("custom-text");
    const textObject = createTextObject(
      id,
      "New text",
      selectedPage.textObjects.length,
      selectedTextObject?.font ?? selectedPage.font,
      selectedTextObject?.color ?? selectedPage.textColor,
    );

    updateSelectedPage((page) => ({
      ...page,
      textObjects: [...page.textObjects, textObject],
    }));
    setSelectedTextId(id);
    setSelectedBlockId(null);
  }

  function deleteSelectedText() {
    if (!selectedTextObject) return;

    updateSelectedPage((page) => ({
      ...page,
      textObjects: page.textObjects.filter(
        (textObject) => textObject.id !== selectedTextObject.id,
      ),
    }));
    setSelectedTextId(null);
  }

  function resetSelectedText() {
    if (!selectedTextObject) return;

    updateTextObject({
      ...selectedTextObject,
      x: 0.5,
      y: 0.5,
      width: selectedPage.type === "text" ? 0.65 : 0.42,
      scale: 1,
    });
  }

  function resetPageTextLayout() {
    updateSelectedPage((page) => ({
      ...page,
      textObjects: page.textObjects.map((textObject, index) => ({
        ...textObject,
        x: clamp(0.5 + ((index % 3) - 1) * 0.12, 0.16, 0.84),
        y: clamp(0.5 + Math.floor(index / 3) * 0.1, 0.16, 0.9),
        width: textObject.role === "title" ? 0.68 : 0.42,
        scale: 1,
      })),
    }));
    setSelectedTextId(selectedPage.textObjects[0]?.id ?? null);
    setSelectedBlockId(null);
  }

  function updateBlock(nextBlock: PhotoBlock) {
    updateSelectedPage((page) => ({
      ...page,
      photoBlocks: page.photoBlocks.map((block) =>
        block.id === nextBlock.id ? nextBlock : block,
      ),
    }));
  }

  function addBlankPage() {
    markUnsaved();
    const nextPage = createPage(pages.length, [], createClientId("custom-page"));

    nextPage.layout = "blank";
    nextPage.photoBlocks = [];
    setPages((currentPages) => [...currentPages, nextPage]);
    setSelectedPageId(nextPage.id);
    setSelectedBlockId(null);
    setSelectedTextId(null);
  }

  function addTextPage() {
    markUnsaved();
    const nextPage = createTextPage(pages.length, createClientId("custom-text-page"));
    const firstTextId = nextPage.textObjects[0]?.id ?? null;

    setPages((currentPages) => [...currentPages, nextPage]);
    setSelectedPageId(nextPage.id);
    setSelectedBlockId(null);
    setSelectedTextId(firstTextId);
  }

  function duplicateSelectedPage() {
    markUnsaved();
    const duplicatePageId = createClientId("custom-page");
    const duplicate = {
      ...selectedPage,
      id: duplicatePageId,
      photoBlocks: selectedPage.photoBlocks.map((block, index) => ({
        ...block,
        id: `${duplicatePageId}-photo-block-${index + 1}-${block.photoId}`,
      })),
      textObjects: selectedPage.textObjects.map((textObject, index) => ({
        ...textObject,
        id: `${duplicatePageId}-text-${index + 1}`,
      })),
    };

    setPages((currentPages) => [
      ...currentPages.slice(0, selectedIndex + 1),
      duplicate,
      ...currentPages.slice(selectedIndex + 1),
    ]);
    setSelectedPageId(duplicate.id);
    setSelectedBlockId(null);
    setSelectedTextId(null);
  }

  function deleteSelectedPage() {
    markUnsaved();

    if (pages.length === 1) {
      const nextPage = createPage(0, [], "custom-page-1");

      nextPage.layout = "blank";
      nextPage.photoBlocks = [];
      setPages([nextPage]);
      setSelectedPageId(nextPage.id);
      setSelectedBlockId(null);
      setSelectedTextId(null);
      return;
    }

    const nextPages = pages.filter((page) => page.id !== selectedPage.id);

    setPages(nextPages);
    setSelectedPageId(nextPages[Math.max(0, selectedIndex - 1)]?.id ?? nextPages[0].id);
    setSelectedBlockId(null);
    setSelectedTextId(null);
  }

  function moveSelectedPage(direction: -1 | 1) {
    const nextIndex = selectedIndex + direction;

    if (nextIndex < 0 || nextIndex >= pages.length) return;

    markUnsaved();
    setPages((currentPages) => {
      const nextPages = [...currentPages];
      const [page] = nextPages.splice(selectedIndex, 1);

      nextPages.splice(nextIndex, 0, page);
      return nextPages;
    });
  }

  function addPhoto(photoId: string) {
    setSelectedTextId(null);
    updateSelectedPage((page) => {
      const nextBlock = createBlock(
        photoId,
        page.photoBlocks.length,
        page.layout,
        createClientId("photo-block"),
      );
      const maxZ = Math.max(0, ...page.photoBlocks.map((block) => block.zIndex));

      nextBlock.zIndex = maxZ + 1;

      return {
        ...page,
        layout: page.layout === "blank" ? "single" : page.layout,
        photoBlocks: [...page.photoBlocks, nextBlock],
      };
    });
  }

  function setLayout(layout: PageLayout) {
    updateSelectedPage((page) => ({
      ...page,
      layout,
      photoBlocks: arrangeBlocks(page.photoBlocks, layout),
    }));
    setSelectedBlockId(null);
    setSelectedTextId(null);
  }

  function deleteSelectedPhoto() {
    if (!selectedBlock) return;

    updateSelectedPage((page) => ({
      ...page,
      photoBlocks: page.photoBlocks.filter((block) => block.id !== selectedBlock.id),
    }));
    setSelectedBlockId(null);
  }

  function changeSelectedPhotoFit(objectFit: PhotoObjectFit) {
    if (!selectedBlock) return;

    updateBlock({ ...selectedBlock, objectFit });
  }

  function changeSelectedPhotoLayer(direction: "forward" | "backward") {
    if (!selectedBlock) return;

    const sortedBlocks = [...selectedPage.photoBlocks].sort(
      (first, second) => first.zIndex - second.zIndex,
    );
    const index = sortedBlocks.findIndex((block) => block.id === selectedBlock.id);
    const swapIndex = direction === "forward" ? index + 1 : index - 1;

    if (swapIndex < 0 || swapIndex >= sortedBlocks.length) return;

    const swapBlock = sortedBlocks[swapIndex];
    const nextZIndex = swapBlock.zIndex;
    const swapZIndex = selectedBlock.zIndex;

    updateSelectedPage((page) => ({
      ...page,
      photoBlocks: page.photoBlocks.map((block) => {
        if (block.id === selectedBlock.id) return { ...block, zIndex: nextZIndex };
        if (block.id === swapBlock.id) return { ...block, zIndex: swapZIndex };
        return block;
      }),
    }));
  }

  if (!selectedPage) return null;

  return (
    <section className="grid gap-8">
      <div className="flex flex-col justify-between gap-5 rounded-[2rem] border border-border/40 bg-card/55 p-5 shadow-[0_18px_60px_rgb(0_0_0_/_0.04)] backdrop-blur-xl dark:border-white/[0.07] dark:bg-white/[0.025] dark:shadow-[0_20px_72px_rgb(0_0_0_/_0.22)] sm:flex-row sm:items-end">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-muted-foreground/75">
            Story pages
          </p>
          <h2 className="mt-2 text-2xl font-light">Custom pages</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Add text pages for poems, dedications, quotes, or story notes, and
            keep photo pages for the images you want to design by hand.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {saveStatus === "saving"
              ? "Saving..."
              : hasUnsavedChanges
                ? "Unsaved changes"
                : "Saved"}
          </span>
          <Button
            type="button"
            variant={hasUnsavedChanges ? "default" : "outline"}
            className={cn(
              "h-10 rounded-full px-5 transition-all duration-200 active:scale-[0.98]",
              hasUnsavedChanges ? "" : studioPillIdleClass,
            )}
            onClick={() => void savePhotobook()}
            disabled={!hasUnsavedChanges || saveStatus === "saving"}
          >
            {saveStatus === "saving" ? "Saving..." : "Save photobook"}
          </Button>
          <DownloadPdfButton
            roomName={roomName}
            onBeforeDownload={saveBeforeDownload}
            disabled={saveStatus === "saving"}
          />
          <Button
            type="button"
            variant="outline"
            className={cn("h-10 rounded-full px-4", studioPillIdleClass)}
            onClick={addBlankPage}
          >
            <Plus className="size-4" />
            Add photo page
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn("h-10 rounded-full px-4", studioPillIdleClass)}
            onClick={addTextPage}
          >
            <Type className="size-4" />
            Add text page
          </Button>
        </div>
      </div>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start xl:gap-14">
        <div className="grid min-w-0 gap-4">
          <div className="grid min-h-[72vh] place-items-center rounded-[2rem] border border-border/45 bg-card/35 p-4 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.20),0_20px_80px_rgb(0_0_0_/_0.045)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.018] dark:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.035),0_24px_84px_rgb(0_0_0_/_0.28)] sm:p-6 xl:p-8">
            <PhotobookPageCanvas
              page={selectedPage}
              photosById={photosById}
              selectedBlockId={selectedBlockId}
              selectedTextId={selectedTextId}
              index={selectedIndex}
              onSelectBlock={(blockId) => {
                setSelectedBlockId(blockId);
                if (blockId) setSelectedTextId(null);
              }}
              onUpdateBlock={updateBlock}
              onSelectText={(textId) => {
                setSelectedTextId(textId);
                if (textId) setSelectedBlockId(null);
              }}
              onUpdateText={updateTextObject}
              onDeleteText={(textId) => {
                updateSelectedPage((page) => ({
                  ...page,
                  textObjects: page.textObjects.filter(
                    (textObject) => textObject.id !== textId,
                  ),
                }));
                setSelectedTextId(null);
              }}
            />
          </div>

          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {pages.map((page, index) => {
              const isSelected = page.id === selectedPage.id;
              const firstBlock = page.photoBlocks[0];
              const thumbnailPhoto = firstBlock ? photosById.get(firstBlock.photoId) : null;
              const thumbnailUrl = thumbnailPhoto ? getPhotoUrl(thumbnailPhoto) : null;
              const firstText = page.textObjects[0]?.text?.trim();

              return (
                <button
                  key={page.id}
                  type="button"
                  className={cn(
                    "group grid w-28 shrink-0 gap-2 rounded-2xl border p-2 text-left shadow-[0_10px_30px_rgb(0_0_0_/_0.035)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgb(0_0_0_/_0.06)] dark:shadow-[0_12px_34px_rgb(0_0_0_/_0.24)]",
                    isSelected
                      ? "border-foreground/80 bg-foreground text-background"
                      : "border-border/55 bg-card/75 text-foreground hover:border-foreground/25 dark:border-white/[0.08] dark:bg-white/[0.035] dark:hover:border-white/20",
                  )}
                  onClick={() => {
                    setSelectedPageId(page.id);
                    setSelectedBlockId(null);
                    setSelectedTextId(null);
                  }}
                >
                  <span
                    className="relative aspect-[4/5] overflow-hidden rounded-xl border border-black/[0.08] dark:border-white/[0.08]"
                    style={{ backgroundColor: page.backgroundColor }}
                  >
                    {thumbnailPhoto && thumbnailUrl ? (
                      <Image
                        src={thumbnailUrl}
                        alt=""
                        fill
                        sizes="112px"
                        className="object-cover opacity-80"
                        crossOrigin="anonymous"
                        unoptimized
                      />
                    ) : firstText ? (
                      <span
                        className="absolute inset-2 flex items-center justify-center text-center text-[0.62rem] leading-tight opacity-75"
                        style={{ color: page.textObjects[0]?.color ?? page.textColor }}
                      >
                        {firstText}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs">
                    Page {index + 3} · {page.type === "text" ? "Text" : "Photo"}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              className="grid w-28 shrink-0 place-items-center rounded-2xl border border-border/55 bg-card/55 p-2 text-sm text-muted-foreground shadow-[0_10px_30px_rgb(0_0_0_/_0.035)] transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/25 hover:bg-card hover:text-foreground dark:border-white/[0.08] dark:bg-white/[0.025] dark:hover:border-white/20 dark:hover:bg-white/[0.05]"
              onClick={addBlankPage}
            >
              <span className="grid aspect-[4/5] w-full place-items-center rounded-xl border border-dashed border-border/45 bg-background/45 dark:border-white/[0.08] dark:bg-white/[0.025]">
                <Plus className="size-5" />
              </span>
              + Photo
            </button>
            <button
              type="button"
              className="grid w-28 shrink-0 place-items-center rounded-2xl border border-border/55 bg-card/55 p-2 text-sm text-muted-foreground shadow-[0_10px_30px_rgb(0_0_0_/_0.035)] transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/25 hover:bg-card hover:text-foreground dark:border-white/[0.08] dark:bg-white/[0.025] dark:hover:border-white/20 dark:hover:bg-white/[0.05]"
              onClick={addTextPage}
            >
              <span className="grid aspect-[4/5] w-full place-items-center rounded-xl border border-dashed border-border/45 bg-background/45 dark:border-white/[0.08] dark:bg-white/[0.025]">
                <Type className="size-5" />
              </span>
              + Text
            </button>
          </div>
        </div>

        <aside
          className={cn(
            studioPanelClass,
            "[scrollbar-width:none] xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto [&::-webkit-scrollbar]:hidden",
          )}
        >
          <div className={studioSectionClass}>
            <div className="flex items-center justify-between gap-3">
            <div>
              <p className={studioLabelClass}>
                Selected page
              </p>
              <h3 className="mt-1 text-lg font-light">
                Page {selectedIndex + 3} · {selectedPage.type === "text" ? "Text" : "Photo"}
              </h3>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn("size-9", studioIconButtonClass)}
                onClick={() => moveSelectedPage(-1)}
                disabled={selectedIndex === 0}
                aria-label="Move page left"
              >
                <span aria-hidden="true">←</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn("size-9", studioIconButtonClass)}
                onClick={() => moveSelectedPage(1)}
                disabled={selectedIndex === pages.length - 1}
                aria-label="Move page right"
              >
                <span aria-hidden="true">→</span>
              </Button>
            </div>
            </div>
          </div>

          {selectedBlock ? (
            <div className={studioSectionClass}>
              <span className={studioLabelClass}>
                <Layers className="size-4" />
                Selected photo
              </span>
              <div className="flex flex-wrap gap-2">
                {(["contain", "cover", "fill"] as PhotoObjectFit[]).map((fit) => (
                  <Button
                    key={fit}
                    type="button"
                    variant={selectedBlock.objectFit === fit ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      studioPillClass,
                      "h-9 capitalize",
                      selectedBlock.objectFit === fit
                        ? studioPillSelectedClass
                        : studioPillIdleClass,
                    )}
                    onClick={() => changeSelectedPhotoFit(fit)}
                  >
                    {fit === "contain" ? "Fit" : fit === "cover" ? "Fill" : "Stretch"}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(studioPillClass, "h-9", studioPillIdleClass)}
                  onClick={() => changeSelectedPhotoLayer("forward")}
                >
                  Bring forward
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(studioPillClass, "h-9", studioPillIdleClass)}
                  onClick={() => changeSelectedPhotoLayer("backward")}
                >
                  Send backward
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    studioPillClass,
                    "h-9 border-red-500/25 text-red-500 hover:border-red-500/45 hover:bg-red-500/10",
                  )}
                  onClick={deleteSelectedPhoto}
                >
                  <Trash2 className="size-4" />
                  Delete photo
                </Button>
              </div>
            </div>
          ) : null}

          <div className={studioSectionClass}>
            <span className={studioLabelClass}>
              <Palette className="size-4" />
              Page background
            </span>
            <div className="flex flex-wrap gap-2.5">
              {backgroundColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Use background ${color}`}
                  className={cn(
                    "size-7 rounded-full border shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.18),0_3px_12px_rgb(0_0_0_/_0.08)] transition-all duration-200 hover:scale-105",
                    selectedPage.backgroundColor === color
                      ? "border-foreground ring-2 ring-foreground/20 ring-offset-2 ring-offset-background"
                      : "border-border/60 hover:border-foreground/40",
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() =>
                    updateSelectedPage((page) => ({ ...page, backgroundColor: color }))
                  }
                />
              ))}
              <label className="grid size-7 cursor-pointer place-items-center rounded-full border border-border/60 bg-[conic-gradient(from_90deg,#ff5b69,#ffc457,#32dcdc,#b9a7ff,#ff5b69)] transition-all duration-200 hover:scale-105 hover:border-foreground/40">
                <input
                  type="color"
                  value={selectedPage.backgroundColor}
                  className="sr-only"
                  onChange={(event) => {
                    const nextColor = event.currentTarget.value;

                    updateSelectedPage((page) => ({
                      ...page,
                      backgroundColor: nextColor,
                    }));
                  }}
                />
              </label>
            </div>
          </div>

          {selectedPage.type === "photo" ? (
            <>
              <div className={studioSectionClass}>
                <span className={studioLabelClass}>
                  <LayoutTemplate className="size-4" />
                  Layout
                </span>
                <div className="flex flex-wrap gap-2">
                  {layoutOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={selectedPage.layout === option.value ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        studioPillClass,
                        "h-9",
                        selectedPage.layout === option.value
                          ? studioPillSelectedClass
                          : studioPillIdleClass,
                      )}
                      onClick={() => setLayout(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className={studioSectionClass}>
                <span className={studioLabelClass}>
                  <ImagePlus className="size-4" />
                  Add photo
                </span>
                {photos.length > 0 ? (
                  <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {photos.map((photo) => {
                      const photoUrl = photo.thumbnail_public_url ?? photo.public_url;

                      return (
                        <button
                          key={photo.id}
                          type="button"
                          className="relative aspect-square overflow-hidden rounded-xl border border-border/45 bg-muted/45 shadow-[0_8px_24px_rgb(0_0_0_/_0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/30 dark:border-white/[0.08] dark:bg-white/[0.035] dark:hover:border-white/22"
                          onClick={() => addPhoto(photo.id)}
                        >
                          {photoUrl ? (
                            <Image
                              src={photoUrl}
                              alt={photo.original_file_name}
                              fill
                              sizes="96px"
                              className="object-cover"
                              crossOrigin="anonymous"
                              unoptimized
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className={studioEmptyClass}>
                    Upload room photos first, then add them to your pages here.
                  </p>
                )}
              </div>
            </>
          ) : null}

          <div className={studioSectionClass}>
            <span className={studioLabelClass}>
              <Type className="size-4" />
              Text boxes
            </span>
            <Button
              type="button"
              variant="outline"
              className={cn("h-10 w-fit rounded-full px-4", studioPillIdleClass)}
              onClick={addTextBox}
            >
              + Add text box
            </Button>
            {selectedTextObject ? (
              <div className="grid gap-3 rounded-2xl border border-border/30 bg-background/45 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
                <Input
                  value={selectedTextObject.text}
                  placeholder="Text"
                  className={studioInputClass}
                  onChange={(event) => {
                    const nextText = event.currentTarget.value;

                    updateTextObject({
                      ...selectedTextObject,
                      text: nextText,
                    });
                  }}
                />
                <div className="flex items-center justify-between gap-3">
                  <Button
                  type="button"
                  variant="outline"
                  size="icon"
                    className={cn("size-8", studioIconButtonClass)}
                  aria-label="Decrease selected text size"
                    onClick={() =>
                      updateTextObject({
                        ...selectedTextObject,
                        scale: clamp(
                          Number((selectedTextObject.scale - 0.1).toFixed(1)),
                          minTextScale,
                          maxTextScale,
                        ),
                      })
                    }
                  >
                    -
                  </Button>
                  <span className="min-w-16 text-center text-sm text-muted-foreground">
                    {Math.round(selectedTextObject.scale * 100)}%
                  </span>
                  <Button
                  type="button"
                  variant="outline"
                  size="icon"
                    className={cn("size-8", studioIconButtonClass)}
                  aria-label="Increase selected text size"
                    onClick={() =>
                      updateTextObject({
                        ...selectedTextObject,
                        scale: clamp(
                          Number((selectedTextObject.scale + 0.1).toFixed(1)),
                          minTextScale,
                          maxTextScale,
                        ),
                      })
                    }
                  >
                    +
                  </Button>
                </div>
              </div>
            ) : (
              <p className={studioEmptyClass}>
                Add a text box or select one on the page to edit its words, font,
                and color.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {fontOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={
                    selectedTextObject?.font === option.value ? "default" : "outline"
                  }
                  size="sm"
                  className={cn(
                    studioPillClass,
                    "h-9",
                    selectedTextObject?.font === option.value
                      ? studioPillSelectedClass
                      : studioPillIdleClass,
                    option.className,
                  )}
                  onClick={() => {
                    if (!selectedTextObject) return;

                    updateTextObject({
                      ...selectedTextObject,
                      font: option.value,
                    });
                  }}
                  disabled={!selectedTextObject}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {textColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Use text color ${color}`}
                  className={cn(
                    "size-7 rounded-full border shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.18),0_3px_12px_rgb(0_0_0_/_0.08)] transition-all duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-45",
                    selectedTextObject?.color === color
                      ? "border-foreground ring-2 ring-foreground/20 ring-offset-2 ring-offset-background"
                      : "border-border/60 hover:border-foreground/40",
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    if (!selectedTextObject) return;

                    updateTextObject({
                      ...selectedTextObject,
                      color,
                    });
                  }}
                  disabled={!selectedTextObject}
                />
              ))}
              <label className="grid size-7 cursor-pointer place-items-center rounded-full border border-border/60 bg-[conic-gradient(from_90deg,#ff5b69,#ffc457,#32dcdc,#b9a7ff,#ff5b69)] transition-all duration-200 hover:scale-105 hover:border-foreground/40">
                <input
                  type="color"
                  value={selectedTextObject?.color ?? selectedPage.textColor}
                  className="sr-only"
                  onChange={(event) => {
                    if (!selectedTextObject) return;

                    const nextColor = event.currentTarget.value;

                    updateTextObject({
                      ...selectedTextObject,
                      color: nextColor,
                    });
                  }}
                  disabled={!selectedTextObject}
                />
              </label>
            </div>
            {selectedTextObject ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  studioPillClass,
                  "w-fit border-red-500/25 text-red-500 hover:border-red-500/45 hover:bg-red-500/10",
                )}
                onClick={deleteSelectedText}
              >
                Delete text box
              </Button>
            ) : null}
          </div>

          <div className={studioSectionClass}>
            <span className={studioLabelClass}>
              Placement
            </span>
            <div className="rounded-2xl border border-border/30 bg-background/45 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
              <p className="text-sm leading-6 text-muted-foreground/90">
                Drag text on the page. Pull corners to resize. Side handles
                stretch width.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(studioPillClass, "h-9", studioPillIdleClass)}
                  onClick={resetSelectedText}
                  disabled={!selectedTextObject}
                >
                  Reset selected text
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(studioPillClass, "h-9", studioPillIdleClass)}
                  onClick={resetPageTextLayout}
                  disabled={selectedPage.textObjects.length === 0}
                >
                  Reset page layout
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <span className={studioLabelClass}>
              Action
            </span>
            <div className="grid gap-2">
              <Button
                type="button"
                variant={hasUnsavedChanges ? "default" : "outline"}
                className={cn(
                  "h-11 w-full rounded-full transition-all duration-200 active:scale-[0.99]",
                  hasUnsavedChanges ? "" : studioPillIdleClass,
                )}
                onClick={() => void savePhotobook()}
                disabled={!hasUnsavedChanges || saveStatus === "saving"}
              >
                {saveStatus === "saving" ? "Saving..." : "Save page"}
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(studioPillClass, "h-9", studioPillIdleClass)}
                  onClick={duplicateSelectedPage}
                >
                  <Copy className="size-4" />
                  Duplicate
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    studioPillClass,
                    "h-9 border-red-500/25 text-red-500 hover:border-red-500/45 hover:bg-red-500/10",
                  )}
                  onClick={deleteSelectedPage}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-[-10000px] top-0 grid w-[34rem] gap-8 opacity-100"
      >
        {savedPages.map((page, index) => (
          <PhotobookPageCanvas
            key={page.id}
            page={page}
            photosById={photosById}
            index={index}
            exportCopy
            className="w-[34rem]"
          />
        ))}
        <PhotobookCreditPage order={savedPages.length + 3} />
      </div>
    </section>
  );
}
