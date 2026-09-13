/**
 * SALAM LIT — Supabase Client
 *
 * Provides a server-side Supabase client for PostgreSQL access.
 * Falls back to null when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set,
 * allowing in-memory fallback for local development and testing.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Get or create the server-side Supabase client.
 * Returns null if environment variables are not configured,
 * allowing services to fall back to in-memory storage.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
}

/**
 * Check whether PostgreSQL persistence is available.
 */
export function isPersistenceAvailable(): boolean {
  return getSupabaseClient() !== null;
}
