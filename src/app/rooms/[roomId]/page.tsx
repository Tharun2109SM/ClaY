import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { BookOpen, Images, Users } from "lucide-react";
import { BetaBadge } from "@/components/photobook/beta-badge";
import { AppHeader } from "@/components/rooms/app-header";
import { DeleteRoomControl } from "@/components/rooms/delete-room-control";
import { InviteLinkControl } from "@/components/rooms/invite-link-control";
import { MemberList } from "@/components/rooms/member-list";
import { PhotoGallery } from "@/components/rooms/photo-gallery";
import { PhotoUploadForm } from "@/components/rooms/photo-upload-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSiteUrl } from "@/lib/env";
import {
  getCurrentUser,
  getRoom,
  getRoomMembers,
  getRoomPhotos,
} from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

function getRequestSiteUrl(headersList: Headers) {
  const configuredUrl = getSiteUrl();

  if (configuredUrl !== "http://localhost:3000") {
    return configuredUrl;
  }

  const host =
    headersList.get("x-forwarded-host") ?? headersList.get("host");

  if (!host) {
    return configuredUrl;
  }

  const protocol =
    headersList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${protocol}://${host}`;
}

export default async function RoomDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{
    upload?: string;
    gallery?: string;
    message?: string;
    missing?: string;
    count?: string;
  }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const { roomId } = await params;
  const uploadState = await searchParams;
  const room = await getRoom(roomId);

  if (!room) {
    notFound();
  }

  const { members, error: membersError } = await getRoomMembers(room.id);
  const { photos, error: galleryError } = await getRoomPhotos(room.id);
  const requestHeaders = await headers();
  const inviteUrl = `${getRequestSiteUrl(requestHeaders)}/invite/${
    room.invite_token
  }`;
  const isHost = room.created_by === user.id;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader email={user.email} />
      <main className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
        <section className="grid gap-8">
          <div className="overflow-hidden rounded-xl border bg-card">
            {room.cover_photo_public_url ? (
              <div className="relative h-72 bg-muted sm:h-96">
                <Image
                  src={room.cover_photo_public_url}
                  alt={`${room.name} cover photo`}
                  fill
                  priority
                  sizes="(min-width: 1024px) 760px, 100vw"
                  className="object-cover"
                  crossOrigin="anonymous"
                  unoptimized
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-5xl leading-tight">{room.name}</h1>
                  <Badge variant="secondary">Permanent room</Badge>
                  {isHost ? <Badge>Host</Badge> : null}
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {[room.occasion, room.location, room.date_label]
                    .filter(Boolean)
                    .join(" · ") || "A private shared photo room."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/rooms/${room.id}/photobook`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  <BookOpen className="size-4" />
                  Photobook
                  <BetaBadge />
                </Link>
                <Button variant="outline" disabled>
                  <Images className="size-4" />
                  {photos.length} photo{photos.length === 1 ? "" : "s"}
                </Button>
              </div>
            </div>
          </div>

          {uploadState.gallery === "error" ? (
            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="p-4 text-sm text-destructive">
                {uploadState.message === "cover-not-allowed"
                  ? "Only the room host can change the cover photo."
                  : uploadState.message === "favorite-failed"
                    ? "We could not update that favorite. Try again."
                    : "We could not update perspectives. Try again."}
              </CardContent>
            </Card>
          ) : null}
          {uploadState.gallery === "success" ? (
            <Card className="border-[color-mix(in_oklch,var(--accent),var(--foreground)_10%)] bg-accent/50">
              <CardContent className="p-4 text-sm text-accent-foreground">
                Cover photo updated.
              </CardContent>
            </Card>
          ) : null}

          <PhotoUploadForm
            roomId={room.id}
            uploadStatus={uploadState.upload}
            uploadMessage={uploadState.message}
            missingConfigKey={uploadState.missing}
            uploadCount={uploadState.count}
          />

          <PhotoGallery
            roomId={room.id}
            members={members}
            photos={photos}
            error={galleryError}
            isHost={isHost}
            coverPhotoId={room.cover_photo_id}
            currentUserId={user.id}
          />
        </section>

        <aside className="grid content-start gap-6">
          <Card className="rounded-3xl shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" />
                Members
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {membersError ? (
                <div className="mb-3 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {membersError}
                </div>
              ) : null}
              <MemberList members={members} />
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Invite people</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <InviteLinkControl inviteUrl={inviteUrl} />
            </CardContent>
          </Card>

          {isHost ? (
            <DeleteRoomControl roomId={room.id} roomName={room.name} />
          ) : null}
        </aside>
      </main>
    </div>
  );
}
