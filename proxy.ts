/**
 * SALAM LIT — Proxy (Session Refresh + Route Protection)
 *
 * Next.js 16 convention: proxy.ts replaces middleware.ts.
 * Runs before routes are rendered. Refreshes Supabase Auth sessions
 * and protects authenticated routes.
 *
 * Phase 14.1: Authentication Foundation
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Public routes that do not require authentication.
 */
const PUBLIC_ROUTES = ["/login", "/signup", "/auth"];

/**
 * Check if a pathname is a public route.
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

/**
 * Check if a pathname is a static asset or internal Next.js route.
 */
function isStaticOrInternal(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js")
  );
}

/**
 * Proxy function — runs before every request.
 *
 * Responsibilities:
 * 1. Refresh Supabase Auth session cookies
 * 2. Redirect unauthenticated users away from protected routes
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets and internal routes through without processing
  if (isStaticOrInternal(pathname)) {
    return NextResponse.next();
  }

  // Create response object that we'll modify with cookie updates
  let supabaseResponse = NextResponse.next({
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
          // Set cookies on the request (for downstream server components)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Recreate the response to include updated request cookies
          supabaseResponse = NextResponse.next({
            request,
          });
          // Set cookies on the response (for the browser)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session by calling getUser().
  // This triggers token refresh if needed and writes updated cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from protected routes
  if (!user && !isPublicRoute(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login/signup to home
  if (user && isPublicRoute(pathname)) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  return supabaseResponse;
}

/**
 * Route matcher — which paths this proxy applies to.
 *
 * Excludes static files and internal Next.js routes.
 * Includes all other paths (pages and API routes).
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata)
     * - *.png, *.jpg, *.svg, *.ico (assets)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
