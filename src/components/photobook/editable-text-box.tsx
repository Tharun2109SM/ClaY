"use client";

import {
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import type { CoverFont } from "@/lib/types";
import { cn } from "@/lib/utils";

export type EditableTextGeometry = {
  x: number;
  y: number;
  scale: number;
  width: number;
};

export type PhotobookTextObjectRole = "title" | "subtitle" | "name" | "custom";

export type PhotobookTextObject = EditableTextGeometry & {
  id: string;
  text: string;
  font: CoverFont;
  color: string;
  role: PhotobookTextObjectRole;
};

type TextBoxInteraction =
  | { type: "idle" }
  | {
      type: "drag";
      startClientX: number;
      startClientY: number;
      startGeometry: EditableTextGeometry;
      canvasWidth: number;
      canvasHeight: number;
    }
  | {
      type: "scale";
      centerX: number;
      centerY: number;
      initialDistance: number;
      initialScale: number;
      startGeometry: EditableTextGeometry;
    }
  | {
      type: "width";
      side: "left" | "right";
      startClientX: number;
      canvasWidth: number;
      startGeometry: EditableTextGeometry;
    };

export type EditableTextBoxProps = {
  id: string;
  canvasRef: RefObject<HTMLElement | null>;
  geometry: EditableTextGeometry;
  selected: boolean;
  editable?: boolean;
  color: string;
  ariaLabel: string;
  children: ReactNode;
  minScale?: number;
  maxScale?: number;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
  chromeRadiusClassName?: string;
  onGeometryChange: (geometry: EditableTextGeometry) => void;
  onSelect: (id: string | null) => void;
  onDelete?: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function clampWidth(
  width: number,
  minWidth: number,
  maxWidth: number,
) {
  return clamp(width, minWidth, maxWidth);
}

function clampGeometry(
  geometry: EditableTextGeometry,
  minScale: number,
  maxScale: number,
  minWidth: number,
  maxWidth: number,
): EditableTextGeometry {
  const scale = clamp(geometry.scale, minScale, maxScale);
  const width = clampWidth(geometry.width, minWidth, maxWidth);
  const safeX = clamp((width * scale) / 2 + 0.015, 0.035, 0.49);
  const safeY = clamp(0.04 * scale + 0.015, 0.05, 0.16);

  return {
    x: clamp(geometry.x, safeX, 1 - safeX),
    y: clamp(geometry.y, safeY, 1 - safeY),
    scale,
    width,
  };
}

function getCanvasRect(canvasRef: RefObject<HTMLElement | null>) {
  const rect = canvasRef.current?.getBoundingClientRect();

  if (!rect || rect.width === 0 || rect.height === 0) {
    return null;
  }

  return rect;
}

export function EditableTextBox({
  id,
  canvasRef,
  geometry,
  selected,
  editable = true,
  color,
  ariaLabel,
  children,
  minScale = 0.35,
  maxScale = 2.8,
  minWidth = 0.12,
  maxWidth = 0.98,
  className,
  chromeRadiusClassName = "rounded-xl",
  onGeometryChange,
  onSelect,
  onDelete,
}: EditableTextBoxProps) {
  const interactionRef = useRef<TextBoxInteraction>({ type: "idle" });
  const [isInteracting, setIsInteracting] = useState(false);
  const showChrome = editable && (selected || isInteracting);

  function updateGeometry(nextGeometry: EditableTextGeometry) {
    onGeometryChange(
      clampGeometry(nextGeometry, minScale, maxScale, minWidth, maxWidth),
    );
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!editable) {
      return;
    }

    const rect = getCanvasRect(canvasRef);

    if (!rect) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = {
      type: "drag",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startGeometry: geometry,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
    };
    onSelect(id);
    setIsInteracting(true);
  }

  function handleScalePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!editable) {
      return;
    }

    const rect = getCanvasRect(canvasRef);

    if (!rect) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const centerX = rect.left + geometry.x * rect.width;
    const centerY = rect.top + geometry.y * rect.height;

    interactionRef.current = {
      type: "scale",
      centerX,
      centerY,
      initialDistance: Math.max(
        1,
        Math.hypot(event.clientX - centerX, event.clientY - centerY),
      ),
      initialScale: geometry.scale,
      startGeometry: geometry,
    };
    onSelect(id);
    setIsInteracting(true);
  }

  function handleWidthPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!editable) {
      return;
    }

    const rect = getCanvasRect(canvasRef);
    const side = event.currentTarget.dataset.side;

    if (!rect || (side !== "left" && side !== "right")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = {
      type: "width",
      side,
      startClientX: event.clientX,
      canvasWidth: rect.width,
      startGeometry: geometry,
    };
    onSelect(id);
    setIsInteracting(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const interaction = interactionRef.current;

    if (interaction.type === "idle") {
      return;
    }

    event.preventDefault();

    if (interaction.type === "drag") {
      updateGeometry({
        ...interaction.startGeometry,
        x:
          interaction.startGeometry.x +
          (event.clientX - interaction.startClientX) / interaction.canvasWidth,
        y:
          interaction.startGeometry.y +
          (event.clientY - interaction.startClientY) / interaction.canvasHeight,
      });
      return;
    }

    if (interaction.type === "scale") {
      const nextDistance = Math.max(
        1,
        Math.hypot(event.clientX - interaction.centerX, event.clientY - interaction.centerY),
      );

      updateGeometry({
        ...interaction.startGeometry,
        scale: interaction.initialScale * (nextDistance / interaction.initialDistance),
      });
      return;
    }

    const deltaX =
      (event.clientX - interaction.startClientX) / interaction.canvasWidth;
    const direction = interaction.side === "right" ? 1 : -1;

    updateGeometry({
      ...interaction.startGeometry,
      width: interaction.startGeometry.width + deltaX * direction,
    });
  }

  function handlePointerEnd(event: PointerEvent<HTMLElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    interactionRef.current = { type: "idle" };
    setIsInteracting(false);
  }

  return (
    <div
      role="button"
      tabIndex={editable ? 0 : -1}
      aria-label={ariaLabel}
      data-people-editable="true"
      data-photobook-editable="true"
      className={cn(
        "group absolute select-none overflow-visible touch-none transition-[box-shadow,outline-color] duration-200 before:absolute before:-inset-3 before:z-0 before:content-['']",
        chromeRadiusClassName,
        editable ? "cursor-grab active:cursor-grabbing" : "",
        isInteracting ? "cursor-grabbing" : "",
        className,
      )}
      style={{
        color,
        left: `${geometry.x * 100}%`,
        top: `${geometry.y * 100}%`,
        width: `${geometry.width * 100}%`,
        transform: `translate(-50%, -50%) scale(${geometry.scale})`,
        transformOrigin: "center",
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(id);
        }

        if (event.key === "Escape") {
          event.preventDefault();
          onSelect(null);
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div
        aria-hidden="true"
        className={cn(
          "photobook-editor-chrome pointer-events-none absolute inset-0 border border-black/[0.24] opacity-0 shadow-[0_0_0_1px_rgb(255_255_255_/_0.04)] transition-opacity duration-200 dark:border-white/[0.35] dark:shadow-[0_0_0_1px_rgb(0_0_0_/_0.18)]",
          chromeRadiusClassName,
          editable ? "group-hover:opacity-100 group-focus-visible:opacity-100" : "",
          showChrome ? "opacity-100" : "",
        )}
      />
      <div
        className="relative z-10 w-full max-w-none whitespace-pre-wrap"
        style={{ overflowWrap: "normal", wordBreak: "normal" }}
      >
        {children}
      </div>
      {editable
        ? ([
            ["-left-2.5 -top-2.5 cursor-nwse-resize", "Resize text"],
            ["-right-2.5 -top-2.5 cursor-nesw-resize", "Resize text"],
            ["-bottom-2.5 -left-2.5 cursor-nesw-resize", "Resize text"],
            ["-bottom-2.5 -right-2.5 cursor-nwse-resize", "Resize text"],
          ] as const).map(([positionClass, label]) => (
            <button
              key={positionClass}
              type="button"
              aria-label={label}
              className={cn(
                "photobook-editor-chrome absolute grid size-5 place-items-center opacity-0 transition duration-200 hover:scale-110 active:scale-95",
                positionClass,
                "group-hover:opacity-100 group-focus-visible:opacity-100",
                showChrome ? "opacity-100" : "",
              )}
              onPointerDown={handleScalePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
            >
              <span className="size-[7px] rounded-full border border-white/80 bg-black/85 shadow-[0_1px_5px_rgb(0_0_0_/_0.22)] dark:border-black/55 dark:bg-white/90" />
            </button>
          ))
        : null}
      {editable
        ? ([
            ["left", "-left-2.5 top-1/2 -translate-y-1/2 cursor-ew-resize"],
            ["right", "-right-2.5 top-1/2 -translate-y-1/2 cursor-ew-resize"],
          ] as const).map(([side, positionClass]) => (
            <button
              key={side}
              type="button"
              aria-label={`Adjust text ${side} edge`}
              className={cn(
                "photobook-editor-chrome absolute grid h-6 w-5 place-items-center opacity-0 transition duration-200 hover:scale-110 active:scale-95",
                positionClass,
                "group-hover:opacity-100 group-focus-visible:opacity-100",
                showChrome ? "opacity-100" : "",
              )}
              data-side={side}
              onPointerDown={handleWidthPointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
            >
              <span className="h-3 w-[7px] rounded-full border border-white/80 bg-black/85 shadow-[0_1px_5px_rgb(0_0_0_/_0.22)] dark:border-black/55 dark:bg-white/90" />
            </button>
          ))
        : null}
      {editable && selected && onDelete ? (
        <button
          type="button"
          aria-label="Remove text"
          className="photobook-editor-chrome absolute -right-2 -top-2 z-20 grid size-5 place-items-center rounded-full border border-white/75 bg-black/75 text-white shadow-sm transition hover:scale-105 dark:border-black/55 dark:bg-white/90 dark:text-black"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onDelete}
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
}
