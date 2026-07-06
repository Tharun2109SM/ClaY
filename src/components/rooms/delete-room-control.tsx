"use client";

import { useState, useTransition } from "react";
import { TriangleAlert, X } from "lucide-react";
import { deleteRoomAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function DeleteRoomControl({
  roomId,
  roomName,
}: {
  roomId: string;
  roomName: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [foreverConfirmation, setForeverConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canDelete =
    confirmation === roomName &&
    foreverConfirmation === "DELETE FOREVER" &&
    !isPending;

  function handleDelete() {
    setError(null);

    startTransition(async () => {
      const result = await deleteRoomAction(roomId);

      if (result?.ok === false) {
        setError(`${result.code}: ${result.message}`);
      }
    });
  }

  return (
    <div className="grid gap-4 rounded-[1.75rem] border border-white/10 bg-card/76 p-5 shadow-[0_18px_70px_rgb(0_0_0_/_0.14)] backdrop-blur dark:bg-white/[0.045]">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Settings
        </p>
        <p className="mt-2 text-sm text-foreground">Room settings</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Manage permanent room actions.
        </p>
      </div>
      <div className="rounded-2xl border border-destructive/15 bg-destructive/[0.035] p-4">
        <p className="text-sm text-destructive">Danger zone</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Permanently delete this room and its uploaded storage files.
        </p>
        <Button
          type="button"
          variant="destructive"
          className="mt-4 rounded-full border border-destructive/20"
          onClick={() => {
            setOpen(true);
            setError(null);
            setConfirmation("");
            setForeverConfirmation("");
          }}
        >
          Delete room
        </Button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-background/80 px-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-room-title"
        >
          <div className="w-full max-w-md rounded-3xl border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
                  <TriangleAlert className="size-5" />
                </span>
                <div>
                  <h2 id="delete-room-title" className="text-xl">
                    Delete room forever?
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    This will permanently delete the room, its photo records, and
                    all uploaded files from storage. This cannot be undone.
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close delete room dialog"
                className="rounded-full p-1 text-muted-foreground transition hover:text-foreground"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-2">
              <label htmlFor="delete-room-confirm" className="text-sm">
                Type <span className="font-medium text-foreground">{roomName}</span>{" "}
                to confirm.
              </label>
              <input
                id="delete-room-confirm"
                value={confirmation}
                onChange={(event) => setConfirmation(event.currentTarget.value)}
                className="h-11 rounded-2xl border bg-background px-4 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                disabled={isPending}
                autoFocus
              />
            </div>

            <div className="mt-4 grid gap-2">
              <label htmlFor="delete-room-forever-confirm" className="text-sm">
                Type{" "}
                <span className="font-medium text-foreground">DELETE FOREVER</span>{" "}
                to continue.
              </label>
              <input
                id="delete-room-forever-confirm"
                value={foreverConfirmation}
                onChange={(event) =>
                  setForeverConfirmation(event.currentTarget.value)
                }
                className="h-11 rounded-2xl border bg-background px-4 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                disabled={isPending}
              />
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="rounded-full"
                onClick={handleDelete}
                disabled={!canDelete}
              >
                {isPending ? "Deleting room and photos..." : "Delete room"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
