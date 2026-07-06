import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { BookOpen, Images, MapPin, Sparkles, Users } from "lucide-react";
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
  const roomMetadata =
    [room.occasion, room.location, room.date_label].filter(Boolean).join(" · ") ||
    "A private shared photo room.";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader email={user.email} />
      <main className="mx-auto grid w-full max-w-[1500px] gap-10 px-5 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(340px,0.9fr)] xl:gap-12">
          <section className="grid min-w-0 gap-7">
            <div className="group relative min-h-[520px] overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-[0_24px_90px_rgb(0_0_0_/_0.32)] ring-1 ring-white/[0.03] transition duration-300 hover:border-white/18 dark:border-white/10">
              {room.cover_photo_public_url ? (
                <div className="absolute inset-0 bg-muted">
                  <Image
                    src={room.cover_photo_public_url}
                    alt={`${room.name} cover photo`}
                    fill
                    priority
                    sizes="(min-width: 1280px) 960px, 100vw"
                    className="object-cover transition duration-700 ease-out group-hover:scale-[1.025]"
                    crossOrigin="anonymous"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(247,239,224,0.16),transparent_30%),radial-gradient(circle_at_78%_10%,rgba(255,255,255,0.09),transparent_24%),linear-gradient(145deg,#090909,#000)]" />
              )}
              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.10),rgba(0,0,0,0.28)_44%,rgba(0,0,0,0.92))]" />
              <div className="relative z-10 flex min-h-[520px] flex-col justify-between p-5 sm:p-7 lg:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <Badge className="h-7 rounded-full border border-white/15 bg-black/35 px-3 text-[0.68rem] uppercase tracking-[0.2em] text-white/82 shadow-sm backdrop-blur-md hover:bg-black/35">
                    Clay room
                  </Badge>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge className="h-7 rounded-full border border-white/15 bg-white/10 px-3 text-white/82 backdrop-blur-md hover:bg-white/10">
                      Permanent room
                    </Badge>
                    <Badge className="h-7 rounded-full border border-white/15 bg-white/10 px-3 text-white/82 backdrop-blur-md hover:bg-white/10">
                      {isHost ? "Host" : "Member"}
                    </Badge>
                    <Badge className="h-7 rounded-full border border-white/15 bg-white/10 px-3 text-white/82 backdrop-blur-md hover:bg-white/10">
                      {photos.length} photo{photos.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </div>

                <div className="max-w-4xl">
                  <div className="mb-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.22em] text-white/58">
                    <Sparkles className="size-3.5" />
                    Shared memory space
                  </div>
                  <h1 className="max-w-4xl text-5xl leading-[0.95] text-[#fff8ea] sm:text-6xl lg:text-7xl">
                    {room.name}
                  </h1>
                  <p className="mt-4 flex max-w-2xl items-center gap-2 text-sm leading-6 text-white/68 sm:text-base">
                    <MapPin className="size-4 shrink-0 text-white/40" />
                    <span>{roomMetadata}</span>
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <Link
                      href={`/rooms/${room.id}/photobook`}
                      className={buttonVariants({
                        variant: "outline",
                        className:
                          "h-11 rounded-full border-white/20 bg-white/10 px-5 text-white shadow-[0_16px_45px_rgb(0_0_0_/_0.28)] backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-white/34 hover:bg-white/16 hover:text-white [&_span]:border-white/24 [&_span]:text-white/78 [&_svg]:text-white",
                      })}
                    >
                      <BookOpen className="size-4" />
                      Photobook
                      <BetaBadge />
                    </Link>
                    <Button
                      variant="outline"
                      disabled
                      className="h-11 rounded-full border-white/14 bg-white/8 px-5 text-white/78 opacity-100 backdrop-blur-md disabled:opacity-100"
                    >
                      <Images className="size-4" />
                      {photos.length} photo{photos.length === 1 ? "" : "s"}
                    </Button>
                  </div>
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
          </section>

          <aside className="grid content-start gap-5 lg:sticky lg:top-24">
            <Card className="rounded-[1.75rem] border-white/10 bg-card/76 shadow-[0_18px_70px_rgb(0_0_0_/_0.18)] backdrop-blur dark:border-white/10 dark:bg-white/[0.045]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Room circle
                    </p>
                    <CardTitle className="mt-2 flex items-center gap-2 text-base">
                      <Users className="size-4" />
                      Members
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="rounded-full">
                    {members.length}
                  </Badge>
                </div>
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

            <Card className="rounded-[1.75rem] border-white/10 bg-card/76 shadow-[0_18px_70px_rgb(0_0_0_/_0.14)] backdrop-blur dark:border-white/10 dark:bg-white/[0.045]">
              <CardHeader className="pb-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Invite
                </p>
                <CardTitle className="text-base">Share this room</CardTitle>
                <p className="text-sm leading-6 text-muted-foreground">
                  Invite people to add their perspective.
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <InviteLinkControl inviteUrl={inviteUrl} />
              </CardContent>
            </Card>

            {isHost ? (
              <DeleteRoomControl roomId={room.id} roomName={room.name} />
            ) : null}
          </aside>
        </div>

        <PhotoGallery
          roomId={room.id}
          members={members}
          photos={photos}
          error={galleryError}
          isHost={isHost}
          coverPhotoId={room.cover_photo_id}
          currentUserId={user.id}
        />
      </main>
    </div>
  );
}
