
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  Check,
  Loader2,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import type { Profile, Role } from '@/lib/types';
import { errorBoxClass, secondaryButtonClass } from '@/lib/ui';

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  member: 'Member',
};

interface MasterPageProps {
  currentUserId: string;
}

interface PendingSignup {
  id: string;
  email: string;
  created_at: string;
}

function formatDate(value: string) {
  return value
    ? new Date(value).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '-';
}

export default function MasterPage({ currentUserId }: MasterPageProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<PendingSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const [usersSnapshot, requestsSnapshot] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'signupRequests')),
      ]);

      const rows: Profile[] = usersSnapshot.docs.map((document) => {
        const data = document.data();

        const createdAt =
          data.created_at instanceof Timestamp
            ? data.created_at.toDate().toISOString()
            : typeof data.created_at === 'string'
              ? data.created_at
              : '';

        return {
          id: document.id,
          email: data.email ?? '',
          role: data.role as Role,
          created_at: createdAt,
        };
      });

      rows.sort(
        (a, b) =>
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
      );

      const pendingRows: PendingSignup[] = requestsSnapshot.docs
        .map((document) => {
          const data = document.data();

          const createdAt =
            data.created_at instanceof Timestamp
              ? data.created_at.toDate().toISOString()
              : '';

          return {
            id: document.id,
            email: data.email ?? '',
            created_at: createdAt,
          };
        })
        .filter((request) => request.email);

      pendingRows.sort(
        (a, b) =>
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
      );

      setProfiles(rows);
      setRequests(pendingRows);
      setError(null);
    } catch (err) {
      console.error('Master page loading error:', err);
      setError(
        'Accounts or registration requests could not be loaded. Check your Firestore permissions.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const adminCount = useMemo(
    () => profiles.filter((profile) => profile.role === 'admin').length,
    [profiles]
  );

  async function approveRequest(request: PendingSignup, role: Role) {
    if (
      !window.confirm(
        `Approve ${request.email} as ${ROLE_LABELS[role]}?`
      )
    ) {
      return;
    }

    setPendingId(request.id);
    setError(null);

    try {
      await setDoc(doc(db, 'users', request.id), {
        email: request.email,
        role,
        active: true,
        created_at: serverTimestamp(),
      });

      await deleteDoc(doc(db, 'signupRequests', request.id));

      await loadData();
    } catch (err) {
      console.error('Approval error:', err);
      setError(
        'Approval failed. Check Firestore permissions and try again.'
      );
    } finally {
      setPendingId(null);
    }
  }

  async function rejectRequest(request: PendingSignup) {
    if (
      !window.confirm(
        `Reject the registration request from ${request.email}?`
      )
    ) {
      return;
    }

    setPendingId(request.id);
    setError(null);

    try {
      await updateDoc(doc(db, 'signupRequests', request.id), {
        status: 'rejected',
      });

      await loadData();
    } catch (err) {
      console.error('Rejection error:', err);
      setError('The registration request could not be rejected.');
    } finally {
      setPendingId(null);
    }
  }

  async function changeRole(profile: Profile, role: Role) {
    const action = role === 'admin' ? 'make admin' : 'change to member';

    if (
      !window.confirm(
        `Are you sure you want to ${action} for ${profile.email}?`
      )
    ) {
      return;
    }

    setPendingId(profile.id);
    setError(null);

    try {
      await updateDoc(doc(db, 'users', profile.id), {
        role,
      });

      setProfiles((prev) =>
        prev.map((item) =>
          item.id === profile.id ? { ...item, role } : item
        )
      );
    } catch (err) {
      console.error('Role update error:', err);
      setError('The role could not be changed. Please try again.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Master
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage account approvals and decide who can manage the roster and
          events. Members can view the roster and events and mark attendance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Accounts
            </p>
            <p className="text-2xl font-semibold text-slate-900">
              {profiles.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Admins
            </p>
            <p className="text-2xl font-semibold text-slate-900">
              {adminCount}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pending requests
            </p>
            <p className="text-2xl font-semibold text-slate-900">
              {requests.length}
            </p>
          </div>
        </div>
      </div>

      {error && <p className={errorBoxClass}>{error}</p>}

      {/* PENDING REGISTRATIONS */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">
              Pending registrations
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Review new accounts before granting access.
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
            {requests.length} pending
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No pending registration requests.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((request) => {
              const isPending = pendingId === request.id;

              return (
                <div
                  key={request.id}
                  className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {request.email}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Registered: {formatDate(request.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => approveRequest(request, 'member')}
                      className={`${secondaryButtonClass} inline-flex items-center gap-1`}
                    >
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Approve member
                    </button>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => approveRequest(request, 'admin')}
                      className={`${secondaryButtonClass} inline-flex items-center gap-1`}
                    >
                      Approve admin
                    </button>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => rejectRequest(request)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* EXISTING ACCOUNTS */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-slate-900">Existing accounts</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading accounts...
          </div>
        ) : profiles.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            No accounts found.
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
                  const nextRole: Role =
                    profile.role === 'admin' ? 'member' : 'admin';

                  return (
                    <tr
                      key={profile.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-3 text-slate-900">
                        {profile.email}
                        {isSelf && (
                          <span className="ml-2 text-xs text-slate-500">
                            (you)
                          </span>
                        )}
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
                        {formatDate(profile.created_at)}
                      </td>

                      <td className="px-6 py-3 text-right">
                        {isSelf ? (
                          <span className="text-xs text-slate-400">
                            Cannot change your own role
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => changeRole(profile, nextRole)}
                            className={secondaryButtonClass}
                          >
                            {isPending
                              ? 'Saving...'
                              : nextRole === 'admin'
                                ? 'Make admin'
                                : 'Make member'}
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
      </section>
    </div>
  );
}
