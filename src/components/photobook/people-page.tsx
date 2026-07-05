"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Check, Plus, X } from "lucide-react";
import {
  EditableTextBox,
  type EditableTextGeometry,
  type PhotobookTextObject,
  type PhotobookTextObjectRole,
} from "@/components/photobook/editable-text-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CoverFont, CoverOverlayStyle, RoomMember } from "@/lib/types";
import { cn } from "@/lib/utils";

type PeoplePageSettings = {
  version?: 2;
  customColor: string;
  overlay: CoverOverlayStyle;
  textObjects: PhotobookTextObject[];
};

type LegacyPeopleName = {
  id: string;
  name: string;
  x: number;
  y: number;
  scale?: number;
  width?: number;
  font?: CoverFont;
  color?: string;
};

type LegacyPeoplePageSettings = {
  title?: string;
  font?: CoverFont;
  color?: string;
  customColor?: string;
  overlay?: CoverOverlayStyle;
  titlePosition?: { x: number; y: number };
  titleScale?: number;
  titleBoxWidth?: number;
  names?: LegacyPeopleName[];
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
const minTextScale = 0.35;
const maxTextScale = 2.8;
const minTextBoxWidth = 0.12;
const maxTextBoxWidth = 0.98;

const defaultTitleText: PhotobookTextObject = {
  id: "people-title",
  text: defaultTitle,
  role: "title",
  x: 0.28,
  y: 0.25,
  width: 0.48,
  scale: 1,
  font: "editorial-serif",
  color: "#ffffff",
};

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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isCoverFont(value: unknown): value is CoverFont {
  return fontOptions.some((option) => option.value === value);
}

function isOverlay(value: unknown): value is CoverOverlayStyle {
  return overlayOptions.some((option) => option.value === value);
}

function isTextRole(value: unknown): value is PhotobookTextObjectRole {
  return value === "title" || value === "subtitle" || value === "name" || value === "custom";
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

function getDefaultNameText(index: number, name: string): PhotobookTextObject {
  return {
    id: `people-name-${index + 1}`,
    text: name,
    role: "name",
    x: clamp(0.5 + ((index % 3) - 1) * 0.16, 0.14, 0.86),
    y: clamp(0.55 + Math.floor(index / 3) * 0.08, 0.34, 0.88),
    width: 0.22,
    scale: 1,
    font: "minimal-light",
    color: "#ffffff",
  };
}

function isPeoplePageSettings(value: unknown): value is PeoplePageSettings {
  if (!value || typeof value !== "object") {
    return false;
  }

  const settings = value as Partial<PeoplePageSettings>;

  return Array.isArray(settings.textObjects);
}

function normalizeSavedSettings(value: unknown): PeoplePageSettings | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (isPeoplePageSettings(value)) {
    const settings = value as PeoplePageSettings;
    const textObjects = settings.textObjects.map((textObject, index) =>
      normalizeTextObject(textObject, {
        ...defaultTitleText,
        id: `people-text-${index + 1}`,
        role: index === 0 ? "title" : "custom",
      }),
    );
    const hasTitle = textObjects.some((textObject) => textObject.role === "title");

    return {
      version: 2,
      customColor:
        typeof settings.customColor === "string" ? settings.customColor : "#ffffff",
      overlay: isOverlay(settings.overlay) ? settings.overlay : "none",
      textObjects: hasTitle ? textObjects : [defaultTitleText, ...textObjects],
    };
  }

  const legacySettings = value as LegacyPeoplePageSettings;
  const titleText = normalizeTextObject(
    {
      id: "people-title",
      text: legacySettings.title,
      role: "title",
      x: legacySettings.titlePosition?.x,
      y: legacySettings.titlePosition?.y,
      width: legacySettings.titleBoxWidth,
      scale: legacySettings.titleScale,
      font: legacySettings.font,
      color: legacySettings.color,
    },
    defaultTitleText,
  );
  const names = Array.isArray(legacySettings.names)
    ? legacySettings.names
        .filter((name) => typeof name.name === "string" && name.name.trim())
        .map((name, index) =>
          normalizeTextObject(
            {
              id: name.id,
              text: name.name,
              role: "name",
              x: name.x,
              y: name.y,
              width: name.width,
              scale: name.scale,
              font: name.font,
              color: name.color,
            },
            getDefaultNameText(index, name.name),
          ),
        )
    : [];

  return {
    version: 2,
    customColor:
      typeof legacySettings.customColor === "string"
        ? legacySettings.customColor
        : "#ffffff",
    overlay: isOverlay(legacySettings.overlay) ? legacySettings.overlay : "none",
    textObjects: [titleText, ...names],
  };
}

export function PeoplePage({
  photobookId,
}: {
  members: RoomMember[];
  photobookId: string;
}) {
  const [textObjects, setTextObjects] = useState<PhotobookTextObject[]>([
    defaultTitleText,
  ]);
  const [newName, setNewName] = useState("");
  const [customColor, setCustomColor] = useState("#ffffff");
  const [overlay, setOverlay] = useState<CoverOverlayStyle>("none");
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved">("saved");
  const colorInputRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const hasLoadedSettingsRef = useRef(false);
  const storageKey = `clay-people-page:${photobookId}`;

  const titleText =
    textObjects.find((textObject) => textObject.role === "title") ?? defaultTitleText;
  const names = textObjects.filter((textObject) => textObject.role === "name");
  const selectedTextObject =
    textObjects.find((textObject) => textObject.id === selectedTextId) ?? null;
  const activeTextObject = selectedTextObject ?? titleText;
  const activeColor = activeTextObject.color;
  const activeCustomColor = activeColor.startsWith("#") ? activeColor : customColor;
  const activeIsCustomColor =
    activeColor.startsWith("#") &&
    !colorOptions.some(
      (option) => option.value.toLowerCase() === activeColor.toLowerCase(),
    );

  const controlSectionClass = "grid gap-3 border-b border-border/35 pb-5 last:border-b-0 last:pb-0 dark:border-white/[0.08]";
  const controlLabelClass =
    "text-[0.66rem] uppercase tracking-[0.24em] text-muted-foreground/75";
  const inputClass =
    "h-11 rounded-2xl border-border/50 bg-background/65 px-4 text-sm shadow-none transition-all duration-200 placeholder:text-muted-foreground/45 hover:border-foreground/20 hover:bg-background/80 focus-visible:border-foreground/35 focus-visible:ring-2 focus-visible:ring-foreground/10 focus-visible:ring-offset-0 dark:border-white/[0.09] dark:bg-white/[0.045] dark:hover:border-white/20 dark:hover:bg-white/[0.065]";
  const pillClass =
    "h-8 rounded-full border px-3.5 text-xs font-normal shadow-none transition-all duration-200 active:scale-[0.98]";
  const selectedPillClass =
    "border-foreground bg-foreground text-background hover:bg-foreground/90 dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/90";
  const idlePillClass =
    "border-border/55 bg-background/35 text-muted-foreground hover:border-foreground/30 hover:bg-muted/45 hover:text-foreground dark:border-white/[0.09] dark:bg-white/[0.035] dark:hover:bg-white/[0.075]";

  function markUnsaved() {
    if (hasLoadedSettingsRef.current) {
      setSaveStatus("unsaved");
    }
  }

  function updateTextObject(
    id: string,
    updater: (textObject: PhotobookTextObject) => PhotobookTextObject,
  ) {
    setTextObjects((current) =>
      current.map((textObject) =>
        textObject.id === id ? normalizeTextObject(updater(textObject), textObject) : textObject,
      ),
    );
    markUnsaved();
  }

  function updateTextGeometry(id: string, geometry: EditableTextGeometry) {
    updateTextObject(id, (textObject) => ({
      ...textObject,
      ...geometry,
    }));
  }

  function addName() {
    const trimmedName = newName.trim();

    if (!trimmedName) {
      return;
    }

    if (
      names.some(
        (name) => name.text.trim().toLowerCase() === trimmedName.toLowerCase(),
      )
    ) {
      setNewName("");
      return;
    }

    const id = createClientId("people-name");
    const nextName = {
      ...getDefaultNameText(names.length, trimmedName),
      id,
      text: trimmedName,
      font: activeTextObject.font,
      color: activeTextObject.color,
    };

    setTextObjects((current) => [...current, nextName]);
    setSelectedTextId(id);
    setNewName("");
    markUnsaved();
  }

  function addTextBox() {
    const customCount = textObjects.filter(
      (textObject) => textObject.role === "custom",
    ).length;
    const id = createClientId("people-text");

    setTextObjects((current) => [
      ...current,
      {
        id,
        text: "New text",
        role: "custom",
        x: clamp(0.5 + ((customCount % 3) - 1) * 0.12, 0.16, 0.84),
        y: clamp(0.7 + Math.floor(customCount / 3) * 0.07, 0.2, 0.9),
        width: 0.34,
        scale: 0.9,
        font: activeTextObject.font,
        color: activeTextObject.color,
      },
    ]);
    setSelectedTextId(id);
    markUnsaved();
  }

  function removeTextObject(id: string) {
    setTextObjects((current) =>
      current.filter(
        (textObject) => textObject.id !== id || textObject.role === "title",
      ),
    );
    setSelectedTextId((current) => (current === id ? null : current));
    markUnsaved();
  }

  function resetLayout() {
    setTextObjects((current) => {
      const resetTitle = normalizeTextObject(
        {
          ...defaultTitleText,
          text: titleText.text,
          font: titleText.font,
          color: titleText.color,
        },
        defaultTitleText,
      );
      let nameIndex = 0;
      let customIndex = 0;

      return current.map((textObject) => {
        if (textObject.role === "title") {
          return resetTitle;
        }

        if (textObject.role === "name") {
          const next = normalizeTextObject(
            {
              ...getDefaultNameText(nameIndex, textObject.text),
              id: textObject.id,
              text: textObject.text,
              font: textObject.font,
              color: textObject.color,
            },
            textObject,
          );

          nameIndex += 1;
          return next;
        }

        const next = normalizeTextObject(
          {
            ...textObject,
            x: clamp(0.5 + ((customIndex % 3) - 1) * 0.12, 0.16, 0.84),
            y: clamp(0.7 + Math.floor(customIndex / 3) * 0.07, 0.2, 0.9),
            width: 0.34,
            scale: 0.9,
          },
          textObject,
        );

        customIndex += 1;
        return next;
      });
    });
    setSelectedTextId("people-title");
    markUnsaved();
  }

  function handlePagePointerDown(event: PointerEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target : null;

    if (!target?.closest("[data-photobook-editable='true']")) {
      setSelectedTextId(null);
    }
  }

  function saveSettings() {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 2,
        customColor,
        overlay,
        textObjects,
      }),
    );
    setSaveStatus("saved");
  }

  useEffect(() => {
    const savedSettings = localStorage.getItem(storageKey);

    if (savedSettings) {
      try {
        const parsedSettings: unknown = JSON.parse(savedSettings);
        const normalizedSettings = normalizeSavedSettings(parsedSettings);

        if (normalizedSettings) {
          queueMicrotask(() => {
            setTextObjects(normalizedSettings.textObjects);
            setCustomColor(normalizedSettings.customColor);
            setOverlay(normalizedSettings.overlay);
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
    <section className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start xl:gap-14">
      <div className="grid min-h-[72vh] place-items-center rounded-[2rem] border border-border/45 bg-card/35 p-4 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.20),0_20px_80px_rgb(0_0_0_/_0.045)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.018] dark:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.035),0_24px_84px_rgb(0_0_0_/_0.28)] sm:p-6 xl:p-8">
        <div
          data-photobook-page="true"
          data-photobook-page-id="people"
          data-photobook-page-label="people page"
          data-photobook-page-order="2"
          ref={pageRef}
          className="relative mx-auto aspect-[4/5] w-full max-w-[42rem] overflow-hidden rounded-[1.35rem] border border-black/[0.10] bg-card shadow-[0_18px_52px_rgb(0_0_0_/_0.10)] dark:border-white/[0.10] dark:shadow-[0_22px_70px_rgb(0_0_0_/_0.42)]"
          onPointerDown={handlePagePointerDown}
        >
          <div className={cn("absolute inset-0", getOverlayClass(overlay))} />
          {textObjects.map((textObject) => (
            <EditableTextBox
              key={textObject.id}
              id={textObject.id}
              canvasRef={pageRef}
              geometry={textObject}
              selected={selectedTextId === textObject.id}
              color={textObject.color}
              ariaLabel={`Drag ${textObject.text || "text"}`}
              className="z-20 rounded-lg p-0"
              chromeRadiusClassName="rounded-lg"
              minScale={minTextScale}
              maxScale={maxTextScale}
              minWidth={minTextBoxWidth}
              maxWidth={maxTextBoxWidth}
              onGeometryChange={(geometry) => updateTextGeometry(textObject.id, geometry)}
              onSelect={setSelectedTextId}
              onDelete={
                textObject.role === "title"
                  ? undefined
                  : () => removeTextObject(textObject.id)
              }
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
      </div>

      <div className="grid w-full gap-6 rounded-[2rem] border border-border/45 bg-card/90 p-5 shadow-[0_22px_70px_rgb(0_0_0_/_0.055)] backdrop-blur-xl [scrollbar-width:none] dark:border-white/[0.09] dark:bg-[#050505]/92 dark:shadow-[0_24px_80px_rgb(0_0_0_/_0.34)] xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto [&::-webkit-scrollbar]:hidden">
        <div className={controlSectionClass}>
          <span className={controlLabelClass}>Heading text</span>
          <div className="grid gap-2">
            <Label htmlFor="people_page_title" className="text-sm text-muted-foreground">
              Title
            </Label>
            <Input
              id="people_page_title"
              value={titleText.text}
              onChange={(event) => {
                const nextText = event.currentTarget.value;

                updateTextObject(titleText.id, (current) => ({
                  ...current,
                  text: nextText,
                }));
              }}
              className={inputClass}
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
              className={inputClass}
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
                  className="inline-flex items-center gap-2 rounded-full border border-border/45 px-3 py-1.5 text-xs text-muted-foreground dark:border-white/[0.08]"
                >
                  {name.text}
                  <button
                    type="button"
                    aria-label={`Remove ${name.text}`}
                    onClick={() => removeTextObject(name.id)}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className={controlSectionClass}>
          <span className={controlLabelClass}>Text boxes</span>
          <Button
            type="button"
            variant="outline"
            className={cn(pillClass, "h-10 w-fit px-4", idlePillClass)}
            onClick={addTextBox}
          >
            + Add text box
          </Button>
          {selectedTextObject ? (
            <div className="grid gap-4 rounded-2xl border border-border/30 bg-background/45 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
              <div className="grid gap-2">
                <Label htmlFor="selected_people_text" className="text-xs text-muted-foreground">
                  Selected text
                </Label>
                <Input
                  id="selected_people_text"
                  value={selectedTextObject.text}
                  onChange={(event) => {
                    const nextText = event.currentTarget.value;

                    updateTextObject(selectedTextObject.id, (current) => ({
                      ...current,
                      text: nextText,
                    }));
                  }}
                  className={inputClass}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-full"
                  aria-label="Decrease selected text size"
                  onClick={() =>
                    updateTextObject(selectedTextObject.id, (current) => ({
                      ...current,
                      scale: clamp(
                        Number((current.scale - 0.1).toFixed(1)),
                        minTextScale,
                        maxTextScale,
                      ),
                    }))
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
                  className="size-8 rounded-full"
                  aria-label="Increase selected text size"
                  onClick={() =>
                    updateTextObject(selectedTextObject.id, (current) => ({
                      ...current,
                      scale: clamp(
                        Number((current.scale + 0.1).toFixed(1)),
                        minTextScale,
                        maxTextScale,
                      ),
                    }))
                  }
                >
                  +
                </Button>
              </div>
              {selectedTextObject.role !== "title" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit rounded-full border-red-500/25 text-red-500 hover:border-red-500/45 hover:bg-red-500/10"
                  onClick={() => removeTextObject(selectedTextObject.id)}
                >
                  Delete text box
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground/75">
              Select a title, name, or text box to edit its words and style.
            </p>
          )}
        </div>

        <div className={controlSectionClass}>
          <span className={controlLabelClass}>Text style</span>
          <div className="flex flex-wrap gap-2">
            {fontOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  pillClass,
                  activeTextObject.font === option.value
                    ? selectedPillClass
                    : idlePillClass,
                  option.className,
                )}
                onClick={() =>
                  updateTextObject(activeTextObject.id, (current) => ({
                    ...current,
                    font: option.value,
                  }))
                }
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
                  "grid size-7 place-items-center rounded-full border shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.2),0_3px_12px_rgb(0_0_0_/_0.08)] transition-all duration-200 hover:scale-105",
                  activeColor.toLowerCase() === option.value.toLowerCase()
                    ? "border-foreground ring-2 ring-foreground/20 ring-offset-2 ring-offset-background"
                    : "border-border/60 hover:border-foreground/40",
                )}
                style={{ backgroundColor: option.value }}
                onClick={() =>
                  updateTextObject(activeTextObject.id, (current) => ({
                    ...current,
                    color: option.value,
                  }))
                }
              >
                {activeColor.toLowerCase() === option.value.toLowerCase() ? (
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
                "grid size-7 place-items-center rounded-full border bg-[conic-gradient(from_0deg,#ff4d4d,#ffc457,#9ff3d4,#32dcdc,#8fd3ff,#b9a7ff,#ff4d4d)] transition-all duration-200 hover:scale-105",
                activeIsCustomColor
                  ? "border-foreground ring-2 ring-foreground/20 ring-offset-2 ring-offset-background"
                  : "border-border/60 hover:border-foreground/40",
              )}
              onClick={() => colorInputRef.current?.click()}
            >
              {activeIsCustomColor ? <Check className="size-3 text-black" /> : null}
            </button>
            <input
              ref={colorInputRef}
              type="color"
              value={activeCustomColor}
              className="sr-only"
              onChange={(event) => {
                const nextColor = event.currentTarget.value;

                setCustomColor(nextColor);
                updateTextObject(activeTextObject.id, (current) => ({
                  ...current,
                  color: nextColor,
                }));
              }}
              aria-label="Choose custom people page color"
            />
          </div>
        </div>

        <div className={controlSectionClass}>
          <span className={controlLabelClass}>Placement</span>
          <div className="rounded-2xl border border-border/30 bg-background/45 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
            <p className="text-sm leading-6 text-muted-foreground">
              Drag text and names directly on the page. Pull corners to resize,
              side handles stretch width.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(pillClass, "mt-3 rounded-full", idlePillClass)}
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
                variant="outline"
                size="sm"
                className={cn(
                  pillClass,
                  overlay === option.value ? selectedPillClass : idlePillClass,
                )}
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
