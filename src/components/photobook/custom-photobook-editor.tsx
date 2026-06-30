"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
type TextPosition = "top" | "center" | "bottom";
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
  backgroundColor: string;
  textColor: string;
  layout: PageLayout;
  title: string;
  caption: string;
  font: CoverFont;
  textPosition: TextPosition;
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
    backgroundColor: "#050505",
    textColor: "#ffffff",
    layout,
    title: "",
    caption: "",
    font: "editorial-serif",
    textPosition: "bottom",
    photoBlocks: firstPhotoId
      ? [createBlock(firstPhotoId, 0, layout, `${id}-photo-block-1-${firstPhotoId}`)]
      : [],
  };
}

function clonePages(pages: CustomPage[]) {
  return pages.map((page) => ({
    ...page,
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

function getTextPositionClass(position: TextPosition) {
  const classes: Record<TextPosition, string> = {
    top: "justify-start",
    center: "justify-center",
    bottom: "justify-end",
  };

  return classes[position];
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
        !exportCopy && "cursor-move",
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
          "relative size-full overflow-hidden rounded-2xl border bg-white/8",
          block.rotation ? "shadow-[0_18px_40px_rgb(0_0_0_/_0.22)]" : "",
          selected && !exportCopy
            ? "border-white ring-2 ring-black/45 dark:ring-white/45"
            : "border-white/14",
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
          {(["nw", "ne", "sw", "se", "n", "s", "e", "w"] as ResizeHandle[]).map(
            (handle) => (
              <button
                key={handle}
                type="button"
                aria-label={`Resize ${handle}`}
                className={cn(
                  "pointer-events-auto absolute size-3 rounded-full border border-black bg-white shadow-sm",
                  handle === "nw" && "-left-1.5 -top-1.5 cursor-nwse-resize",
                  handle === "ne" && "-right-1.5 -top-1.5 cursor-nesw-resize",
                  handle === "sw" && "-bottom-1.5 -left-1.5 cursor-nesw-resize",
                  handle === "se" && "-bottom-1.5 -right-1.5 cursor-nwse-resize",
                  handle === "n" &&
                    "left-1/2 -top-1.5 -translate-x-1/2 cursor-ns-resize",
                  handle === "s" &&
                    "bottom-[-0.375rem] left-1/2 -translate-x-1/2 cursor-ns-resize",
                  handle === "e" &&
                    "right-[-0.375rem] top-1/2 -translate-y-1/2 cursor-ew-resize",
                  handle === "w" &&
                    "left-[-0.375rem] top-1/2 -translate-y-1/2 cursor-ew-resize",
                )}
                onPointerDown={(event) => startInteraction(event, handle)}
              />
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
  index,
  exportCopy = false,
  className,
  onSelectBlock,
  onUpdateBlock,
}: {
  page: CustomPage;
  photosById: Map<string, PhotoAsset>;
  selectedBlockId?: string | null;
  index: number;
  exportCopy?: boolean;
  className?: string;
  onSelectBlock?: (blockId: string | null) => void;
  onUpdateBlock?: (block: PhotoBlock) => void;
}) {
  const fontClass = getFontClass(page.font);
  const darkBackground = isDarkColor(page.backgroundColor);

  return (
    <div
      data-photobook-page={exportCopy ? "true" : undefined}
      data-photobook-page-id={exportCopy ? page.id : undefined}
      data-photobook-page-label={exportCopy ? `photo page ${index + 1}` : undefined}
      data-photobook-page-order={exportCopy ? String(index + 3) : undefined}
      data-photobook-export-copy={exportCopy ? "true" : undefined}
      data-photobook-page-kind={exportCopy ? "custom" : undefined}
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
        "relative mx-auto aspect-[4/5] w-full max-w-[34rem] overflow-hidden rounded-[1.25rem] border shadow-[0_28px_90px_rgb(0_0_0_/_0.16)]",
        !exportCopy && "touch-none",
        darkBackground ? "border-white/14" : "border-black/10",
        className,
      )}
      style={{
        backgroundColor: page.backgroundColor,
        color: page.textColor,
      }}
      onPointerDown={() => onSelectBlock?.(null)}
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
      <div
        className={cn(
          "pointer-events-none relative z-[1000] flex h-full flex-col p-8 md:p-12",
          getTextPositionClass(page.textPosition),
        )}
      >
        <div
          className={cn(
            "max-w-[88%]",
            page.textPosition === "center" ? "self-center text-center" : "",
            page.textPosition === "bottom" ? "mt-auto" : "",
          )}
        >
          {page.title ? (
            <h3 className={cn("text-4xl leading-none md:text-5xl", fontClass)}>
              {page.title}
            </h3>
          ) : null}
          {page.caption ? (
            <p className="mt-4 max-w-md text-sm leading-6 opacity-85 md:text-base">
              {page.caption}
            </p>
          ) : null}
        </div>
      </div>
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
      className="photobook-credit-page mx-auto grid aspect-[4/5] w-[34rem] overflow-hidden rounded-[1.25rem] border border-black/10 bg-[#ffffff] text-[#050505] shadow-[0_28px_90px_rgb(0_0_0_/_0.12)] dark:border-white/14 dark:bg-[#050505] dark:text-[#f7efe0]"
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
}: {
  photos: PhotoAsset[];
  roomName: string;
}) {
  const [pages, setPages] = useState<CustomPage[]>(() => [createPage(0, photos)]);
  const [savedPages, setSavedPages] = useState<CustomPage[]>(() => [
    createPage(0, photos),
  ]);
  const [selectedPageId, setSelectedPageId] = useState(() => pages[0]?.id ?? "");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved",
  );
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

  function markUnsaved() {
    setHasUnsavedChanges(true);
    setSaveStatus("unsaved");
  }

  async function savePhotobook({ quiet = false }: { quiet?: boolean } = {}) {
    if (!quiet) {
      setSaveStatus("saving");
    }

    await Promise.resolve();

    const snapshot = clonePages(pages);

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
    };

    setPages((currentPages) => [
      ...currentPages.slice(0, selectedIndex + 1),
      duplicate,
      ...currentPages.slice(selectedIndex + 1),
    ]);
    setSelectedPageId(duplicate.id);
    setSelectedBlockId(null);
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
      return;
    }

    const nextPages = pages.filter((page) => page.id !== selectedPage.id);

    setPages(nextPages);
    setSelectedPageId(nextPages[Math.max(0, selectedIndex - 1)]?.id ?? nextPages[0].id);
    setSelectedBlockId(null);
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
    <section className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Step 3 · Custom pages
          </p>
          <h2 className="mt-2 text-2xl">Build your pages</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Add blank pages, choose colors, drag photos into place, and resize them
            until the memory feels right.
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
            className="rounded-full"
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
          <Button type="button" variant="outline" className="rounded-full" onClick={addBlankPage}>
            <Plus className="size-4" />
            Add blank page
          </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(480px,1fr)_minmax(360px,440px)] lg:items-start">
        <div className="grid gap-4">
          <div className="grid min-h-[70vh] place-items-center rounded-[2rem] border bg-muted/20 p-4 sm:p-6 lg:p-8">
            <PhotobookPageCanvas
              page={selectedPage}
              photosById={photosById}
              selectedBlockId={selectedBlockId}
              index={selectedIndex}
              onSelectBlock={setSelectedBlockId}
              onUpdateBlock={updateBlock}
            />
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2">
            {pages.map((page, index) => {
              const isSelected = page.id === selectedPage.id;
              const firstBlock = page.photoBlocks[0];
              const thumbnailPhoto = firstBlock ? photosById.get(firstBlock.photoId) : null;
              const thumbnailUrl = thumbnailPhoto ? getPhotoUrl(thumbnailPhoto) : null;

              return (
                <button
                  key={page.id}
                  type="button"
                  className={cn(
                    "group grid w-28 shrink-0 gap-2 rounded-2xl border p-2 text-left transition",
                    isSelected
                      ? "border-foreground bg-foreground text-background"
                      : "bg-card hover:border-foreground/30",
                  )}
                  onClick={() => {
                    setSelectedPageId(page.id);
                    setSelectedBlockId(null);
                  }}
                >
                  <span
                    className="relative aspect-[4/5] overflow-hidden rounded-xl border"
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
                    ) : null}
                  </span>
                  <span className="text-xs">Page {index + 3}</span>
                </button>
              );
            })}
            <button
              type="button"
              className="grid w-28 shrink-0 place-items-center rounded-2xl border border-dashed p-2 text-sm text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
              onClick={addBlankPage}
            >
              <span className="grid aspect-[4/5] w-full place-items-center rounded-xl bg-muted/40">
                <Plus className="size-5" />
              </span>
              + Page
            </button>
          </div>
        </div>

        <aside className="grid gap-5 rounded-[2rem] border bg-card p-5 lg:sticky lg:top-28">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Selected page
              </p>
              <h3 className="mt-1 text-lg">Page {selectedIndex + 3}</h3>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-full"
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
                className="rounded-full"
                onClick={() => moveSelectedPage(1)}
                disabled={selectedIndex === pages.length - 1}
                aria-label="Move page right"
              >
                <span aria-hidden="true">→</span>
              </Button>
            </div>
          </div>

          {selectedBlock ? (
            <div className="grid gap-3 rounded-3xl border bg-background/40 p-4">
              <span className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
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
                    className="h-9 rounded-full capitalize"
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
                  className="rounded-full"
                  onClick={() => changeSelectedPhotoLayer("forward")}
                >
                  Bring forward
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => changeSelectedPhotoLayer("backward")}
                >
                  Send backward
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={deleteSelectedPhoto}
                >
                  <Trash2 className="size-4" />
                  Delete photo
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3">
            <span className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <Palette className="size-4" />
              Page background
            </span>
            <div className="flex flex-wrap gap-2">
              {backgroundColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Use background ${color}`}
                  className={cn(
                    "size-8 rounded-full border transition",
                    selectedPage.backgroundColor === color
                      ? "ring-2 ring-foreground/40"
                      : "hover:ring-2 hover:ring-foreground/20",
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() =>
                    updateSelectedPage((page) => ({ ...page, backgroundColor: color }))
                  }
                />
              ))}
              <label className="grid size-8 cursor-pointer place-items-center rounded-full border bg-[conic-gradient(from_90deg,#ff5b69,#ffc457,#32dcdc,#b9a7ff,#ff5b69)]">
                <input
                  type="color"
                  value={selectedPage.backgroundColor}
                  className="sr-only"
                  onChange={(event) =>
                    updateSelectedPage((page) => ({
                      ...page,
                      backgroundColor: event.currentTarget.value,
                    }))
                  }
                />
              </label>
            </div>
          </div>

          <div className="grid gap-3">
            <span className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
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
                  className="h-9 rounded-full"
                  onClick={() => setLayout(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <span className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <ImagePlus className="size-4" />
              Add photo
            </span>
            {photos.length > 0 ? (
              <div className="grid max-h-52 grid-cols-4 gap-2 overflow-y-auto pr-1">
                {photos.map((photo) => {
                  const photoUrl = photo.thumbnail_public_url ?? photo.public_url;

                  return (
                    <button
                      key={photo.id}
                      type="button"
                      className="relative aspect-square overflow-hidden rounded-xl border bg-muted transition hover:border-foreground/40"
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
              <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                Upload room photos first, then add them to your pages here.
              </p>
            )}
          </div>

          <div className="grid gap-3">
            <span className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <Type className="size-4" />
              Text
            </span>
            <Input
              value={selectedPage.title}
              placeholder="Add a title"
              className="h-11 rounded-2xl bg-transparent"
              onChange={(event) =>
                updateSelectedPage((page) => ({
                  ...page,
                  title: event.currentTarget.value,
                }))
              }
            />
            <Textarea
              value={selectedPage.caption}
              placeholder="Add a caption"
              className="min-h-24 rounded-2xl bg-transparent"
              onChange={(event) =>
                updateSelectedPage((page) => ({
                  ...page,
                  caption: event.currentTarget.value,
                }))
              }
            />
            <div className="flex flex-wrap gap-2">
              {fontOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={selectedPage.font === option.value ? "default" : "outline"}
                  size="sm"
                  className={cn("h-9 rounded-full", option.className)}
                  onClick={() =>
                    updateSelectedPage((page) => ({ ...page, font: option.value }))
                  }
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
                    "size-8 rounded-full border transition",
                    selectedPage.textColor === color
                      ? "ring-2 ring-foreground/40"
                      : "hover:ring-2 hover:ring-foreground/20",
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() =>
                    updateSelectedPage((page) => ({ ...page, textColor: color }))
                  }
                />
              ))}
              <label className="grid size-8 cursor-pointer place-items-center rounded-full border bg-[conic-gradient(from_90deg,#ff5b69,#ffc457,#32dcdc,#b9a7ff,#ff5b69)]">
                <input
                  type="color"
                  value={selectedPage.textColor}
                  className="sr-only"
                  onChange={(event) =>
                    updateSelectedPage((page) => ({
                      ...page,
                      textColor: event.currentTarget.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["top", "center", "bottom"] as TextPosition[]).map((position) => (
                <Button
                  key={position}
                  type="button"
                  variant={selectedPage.textPosition === position ? "default" : "outline"}
                  size="sm"
                  className="h-9 rounded-full capitalize"
                  onClick={() =>
                    updateSelectedPage((page) => ({ ...page, textPosition: position }))
                  }
                >
                  {position}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 border-t pt-4">
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Page actions
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={duplicateSelectedPage}
              >
                <Copy className="size-4" />
                Duplicate
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={deleteSelectedPage}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
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
