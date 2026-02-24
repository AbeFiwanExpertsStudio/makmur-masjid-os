import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Module-level singleton — one client for the entire browser session.
// createBrowserClient already has internal singleton semantics, but this
// ensures we never construct more than one instance even during SSR hydration.
let _client: SupabaseClient | null = null;

/**
 * Returns the shared Supabase browser client.
 * Safe to call from any "use client" component or hook.
 */
export function createClient(): SupabaseClient {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _client;
}
