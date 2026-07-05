import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, ChevronLeft } from "lucide-react";
import { BetaBadge } from "@/components/photobook/beta-badge";
import { UniversalPhotobookBuilder } from "@/components/photobook/universal-photobook-builder";
import { AppHeader } from "@/components/rooms/app-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getCurrentUser,
  getOrCreateRoomPhotobook,
  getRoom,
  getRoomMembers,
  getRoomPhotos,
} from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

const messages: Record<string, string> = {
  "cover-updated": "Cover saved.",
  "cover-host-only": "Only the room host can customize the main cover.",
  "invalid-cover-settings": "Those cover settings were not valid.",
  "cover-photo-not-found": "That cover photo is not part of this room.",
  "cover-update-failed": "We could not save the cover. Try again.",
};

export default async function PhotobookPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const { roomId } = await params;
  const { message } = await searchParams;
  const room = await getRoom(roomId);

  if (!room) {
    redirect("/dashboard");
  }

  const [memberResult, photoResult, photobook] = await Promise.all([
    getRoomMembers(room.id),
    getRoomPhotos(room.id),
    getOrCreateRoomPhotobook(room.id),
  ]);
  const isHost = room.created_by === user.id;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader email={user.email} />
      <main className="mx-auto grid w-full max-w-[1600px] gap-10 px-6 py-10 sm:px-8 xl:px-10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <Link
              href={`/rooms/${room.id}`}
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "-ml-2 mb-3",
              })}
            >
              <ChevronLeft className="size-4" />
              Back to room
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold">Photobook Builder</h1>
              <BetaBadge />
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Shape the room into a memory book: cover first, people second, then
              custom pages built from everyone&apos;s photos. No printing or payments here.
            </p>
          </div>
          <div className="w-full sm:w-auto">
            <div className="grid max-w-xl gap-3 rounded-2xl border border-border/60 bg-card/75 p-4 shadow-[0_18px_55px_rgb(0_0_0_/_0.055)] backdrop-blur-xl dark:border-white/[0.11] dark:bg-white/[0.045] dark:shadow-[0_22px_70px_rgb(0_0_0_/_0.28)]">
              <div className="flex flex-wrap items-center gap-2 text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground">
                <span className="rounded-full border border-border/50 px-2.5 py-1 dark:border-white/[0.10]">
                  01 Choose page
                </span>
                <span className="rounded-full border border-border/50 px-2.5 py-1 dark:border-white/[0.10]">
                  02 Customize
                </span>
                <span className="rounded-full border border-border/50 px-2.5 py-1 dark:border-white/[0.10]">
                  03 Save page
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Choose a page, customize it, then save before moving on.
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Click any page or object to open its controls in the editor panel.
                </p>
              </div>
            </div>
          </div>
        </div>

        {message ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              {messages[message] ?? "Photobook updated."}
            </CardContent>
          </Card>
        ) : null}

        {!photobook ? (
          <Card className="border-dashed">
            <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
              <BookOpen className="size-7 text-muted-foreground" />
              <div>
                <h2 className="font-semibold">The photobook is not ready yet</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  The room host can open this page to create the first draft.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <UniversalPhotobookBuilder
            roomName={room.name}
            photobook={photobook}
            photos={photoResult.photos}
            members={memberResult.members}
            isHost={isHost}
          />
        )}
      </main>
    </div>
  );
}
