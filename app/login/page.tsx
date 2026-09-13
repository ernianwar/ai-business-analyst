"use client";

import { useState } from "react";
import { createClient } from "@/lib/db/supabase-browser";
import Link from "next/link";

/**
 * SALAM LIT — Login Page
 *
 * Email/password authentication via Supabase Auth.
 * Phase 14.1: Authentication Foundation
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Redirect to home on success
    window.location.href = "/";
  }

  return (
    <main className="min-h-screen bg-[var(--office-bg)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[var(--office-accent)]">
            SALAM LIT
          </p>
          <h1 className="mt-3 text-2xl font-bold text-[var(--office-text-primary)]">
            AI Business Office
          </h1>
          <p className="mt-2 text-sm text-[var(--office-text-secondary)]">
            Sign in to your AI workforce
          </p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleLogin}
          className="rounded-2xl border border-[var(--office-border)] bg-[var(--office-surface)] p-8 space-y-6"
        >
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-[var(--office-text-secondary)] mb-2"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-lg border border-[var(--office-border)] bg-[var(--office-surface-elevated)] px-4 py-3 text-[var(--office-text-primary)] outline-none focus:border-[var(--office-accent)] transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[var(--office-text-secondary)] mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-[var(--office-border)] bg-[var(--office-surface-elevated)] px-4 py-3 text-[var(--office-text-primary)] outline-none focus:border-[var(--office-accent)] transition-colors"
              placeholder="Your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[var(--office-accent)] px-6 py-3 font-semibold text-white hover:bg-[var(--office-accent-hover)] disabled:opacity-60 transition-colors"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-[var(--office-text-muted)]">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="text-[var(--office-accent)] hover:text-[var(--office-accent-hover)] transition-colors"
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
