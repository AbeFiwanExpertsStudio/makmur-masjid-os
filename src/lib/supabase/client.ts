import { createBrowserClient } from "@supabase/ssr";

/**
 * Singleton Supabase browser client.
 * Use this in any "use client" component or hook.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
