/**
 * SALAM LIT — Sign Out API
 *
 * Signs out the authenticated user by clearing the Supabase Auth session.
 *
 * Phase 14.1: Authentication Foundation
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          const refreshedResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            refreshedResponse.cookies.set(name, value, options)
          );
          Object.assign(supabaseResponse, refreshedResponse);
        },
      },
    }
  );

  await supabase.auth.signOut();

  return NextResponse.json({ success: true }, { status: 200 });
}

export async function GET(request: NextRequest) {
  // Allow GET for convenience (redirect after signout)
  const supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          const refreshedResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            refreshedResponse.cookies.set(name, value, options)
          );
          Object.assign(supabaseResponse, refreshedResponse);
        },
      },
    }
  );

  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/login", request.url));
}
