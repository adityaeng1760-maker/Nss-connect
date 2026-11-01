import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

interface ProfileResult {
  userId: string;
  profile: Profile | null;
  error: string | null;
}

export function useProfile(userId: string | undefined) {
  const [result, setResult] = useState<ProfileResult | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    supabase
      .from('profiles')
      .select('id, email, role, created_at')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setResult({
          userId,
          profile: (data as Profile | null) ?? null,
          error: error
            ? 'Your account could not be loaded. Please sign in again.'
            : data
              ? null
              : 'Your account does not have access yet. Ask an admin to check it.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const isCurrent = Boolean(userId) && result?.userId === userId;
  return {
    profile: isCurrent ? result?.profile ?? null : null,
    error: isCurrent ? result?.error ?? null : null,
    loading: Boolean(userId) && !isCurrent,
  };
}
