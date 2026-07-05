import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

function getSignInRedirectUrl({
  request,
  message,
  nextPath,
}: {
  request: NextRequest;
  message: string;
  nextPath: string;
}) {
  const url = new URL("/auth/sign-in", request.url);

  url.searchParams.set("message", message);

  if (nextPath !== "/dashboard") {
    url.searchParams.set("next", nextPath);
  }

  return url;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      getSignInRedirectUrl({
        request,
        message: "invalid-callback",
        nextPath,
      }),
    );
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.redirect(
      getSignInRedirectUrl({
        request,
        message: "missing-config",
        nextPath,
      }),
    );
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.warn("[auth-callback-error]", {
      message: error.message,
      status: error.status ?? null,
      code: error.code ?? null,
    });

    return NextResponse.redirect(
      getSignInRedirectUrl({
        request,
        message: "invalid-callback",
        nextPath,
      }),
    );
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}
