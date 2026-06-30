import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { AppHeader } from "@/components/rooms/app-header";
import { RoomCard } from "@/components/rooms/room-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser, getMyRooms } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const { rooms, error: roomsError } = await getMyRooms();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader email={user.email} />
      <main className="mx-auto w-full max-w-6xl px-6 py-14">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-muted-foreground">
              ClaY rooms
            </p>
            <h1 className="mt-4 text-5xl leading-tight">My Rooms</h1>
          </div>
          <Link href="/rooms/new" className={buttonVariants()}>
            <FolderPlus className="size-4" />
            Create room
          </Link>
        </div>

        {roomsError ? (
          <Card className="mt-8 border-destructive/20 bg-destructive/5">
            <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
              <div className="grid size-14 place-items-center rounded-full bg-background text-destructive">
                <FolderPlus className="size-6" />
              </div>
              <div className="max-w-lg">
                <h2 className="text-lg font-semibold">
                  We could not load your rooms
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  The dashboard is connected, but the rooms query failed. Check
                  that the latest Supabase schema has been applied.
                </p>
                <p className="mt-3 rounded-md bg-background px-3 py-2 text-left font-mono text-xs text-muted-foreground">
                  {roomsError.code ? `${roomsError.code}: ` : ""}
                  {roomsError.message}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : rooms.length > 0 ? (
          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        ) : (
          <Card className="mt-10 border-dashed bg-transparent shadow-none">
            <CardContent className="flex min-h-80 flex-col items-center justify-center gap-4 text-center">
              <div className="grid size-14 place-items-center rounded-full border text-muted-foreground">
                <FolderPlus className="size-6" />
              </div>
              <div className="max-w-md">
                <h2 className="text-lg font-semibold">No rooms yet</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Start with a trip, dinner, birthday, wedding weekend, or any
                  occasion that deserves one shared gallery.
                </p>
              </div>
              <Link href="/rooms/new" className={buttonVariants()}>
                Create your first room
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
