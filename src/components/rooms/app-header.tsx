import Link from "next/link";
import { Plus } from "lucide-react";
import { signOutAction } from "@/app/actions";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function AppHeader({ email }: { email?: string | null }) {
  const isSignedIn = Boolean(email);

  return (
    <header className="border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-6">
        <Logo />
        <nav className="flex items-center gap-3">
          {isSignedIn ? (
            <>
              <Link
                href="/dashboard"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                My Rooms
              </Link>
              <Link href="/rooms/new" className={buttonVariants({ size: "sm" })}>
                <Plus className="size-4" />
                New room
              </Link>
              <Separator orientation="vertical" className="hidden h-6 sm:block" />
              <form action={signOutAction}>
                <Button variant="outline" size="sm">
                  Sign out
                </Button>
              </form>
              <ThemeToggle />
            </>
          ) : (
            <>
              <Link
                href="/auth/sign-in"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Sign in
              </Link>
              <Link href="/auth/sign-up" className={buttonVariants({ size: "sm" })}>
                Create account
              </Link>
              <ThemeToggle />
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
