"use client";

import { useState } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CopyState = "idle" | "copied" | "error";

export function InviteLinkControl({ inviteUrl }: { inviteUrl: string }) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

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
      <Input readOnly value={inviteUrl} aria-label="Invite link" />
      <Button type="button" variant="outline" onClick={handleCopy}>
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
          Anyone with this link can request to join this room.
        </p>
      ) : null}
      {copyState === "error" ? (
        <p className="text-xs text-destructive">
          Copy was blocked by the browser. Select the link above instead.
        </p>
      ) : null}
    </div>
  );
}
