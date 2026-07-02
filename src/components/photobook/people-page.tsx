"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Check, Plus, X } from "lucide-react";
import type { CoverFont, CoverOverlayStyle, RoomMember } from "@/lib/types";
import {
  EditableTextBox,
  type EditableTextGeometry,
} from "@/components/photobook/editable-text-box";
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
  width: number;
  font: CoverFont;
  color: string;
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
const defaultNameWidth = 0.22;
const minTextScale = 0.35;
const maxTextScale = 2.5;
const minTextBoxWidth = 0.12;
const maxTextBoxWidth = 0.95;

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

function getFontClass(font: CoverFont) {
  return fontOptions.find((option) => option.value === font)?.className ?? "font-serif";
}

function getDefaultNamePosition(index: number): Coordinates {
  return {
    x: clamp(0.5 + ((index % 3) - 1) * 0.16, 0.12, 0.88),
    y: clamp(0.55 + Math.floor(index / 3) * 0.08, 0.34, 0.88),
  };
}

function clampTitleBoxWidth(width: number, x: number, scale: number) {
  const maxWidthForPosition = Math.max(
    minTextBoxWidth,
    Math.min(maxTextBoxWidth, ((Math.min(x, 1 - x) - 0.015) * 2) / scale),
  );

  return clamp(width, minTextBoxWidth, maxWidthForPosition);
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
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved">("saved");
  const colorInputRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const hasLoadedSettingsRef = useRef(false);
  const storageKey = `clay-people-page:${photobookId}`;

  const fontClass =
    fontOptions.find((option) => option.value === font)?.className ?? "font-serif";
  const controlSectionClass = "grid gap-3";
  const controlLabelClass =
    "text-xs uppercase tracking-[0.18em] text-muted-foreground";
  const pillClass =
    "h-9 rounded-full border px-3 text-xs font-normal transition-all duration-200 hover:border-foreground/30";
  const selectedNameId =
    selectedElement?.type === "name" ? selectedElement.id : null;
  const selectedName = selectedNameId
    ? names.find((name) => name.id === selectedNameId) ?? null
    : null;
  const activeFont = selectedName?.font ?? font;
  const activeColor = selectedName?.color ?? color;
  const activeCustomColor = activeColor.startsWith("#") ? activeColor : customColor;
  const activeIsCustomColor =
    activeColor.startsWith("#") &&
    !colorOptions.some(
      (option) => option.value.toLowerCase() === activeColor.toLowerCase(),
    );
  const titleIsSelected = selectedElement?.type === "title";

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

  function markUnsaved() {
    if (hasLoadedSettingsRef.current) {
      setSaveStatus("unsaved");
    }
  }

  function updateTitleGeometry(geometry: EditableTextGeometry) {
    setTitlePosition({ x: geometry.x, y: geometry.y });
    setTitleScale(geometry.scale);
    setTitleBoxWidth(geometry.width);
    markUnsaved();
  }

  function updateNameGeometry(id: string, geometry: EditableTextGeometry) {
    setNames((current) =>
      current.map((name) =>
        name.id === id
          ? {
              ...name,
              x: geometry.x,
              y: geometry.y,
              scale: geometry.scale,
              width: geometry.width,
            }
          : name,
      ),
    );
    markUnsaved();
  }

  function applyActiveFont(nextFont: CoverFont) {
    if (selectedNameId) {
      setNames((current) =>
        current.map((name) =>
          name.id === selectedNameId ? { ...name, font: nextFont } : name,
        ),
      );
    } else {
      setFont(nextFont);
    }

    markUnsaved();
  }

  function applyActiveColor(nextColor: string) {
    if (selectedNameId) {
      setNames((current) =>
        current.map((name) =>
          name.id === selectedNameId ? { ...name, color: nextColor } : name,
        ),
      );
    } else {
      setColor(nextColor);
    }

    markUnsaved();
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
          width: defaultNameWidth,
          font,
          color,
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
        width: defaultNameWidth,
        ...getDefaultNamePosition(index),
      })),
    );
    setSelectedElement({ type: "title" });
    markUnsaved();
  }

  function handlePagePointerDown(event: PointerEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target : null;

    if (!target?.closest("[data-photobook-editable='true']")) {
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
              clamp(parsedSettings.titleScale, minTextScale, maxTextScale),
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
                  ? clamp(parsedSettings.titleScale, minTextScale, maxTextScale)
                  : 1,
              ),
            );
            setNames(
              parsedSettings.names.map((name) => ({
                ...name,
                scale:
                  typeof name.scale === "number" && Number.isFinite(name.scale)
                    ? clamp(name.scale, minTextScale, maxTextScale)
                    : 1,
                width:
                  typeof name.width === "number" && Number.isFinite(name.width)
                    ? clamp(name.width, minTextBoxWidth, maxTextBoxWidth)
                    : defaultNameWidth,
                font: fontOptions.some((option) => option.value === name.font)
                  ? name.font
                  : parsedSettings.font,
                color: typeof name.color === "string" ? name.color : parsedSettings.color,
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
      <div className="grid min-h-[70vh] place-items-center rounded-[2rem] border border-black/[0.08] bg-muted/15 p-4 dark:border-white/[0.07] dark:bg-white/[0.018] sm:p-6 lg:p-8">
        <div
          data-photobook-page="true"
          data-photobook-page-id="people"
          data-photobook-page-label="people page"
          data-photobook-page-order="2"
          ref={pageRef}
          className="relative mx-auto aspect-[4/5] w-full max-w-[34rem] overflow-hidden rounded-[1.25rem] border border-black/[0.10] bg-card shadow-[0_18px_58px_rgb(0_0_0_/_0.10)] dark:border-white/[0.10] dark:shadow-[0_22px_72px_rgb(0_0_0_/_0.44)]"
          onPointerDown={handlePagePointerDown}
        >
          <div className={cn("absolute inset-0", getOverlayClass(overlay))} />
          <EditableTextBox
            id="people-title"
            canvasRef={pageRef}
            geometry={{
              x: titlePosition.x,
              y: titlePosition.y,
              scale: titleScale,
              width: titleBoxWidth,
            }}
            selected={titleIsSelected}
            color={color}
            ariaLabel="Drag people page title"
            className="z-20 rounded-lg p-0"
            chromeRadiusClassName="rounded-lg"
            minScale={minTextScale}
            maxScale={maxTextScale}
            minWidth={minTextBoxWidth}
            maxWidth={maxTextBoxWidth}
            onGeometryChange={updateTitleGeometry}
            onSelect={(id) => setSelectedElement(id ? { type: "title" } : null)}
          >
            <h2
              className={cn(
                "w-full max-w-none whitespace-normal text-left text-4xl leading-tight md:text-5xl",
                fontClass,
              )}
              style={{ overflowWrap: "normal", wordBreak: "normal" }}
            >
              {title || defaultTitle}
            </h2>
          </EditableTextBox>

          {names.map((name) => {
            const isSelected = selectedNameId === name.id;

            return (
              <EditableTextBox
                key={name.id}
                id={name.id}
                canvasRef={pageRef}
                geometry={{
                  x: name.x,
                  y: name.y,
                  scale: name.scale,
                  width: name.width,
                }}
                selected={isSelected}
                color={name.color}
                ariaLabel={`Drag ${name.name}`}
                className="z-30 rounded-lg p-0 text-xl leading-none md:text-2xl"
                chromeRadiusClassName="rounded-lg"
                minScale={minTextScale}
                maxScale={maxTextScale}
                minWidth={minTextBoxWidth}
                maxWidth={maxTextBoxWidth}
                onGeometryChange={(geometry) => updateNameGeometry(name.id, geometry)}
                onSelect={(id) =>
                  setSelectedElement(id ? { type: "name", id: name.id } : null)
                }
                onDelete={() => removeName(name.id)}
              >
                <span className={cn("leading-none", getFontClass(name.font))}>
                  {name.name}
                </span>
              </EditableTextBox>
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
                                minTextScale,
                                maxTextScale,
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
                                minTextScale,
                                maxTextScale,
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
          <span className={controlLabelClass}>
            {selectedName ? "Selected name style" : "Title style"}
          </span>
          <div className="flex flex-wrap gap-2">
            {fontOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={activeFont === option.value ? "default" : "outline"}
                size="sm"
                className={cn(pillClass, option.className)}
                onClick={() => applyActiveFont(option.value)}
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
                  activeColor.toLowerCase() === option.value.toLowerCase()
                    ? "border-foreground ring-2 ring-foreground/25"
                    : "border-border hover:border-foreground/40",
                )}
                style={{ backgroundColor: option.value }}
                onClick={() => applyActiveColor(option.value)}
              >
                {activeColor.toLowerCase() === option.value.toLowerCase() ? (
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
                activeIsCustomColor
                  ? "border-foreground ring-2 ring-foreground/25"
                  : "border-border hover:border-foreground/40",
              )}
              onClick={() => colorInputRef.current?.click()}
            >
              {activeIsCustomColor ? <Check className="size-4 text-black" /> : null}
            </button>
            <input
              ref={colorInputRef}
              type="color"
              value={activeCustomColor}
              className="sr-only"
              onChange={(event) => {
                setCustomColor(event.currentTarget.value);
                applyActiveColor(event.currentTarget.value);
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
