import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { signOutAction } from "@/app/actions";
import { Logo } from "@/components/brand/logo";
import { AuroraBackground } from "@/components/landing/aurora-background";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/supabase/queries";

const steps = [
  {
    title: "Create a room",
  },
  {
    title: "Invite your people",
  },
  {
    title: "Everyone uploads",
  },
  {
    title: "Shape the photobook",
  },
];

const landingPrimaryButton =
  "group inline-flex h-10 items-center justify-center gap-2 rounded-full border border-black/10 bg-foreground px-4 text-[0.8rem] text-background shadow-[inset_0_1px_0_rgb(255_255_255_/_0.22),0_10px_30px_rgb(0_0_0_/_0.12)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.28),0_16px_42px_rgb(0_0_0_/_0.16)] active:translate-y-0 active:scale-[0.985] sm:h-11 sm:px-5 sm:text-sm dark:border-white/25 dark:bg-[#f7efe0] dark:text-black dark:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.85),0_0_28px_rgb(255_196_87_/_0.12),0_14px_42px_rgb(0_0_0_/_0.45)] dark:hover:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.9),0_0_38px_rgb(255_196_87_/_0.18),0_18px_52px_rgb(0_0_0_/_0.5)]";

const landingHeroButtonFrame =
  "min-h-[54px] w-full min-w-0 text-base sm:min-h-[58px] sm:w-auto sm:min-w-[230px]";

const landingHeroPrimaryButton =
  `${landingHeroButtonFrame} group inline-flex items-center justify-center gap-3 rounded-full border border-black/10 bg-foreground py-1.5 pl-7 pr-2 text-background shadow-[inset_0_1px_0_rgb(255_255_255_/_0.24),0_14px_38px_rgb(0_0_0_/_0.14)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.3),0_20px_54px_rgb(0_0_0_/_0.18)] active:translate-y-0 active:scale-[0.985] dark:border-white/25 dark:bg-[#f7efe0] dark:text-black dark:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.85),0_0_34px_rgb(255_196_87_/_0.14),0_16px_50px_rgb(0_0_0_/_0.5)] dark:hover:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.9),0_0_48px_rgb(255_196_87_/_0.2),0_22px_64px_rgb(0_0_0_/_0.55)]`;

const landingSecondaryButton =
  "inline-flex h-10 items-center justify-center rounded-full border border-foreground/15 bg-foreground/[0.035] px-4 text-[0.8rem] text-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.18)] backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-foreground/30 hover:bg-foreground/[0.07] active:translate-y-0 active:scale-[0.985] sm:h-11 sm:px-5 sm:text-sm dark:border-white/15 dark:bg-white/[0.045] dark:text-white/90 dark:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.08),0_12px_34px_rgb(0_0_0_/_0.25)] dark:hover:border-white/28 dark:hover:bg-white/[0.085] dark:hover:text-white";

function MemoryRoomPreview() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto mt-10 min-h-[360px] w-full max-w-sm sm:min-h-[430px] lg:mt-0 lg:block lg:min-h-[540px] lg:max-w-md"
    >
      <div className="absolute inset-x-8 bottom-8 h-20 rounded-full bg-foreground/10 blur-3xl dark:bg-cyan-300/10" />
      <div className="absolute inset-0 rounded-[2.5rem] bg-[radial-gradient(circle_at_50%_40%,var(--muted),transparent_58%)] opacity-45 dark:bg-[radial-gradient(circle_at_50%_42%,rgb(34_211_238_/_0.14),transparent_62%)]" />
      <div className="absolute inset-0 grid place-items-center">
        <Image
          src="/assets/vintage-polaroid-camera.png"
          alt=""
          width={760}
          height={760}
          priority
          sizes="(min-width: 1024px) 430px, 70vw"
          className="h-auto w-[82%] max-w-[25rem] drop-shadow-[0_30px_70px_rgb(0_0_0_/_0.18)] dark:drop-shadow-[0_28px_90px_rgb(34_211_238_/_0.18)]"
        />
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  const isSignedIn = Boolean(user);

  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <section className="relative min-h-screen overflow-hidden">
        <AuroraBackground />
        <header className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-start gap-5 px-6 py-6 sm:h-28 sm:flex-row sm:items-center sm:justify-between sm:py-0">
          <Logo size="large" />
          <nav className="flex flex-wrap items-center gap-2 sm:gap-3">
            {isSignedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className={landingSecondaryButton}
                >
                  My Rooms
                </Link>
                <Link href="/rooms/new" className={landingPrimaryButton}>
                  New room
                </Link>
                <form action={signOutAction}>
                  <Button className={landingSecondaryButton}>
                    Sign out
                  </Button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/auth/sign-in"
                  className={landingSecondaryButton}
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/sign-up"
                  className={landingPrimaryButton}
                >
                  Create account
                </Link>
              </>
            )}
            <ThemeToggle />
          </nav>
        </header>

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-7rem)] w-full max-w-6xl items-center gap-14 px-6 pb-20 pt-10 lg:grid-cols-[1fr_0.74fr]">
          <div className="max-w-4xl">
            <div className="inline-flex flex-col items-start">
              <h1 className="font-brand text-7xl leading-none text-foreground sm:text-8xl md:text-9xl">
                ClaY.
              </h1>
              <p className="font-byline mt-3 text-2xl text-muted-foreground">
                by tharun
              </p>
            </div>
            <h2 className="mt-14 max-w-3xl text-5xl leading-tight text-foreground md:text-7xl">
              One room for every memory.
            </h2>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-muted-foreground">
              Create a private room for a trip, event, or occasion. Invite everyone,
              collect every perspective, and shape shared photos into beautiful
              photobooks.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href={isSignedIn ? "/rooms/new" : "/auth/sign-up"}
                className={landingHeroPrimaryButton}
              >
                Start a room
                <span className="grid size-10 place-items-center rounded-full bg-background/95 text-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.28)] transition-transform duration-300 ease-out group-hover:translate-x-1 sm:size-11 dark:bg-black dark:text-[#f7efe0]">
                  <ArrowRight className="size-4" />
                </span>
              </Link>
              <Link
                href="#how-it-works"
                className={`${landingSecondaryButton} ${landingHeroButtonFrame} px-8`}
              >
                How it works
              </Link>
            </div>
          </div>

          <MemoryRoomPreview />
          <div className="border-y py-6 text-sm text-muted-foreground lg:col-span-2">
            <div className="grid gap-3 sm:grid-cols-3">
              <p>Private rooms for shared memories.</p>
              <p>Every uploader stays credited.</p>
              <p>Photobook-ready from the beginning.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-t">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-24">
          <div className="max-w-2xl">
            <p className="text-sm uppercase tracking-[0.22em] text-muted-foreground">
              How it works
            </p>
            <h2 className="mt-4 text-4xl leading-tight md:text-5xl">
              Your memory, shaped in four quiet moves.
            </h2>
          </div>
          <div className="grid max-w-4xl gap-7">
            <div className="grid gap-1">
              {steps.map((step, index) => (
                <div
                  key={step.title}
                  className="group/timeline grid cursor-pointer grid-cols-[3rem_1fr] items-center gap-5 py-5 transition-opacity duration-300 ease-out active:opacity-80 sm:grid-cols-[4rem_1fr] sm:gap-7"
                >
                  <div className="flex justify-end" aria-hidden="true">
                    <span className="h-px w-6 bg-foreground/20 transition-all duration-300 ease-out group-hover/timeline:w-10 group-hover/timeline:bg-foreground group-hover/timeline:shadow-[0_0_18px_color-mix(in_oklch,var(--foreground),transparent_58%)] sm:w-8 sm:group-hover/timeline:w-12" />
                  </div>
                  <div className="grid gap-2 border-b border-border/70 pb-5 transition-colors duration-300 ease-out group-hover/timeline:border-foreground/35">
                    <p className="text-sm text-muted-foreground transition-colors duration-300 ease-out group-hover/timeline:text-foreground sm:text-base">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <h3 className="text-3xl leading-tight text-muted-foreground/70 transition-colors duration-300 ease-out group-hover/timeline:text-foreground sm:text-4xl">
                      {step.title}
                    </h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="max-w-3xl text-xl leading-8 text-muted-foreground">
            No more chasing people for photos. ClaY gives every occasion one
            private room where everyone adds their own perspective.
          </p>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-24 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="flex flex-col items-start text-muted-foreground">
            <span className="text-3xl uppercase leading-none tracking-[0.18em] sm:text-4xl">
              WHAT
            </span>
            <span className="mt-3 text-3xl uppercase leading-none tracking-[0.18em] sm:text-4xl">
              IS
            </span>
            <span className="font-brand mt-7 text-7xl leading-none text-foreground sm:text-8xl md:text-9xl">
              ClaY.
            </span>
          </div>
          <p className="max-w-3xl text-3xl leading-snug md:text-5xl">
            No more chasing people for photos after a trip. ClaY gives every
            memory its own private room — permanent, organized, and made for
            everyone’s perspective.
          </p>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-24">
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <h2 className="max-w-3xl text-4xl leading-tight md:text-6xl">
              Stop losing the photos after the event.
            </h2>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground lg:justify-self-end">
              Everyone takes pictures. Almost nobody sends them. ClaY gives the
              whole group one place to gather, sort, and keep them.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[2rem] border bg-card/50 p-6 text-muted-foreground dark:bg-white/[0.015] sm:p-8">
              <div className="flex items-center justify-between gap-4 border-b pb-6">
                <h3 className="text-2xl text-foreground">Without ClaY</h3>
                <span className="h-px w-10 bg-muted-foreground/40" />
              </div>
              <ul className="mt-8 grid gap-5 text-sm leading-6 sm:text-base">
                {[
                  "Photos stay scattered across chats",
                  "People forget to send their best shots",
                  "Nobody knows who took what",
                  "The event disappears into camera rolls",
                ].map((item) => (
                  <li key={item} className="grid grid-cols-[1.5rem_1fr] gap-3">
                    <span className="mt-2 h-px bg-muted-foreground/40" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[2rem] border border-foreground/18 bg-foreground text-background p-6 dark:bg-white dark:text-black sm:p-8">
              <div className="flex items-center justify-between gap-4 border-b border-background/20 pb-6 dark:border-black/15">
                <h3 className="text-2xl">With ClaY</h3>
                <span className="h-px w-10 bg-background/50 dark:bg-black/35" />
              </div>
              <ul className="mt-8 grid gap-5 text-sm leading-6 sm:text-base">
                {[
                  "One private room for the occasion",
                  "Each person uploads their own view",
                  "Photos stay credited to the uploader",
                  "The best ones can become a photobook",
                ].map((item) => (
                  <li key={item} className="grid grid-cols-[1.5rem_1fr] gap-3">
                    <span className="mt-2 h-px bg-background/55 dark:bg-black/35" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="max-w-4xl border-t pt-8 text-center text-sm leading-6 text-muted-foreground sm:mx-auto sm:text-base">
            Made for trips, birthdays, weddings, reunions, and the photos people
            actually want to keep.
          </p>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="relative overflow-hidden rounded-[2rem] border bg-background p-7 sm:p-10">
            <div
              aria-hidden="true"
              className="absolute right-[-12%] top-[-30%] h-72 w-72 rounded-full bg-foreground/[0.035] blur-3xl dark:bg-white/[0.045]"
            />
            <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
              <div>
                <h2 className="max-w-3xl text-4xl leading-tight md:text-6xl">
                  Create the room before the photos scatter.
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                  Send one invite. Let everyone add their photos. Build the story
                  later.
                </p>
              </div>
              <Link
                href={isSignedIn ? "/rooms/new" : "/auth/sign-up"}
                className={`${landingHeroPrimaryButton} sm:min-w-[240px]`}
              >
                Start a room
                <span className="grid size-10 place-items-center rounded-full bg-background/95 text-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.28)] transition-transform duration-300 ease-out group-hover:translate-x-1 dark:bg-black dark:text-[#f7efe0]">
                  <ArrowRight className="size-4" />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
