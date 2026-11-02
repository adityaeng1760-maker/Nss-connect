
import type { ReactNode } from 'react';
import {
  CalendarDays,
  GraduationCap,
  LogOut,
  ShieldCheck,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import type { View } from '@/lib/types';

type NavPage = Exclude<View['page'], 'event'>;

interface NavItem {
  page: NavPage;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { page: 'students', label: 'Students', icon: Users },
  { page: 'events', label: 'Events', icon: CalendarDays },
  { page: 'points', label: 'Points', icon: Trophy },
  { page: 'master', label: 'Master', icon: ShieldCheck, adminOnly: true },
];

interface AppShellProps {
  view: View;
  isAdmin: boolean;
  onNavigate: (view: View) => void;
  children: ReactNode;
}

export default function AppShell({
  view,
  isAdmin,
  onNavigate,
  children,
}: AppShellProps) {
  const activePage: NavPage =
    view.page === 'event' ? 'events' : view.page;

  const items = NAV_ITEMS.filter(
    (item) => !item.adminOnly || isAdmin
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-base font-semibold tracking-tight text-slate-900">
              NSS Points Desk
            </span>
            <span
              className={`hidden rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline ${
                isAdmin
                  ? 'bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-200'
                  : 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200'
              }`}
            >
              {isAdmin ? 'Admin' : 'Member'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => signOut(auth)}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.page;

            return (
              <button
                key={item.page}
                type="button"
                onClick={() => onNavigate({ page: item.page })}
                className={`inline-flex items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-sm font-medium transition ${
                  isActive
                    ? 'border-teal-700 text-teal-800'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
