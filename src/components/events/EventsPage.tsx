import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Lock, Loader2, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import EventFormModal from '@/components/events/EventFormModal';
import { formatEventDate, pluralize } from '@/lib/format';
import { ATTENDANCE_COLUMNS, EVENT_COLUMNS } from '@/lib/columns';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { supabase } from '@/lib/supabase';
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
  const [modal, setModal] = useState<{ type: 'add' } | { type: 'edit'; event: EventItem } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [eventRows, attendanceRows] = await Promise.all([
        fetchAllRows<EventItem>('events', EVENT_COLUMNS, 'id'),
        fetchAllRows<Attendance>('attendance', ATTENDANCE_COLUMNS, 'id'),
      ]);
      const counts = new Map<string, number>();
      for (const record of attendanceRows) {
        counts.set(record.event_id, (counts.get(record.event_id) ?? 0) + 1);
      }
      setEvents(eventRows.sort((a, b) => (b.event_date ?? '').localeCompare(a.event_date ?? '')));
      setAttendeeCounts(counts);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load events.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const publishedCount = useMemo(() => events.filter((event) => event.published_at).length, [events]);

  async function handlePublish(event: EventItem) {
    if (!window.confirm(`Publish "${event.name}"? Its points will count on the points list and its attendance will be locked.`)) {
      return;
    }
    setActionError(null);
    const { data, error } = await supabase
      .from('events')
      .update({ published_at: new Date().toISOString() })
      .eq('id', event.id)
      .select('id');
    if (error) {
      setActionError(error.message);
      return;
    }
    if (!data?.length) {
      setActionError(`"${event.name}" is already published.`);
      return;
    }
    void loadData();
  }

  async function handleDelete(event: EventItem) {
    const attendees = attendeeCounts.get(event.id) ?? 0;
    if (!window.confirm(`Delete "${event.name}" and its ${pluralize(attendees, 'attendance record')}? This cannot be undone.`)) {
      return;
    }
    setActionError(null);
    const { data, error } = await supabase.from('events').delete().eq('id', event.id).select('id');
    if (error) {
      setActionError(error.message);
      return;
    }
    if (!data?.length) {
      setActionError(`"${event.name}" is published, so it cannot be deleted.`);
      return;
    }
    void loadData();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Events</h1>
          <p className="mt-1 text-sm text-slate-600">
            {events.length} events, {publishedCount} published
          </p>
        </div>
        {isAdmin && (
          <button type="button" onClick={() => setModal({ type: 'add' })} className={primaryButtonClass}>
            <Plus className="h-4 w-4" />
            New event
          </button>
        )}
      </div>

      {loadError && <p className={errorBoxClass}>Could not load events: {loadError}</p>}
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
            {isAdmin ? 'Create an event with its points to start taking attendance.' : 'An admin needs to create events first.'}
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
                        onClick={() => onNavigate({ page: 'event', eventId: event.id })}
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
                      {formatEventDate(event.event_date)} · {event.points} points · {pluralize(attendees, 'student')} present
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigate({ page: 'event', eventId: event.id })}
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
        <EventFormModal event={null} onClose={() => setModal(null)} onSaved={loadData} />
      )}
      {modal?.type === 'edit' && (
        <EventFormModal event={modal.event} onClose={() => setModal(null)} onSaved={loadData} />
      )}
    </div>
  );
}
