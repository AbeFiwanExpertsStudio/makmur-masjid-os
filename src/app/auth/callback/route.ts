import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Handles the OAuth / magic-link / password-reset callback.
 * Supabase redirects here with ?code=... after a password reset email click.
 * We exchange the code for a session, then redirect to `next` (default: /).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";
  const origin = url.origin;

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // If exchange failed, still redirect but to the home page
    console.error("[auth/callback] exchangeCodeForSession error:", error.message);
  }

  // Fallback — redirect to home
  return NextResponse.redirect(`${origin}/`);
}
