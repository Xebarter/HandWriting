import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

function formatSessionError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials')) {
    return 'Invalid email or password.';
  }

  if (lower.includes('rate limit')) {
    return 'Too many sign-in attempts. Wait a few minutes and try again.';
  }

  return `Authentication error: ${message}`;
}

function isMissingSessionError(error: { name?: string; message?: string } | null): boolean {
  if (!error) return false;

  const message = error.message?.toLowerCase() ?? '';
  return (
    error.name === 'AuthSessionMissingError' ||
    message.includes('auth session missing') ||
    message.includes('session not found')
  );
}

/**
 * Returns the current authenticated user, refreshing the session when possible.
 */
export async function ensureSupabaseSession(): Promise<User> {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    return session.user;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (user) {
    return user;
  }

  const {
    data: { session: refreshedSession },
    error: refreshError,
  } = await supabase.auth.refreshSession();

  if (refreshedSession?.user) {
    return refreshedSession.user;
  }

  if (userError && !isMissingSessionError(userError)) {
    throw new Error(formatSessionError(userError.message));
  }

  if (refreshError && !isMissingSessionError(refreshError)) {
    throw new Error(formatSessionError(refreshError.message));
  }

  throw new Error('Please sign in to continue.');
}
