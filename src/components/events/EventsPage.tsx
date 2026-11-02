
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query as firestoreQuery,
  updateDoc,
} from 'firebase/firestore';
import {
  CalendarDays,
  Lock,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import EventFormModal from '@/components/events/EventFormModal';
import { db } from '@/lib/firebase';
import { formatEventDate, pluralize } from '@/lib/format';
import type { Attendance, EventItem, View } from '@/lib/types';
import { errorBoxClass, iconButtonClass, primaryButtonClass } from '@/lib/ui';

interface EventsPageProps {
  isAdmin: boolean;
  onNavigate: (view: View) => void;
}

export default function EventsPage({ isAdmin, onNavigate }: EventsPageProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [attendeeCounts, setAttendeeCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [modal, setModal] = useState<
    { type: 'add' } | { type: 'edit'; event: EventItem } | null
  >(null);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const [eventSnapshot, attendanceSnapshot] = await Promise.all([
        getDocs(firestoreQuery(collection(db, 'events'))),
        getDocs(firestoreQuery(collection(db, 'attendance'))),
      ]);

      const eventRows: EventItem[] = eventSnapshot.docs.map((item) => ({
        id: item.id,
        name: item.data().name,
        event_date: item.data().event_date ?? null,
        points: item.data().points,
        published_at: item.data().published_at ?? null,
      }));

      const attendanceRows: Attendance[] = attendanceSnapshot.docs.map((item) => ({
        id: item.id,
        event_id: item.data().event_id,
        student_id: item.data().student_id,
      }));

      const counts = new Map<string, number>();

      for (const record of attendanceRows) {
        counts.set(
          record.event_id,
          (counts.get(record.event_id) ?? 0) + 1,
        );
      }

      eventRows.sort((a, b) =>
        (b.event_date ?? '').localeCompare(a.event_date ?? ''),
      );

      setEvents(eventRows);
      setAttendeeCounts(counts);
      setLoadError(null);
    } catch (err) {
      console.error('Event loading error:', err);
      setLoadError(
        err instanceof Error ? err.message : 'Could not load events.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const publishedCount = useMemo(
    () => events.filter((event) => event.published_at).length,
    [events],
  );

  async function handlePublish(event: EventItem) {
    if (
      !window.confirm(
        `Publish "${event.name}"? Its points will count on the points list and its attendance will be locked.`,
      )
    ) {
      return;
    }

    setActionError(null);

    try {
      if (event.published_at) {
        setActionError(`"${event.name}" is already published.`);
        return;
      }

      await updateDoc(doc(db, 'events', event.id), {
        published_at: new Date().toISOString(),
      });

      await loadData();
    } catch (err) {
      console.error('Event publish error:', err);
      setActionError('Could not publish this event. Please try again.');
    }
  }

  async function handleDelete(event: EventItem) {
    const attendees = attendeeCounts.get(event.id) ?? 0;

    if (
      !window.confirm(
        `Delete "${event.name}" and its ${pluralize(attendees, 'attendance record')}? This cannot be undone.`,
      )
    ) {
      return;
    }

    setActionError(null);

    try {
      if (event.published_at) {
        setActionError(`"${event.name}" is published, so it cannot be deleted.`);
        return;
      }

      // Remove attendance records before deleting the draft event.
      const attendanceSnapshot = await getDocs(
        firestoreQuery(collection(db, 'attendance')),
      );

      const relatedAttendance = attendanceSnapshot.docs.filter(
        (item) => item.data().event_id === event.id,
      );

      for (let start = 0; start < relatedAttendance.length; start += 500) {
        const chunk = relatedAttendance.slice(start, start + 500);
        const { writeBatch } = await import('firebase/firestore');
        const batch = writeBatch(db);

        chunk.forEach((item) => batch.delete(item.ref));
        await batch.commit();
      }

      await deleteDoc(doc(db, 'events', event.id));
      await loadData();
    } catch (err) {
      console.error('Event delete error:', err);
      setActionError('Could not delete this event. Please try again.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Events
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {events.length} events, {publishedCount} published
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setModal({ type: 'add' })}
            className={primaryButtonClass}
          >
            <Plus className="h-4 w-4" />
            New event
          </button>
        )}
      </div>

      {loadError && (
        <p className={errorBoxClass}>Could not load events: {loadError}</p>
      )}
      {actionError && <p className={errorBoxClass}>{actionError}</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading events...
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <CalendarDays className="h-6 w-6" />
          </div>
          <p className="font-medium text-slate-900">No events yet</p>
          <p className="text-sm text-slate-600">
            {isAdmin
              ? 'Create an event with its points to start taking attendance.'
              : 'An admin needs to create events first.'}
          </p>
        </div>
      ) : (
        <ul className="grid gap-4">
          {events.map((event) => {
            const isPublished = Boolean(event.published_at);
            const attendees = attendeeCounts.get(event.id) ?? 0;

            return (
              <li
                key={event.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow-md"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate({ page: 'event', eventId: event.id })
                        }
                        className="truncate text-left text-base font-semibold text-slate-900 hover:text-teal-700"
                      >
                        {event.name}
                      </button>

                      {isPublished ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                          <Lock className="h-3 w-3" />
                          Published
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                          Draft
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-slate-600">
                      {formatEventDate(event.event_date)} · {event.points} points ·{' '}
                      {pluralize(attendees, 'student')} present
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate({ page: 'event', eventId: event.id })
                      }
                      className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
                    >
                      {isPublished ? 'View attendance' : 'Take attendance'}
                    </button>

                    {isAdmin && !isPublished && (
                      <>
                        <button
                          type="button"
                          onClick={() => handlePublish(event)}
                          className={`${iconButtonClass} hover:text-emerald-700`}
                          aria-label={`Publish ${event.name}`}
                          title="Publish"
                        >
                          <Send className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setModal({ type: 'edit', event })}
                          className={iconButtonClass}
                          aria-label={`Edit ${event.name}`}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(event)}
                          className={`${iconButtonClass} hover:text-red-600`}
                          aria-label={`Delete ${event.name}`}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modal?.type === 'add' && (
        <EventFormModal
          event={null}
          onClose={() => setModal(null)}
          onSaved={loadData}
        />
      )}

      {modal?.type === 'edit' && (
        <EventFormModal
          event={modal.event}
          onClose={() => setModal(null)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}
