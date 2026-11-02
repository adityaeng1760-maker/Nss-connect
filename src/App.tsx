import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import AuthScreen from '@/components/AuthScreen';
import MasterPage from '@/components/master/MasterPage';
import EventAttendancePage from '@/components/events/EventAttendancePage';
import EventsPage from '@/components/events/EventsPage';
import PointsPage from '@/components/points/PointsPage';
import StudentsPage from '@/components/students/StudentsPage';
import { useProfile } from '@/hooks/useProfile';
import { useSession } from '@/hooks/useSession';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import type { View } from '@/lib/types';
import { errorBoxClass, secondaryButtonClass } from '@/lib/ui';

interface PageContext {
  isAdmin: boolean;
  currentUserId: string;
  onNavigate: (view: View) => void;
}

function renderPage(view: View, { isAdmin, currentUserId, onNavigate }: PageContext) {
  switch (view.page) {
    case 'students':
      return <StudentsPage isAdmin={isAdmin} />;
    case 'events':
      return <EventsPage isAdmin={isAdmin} onNavigate={onNavigate} />;
    case 'event':
      return <EventAttendancePage eventId={view.eventId} onBack={() => onNavigate({ page: 'events' })} />;
    case 'points':
      return <PointsPage />;
    case 'master':
      return isAdmin ? <MasterPage currentUserId={currentUserId} /> : <StudentsPage isAdmin={false} />;
  }
}

function App() {
  const { session, loading: sessionLoading } = useSession();
  const { profile, loading: profileLoading, error: profileError } = useProfile(session?.user.uid);
  const [view, setView] = useState<View>({ page: 'students' });

  if (sessionLoading || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className={errorBoxClass}>{profileError ?? 'Your account could not be loaded.'}</p>
          <button type="button" onClick={() => signOut(auth)} className={`${secondaryButtonClass} w-full`}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const isAdmin = profile.role === 'admin';

  return (
    <AppShell view={view} isAdmin={isAdmin} onNavigate={setView}>
      {renderPage(view, { isAdmin, currentUserId: profile.id, onNavigate: setView })}
    </AppShell>
  );
}

export default App;
