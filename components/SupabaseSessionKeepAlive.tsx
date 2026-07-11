'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const REFRESH_INTERVAL_MS = 4 * 60 * 1000;

async function refreshServerSession() {
  try {
    await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    // Network hiccups should not sign the user out.
  }
}

async function refreshClientSession() {
  const supabase = createClient();
  await supabase.auth.getSession();
  await refreshServerSession();
}

export function SupabaseSessionKeepAlive() {
  useEffect(() => {
    void refreshClientSession();

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        void refreshServerSession();
      }
    });

    const intervalId = window.setInterval(() => {
      void refreshClientSession();
    }, REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshClientSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
}
