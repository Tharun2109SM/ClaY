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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type InvitePreview = {
  name: string;
  occasion: string | null;
  location: string | null;
  date_label: string | null;
};

function getInviteMessage(message: string | undefined, code: string | undefined) {
  if (message === "invalid-invite") {
    return "This invite link is no longer available.";
  }

  if (message === "join-failed") {
    return `We could not add you to this room. Try again.${
      code ? ` (${code})` : ""
    }`;
  }

  if (message) {
    return "We could not add you to this room. Try again.";
  }

  return null;
}

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ message?: string; code?: string }>;
}) {
  const { token } = await params;
  const { message, code } = await searchParams;
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
  const currentDisplayName =
    profile?.display_name && !isEmailLike(profile.display_name)
      ? profile.display_name
      : "";

  const { data: roomPreview, error: previewError } = await supabase.rpc(
    "get_invite_preview",
    { token },
  );
  const room = Array.isArray(roomPreview)
    ? ((roomPreview[0] ?? null) as InvitePreview | null)
    : ((roomPreview ?? null) as InvitePreview | null);

  if (previewError) {
    logInviteIssue("Unable to load invite preview", previewError);
  }

  const nextPath = `/invite/${token}`;
  const encodedNext = encodeURIComponent(nextPath);
  const inviteMessage = getInviteMessage(message, code);

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
            {inviteMessage ? (
              <div className="rounded-md border bg-muted px-4 py-3 text-sm text-muted-foreground">
                {inviteMessage}
              </div>
            ) : null}
            {room ? (
              <>
                <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{room.name}</p>
                  {room.occasion ? <p className="mt-1">{room.occasion}</p> : null}
                  <p className="mt-2">
                    {[room.location, room.date_label]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {user ? (
                  <form action={joinRoomAction} className="grid gap-3">
                    <input type="hidden" name="token" value={token} />
                    <div className="grid gap-2">
                      <Label htmlFor="display_name">Your name</Label>
                      <Input
                        id="display_name"
                        name="display_name"
                        placeholder="Tharun"
                        defaultValue={currentDisplayName}
                        required={needsDisplayName}
                      />
                      <p className="text-xs leading-5 text-muted-foreground">
                        This name will appear with the photos you upload.
                      </p>
                    </div>
                    <Button type="submit" className="w-full">
                      Join room
                    </Button>
                  </form>
                ) : (
                  <div className="grid gap-3">
                    <p className="text-center text-sm text-muted-foreground">
                      Create an account or sign in to join this room.
                    </p>
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
