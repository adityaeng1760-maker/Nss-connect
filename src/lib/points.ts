import type { Attendance, EventItem, Student } from '@/lib/types';

export interface StudentPoints {
  student: Student;
  total: number;
  eventsAttended: number;
}

export function computeStudentPoints(
  students: Student[],
  events: EventItem[],
  attendance: Attendance[],
): StudentPoints[] {
  const publishedPoints = new Map<string, number>(
    events.filter((event) => event.published_at).map((event) => [event.id, event.points]),
  );
  const totals = new Map<string, { total: number; eventsAttended: number }>();

  for (const record of attendance) {
    const points = publishedPoints.get(record.event_id);
    if (points === undefined) continue;
    const entry = totals.get(record.student_id) ?? { total: 0, eventsAttended: 0 };
    entry.total += points;
    entry.eventsAttended += 1;
    totals.set(record.student_id, entry);
  }

  return students
    .map((student) => ({
      student,
      total: totals.get(student.id)?.total ?? 0,
      eventsAttended: totals.get(student.id)?.eventsAttended ?? 0,
    }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        a.student.roll_no.localeCompare(b.student.roll_no, undefined, { numeric: true }),
    );
}
