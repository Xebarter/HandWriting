'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AppLogo } from '@/components/AppLogo';

function formatAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials')) {
    return 'Incorrect password for this email.';
  }

  if (lower.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }

  if (lower.includes('user already registered')) {
    return 'Incorrect password for this email.';
  }

  return message;
}

function isInvalidCredentialsError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('invalid login credentials');
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => searchParams.get('next') || '/', [searchParams]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const completeSignIn = () => {
    router.replace(nextPath);
    router.refresh();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const supabase = createClient();
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined;

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!signInError) {
        completeSignIn();
        return;
      }

      if (!isInvalidCredentialsError(signInError.message)) {
        throw signInError;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: origin
          ? {
              emailRedirectTo: `${origin}/`,
            }
          : undefined,
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data.session) {
        completeSignIn();
        return;
      }

      const { error: retrySignInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!retrySignInError) {
        completeSignIn();
        return;
      }

      setMessage('Account created. Check your email to confirm your address, then sign in again.');
    } catch (err) {
      setError(err instanceof Error ? formatAuthError(err.message) : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#ffffff_0%,_#f3f2f1_55%,_#ebe9e8_100%)] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/95 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur">
        <div className="mb-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-[#e1dfdd] bg-white p-1.5 shadow-sm">
              <AppLogo size={40} />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-[#185abd] uppercase">HandWriting</p>
              <p className="text-xs text-[#605e5c]">Worksheet Generator</p>
            </div>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#201f1e]">Welcome</h1>
          <p className="mt-2 text-sm leading-6 text-[#605e5c]">
            Sign in to access your workspace.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#323130]" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="you@example.com"
              className="h-11 w-full rounded-xl border border-[#c8c6c4] bg-white px-3 text-[#201f1e] outline-none transition focus:border-[#185abd] focus:ring-2 focus:ring-[#deecf9]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#323130]" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="h-11 w-full rounded-xl border border-[#c8c6c4] bg-white px-3 pr-24 text-[#201f1e] outline-none transition focus:border-[#185abd] focus:ring-2 focus:ring-[#deecf9]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#185abd] transition hover:bg-[#f3f2f1]"
                aria-label={showPassword ? 'Hide password' : 'View password'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                {showPassword ? 'Hide' : 'View'}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-[#a4262c]">{error}</p>}
          {message && <p className="text-sm text-[#107c10]">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#185abd] px-4 text-sm font-semibold text-white transition hover:bg-[#124078] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            Sign In
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[#605e5c]">
          After signing in, you remain signed in until you choose{' '}
          <span className="font-medium text-[#323130]">Sign out</span>.
        </p>

        <div className="mt-4 text-center text-xs text-[#8a8886]">
          <Link href="/" className="underline underline-offset-2">
            Back to app
          </Link>
        </div>
      </div>
    </main>
  );
}
