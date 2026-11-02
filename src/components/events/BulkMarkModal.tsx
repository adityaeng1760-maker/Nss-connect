
import { useMemo, useState, type FormEvent } from 'react';
import {
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import Modal from '@/components/Modal';
import { db } from '@/lib/firebase';
import type { Attendance, Student } from '@/lib/types';
import {
  errorBoxClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/lib/ui';

function parseRollNumbers(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((roll) => roll.trim().toUpperCase())
        .filter(Boolean)
    ),
  ];
}

interface BulkMarkModalProps {
  eventId: string;
  students: Student[];
  attendedIds: Set<string>;
  onClose: () => void;
  onMarked: (rows: Attendance[]) => void;
}

export default function BulkMarkModal({
  eventId,
  students,
  attendedIds,
  onClose,
  onMarked,
}: BulkMarkModalProps) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = useMemo(() => {
    const byRoll = new Map(
      students.map((student) => [student.roll_no, student])
    );

    const queued = new Set<string>();
    const toMark: Student[] = [];
    const notFound: string[] = [];
    let alreadyPresent = 0;

    for (const roll of parseRollNumbers(text)) {
      const student = byRoll.get(roll);

      if (!student) {
        notFound.push(roll);
      } else if (
        attendedIds.has(student.id) ||
        queued.has(student.id)
      ) {
        alreadyPresent += 1;
      } else {
        queued.add(student.id);
        toMark.push(student);
      }
    }

    return { toMark, notFound, alreadyPresent };
  }, [text, students, attendedIds]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (plan.toMark.length === 0) return;

    setSaving(true);
    setError(null);

    try {
      const markedRows: Attendance[] = [];

      // Process in chunks to stay within Firestore transaction limits.
      for (let i = 0; i < plan.toMark.length; i += 400) {
        const chunk = plan.toMark.slice(i, i + 400);

        const newlyMarked = await runTransaction(db, async (transaction) => {
          const eventRef = doc(db, 'events', eventId);
          const eventSnapshot = await transaction.get(eventRef);

          if (!eventSnapshot.exists()) {
            throw new Error('This event no longer exists.');
          }

          if (eventSnapshot.data().published_at != null) {
            throw new Error(
              'This event has already been published. Attendance is locked.'
            );
          }

          const attendanceRefs = chunk.map((student) =>
            doc(db, 'attendance', `${eventId}_${student.id}`)
          );

          const attendanceSnapshots = await Promise.all(
            attendanceRefs.map((ref) => transaction.get(ref))
          );

          const rows: Attendance[] = [];

          attendanceSnapshots.forEach((snapshot, index) => {
            if (snapshot.exists()) return;

            const student = chunk[index];
            const attendanceRef = attendanceRefs[index];

            transaction.set(attendanceRef, {
              event_id: eventId,
              student_id: student.id,
              created_at: serverTimestamp(),
            });

            rows.push({
              id: attendanceRef.id,
              event_id: eventId,
              student_id: student.id,
            } as Attendance);
          });

          return rows;
        });

        markedRows.push(...newlyMarked);
      }

      if (markedRows.length === 0) {
        setError('All selected students are already marked present.');
        return;
      }

      onMarked(markedRows);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not mark attendance. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Paste roll numbers" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="bulk-rolls" className={labelClass}>
            Roll numbers present
          </label>

          <textarea
            id="bulk-rolls"
            rows={8}
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={'21CS001, 21CS002\n21CS005'}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
          />

          <p className="mt-2 text-xs text-slate-500">
            Separate roll numbers with commas, spaces, or new lines.
          </p>
        </div>

        {text.trim() && (
          <div className="space-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p>
              <span className="font-semibold text-slate-900">
                {plan.toMark.length}
              </span>{' '}
              will be marked present
            </p>

            {plan.alreadyPresent > 0 && (
              <p>{plan.alreadyPresent} already present, skipped</p>
            )}

            {plan.notFound.length > 0 && (
              <p className="text-red-700">
                Not found in the roster: {plan.notFound.slice(0, 15).join(', ')}
                {plan.notFound.length > 15 &&
                  ` and ${plan.notFound.length - 15} more`}
              </p>
            )}
          </div>
        )}

        {error && <p className={errorBoxClass}>{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className={secondaryButtonClass}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving || plan.toMark.length === 0}
            className={primaryButtonClass}
          >
            {saving ? 'Marking...' : `Mark ${plan.toMark.length} present`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
