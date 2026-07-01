"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

const TICKS = Array.from({ length: 56 }, (_, index) => index);
const KEYBOARD_SMALL_STEP = 0.04;
const KEYBOARD_LARGE_STEP = 0.16;

function clampProgress(value: number) {
  return Math.min(1, Math.max(0, value));
}

function getMaxScroll() {
  return Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  );
}

function getScrollProgress() {
  const maxScroll = getMaxScroll();

  if (maxScroll === 0) {
    return 0;
  }

  return clampProgress(window.scrollY / maxScroll);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ScrollProgressRail() {
  const railRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const previousUserSelectRef = useRef("");
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    function updateProgress() {
      setProgress(getScrollProgress());
    }

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
      document.body.style.userSelect = previousUserSelectRef.current;

      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  function getProgressFromPointer(clientY: number) {
    const rail = railRef.current;

    if (!rail) {
      return progress;
    }

    const rect = rail.getBoundingClientRect();

    if (rect.height === 0) {
      return progress;
    }

    return clampProgress((clientY - rect.top) / rect.height);
  }

  function scrollToProgress(nextProgress: number, smooth = false) {
    const targetProgress = clampProgress(nextProgress);
    const maxScroll = getMaxScroll();

    setProgress(targetProgress);

    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = window.requestAnimationFrame(() => {
      window.scrollTo({
        top: targetProgress * maxScroll,
        behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
      });
      rafRef.current = null;
    });
  }

  function startDragging(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    isDraggingRef.current = true;
    setIsDragging(true);
    previousUserSelectRef.current = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    scrollToProgress(getProgressFromPointer(event.clientY));
  }

  function drag(event: PointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current) {
      return;
    }

    event.preventDefault();
    scrollToProgress(getProgressFromPointer(event.clientY));
  }

  function stopDragging(event: PointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    isDraggingRef.current = false;
    setIsDragging(false);
    document.body.style.userSelect = previousUserSelectRef.current;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentProgress = getScrollProgress();
    let nextProgress: number | null = null;

    if (event.key === "ArrowUp") {
      nextProgress = currentProgress - KEYBOARD_SMALL_STEP;
    }

    if (event.key === "ArrowDown") {
      nextProgress = currentProgress + KEYBOARD_SMALL_STEP;
    }

    if (event.key === "PageUp") {
      nextProgress = currentProgress - KEYBOARD_LARGE_STEP;
    }

    if (event.key === "PageDown") {
      nextProgress = currentProgress + KEYBOARD_LARGE_STEP;
    }

    if (event.key === "Home") {
      nextProgress = 0;
    }

    if (event.key === "End") {
      nextProgress = 1;
    }

    if (nextProgress === null) {
      return;
    }

    event.preventDefault();
    scrollToProgress(nextProgress, true);
  }

  const activeTick = Math.round(progress * (TICKS.length - 1));

  return (
    <div
      ref={railRef}
      role="scrollbar"
      aria-label="Page scroll progress"
      aria-orientation="vertical"
      aria-controls="clay-landing-page"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      tabIndex={0}
      className={cn(
        "fixed left-3 top-1/2 z-50 hidden h-[72vh] w-12 -translate-y-1/2 touch-none select-none items-center justify-center opacity-45 outline-none transition-opacity duration-300 ease-out md:flex",
        "cursor-grab hover:opacity-80 focus-visible:opacity-90",
        isDragging && "cursor-grabbing opacity-95",
      )}
      onPointerDown={startDragging}
      onPointerMove={drag}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onKeyDown={handleKeyDown}
    >
      <div className="flex h-full w-full flex-col items-center justify-between py-1">
        {TICKS.map((tick) => {
          const distanceFromActive = Math.abs(tick - activeTick);
          const isActive = distanceFromActive === 0;
          const isNear = distanceFromActive <= 2;

          return (
            <span
              key={tick}
              className={cn(
                "h-px rounded-full bg-foreground/25 transition-all duration-200 ease-out dark:bg-white/24",
                isActive
                  ? "w-7 bg-foreground shadow-[0_0_16px_rgb(0_0_0_/_0.22)] dark:bg-white dark:shadow-[0_0_18px_rgb(255_255_255_/_0.42)]"
                  : "w-3.5",
                isNear && !isActive && "w-5 bg-foreground/45 dark:bg-white/42",
                isDragging && isActive && "w-9 shadow-[0_0_22px_rgb(0_0_0_/_0.28)] dark:shadow-[0_0_24px_rgb(255_255_255_/_0.5)]",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
