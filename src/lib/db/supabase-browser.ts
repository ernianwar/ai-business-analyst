/**
 * SALAM LIT — Supabase Browser Client
 *
 * Creates a Supabase client for use in Client Components.
 * Uses @supabase/ssr createBrowserClient with automatic cookie handling.
 *
 * IMPORTANT: This client uses the ANON key only.
 * The service role key must NEVER be exposed to the browser.
 */

import { createBrowserClient } from "@supabase/ssr";

/**
 * Create a user-scoped Supabase client for use in Client Components.
 *
 * Returns a singleton — safe to call multiple times in the browser.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
