import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, ChevronLeft } from "lucide-react";
import { BetaBadge } from "@/components/photobook/beta-badge";
import { CoverCustomizer } from "@/components/photobook/cover-customizer";
import { CustomPhotobookEditor } from "@/components/photobook/custom-photobook-editor";
import { PeoplePage } from "@/components/photobook/people-page";
import { AppHeader } from "@/components/rooms/app-header";
import { Badge } from "@/components/ui/badge";
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
      <main className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-10">
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
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <Badge className="w-fit gap-2">
              <BookOpen className="size-3" />
              ClaY. by tharun
            </Badge>
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
          <>
            <section className="grid gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Page 1
                </p>
                <h2 className="mt-2 text-2xl">Cover</h2>
              </div>
              {!isHost ? (
                <p className="text-sm text-muted-foreground">
                  Only the host can customize the room photobook cover.
                </p>
              ) : null}
              <CoverCustomizer
                roomId={room.id}
                photobook={photobook}
                photos={photoResult.photos}
                isHost={isHost}
              />
            </section>

            <section className="grid gap-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Page 2
              </p>
              <PeoplePage members={memberResult.members} />
            </section>

            <CustomPhotobookEditor photos={photoResult.photos} roomName={room.name} />
          </>
        )}
      </main>
    </div>
  );
}
