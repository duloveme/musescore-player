import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  if (!code) {
    return NextResponse.redirect(`${url.origin}/login?error=callback`);
  }
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(`${url.origin}/login?error=config`);
  }
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${url.origin}/login?error=callback`);
  }
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (process.env.NODE_ENV !== "development" && forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${next}`);
  }
  return NextResponse.redirect(`${url.origin}${next}`);
}
