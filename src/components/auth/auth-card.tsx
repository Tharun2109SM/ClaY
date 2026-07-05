import Link from "next/link";
import { signInAction, signUpAction } from "@/app/actions";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const messages: Record<string, string> = {
  "missing-config":
    "Supabase environment variables are missing. Add them to .env.local to enable auth.",
  "invalid-credentials": "Those credentials do not match an account.",
  "unable-to-create-account": "We could not create that account. Try again.",
  "confirm-email":
    "Account created. Check your email to confirm it, then sign in to join this room.",
  "invalid-callback":
    "We could not confirm that sign-in link. Sign in to continue.",
};

export function AuthCard({
  mode,
  message,
  next,
}: {
  mode: "sign-in" | "sign-up";
  message?: string;
  next?: string;
}) {
  const isSignUp = mode === "sign-up";
  const nextPath = next?.startsWith("/") && !next.startsWith("//") ? next : "";
  const alternateAuthHref = new URLSearchParams();
  const signInContinueHref = new URLSearchParams();

  if (nextPath) {
    alternateAuthHref.set("next", nextPath);
    signInContinueHref.set("next", nextPath);
  }

  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center gap-10">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>
        <section className="grid gap-8 border-t pt-10">
          <div>
            <h1 className="text-4xl leading-tight">
              {isSignUp ? "Create your private room." : "Welcome back."}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {isSignUp
                ? "Start a permanent photo room for the people who were there."
                : "Sign in to view your rooms, invites, and shared galleries."}
            </p>
          </div>
          {message ? (
            <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
              {messages[message] ?? "Something needs your attention."}
              {message === "confirm-email" ? (
                <Link
                  href={`/auth/sign-in${
                    signInContinueHref.size > 0
                      ? `?${signInContinueHref.toString()}`
                      : ""
                  }`}
                  className="mt-3 block font-medium text-foreground underline-offset-4 hover:underline"
                >
                  After confirming, sign in to continue
                </Link>
              ) : null}
            </div>
          ) : null}
          <form
            action={isSignUp ? signUpAction : signInAction}
            className="grid gap-4"
          >
            {nextPath ? (
              <input type="hidden" name="next" value={nextPath} />
            ) : null}
            {isSignUp ? (
              <div className="grid gap-2">
                <Label htmlFor="display_name">Name</Label>
                <Input
                  id="display_name"
                  name="display_name"
                  placeholder="Tharun"
                  required
                />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                required
              />
            </div>
            <Button type="submit" className="mt-2 w-full">
              {isSignUp ? "Create account" : "Sign in"}
            </Button>
          </form>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {isSignUp ? "Already have an account?" : "New to ClaY?"}{" "}
            <Link
              href={`${isSignUp ? "/auth/sign-in" : "/auth/sign-up"}${
                alternateAuthHref.size > 0
                  ? `?${alternateAuthHref.toString()}`
                  : ""
              }`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {isSignUp ? "Sign in" : "Create one"}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
