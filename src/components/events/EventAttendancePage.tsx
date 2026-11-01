import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, Loader2, Lock, Trash2, Users } from 'lucide-react';
import BulkMarkModal from '@/components/events/BulkMarkModal';
import { ATTENDANCE_COLUMNS, EVENT_COLUMNS, STUDENT_COLUMNS } from '@/lib/columns';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { formatEventDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Attendance, EventItem, Student } from '@/lib/types';
import {
  errorBoxClass,
  iconButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  successBoxClass,
} from '@/lib/ui';

interface Feedback {
  tone: 'success' | 'error' | 'info';
  text: string;
}

const FEEDBACK_CLASS: Record<Feedback['tone'], string> = {
  success: successBoxClass,
  error: errorBoxClass,
  info: 'rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700',
};

interface EventAttendancePageProps {
  eventId: string;
  onBack: () => void;
}

export default function EventAttendancePage({ eventId, onBack }: EventAttendancePageProps) {
  const [event, setEvent] = useState<EventItem | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rollInput, setRollInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [eventResult, studentRows, attendanceResult] = await Promise.all([
        supabase.from('events').select(EVENT_COLUMNS).eq('id', eventId).maybeSingle(),
        fetchAllRows<Student>('students', STUDENT_COLUMNS, 'roll_no'),
        supabase.from('attendance').select(ATTENDANCE_COLUMNS).eq('event_id', eventId),
      ]);
      if (eventResult.error) throw new Error(eventResult.error.message);
      if (attendanceResult.error) throw new Error(attendanceResult.error.message);
      setEvent(eventResult.data as EventItem | null);
      setStudents(studentRows);
      setRecords((attendanceResult.data ?? []) as Attendance[]);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load attendance.');
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const studentByRoll = useMemo(() => new Map(students.map((s) => [s.roll_no, s])), [students]);
  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const attendedIds = useMemo(() => new Set(records.map((r) => r.student_id)), [records]);

  const attendedRows = useMemo(
    () =>
      records
        .map((record) => ({ record, student: studentById.get(record.student_id) }))
        .filter((row): row is { record: Attendance; student: Student } => Boolean(row.student))
        .sort((a, b) => a.student.roll_no.localeCompare(b.student.roll_no, undefined, { numeric: true })),
    [records, studentById],
  );

  const isLocked = Boolean(event?.published_at);

  async function markStudent(student: Student) {
    if (attendedIds.has(student.id)) {
      setFeedback({ tone: 'info', text: `${student.name} is already marked present.` });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from('attendance')
      .insert({ event_id: eventId, student_id: student.id })
      .select(ATTENDANCE_COLUMNS)
      .single();
    setSaving(false);

    if (error) {
      setFeedback({
        tone: error.code === '23505' ? 'info' : 'error',
        text:
          error.code === '23505'
            ? `${student.name} is already marked present.`
            : `Could not mark ${student.name}: ${error.message}`,
      });
      return;
    }
    setRecords((prev) => [...prev, data as Attendance]);
    setFeedback({ tone: 'success', text: `${student.name} (${student.roll_no}) marked present.` });
  }

  function handleRollChange(value: string) {
    const roll = value.trim().toUpperCase();
    const student = roll ? studentByRoll.get(roll) : undefined;
    const isUniqueMatch = student && !students.some((s) => s.roll_no !== roll && s.roll_no.startsWith(roll));

    if (student && isUniqueMatch) {
      setRollInput('');
      void markStudent(student);
      return;
    }
    setRollInput(value);
  }

  function handleRollSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const roll = rollInput.trim().toUpperCase();
    if (!roll) return;
    const student = studentByRoll.get(roll);
    if (!student) {
      setFeedback({ tone: 'error', text: `No student has the roll number ${roll}. Check the number or add the student first.` });
      return;
    }
    setRollInput('');
    void markStudent(student);
  }

  async function removeRecord(record: Attendance) {
    const student = studentById.get(record.student_id);
    setFeedback(null);
    const { data, error } = await supabase.from('attendance').delete().eq('id', record.id).select('id');
    if (error) {
      setFeedback({ tone: 'error', text: `Could not remove attendance: ${error.message}` });
      return;
    }
    if (!data?.length) {
      setFeedback({ tone: 'error', text: 'This event is published, so attendance can no longer be changed.' });
      return;
    }
    setRecords((prev) => prev.filter((item) => item.id !== record.id));
    if (student) setFeedback({ tone: 'info', text: `${student.name} removed from attendance.` });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading attendance...
      </div>
    );
  }

  if (loadError || !event) {
    return (
      <div className="space-y-4">
        <BackLink onBack={onBack} />
        <p className={errorBoxClass}>
          {loadError ? `Could not load attendance: ${loadError}` : 'This event could not be found.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink onBack={onBack} />

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{event.name}</h1>
            {isLocked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <Lock className="h-3 w-3" />
                Published
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {formatEventDate(event.event_date)} · {event.points} points per attendee
          </p>
        </div>
        <div className="flex gap-6 sm:text-right">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Present</p>
            <p className="text-2xl font-semibold text-slate-900">{records.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Points given</p>
            <p className="text-2xl font-semibold text-teal-700">{records.length * event.points}</p>
          </div>
        </div>
      </div>

      {isLocked && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          This event is published, so its attendance is locked and can only be viewed.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Mark attendance</h2>
            <p className="mt-1 text-sm text-slate-600">
              Type a roll number. It is marked automatically once it matches exactly, or press Enter.
            </p>
          </div>

          <form onSubmit={handleRollSubmit} className="space-y-3">
            <label htmlFor="roll-input" className={labelClass}>Roll number</label>
            <input
              id="roll-input"
              autoFocus
              autoComplete="off"
              value={rollInput}
              disabled={isLocked || saving}
              onChange={(e) => handleRollChange(e.target.value)}
              className={`${inputClass} font-mono uppercase`}
              placeholder="e.g. 21CS001"
            />
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={isLocked || saving || !rollInput.trim()} className={primaryButtonClass}>
                {saving ? 'Marking...' : 'Mark present'}
              </button>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => setBulkOpen(true)}
                className={secondaryButtonClass}
              >
                Paste many
              </button>
            </div>
          </form>

          {feedback && <p className={FEEDBACK_CLASS[feedback.tone]}>{feedback.text}</p>}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">Present students</h2>
            <span className="text-sm text-slate-500">{attendedRows.length}</span>
          </div>
          {attendedRows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Users className="h-6 w-6" />
              </div>
              <p className="text-sm text-slate-600">No students marked yet.</p>
            </div>
          ) : (
            <ul className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto">
              {attendedRows.map(({ record, student }) => (
                <li key={record.id} className="flex items-center justify-between gap-4 px-6 py-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-slate-900">{student.roll_no}</p>
                    <p className="truncate text-sm text-slate-600">{student.name}</p>
                  </div>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => removeRecord(record)}
                      className={`${iconButtonClass} hover:text-red-600`}
                      aria-label={`Remove ${student.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {bulkOpen && (
        <BulkMarkModal
          eventId={eventId}
          students={students}
          attendedIds={attendedIds}
          onClose={() => setBulkOpen(false)}
          onMarked={(rows) => {
            setRecords((prev) => [...prev, ...rows]);
            setFeedback({ tone: 'success', text: `Marked ${rows.length} students present.` });
          }}
        />
      )}
    </div>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
    >
      <ArrowLeft className="h-4 w-4" />
      All events
    </button>
  );
}
