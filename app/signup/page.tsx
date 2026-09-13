"use client";

import { useState } from "react";
import { createClient } from "@/lib/db/supabase-browser";
import Link from "next/link";

/**
 * SALAM LIT — Signup Page
 *
 * Email/password registration via Supabase Auth.
 * Phase 14.1: Authentication Foundation
 */
export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || null,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <main className="min-h-screen bg-[var(--office-bg)] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl border border-[var(--office-border)] bg-[var(--office-surface)] p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[var(--office-accent)]">
              SALAM LIT
            </p>
            <h1 className="mt-4 text-2xl font-bold text-[var(--office-text-primary)]">
              Check your email
            </h1>
            <p className="mt-3 text-sm text-[var(--office-text-secondary)]">
              We&apos;ve sent a confirmation link to{" "}
              <span className="font-medium text-[var(--office-text-primary)]">
                {email}
              </span>
              . Please check your inbox and verify your account.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-full bg-[var(--office-accent)] px-6 py-3 font-semibold text-white hover:bg-[var(--office-accent-hover)] transition-colors"
            >
              Go to Sign In
            </Link>
          </div>
        </div>
      </main>
    );
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
            Create your account to get started
          </p>
        </div>

        {/* Signup Form */}
        <form
          onSubmit={handleSignup}
          className="rounded-2xl border border-[var(--office-border)] bg-[var(--office-surface)] p-8 space-y-6"
        >
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-[var(--office-text-secondary)] mb-2"
            >
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              className="w-full rounded-lg border border-[var(--office-border)] bg-[var(--office-surface-elevated)] px-4 py-3 text-[var(--office-text-primary)] outline-none focus:border-[var(--office-accent)] transition-colors"
              placeholder="Your name"
            />
          </div>

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
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-lg border border-[var(--office-border)] bg-[var(--office-surface-elevated)] px-4 py-3 text-[var(--office-text-primary)] outline-none focus:border-[var(--office-accent)] transition-colors"
              placeholder="At least 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[var(--office-accent)] px-6 py-3 font-semibold text-white hover:bg-[var(--office-accent-hover)] disabled:opacity-60 transition-colors"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-[var(--office-text-muted)]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[var(--office-accent)] hover:text-[var(--office-accent-hover)] transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
