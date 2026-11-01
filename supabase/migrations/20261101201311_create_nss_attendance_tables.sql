/*
# Create students, events, and attendance tables (shared staff workspace)

1. New Tables
- `students`: roll_no (unique), name, department, created_at
- `events`: name, event_date, points (allotted to every attendee), published_at (null until published), created_at
- `attendance`: links one student to one event (unique pair), with marked_at and marked_by

2. Security
- Row level security enabled on all three tables.
- Access is limited to signed-in staff (role `authenticated`). Anonymous visitors get nothing.
- All signed-in staff share the same data by design, so policies check only that the user is signed in.
- Events can be edited or deleted only until they are published.
- Attendance can be added or removed only for events that are not yet published.
- Attendance rows are never edited, only added or removed.

3. Important notes
- Publishing an event is a one-way step at the database level: once published_at is set, the event and its attendance are read-only.
- Migration is idempotent and safe to re-run.
*/

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_no text NOT NULL UNIQUE,
  name text NOT NULL,
  department text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  event_date date,
  points integer NOT NULL CHECK (points >= 0),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  marked_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  marked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_event_student_unique UNIQUE (event_id, student_id)
);

CREATE INDEX IF NOT EXISTS attendance_student_id_idx ON attendance (student_id);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON events TO authenticated;
GRANT SELECT, INSERT, DELETE ON attendance TO authenticated;

DROP POLICY IF EXISTS "staff_select_students" ON students;
CREATE POLICY "staff_select_students" ON students FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_students" ON students;
CREATE POLICY "staff_insert_students" ON students FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "staff_update_students" ON students;
CREATE POLICY "staff_update_students" ON students FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_delete_students" ON students;
CREATE POLICY "staff_delete_students" ON students FOR DELETE
  TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_select_events" ON events;
CREATE POLICY "staff_select_events" ON events FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_events" ON events;
CREATE POLICY "staff_insert_events" ON events FOR INSERT
  TO authenticated WITH CHECK (published_at IS NULL);

DROP POLICY IF EXISTS "staff_update_unpublished_events" ON events;
CREATE POLICY "staff_update_unpublished_events" ON events FOR UPDATE
  TO authenticated USING (published_at IS NULL) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_delete_unpublished_events" ON events;
CREATE POLICY "staff_delete_unpublished_events" ON events FOR DELETE
  TO authenticated USING (published_at IS NULL);

DROP POLICY IF EXISTS "staff_select_attendance" ON attendance;
CREATE POLICY "staff_select_attendance" ON attendance FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_attendance_unpublished" ON attendance;
CREATE POLICY "staff_insert_attendance_unpublished" ON attendance FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = attendance.event_id
        AND events.published_at IS NULL
    )
  );

DROP POLICY IF EXISTS "staff_delete_attendance_unpublished" ON attendance;
CREATE POLICY "staff_delete_attendance_unpublished" ON attendance FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = attendance.event_id
        AND events.published_at IS NULL
    )
  );
