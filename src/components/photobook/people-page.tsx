"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import type { CoverFont, CoverOverlayStyle, RoomMember } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PeopleLayout = "centered" | "left-list" | "floating" | "grid" | "credits";
type PeoplePosition = "top" | "center" | "bottom";

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

const layoutOptions: { value: PeopleLayout; label: string }[] = [
  { value: "centered", label: "Centered names" },
  { value: "left-list", label: "Left editorial list" },
  { value: "floating", label: "Floating name pills" },
  { value: "grid", label: "Grid" },
  { value: "credits", label: "Minimal credits" },
];

const positionOptions: { value: PeoplePosition; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "center", label: "Center" },
  { value: "bottom", label: "Bottom" },
];

const overlayOptions: { value: CoverOverlayStyle; label: string }[] = [
  { value: "none", label: "None" },
  { value: "soft", label: "Soft" },
  { value: "deep", label: "Deep" },
  { value: "film", label: "Film" },
];

function isEmailLike(value: string) {
  return /^\S+@\S+\.\S+$/.test(value.trim());
}

function getMemberName(member: RoomMember) {
  const displayName = member.display_name?.trim() ?? "";

  return displayName && !isEmailLike(displayName) ? displayName : "";
}

function dedupeNames(names: string[]) {
  const seen = new Set<string>();

  return names.filter((name) => {
    const key = name.trim().toLowerCase();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getPositionClass(position: PeoplePosition) {
  const classes: Record<PeoplePosition, string> = {
    top: "justify-start",
    center: "justify-center",
    bottom: "justify-end",
  };

  return classes[position];
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

function getNamesClass(layout: PeopleLayout) {
  const classes: Record<PeopleLayout, string> = {
    centered: "flex flex-wrap justify-center gap-3 text-center",
    "left-list": "grid gap-3 text-left",
    floating: "flex flex-wrap gap-3",
    grid: "grid grid-cols-2 gap-3",
    credits: "grid gap-2 text-center",
  };

  return classes[layout];
}

function getNameTagClass(layout: PeopleLayout) {
  if (layout === "left-list") {
    return "border-b border-current/20 pb-2 text-2xl leading-tight";
  }

  if (layout === "credits") {
    return "text-sm uppercase tracking-[0.24em]";
  }

  if (layout === "grid") {
    return "rounded-2xl border border-current/20 px-4 py-3 text-center text-sm";
  }

  return "rounded-full border border-current/25 px-4 py-2 text-sm";
}

export function PeoplePage({ members }: { members: RoomMember[] }) {
  const [title, setTitle] = useState("The People Who Made It");
  const [newName, setNewName] = useState("");
  const [customNames, setCustomNames] = useState<string[]>([]);
  const [font, setFont] = useState<CoverFont>("editorial-serif");
  const [color, setColor] = useState("#ffffff");
  const [customColor, setCustomColor] = useState("#ffffff");
  const [layout, setLayout] = useState<PeopleLayout>("centered");
  const [position, setPosition] = useState<PeoplePosition>("center");
  const [overlay, setOverlay] = useState<CoverOverlayStyle>("none");
  const colorInputRef = useRef<HTMLInputElement>(null);

  // TODO: Persist Page 2 title, custom names, and style settings when photobook pages get database support.
  const names = useMemo(
    () => dedupeNames([...members.map(getMemberName), ...customNames]),
    [members, customNames],
  );

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

  function addName() {
    const trimmedName = newName.trim();

    if (!trimmedName) {
      return;
    }

    setCustomNames((current) => dedupeNames([...current, trimmedName]));
    setNewName("");
  }

  function removeName(name: string) {
    setCustomNames((current) => current.filter((item) => item !== name));
  }

  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(480px,1fr)_minmax(380px,440px)] lg:items-start">
      <div className="grid min-h-[70vh] place-items-center rounded-[2rem] border bg-muted/20 p-4 sm:p-6 lg:p-8">
        <div
          data-photobook-page="true"
          data-photobook-page-id="people"
          data-photobook-page-label="people page"
          data-photobook-page-order="2"
          className="relative mx-auto aspect-[4/5] w-full max-w-[34rem] overflow-hidden rounded-[1.25rem] border bg-card shadow-[0_28px_90px_rgb(0_0_0_/_0.12)] dark:shadow-[0_28px_90px_rgb(0_0_0_/_0.55)]"
        >
          <div className={cn("absolute inset-0", getOverlayClass(overlay))} />
          <div
            className={cn(
              "relative z-10 flex h-full flex-col p-8 md:p-12",
              getPositionClass(position),
            )}
            style={{ color }}
          >
            <p className="text-xs uppercase tracking-[0.24em] opacity-60">Page 2</p>
            <h2 className={cn("mt-4 max-w-sm text-4xl leading-tight md:text-5xl", fontClass)}>
              {title || "The People Who Made It"}
            </h2>
            <div className={cn("mt-10", getNamesClass(layout))}>
              {names.length > 0 ? (
                names.map((name) => (
                  <span key={name} className={getNameTagClass(layout)}>
                    {name}
                  </span>
                ))
              ) : (
                <span className="text-sm opacity-60">Add names to begin.</span>
              )}
            </div>
          </div>
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
              onChange={(event) => setTitle(event.currentTarget.value)}
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
          {customNames.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {customNames.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
                >
                  {name}
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() => removeName(name)}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
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
                onClick={() => setFont(option.value)}
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
              }}
              aria-label="Choose custom people page color"
            />
          </div>
        </div>

        <div className={controlSectionClass}>
          <span className={controlLabelClass}>Layout style</span>
          <div className="flex flex-wrap gap-2">
            {layoutOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={layout === option.value ? "default" : "outline"}
                size="sm"
                className={pillClass}
                onClick={() => setLayout(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className={controlSectionClass}>
          <span className={controlLabelClass}>Position</span>
          <div className="flex flex-wrap gap-2">
            {positionOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={position === option.value ? "default" : "outline"}
                size="sm"
                className={pillClass}
                onClick={() => setPosition(option.value)}
              >
                {option.label}
              </Button>
            ))}
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
                onClick={() => setOverlay(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
