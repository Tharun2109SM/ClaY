import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = "default",
}: {
  className?: string;
  size?: "default" | "large";
}) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex flex-col items-start gap-0.5 text-foreground transition-opacity hover:opacity-70",
        className,
      )}
    >
      <span
        className={cn(
          "font-brand leading-none",
          size === "large" ? "text-5xl" : "text-3xl",
        )}
      >
        ClaY.
      </span>
      <span
        className={cn(
          "font-byline leading-none text-muted-foreground",
          size === "large" ? "text-base" : "text-sm",
        )}
      >
        by tharun
      </span>
    </Link>
  );
}
