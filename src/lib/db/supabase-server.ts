/**
 * SALAM LIT — Supabase Server Client (User-Scoped)
 *
 * Creates a Supabase client for use in Server Components, Route Handlers,
 * and Server Actions. The client reads the user's session from cookies
 * and enforces RLS.
 *
 * Uses @supabase/ssr createServerClient with Next.js cookie adapter.
 *
 * IMPORTANT: This client uses the ANON key, not the service role key.
 * RLS is enforced. This is the correct client for user-facing operations.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Create a user-scoped Supabase client for use in Server Components,
 * Route Handlers, and Server Actions.
 *
 * Must be called per-request — never reuse across requests.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if you have proxy.ts refreshing sessions.
          }
        },
      },
    }
  );
}
