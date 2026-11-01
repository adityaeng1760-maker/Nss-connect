import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Search, Trophy } from 'lucide-react';
import { ATTENDANCE_COLUMNS, EVENT_COLUMNS, STUDENT_COLUMNS } from '@/lib/columns';
import { downloadCsv } from '@/lib/csv';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { pluralize } from '@/lib/format';
import { computeStudentPoints } from '@/lib/points';
import type { Attendance, EventItem, Student } from '@/lib/types';
import { errorBoxClass, inputClass, secondaryButtonClass } from '@/lib/ui';

export default function PointsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [studentRows, eventRows, attendanceRows] = await Promise.all([
        fetchAllRows<Student>('students', STUDENT_COLUMNS, 'roll_no'),
        fetchAllRows<EventItem>('events', EVENT_COLUMNS, 'id'),
        fetchAllRows<Attendance>('attendance', ATTENDANCE_COLUMNS, 'id'),
      ]);
      setStudents(studentRows);
      setEvents(eventRows);
      setAttendance(attendanceRows);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load points.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const standings = useMemo(
    () => computeStudentPoints(students, events, attendance),
    [students, events, attendance],
  );

  const visibleStandings = useMemo(() => {
    const term = query.trim().toLowerCase();
    const ranked = standings.map((row, index) => ({ ...row, rank: index + 1 }));
    if (!term) return ranked;
    return ranked.filter(
      (row) =>
        row.student.roll_no.toLowerCase().includes(term) ||
        row.student.name.toLowerCase().includes(term),
    );
  }, [standings, query]);

  const publishedEvents = useMemo(() => events.filter((event) => event.published_at), [events]);
  const totalAwarded = useMemo(
    () => standings.reduce((sum, row) => sum + row.total, 0),
    [standings],
  );

  function handleExport() {
    const rows: (string | number)[][] = [
      ['Rank', 'Roll No', 'Name', 'Department', 'Events Attended', 'Total Points'],
      ...standings.map((row, index) => [
        index + 1,
        row.student.roll_no,
        row.student.name,
        row.student.department ?? '',
        row.eventsAttended,
        row.total,
      ]),
    ];
    downloadCsv(`points-list-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Points list</h1>
          <p className="mt-1 text-sm text-slate-600">
            Totals count published events only, so drafts never change the list.
          </p>
        </div>
        <button type="button" onClick={handleExport} disabled={loading || standings.length === 0} className={secondaryButtonClass}>
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Published events" value={String(publishedEvents.length)} />
        <StatCard label="Points awarded" value={String(totalAwarded)} />
        <StatCard label="Students ranked" value={String(students.length)} />
      </div>

      {loadError && <p className={errorBoxClass}>Could not load points: {loadError}</p>}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by roll number or name"
          className={`${inputClass} pl-9`}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading points...
          </div>
        ) : visibleStandings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Trophy className="h-6 w-6" />
            </div>
            <p className="font-medium text-slate-900">
              {students.length === 0 ? 'No students yet' : 'No students match your search'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3">Rank</th>
                  <th className="px-6 py-3">Roll no</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="hidden px-6 py-3 md:table-cell">Department</th>
                  <th className="px-6 py-3 text-right">Events</th>
                  <th className="px-6 py-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleStandings.map((row) => (
                  <tr key={row.student.id} className="transition hover:bg-slate-50">
                    <td className="px-6 py-3 font-semibold text-slate-500">{row.rank}</td>
                    <td className="whitespace-nowrap px-6 py-3 font-mono text-slate-900">{row.student.roll_no}</td>
                    <td className="px-6 py-3 text-slate-800">{row.student.name}</td>
                    <td className="hidden px-6 py-3 text-slate-600 md:table-cell">{row.student.department ?? '-'}</td>
                    <td className="px-6 py-3 text-right text-slate-600">{pluralize(row.eventsAttended, 'event')}</td>
                    <td className="px-6 py-3 text-right text-base font-semibold text-teal-700">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
