import Link from "next/link";
import Image from "next/image";
import { Calendar, ImageIcon, MapPin, Users } from "lucide-react";
import type { RoomSummary } from "@/lib/types";

export function RoomCard({ room }: { room: RoomSummary }) {
  const isOwner = room.role === "owner";

  return (
    <Link
      href={`/rooms/${room.id}`}
      className="group block overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-none transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[0_16px_42px_rgb(0_0_0_/_0.08)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 dark:bg-card dark:hover:border-white/20 dark:hover:shadow-[0_18px_52px_rgb(0_0_0_/_0.45)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {room.cover_photo_public_url ? (
          <Image
            src={room.cover_photo_public_url}
            alt={`${room.name} cover photo`}
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
            className="object-cover transition-all duration-500 ease-out group-hover:scale-[1.015] group-hover:brightness-[1.04]"
            crossOrigin="anonymous"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_24%,rgb(255_255_255_/_0.75),transparent_24%),linear-gradient(135deg,oklch(0.96_0_0),oklch(0.88_0_0))] dark:bg-[radial-gradient(circle_at_28%_24%,rgb(255_255_255_/_0.10),transparent_24%),linear-gradient(135deg,oklch(0.16_0_0),oklch(0.08_0_0))]" />
        )}
        <div className="absolute right-4 top-4 rounded-full border border-background/40 bg-background/70 px-3 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-foreground/70 backdrop-blur">
          {room.occasion ?? "Memory"}
        </div>
      </div>

      <div className="grid gap-6 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              ClaY room
            </p>
            <h2 className="mt-2 text-3xl leading-[1.15] text-foreground">
              {room.name}
            </h2>
          </div>
          {isOwner ? (
            <span className="shrink-0 rounded-full border px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
              Owner
            </span>
          ) : null}
        </div>

        <div className="grid gap-4 border-t pt-4 text-sm text-muted-foreground">
          <div className="grid gap-2">
            {room.location ? (
              <span className="flex items-center gap-2">
                <MapPin className="size-4" />
                {room.location}
              </span>
            ) : null}
            {room.date_label ? (
              <span className="flex items-center gap-2">
                <Calendar className="size-4" />
                {room.date_label}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em]">
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
              <Users className="size-3.5" />
              {room.member_count} member{room.member_count === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
              <ImageIcon className="size-3.5" />
              {room.photo_count} photo{room.photo_count === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
