
import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AppSession {
  user: User;
}

export function useSession() {
  const [session, setSession] = useState<AppSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setSession(user ? { user } : null);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { session, loading };
}
