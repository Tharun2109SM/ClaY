"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";
type ThemeToggleVariant = "default" | "intro";

const toggleButtonClass =
  "group size-10 rounded-full border border-foreground/15 bg-foreground/[0.035] text-foreground/80 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.18)] backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:rotate-12 hover:border-foreground/30 hover:bg-foreground/[0.07] hover:text-foreground active:translate-y-0 active:scale-95 motion-reduce:hover:rotate-0 dark:border-white/15 dark:bg-white/[0.045] dark:text-white/80 dark:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.08),0_0_24px_rgb(255_244_218_/_0.08)] dark:hover:border-white/28 dark:hover:bg-white/[0.085] dark:hover:text-white dark:hover:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.12),0_0_30px_rgb(255_196_87_/_0.12)]";

const introToggleButtonClass =
  "group size-11 rounded-full border border-black/12 bg-white/45 text-black/75 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.72),0_12px_34px_rgb(0_0_0_/_0.08)] backdrop-blur-2xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-black/22 hover:bg-white/65 hover:text-black hover:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.82),0_16px_42px_rgb(0_0_0_/_0.12)] active:translate-y-0 active:scale-95 motion-reduce:transition-none dark:border-white/14 dark:bg-white/[0.06] dark:text-[#f7efe0] dark:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.08),0_0_0_1px_rgb(255_255_255_/_0.02)] dark:hover:border-white/24 dark:hover:bg-white/[0.1] dark:hover:text-white dark:hover:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.12),0_0_32px_rgb(255_196_87_/_0.14),0_16px_44px_rgb(0_0_0_/_0.28)] sm:size-12";

export function ThemeToggle({
  variant = "default",
}: {
  variant?: ThemeToggleVariant;
}) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const buttonClass =
    variant === "intro" ? introToggleButtonClass : toggleButtonClass;
  const iconClass = cn(
    "size-4 transition-transform duration-300 ease-out motion-reduce:transition-none",
    variant === "intro" && "group-hover:rotate-12 sm:size-[1.05rem]",
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const savedTheme = localStorage.getItem("clay-theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const resolvedTheme = savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : prefersDark
          ? "dark"
          : "light";

      setTheme(resolvedTheme);
      document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
      setMounted(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("clay-theme", theme);
  }, [mounted, theme]);

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={buttonClass}
        aria-label="Theme toggle loading"
        disabled
      >
        <span className="size-4" aria-hidden="true" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={buttonClass}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
    >
      {theme === "dark" ? (
        <Sun className={iconClass} />
      ) : (
        <Moon className={iconClass} />
      )}
    </Button>
  );
}
