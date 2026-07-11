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

/**
 * Returns the current authenticated user.
 */
export async function ensureSupabaseSession(): Promise<User> {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (user) {
    return user;
  }

  if (userError && userError.name !== 'AuthSessionMissingError') {
    throw new Error(formatSessionError(userError.message));
  }

  throw new Error('Please sign in to continue.');
}
