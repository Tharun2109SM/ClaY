import { redirect } from "next/navigation";
import { createRoomAction } from "@/app/actions";
import { AppHeader } from "@/components/rooms/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function NewRoomPage({
  searchParams,
}: {
  searchParams: Promise<{
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const { message, code, details, hint } = await searchParams;
  const errorMessage = (() => {
    if (message === "profile-check-failed") {
      return "We could not confirm your profile before creating the room.";
    }

    if (message === "owner-membership-failed") {
      return "The room was created, but we could not add you as the host.";
    }

    if (message === "missing-config") {
      return "Supabase is not configured for this app.";
    }

    return "We could not create the room.";
  })();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader email={user.email} />
      <main className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-20">
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            New memory room
          </p>
          <h1 className="mt-5 text-4xl leading-tight sm:text-5xl">
            Create a room
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
            Give this memory a permanent home.
          </p>
        </div>

        {message ? (
          <div className="mb-8 grid gap-2 rounded-2xl border bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
            <p className="text-foreground">{errorMessage}</p>
            {code ? (
              <p className="font-mono text-xs">
                Code: <span>{code}</span>
              </p>
            ) : null}
            {details ? <p>{details}</p> : null}
            {hint ? <p>{hint}</p> : null}
          </div>
        ) : null}

        <form action={createRoomAction} className="grid gap-7">
          <div className="grid gap-2.5">
            <Label
              htmlFor="name"
              className="text-xs font-normal uppercase tracking-[0.18em] text-muted-foreground"
            >
              Room name
            </Label>
            <Input
              id="name"
              name="name"
              placeholder="Goa monsoon weekend"
              required
              className="h-14 rounded-2xl border-border bg-transparent px-4 text-base shadow-none placeholder:text-muted-foreground/45 focus-visible:ring-2"
            />
          </div>

          <div className="grid gap-2.5">
            <Label
              htmlFor="occasion"
              className="text-xs font-normal uppercase tracking-[0.18em] text-muted-foreground"
            >
              Occasion
            </Label>
            <Textarea
              id="occasion"
              name="occasion"
              placeholder="Trip, birthday, wedding, reunion..."
              rows={3}
              className="min-h-28 resize-none rounded-2xl border-border bg-transparent px-4 py-4 text-base shadow-none placeholder:text-muted-foreground/45 focus-visible:ring-2"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2.5">
              <Label
                htmlFor="location"
                className="text-xs font-normal uppercase tracking-[0.18em] text-muted-foreground"
              >
                Location
              </Label>
              <Input
                id="location"
                name="location"
                placeholder="Goa"
                className="h-14 rounded-2xl border-border bg-transparent px-4 text-base shadow-none placeholder:text-muted-foreground/45 focus-visible:ring-2"
              />
            </div>
            <div className="grid gap-2.5">
              <Label
                htmlFor="date_label"
                className="text-xs font-normal uppercase tracking-[0.18em] text-muted-foreground"
              >
                Date
              </Label>
              <Input
                id="date_label"
                name="date_label"
                placeholder="June 2026"
                className="h-14 rounded-2xl border-border bg-transparent px-4 text-base shadow-none placeholder:text-muted-foreground/45 focus-visible:ring-2"
              />
            </div>
          </div>

          <div className="mt-3 grid gap-3">
            <Button
              type="submit"
              className="h-12 w-full rounded-full border border-black/10 bg-foreground px-6 text-background shadow-[inset_0_1px_0_rgb(255_255_255_/_0.22),0_10px_30px_rgb(0_0_0_/_0.10)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-foreground hover:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.28),0_16px_42px_rgb(0_0_0_/_0.14)] active:translate-y-0 active:scale-[0.985] sm:w-fit dark:border-white/20 dark:bg-[#f7efe0] dark:text-black dark:hover:bg-[#f7efe0]"
            >
              Create permanent room
            </Button>
            <p className="text-sm text-muted-foreground">
              You can invite people after the room is created.
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}
