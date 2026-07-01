"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Check, Plus, X } from "lucide-react";
import type { CoverFont, CoverOverlayStyle, RoomMember } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Coordinates = {
  x: number;
  y: number;
};

type PeopleName = Coordinates & {
  id: string;
  name: string;
  scale: number;
};

type PeoplePageSettings = {
  title: string;
  font: CoverFont;
  color: string;
  customColor: string;
  overlay: CoverOverlayStyle;
  titlePosition: Coordinates;
  titleScale: number;
  titleBoxWidth: number;
  names: PeopleName[];
};

type SelectedElement =
  | { type: "title" }
  | { type: "name"; id: string }
  | null;

type PeopleInteraction =
  | { type: "idle" }
  | {
      type: "title-drag";
      startClientX: number;
      startClientY: number;
      startPosition: Coordinates;
      pageWidth: number;
      pageHeight: number;
    }
  | {
      type: "title-resize";
      centerX: number;
      centerY: number;
      initialDistance: number;
      initialScale: number;
    }
  | {
      type: "title-width";
      side: "left" | "right";
      startClientX: number;
      pageWidth: number;
      initialWidth: number;
    }
  | {
      type: "name-drag";
      id: string;
      startClientX: number;
      startClientY: number;
      startPosition: Coordinates;
      pageWidth: number;
      pageHeight: number;
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

const overlayOptions: { value: CoverOverlayStyle; label: string }[] = [
  { value: "none", label: "None" },
  { value: "soft", label: "Soft" },
  { value: "deep", label: "Deep" },
  { value: "film", label: "Film" },
];

const defaultTitle = "The People Who Made It";
const defaultTitlePosition = { x: 0.22, y: 0.28 };
const defaultTitleBoxWidth = 0.42;
const minTitleScale = 0.6;
const maxTitleScale = 2.2;
const minTitleBoxWidth = 0.2;
const maxTitleBoxWidth = 0.9;
const minNameScale = 0.7;
const maxNameScale = 2;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function createClientId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function getOverlayClass(overlay: CoverOverlayStyle) {
  const classes: Record<CoverOverlayStyle, string> = {
    none: "",
    soft: "bg-muted/30",
    deep: "bg-foreground/[0.035]",
    film: "bg-[linear-gradient(180deg,transparent,rgba(127,127,127,.12))]",
  };

  return classes[overlay];
}

function getDefaultNamePosition(index: number): Coordinates {
  return {
    x: clamp(0.5 + ((index % 3) - 1) * 0.16, 0.12, 0.88),
    y: clamp(0.55 + Math.floor(index / 3) * 0.08, 0.34, 0.88),
  };
}

function clampTitleBoxWidth(width: number, x: number, scale: number) {
  const maxWidthForPosition = Math.max(
    minTitleBoxWidth,
    Math.min(maxTitleBoxWidth, ((Math.min(x, 1 - x) - 0.015) * 2) / scale),
  );

  return clamp(width, minTitleBoxWidth, maxWidthForPosition);
}

function isCoordinates(value: unknown): value is Coordinates {
  if (!value || typeof value !== "object") {
    return false;
  }

  const coordinates = value as Partial<Coordinates>;

  return (
    typeof coordinates.x === "number" &&
    Number.isFinite(coordinates.x) &&
    typeof coordinates.y === "number" &&
    Number.isFinite(coordinates.y)
  );
}

function isPeopleName(value: unknown): value is PeopleName {
  if (!value || typeof value !== "object") {
    return false;
  }

  const name = value as Partial<PeopleName>;

  return (
    typeof name.id === "string" &&
    typeof name.name === "string" &&
    name.name.trim().length > 0 &&
    isCoordinates(name)
  );
}

function isPeoplePageSettings(value: unknown): value is PeoplePageSettings {
  if (!value || typeof value !== "object") {
    return false;
  }

  const settings = value as Partial<PeoplePageSettings>;

  return (
    typeof settings.title === "string" &&
    typeof settings.font === "string" &&
    typeof settings.color === "string" &&
    typeof settings.customColor === "string" &&
    typeof settings.overlay === "string" &&
    isCoordinates(settings.titlePosition) &&
    typeof settings.titleScale === "number" &&
    Number.isFinite(settings.titleScale) &&
    Array.isArray(settings.names) &&
    settings.names.every(isPeopleName)
  );
}

export function PeoplePage({
  photobookId,
}: {
  members: RoomMember[];
  photobookId: string;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [newName, setNewName] = useState("");
  const [names, setNames] = useState<PeopleName[]>([]);
  const [font, setFont] = useState<CoverFont>("editorial-serif");
  const [color, setColor] = useState("#ffffff");
  const [customColor, setCustomColor] = useState("#ffffff");
  const [overlay, setOverlay] = useState<CoverOverlayStyle>("none");
  const [titlePosition, setTitlePosition] =
    useState<Coordinates>(defaultTitlePosition);
  const [titleScale, setTitleScale] = useState(1);
  const [titleBoxWidth, setTitleBoxWidth] = useState(defaultTitleBoxWidth);
  const [selectedElement, setSelectedElement] =
    useState<SelectedElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizingTitle, setIsResizingTitle] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved">("saved");
  const colorInputRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<PeopleInteraction>({ type: "idle" });
  const hasLoadedSettingsRef = useRef(false);
  const storageKey = `clay-people-page:${photobookId}`;

  const fontClass =
    fontOptions.find((option) => option.value === font)?.className ?? "font-serif";
  const isCustomColor =
    color.startsWith("#") &&
    !colorOptions.some((option) => option.value.toLowerCase() === color.toLowerCase());
  const controlSectionClass = "grid gap-3";
  const controlLabelClass =
    "text-xs uppercase tracking-[0.18em] text-muted-foreground";
  const pillClass =
    "h-9 rounded-full border px-3 text-xs font-normal transition-all duration-200 hover:border-foreground/30";
  const selectedNameId =
    selectedElement?.type === "name" ? selectedElement.id : null;
  const titleIsSelected =
    selectedElement?.type === "title" || isDragging || isResizingTitle;

  function serializeSettings(): PeoplePageSettings {
    return {
      title,
      font,
      color,
      customColor,
      overlay,
      titlePosition,
      titleScale,
      titleBoxWidth,
      names,
    };
  }

  function saveSettings() {
    localStorage.setItem(storageKey, JSON.stringify(serializeSettings()));
    setSaveStatus("saved");
  }

  function getClampedTitlePosition(x: number, y: number): Coordinates {
    const safeX = clamp((titleBoxWidth * titleScale) / 2 + 0.015, 0.04, 0.49);
    const safeY = clamp(0.045 * titleScale, 0.05, 0.1);

    return {
      x: clamp(x, safeX, 1 - safeX),
      y: clamp(y, safeY, 1 - safeY),
    };
  }

  function getClampedTitleBoxWidth(width: number, x = titlePosition.x) {
    return clampTitleBoxWidth(width, x, titleScale);
  }

  function markUnsaved() {
    if (hasLoadedSettingsRef.current) {
      setSaveStatus("unsaved");
    }
  }

  function startTitleDrag(event: PointerEvent<HTMLDivElement>) {
    const pageRect = pageRef.current?.getBoundingClientRect();

    if (!pageRect || pageRect.width === 0 || pageRect.height === 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = {
      type: "title-drag",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosition: titlePosition,
      pageWidth: pageRect.width,
      pageHeight: pageRect.height,
    };
    setSelectedElement({ type: "title" });
    setIsDragging(true);
  }

  function startTitleResize(event: PointerEvent<HTMLButtonElement>) {
    const pageRect = pageRef.current?.getBoundingClientRect();

    if (!pageRect || pageRect.width === 0 || pageRect.height === 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const centerX = pageRect.left + titlePosition.x * pageRect.width;
    const centerY = pageRect.top + titlePosition.y * pageRect.height;
    const initialDistance = Math.max(
      1,
      Math.hypot(event.clientX - centerX, event.clientY - centerY),
    );

    interactionRef.current = {
      type: "title-resize",
      centerX,
      centerY,
      initialDistance,
      initialScale: titleScale,
    };
    setSelectedElement({ type: "title" });
    setIsResizingTitle(true);
  }

  function startTitleWidthResize(
    event: PointerEvent<HTMLButtonElement>,
    side: "left" | "right",
  ) {
    const pageRect = pageRef.current?.getBoundingClientRect();

    if (!pageRect || pageRect.width === 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = {
      type: "title-width",
      side,
      startClientX: event.clientX,
      pageWidth: pageRect.width,
      initialWidth: titleBoxWidth,
    };
    setSelectedElement({ type: "title" });
    setIsResizingTitle(true);
  }

  function startNameDrag(event: PointerEvent<HTMLDivElement>, name: PeopleName) {
    const pageRect = pageRef.current?.getBoundingClientRect();

    if (!pageRect || pageRect.width === 0 || pageRect.height === 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = {
      type: "name-drag",
      id: name.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosition: { x: name.x, y: name.y },
      pageWidth: pageRect.width,
      pageHeight: pageRect.height,
    };
    setSelectedElement({ type: "name", id: name.id });
    setIsDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const interaction = interactionRef.current;

    if (interaction.type === "idle") {
      return;
    }

    event.preventDefault();
    markUnsaved();

    if (interaction.type === "title-drag") {
      const deltaX = (event.clientX - interaction.startClientX) / interaction.pageWidth;
      const deltaY = (event.clientY - interaction.startClientY) / interaction.pageHeight;

      setTitlePosition(
        getClampedTitlePosition(
          interaction.startPosition.x + deltaX,
          interaction.startPosition.y + deltaY,
        ),
      );
      return;
    }

    if (interaction.type === "title-resize") {
      const nextDistance = Math.max(
        1,
        Math.hypot(event.clientX - interaction.centerX, event.clientY - interaction.centerY),
      );
      const nextScale = clamp(
        interaction.initialScale * (nextDistance / interaction.initialDistance),
        minTitleScale,
        maxTitleScale,
      );

      setTitleScale(nextScale);
      requestAnimationFrame(() => {
        setTitlePosition((current) => getClampedTitlePosition(current.x, current.y));
      });
      return;
    }

    if (interaction.type === "title-width") {
      const deltaX = (event.clientX - interaction.startClientX) / interaction.pageWidth;
      const direction = interaction.side === "right" ? 1 : -1;
      const nextWidth = getClampedTitleBoxWidth(
        interaction.initialWidth + deltaX * direction,
      );

      setTitleBoxWidth(nextWidth);
      setTitlePosition((current) => getClampedTitlePosition(current.x, current.y));
      return;
    }

    const deltaX = (event.clientX - interaction.startClientX) / interaction.pageWidth;
    const deltaY = (event.clientY - interaction.startClientY) / interaction.pageHeight;
    const nextX = clamp(interaction.startPosition.x + deltaX, 0.04, 0.96);
    const nextY = clamp(interaction.startPosition.y + deltaY, 0.06, 0.94);

    setNames((current) =>
      current.map((name) =>
        name.id === interaction.id ? { ...name, x: nextX, y: nextY } : name,
      ),
    );
  }

  function handlePointerEnd(event: PointerEvent<HTMLElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    interactionRef.current = { type: "idle" };
    setIsDragging(false);
    setIsResizingTitle(false);
  }

  function addName() {
    const trimmedName = newName.trim();

    if (!trimmedName) {
      return;
    }

    setNames((current) => {
      if (
        current.some(
          (existingName) =>
            existingName.name.trim().toLowerCase() === trimmedName.toLowerCase(),
        )
      ) {
        return current;
      }

      const position = getDefaultNamePosition(current.length);

      return [
        ...current,
        {
          id: createClientId("people-name"),
          name: trimmedName,
          scale: 1,
          ...position,
        },
      ];
    });
    setNewName("");
    markUnsaved();
  }

  function removeName(id: string) {
    setNames((current) => current.filter((name) => name.id !== id));
    setSelectedElement((current) =>
      current?.type === "name" && current.id === id ? null : current,
    );
    markUnsaved();
  }

  function resetLayout() {
    setTitlePosition(defaultTitlePosition);
    setTitleScale(1);
    setTitleBoxWidth(defaultTitleBoxWidth);
    setNames((current) =>
      current.map((name, index) => ({
        ...name,
        scale: 1,
        ...getDefaultNamePosition(index),
      })),
    );
    setSelectedElement({ type: "title" });
    markUnsaved();
  }

  function handlePagePointerDown(event: PointerEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target : null;

    if (!target?.closest("[data-people-editable='true']")) {
      setSelectedElement(null);
    }
  }

  useEffect(() => {
    const savedSettings = localStorage.getItem(storageKey);

    if (savedSettings) {
      try {
        const parsedSettings: unknown = JSON.parse(savedSettings);

        if (isPeoplePageSettings(parsedSettings)) {
          queueMicrotask(() => {
            setTitle(parsedSettings.title || defaultTitle);
            setFont(parsedSettings.font);
            setColor(parsedSettings.color);
            setCustomColor(parsedSettings.customColor);
            setOverlay(parsedSettings.overlay);
            setTitlePosition({
              x: clamp(parsedSettings.titlePosition.x, 0.05, 0.95),
              y: clamp(parsedSettings.titlePosition.y, 0.05, 0.95),
            });
            setTitleScale(
              clamp(parsedSettings.titleScale, minTitleScale, maxTitleScale),
            );
            setTitleBoxWidth(
              clampTitleBoxWidth(
                typeof parsedSettings.titleBoxWidth === "number" &&
                  Number.isFinite(parsedSettings.titleBoxWidth)
                  ? parsedSettings.titleBoxWidth
                  : defaultTitleBoxWidth,
                parsedSettings.titlePosition.x,
                typeof parsedSettings.titleScale === "number" &&
                  Number.isFinite(parsedSettings.titleScale)
                  ? clamp(parsedSettings.titleScale, minTitleScale, maxTitleScale)
                  : 1,
              ),
            );
            setNames(
              parsedSettings.names.map((name) => ({
                ...name,
                scale:
                  typeof name.scale === "number" && Number.isFinite(name.scale)
                    ? clamp(name.scale, minNameScale, maxNameScale)
                    : 1,
                x: clamp(name.x, 0.04, 0.96),
                y: clamp(name.y, 0.06, 0.94),
              })),
            );
            hasLoadedSettingsRef.current = true;
            setSaveStatus("saved");
          });
          return;
        }
      } catch {
        localStorage.removeItem(storageKey);
      }
    }

    queueMicrotask(() => {
      hasLoadedSettingsRef.current = true;
      setSaveStatus("saved");
    });
  }, [storageKey]);

  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(480px,1fr)_minmax(380px,440px)] lg:items-start">
      <div className="grid min-h-[70vh] place-items-center rounded-[2rem] border bg-muted/20 p-4 sm:p-6 lg:p-8">
        <div
          data-photobook-page="true"
          data-photobook-page-id="people"
          data-photobook-page-label="people page"
          data-photobook-page-order="2"
          ref={pageRef}
          className="relative mx-auto aspect-[4/5] w-full max-w-[34rem] overflow-hidden rounded-[1.25rem] border bg-card shadow-[0_28px_90px_rgb(0_0_0_/_0.12)] dark:shadow-[0_28px_90px_rgb(0_0_0_/_0.55)]"
          onPointerDown={handlePagePointerDown}
        >
          <div className={cn("absolute inset-0", getOverlayClass(overlay))} />
          <div
            role="button"
            tabIndex={0}
            aria-label="Drag people page title"
            data-people-editable="true"
            className={cn(
              "group absolute z-20 select-none rounded-2xl p-3 touch-none md:p-4",
              isDragging || isResizingTitle ? "cursor-grabbing" : "cursor-grab",
            )}
            style={{
              color,
              left: `${titlePosition.x * 100}%`,
              top: `${titlePosition.y * 100}%`,
              width: `${titleBoxWidth * 100}%`,
              transform: `translate(-50%, -50%) scale(${titleScale})`,
              transformOrigin: "center",
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setSelectedElement(null);
              }
            }}
            onPointerDown={startTitleDrag}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
          >
            <div
              aria-hidden="true"
              className={cn(
                "photobook-editor-chrome pointer-events-none absolute inset-0 rounded-2xl border border-black/45 opacity-0 shadow-[0_12px_34px_rgb(0_0_0_/_0.08)] transition-opacity duration-200 dark:border-white/55",
                "group-hover:opacity-100 group-focus-visible:opacity-100",
                titleIsSelected ? "opacity-100" : "",
              )}
            />
            <h2 className={cn("text-4xl leading-tight md:text-5xl", fontClass)}>
              {title || defaultTitle}
            </h2>
            {([
              ["-left-1 -top-1 cursor-nwse-resize", "Resize people page title"],
              ["-right-1 -top-1 cursor-nesw-resize", "Resize people page title"],
              ["-bottom-1 -left-1 cursor-nesw-resize", "Resize people page title"],
              ["-bottom-1 -right-1 cursor-nwse-resize", "Resize people page title"],
            ] as const).map(([positionClass, label]) => (
              <button
                key={positionClass}
                type="button"
                aria-label={label}
                className={cn(
                  "photobook-editor-chrome absolute size-2.5 rounded-full border border-white/90 bg-black/80 opacity-0 shadow-[0_2px_8px_rgb(0_0_0_/_0.28)] transition duration-200 hover:scale-125 dark:border-black/70 dark:bg-white/90",
                  positionClass,
                  "group-hover:opacity-100 group-focus-visible:opacity-100",
                  titleIsSelected ? "opacity-100" : "",
                )}
                onPointerDown={startTitleResize}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
              />
            ))}
            {([
              ["left", "-left-1 top-1/2 -translate-y-1/2 cursor-ew-resize"],
              ["right", "-right-1 top-1/2 -translate-y-1/2 cursor-ew-resize"],
            ] as const).map(([side, positionClass]) => (
              <button
                key={side}
                type="button"
                aria-label={`Adjust people page title ${side} edge`}
                className={cn(
                  "photobook-editor-chrome absolute h-5 w-2 rounded-full border border-white/90 bg-black/80 opacity-0 shadow-[0_2px_8px_rgb(0_0_0_/_0.28)] transition duration-200 hover:scale-110 dark:border-black/70 dark:bg-white/90",
                  positionClass,
                  "group-hover:opacity-100 group-focus-visible:opacity-100",
                  titleIsSelected ? "opacity-100" : "",
                )}
                onPointerDown={(event) => startTitleWidthResize(event, side)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
              />
            ))}
          </div>

          {names.map((name) => {
            const isSelected = selectedNameId === name.id;

            return (
              <div
                key={name.id}
                role="button"
                tabIndex={0}
                data-people-editable="true"
                className={cn(
                  "group/name absolute z-30 select-none rounded-xl p-2 text-xl leading-none touch-none md:text-2xl",
                  isDragging && isSelected ? "cursor-grabbing" : "cursor-grab",
                )}
                style={{
                  color,
                  left: `${name.x * 100}%`,
                  top: `${name.y * 100}%`,
                  transform: `translate(-50%, -50%) scale(${name.scale})`,
                  transformOrigin: "center",
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setSelectedElement(null);
                  }
                }}
                onPointerDown={(event) => startNameDrag(event, name)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    "photobook-editor-chrome pointer-events-none absolute inset-0 rounded-xl border border-black/35 opacity-0 transition-opacity duration-200 dark:border-white/50",
                    "group-hover/name:opacity-100 group-focus-visible/name:opacity-100",
                    isSelected ? "opacity-100" : "",
                  )}
                />
                <span className="relative z-10">{name.name}</span>
                {isSelected ? (
                  <button
                    type="button"
                    aria-label={`Remove ${name.name}`}
                    className="photobook-editor-chrome absolute -right-2 -top-2 z-20 grid size-5 place-items-center rounded-full border border-white/80 bg-black/80 text-white shadow-sm dark:border-black/60 dark:bg-white dark:text-black"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => removeName(name.id)}
                  >
                    <X className="size-3" />
                  </button>
                ) : null}
              </div>
            );
          })}

          {names.length === 0 ? (
            <p
              className="absolute left-1/2 top-[58%] z-10 -translate-x-1/2 text-center text-sm opacity-60"
              style={{ color }}
            >
              Add names to begin.
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid w-full gap-6 rounded-[2rem] border bg-card p-5 shadow-none lg:sticky lg:top-28">
        <div className={controlSectionClass}>
          <span className={controlLabelClass}>Heading text</span>
          <div className="grid gap-2">
            <Label htmlFor="people_page_title" className="text-sm text-muted-foreground">
              Title
            </Label>
            <Input
              id="people_page_title"
              value={title}
              onChange={(event) => {
                setTitle(event.currentTarget.value);
                markUnsaved();
              }}
              className="h-11 rounded-2xl bg-transparent"
            />
          </div>
        </div>

        <div className={controlSectionClass}>
          <span className={controlLabelClass}>Add member name</span>
          <div className="flex gap-2">
            <Input
              value={newName}
              placeholder="Add a name"
              onChange={(event) => setNewName(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addName();
                }
              }}
              className="h-11 rounded-2xl bg-transparent"
            />
            <Button type="button" className="h-11 rounded-full px-4" onClick={addName}>
              <Plus className="size-4" />
              Add
            </Button>
          </div>
          {names.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {names.map((name) => (
                <span
                  key={name.id}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
                >
                  {name.name}
                  <button
                    type="button"
                    aria-label={`Remove ${name.name}`}
                    onClick={() => removeName(name.id)}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          {selectedNameId ? (
            <div className="rounded-2xl border bg-muted/20 p-3">
              <span className={controlLabelClass}>Selected name size</span>
              <div className="mt-3 flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-full"
                  aria-label="Decrease selected name size"
                  onClick={() => {
                    setNames((current) =>
                      current.map((name) =>
                        name.id === selectedNameId
                          ? {
                              ...name,
                              scale: clamp(
                                Number((name.scale - 0.1).toFixed(1)),
                                minNameScale,
                                maxNameScale,
                              ),
                            }
                          : name,
                      ),
                    );
                    markUnsaved();
                  }}
                >
                  -
                </Button>
                <span className="min-w-16 text-center text-sm text-muted-foreground">
                  {Math.round(
                    (names.find((name) => name.id === selectedNameId)?.scale ?? 1) *
                      100,
                  )}
                  %
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-full"
                  aria-label="Increase selected name size"
                  onClick={() => {
                    setNames((current) =>
                      current.map((name) =>
                        name.id === selectedNameId
                          ? {
                              ...name,
                              scale: clamp(
                                Number((name.scale + 0.1).toFixed(1)),
                                minNameScale,
                                maxNameScale,
                              ),
                            }
                          : name,
                      ),
                    );
                    markUnsaved();
                  }}
                >
                  +
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className={controlSectionClass}>
          <span className={controlLabelClass}>Font</span>
          <div className="flex flex-wrap gap-2">
            {fontOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={font === option.value ? "default" : "outline"}
                size="sm"
                className={cn(pillClass, option.className)}
                onClick={() => {
                  setFont(option.value);
                  markUnsaved();
                }}
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
                onClick={() => {
                  setColor(option.value);
                  markUnsaved();
                }}
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
                markUnsaved();
              }}
              aria-label="Choose custom people page color"
            />
          </div>
        </div>

        <div className={controlSectionClass}>
          <span className={controlLabelClass}>Position</span>
          <div className="rounded-2xl border bg-muted/20 p-3">
            <p className="text-sm leading-6 text-muted-foreground">
              Drag text and names directly on the page.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 rounded-full"
              onClick={resetLayout}
            >
              Reset layout
            </Button>
          </div>
        </div>

        <div className={controlSectionClass}>
          <span className={controlLabelClass}>Background / mood</span>
          <div className="flex flex-wrap gap-2">
            {overlayOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={overlay === option.value ? "default" : "outline"}
                size="sm"
                className={pillClass}
                onClick={() => {
                  setOverlay(option.value);
                  markUnsaved();
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {saveStatus === "saved" ? "Saved" : "Unsaved changes"}
          </p>
          <Button type="button" className="h-10 rounded-full px-5" onClick={saveSettings}>
            Save page
          </Button>
        </div>
      </div>
    </section>
  );
}
