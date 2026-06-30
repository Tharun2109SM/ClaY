"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

const toggleButtonClass =
  "size-10 rounded-full border border-foreground/15 bg-foreground/[0.035] text-foreground/80 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.18)] backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:rotate-12 hover:border-foreground/30 hover:bg-foreground/[0.07] hover:text-foreground active:translate-y-0 active:scale-95 motion-reduce:hover:rotate-0 dark:border-white/15 dark:bg-white/[0.045] dark:text-white/80 dark:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.08),0_0_24px_rgb(255_244_218_/_0.08)] dark:hover:border-white/28 dark:hover:bg-white/[0.085] dark:hover:text-white dark:hover:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.12),0_0_30px_rgb(255_196_87_/_0.12)]";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");

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
        className={toggleButtonClass}
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
      className={toggleButtonClass}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
