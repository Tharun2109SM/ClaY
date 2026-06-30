import { redirect } from "next/navigation";
import Link from "next/link";
import { joinRoomAction } from "@/app/actions";
import { Logo } from "@/components/brand/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function logInviteIssue(label: string, error: {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}) {
  console.warn(label, {
    message: error.message ?? "Unknown Supabase invite error.",
    details: error.details ?? null,
    hint: error.hint ?? null,
    code: error.code ?? null,
  });
}

function isEmailLike(value: string | null | undefined) {
  return Boolean(value && /^\S+@\S+\.\S+$/.test(value.trim()));
}

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ message?: string; code?: string; details?: string }>;
}) {
  const { token } = await params;
  const { message, code, details } = await searchParams;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect("/auth/sign-in?message=missing-config");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };
  const needsDisplayName = Boolean(
    user && (!profile?.display_name || isEmailLike(profile.display_name)),
  );

  const { data: room, error: previewError } = await supabase.rpc(
    "get_invite_preview",
    { token },
  );

  if (previewError) {
    logInviteIssue("Unable to load invite preview", previewError);
  }

  const nextPath = `/invite/${token}`;
  const encodedNext = encodeURIComponent(nextPath);

  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col justify-center gap-8">
        <Logo className="justify-center" />
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {room ? `Join ${room.name}` : "Invite not found"}
            </CardTitle>
            <CardDescription>
              {room
                ? "You were invited to a private ClaY photo room."
                : "This invite link may have been changed or removed."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {message ? (
              <div className="rounded-md border bg-muted px-4 py-3 text-sm text-muted-foreground">
                {message === "join-failed"
                  ? `We could not join this room${
                      code ? ` (${code})` : ""
                    }. ${details ?? "Try the invite link again."}`
                  : "We could not join this room. Try the invite link again."}
              </div>
            ) : null}
            {room ? (
              <>
                <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{room.name}</p>
                <p className="mt-1">{room.occasion}</p>
                <p className="mt-2">
                  {[room.location, room.date_label].filter(Boolean).join(" · ")}
                </p>
                </div>
                {user ? (
                  <form action={joinRoomAction} className="grid gap-3">
                    <input type="hidden" name="token" value={token} />
                    {needsDisplayName ? (
                      <div className="grid gap-2">
                        <label
                          htmlFor="display_name"
                          className="text-sm text-muted-foreground"
                        >
                          Your name
                        </label>
                        <input
                          id="display_name"
                          name="display_name"
                          placeholder="Tharun"
                          required
                          className="h-10 rounded-md border bg-background px-3 text-sm"
                        />
                      </div>
                    ) : null}
                    <Button type="submit" className="w-full">
                      Join room
                    </Button>
                  </form>
                ) : (
                  <div className="grid gap-3">
                    <Link
                      href={`/auth/sign-in?next=${encodedNext}`}
                      className={buttonVariants({ className: "w-full" })}
                    >
                      Sign in to join
                    </Link>
                    <Link
                      href={`/auth/sign-up?next=${encodedNext}`}
                      className={buttonVariants({
                        variant: "outline",
                        className: "w-full",
                      })}
                    >
                      Create account
                    </Link>
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
