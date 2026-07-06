"use client";

import { useState } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

type CopyState = "idle" | "copied" | "error";

function getShortInviteUrl(inviteUrl: string) {
  try {
    const url = new URL(inviteUrl);
    const token = url.pathname.split("/").filter(Boolean).at(-1) ?? "";

    return `${url.host}/invite/${token.slice(0, 8)}…`;
  } catch {
    return inviteUrl;
  }
}

export function InviteLinkControl({ inviteUrl }: { inviteUrl: string }) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const shortInviteUrl = getShortInviteUrl(inviteUrl);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <div className="grid gap-3">
      <div
        className="min-w-0 rounded-2xl border border-foreground/10 bg-background/50 px-4 py-3 text-sm text-muted-foreground shadow-sm dark:bg-black/22"
        title={inviteUrl}
        aria-label="Invite link"
      >
        <p className="truncate">{shortInviteUrl}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={handleCopy}
        className="h-10 rounded-full border-foreground/12 bg-background/45 transition duration-300 hover:-translate-y-0.5 hover:border-foreground/24 dark:bg-white/[0.045]"
      >
        {copyState === "copied" ? (
          <Check className="size-4" />
        ) : copyState === "error" ? (
          <TriangleAlert className="size-4" />
        ) : (
          <Copy className="size-4" />
        )}
        {copyState === "copied"
          ? "Invite link copied"
          : copyState === "error"
            ? "Copy failed"
            : "Copy invite link"}
      </Button>
      {copyState === "copied" ? (
        <p className="text-xs text-muted-foreground">
          Invite link copied. Anyone you send it to can join after signing in.
        </p>
      ) : null}
      {copyState === "error" ? (
        <p className="text-xs text-destructive">
          Copy was blocked by the browser. Use your browser share controls.
        </p>
      ) : null}
    </div>
  );
}
