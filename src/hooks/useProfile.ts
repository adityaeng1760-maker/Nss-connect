
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Profile } from '@/lib/types';

interface ProfileResult {
  userId: string;
  profile: Profile | null;
  error: string | null;
}

export function useProfile(userId: string | undefined) {
  const [result, setResult] = useState<ProfileResult | null>(null);

  useEffect(() => {
    if (!userId) {
      setResult(null);
      return;
    }

    const currentUserId = userId;
    let cancelled = false;

    async function loadProfile() {
      try {
        console.log('Loading Firestore profile for UID:', currentUserId);

        const snapshot = await getDoc(
          doc(db, 'users', currentUserId)
        );

        if (cancelled) return;

        console.log('Profile document exists:', snapshot.exists());

        if (!snapshot.exists()) {
          setResult({
            userId: currentUserId,
            profile: null,
            error: 'Your account does not have access yet. Ask an admin to check it.',
          });
          return;
        }

        const data = snapshot.data();

        console.log('Firestore profile data:', data);

        if (
          data.active !== true ||
          !['admin', 'member'].includes(data.role)
        ) {
          setResult({
            userId: currentUserId,
            profile: null,
            error: 'Your account is inactive or does not have a valid role. Contact an admin.',
          });
          return;
        }

        setResult({
          userId: currentUserId,
          profile: {
            id: snapshot.id,
            email: data.email ?? '',
            role: data.role,
            created_at: data.created_at ?? '',
          },
          error: null,
        });
      } catch (err) {
        if (cancelled) return;

        console.error('Firebase profile loading error:', err);

        setResult({
          userId: currentUserId,
          profile: null,
          error:
            err instanceof Error
              ? err.message
              : 'Your account could not be loaded. Please sign in again.',
        });
      }
    }

    loadProfile();

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
