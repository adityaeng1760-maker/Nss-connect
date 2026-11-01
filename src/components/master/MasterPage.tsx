import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, ShieldCheck, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile, Role } from '@/lib/types';
import { errorBoxClass, secondaryButtonClass } from '@/lib/ui';

const PROFILE_COLUMNS = 'id, email, role, created_at';

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  member: 'Member',
};

interface MasterPageProps {
  currentUserId: string;
}

export default function MasterPage({ currentUserId }: MasterPageProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .order('created_at');
    if (queryError) {
      setError('The member list could not be loaded. Please refresh the page.');
    } else {
      setProfiles((data ?? []) as Profile[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const adminCount = useMemo(() => profiles.filter((profile) => profile.role === 'admin').length, [profiles]);

  async function changeRole(profile: Profile, role: Role) {
    const action = role === 'admin' ? 'make admin' : 'change to member';
    if (!window.confirm(`Are you sure you want to ${action} for ${profile.email}?`)) return;

    setPendingId(profile.id);
    setError(null);
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', profile.id)
      .select('id');
    setPendingId(null);

    if (updateError || !data?.length) {
      setError('The role could not be changed. Please try again.');
      return;
    }
    setProfiles((prev) => prev.map((item) => (item.id === profile.id ? { ...item, role } : item)));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Master</h1>
        <p className="mt-1 text-sm text-slate-600">
          Decide who can manage the roster and events. Admins can change everything. Members can view the roster and events and mark attendance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Accounts</p>
            <p className="text-2xl font-semibold text-slate-900">{profiles.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Admins</p>
            <p className="text-2xl font-semibold text-slate-900">{adminCount}</p>
          </div>
        </div>
      </div>

      {error && <p className={errorBoxClass}>{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading accounts...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="hidden px-6 py-3 md:table-cell">Joined</th>
                  <th className="px-6 py-3 text-right">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles.map((profile) => {
                  const isSelf = profile.id === currentUserId;
                  const isPending = pendingId === profile.id;
                  const nextRole: Role = profile.role === 'admin' ? 'member' : 'admin';
                  return (
                    <tr key={profile.id} className="transition hover:bg-slate-50">
                      <td className="px-6 py-3 text-slate-900">
                        {profile.email}
                        {isSelf && <span className="ml-2 text-xs text-slate-500">(you)</span>}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                            profile.role === 'admin'
                              ? 'bg-teal-50 text-teal-800 ring-teal-200'
                              : 'bg-slate-100 text-slate-700 ring-slate-200'
                          }`}
                        >
                          {ROLE_LABELS[profile.role]}
                        </span>
                      </td>
                      <td className="hidden px-6 py-3 text-slate-600 md:table-cell">
                        {new Date(profile.created_at).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {isSelf ? (
                          <span className="text-xs text-slate-400">Cannot change your own role</span>
                        ) : (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => changeRole(profile, nextRole)}
                            className={secondaryButtonClass}
                          >
                            {isPending ? 'Saving...' : nextRole === 'admin' ? 'Make admin' : 'Make member'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
