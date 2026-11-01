/*
# Limit student and event changes to admins

1. Modified Tables
- `students`: adding, editing, and removing students is admin only. Everyone signed in can still view.
- `events`: creating, editing, deleting, and publishing events is admin only. Everyone signed in can still view.
- `attendance`: unchanged. Any signed-in staff member can mark or unmark attendance for events that are not yet published.

2. Security
- Replaced the previous signed-in-only write policies with admin-only policies.
- Published events stay locked for everyone, including admins.
- Students who have points from a published event still cannot be removed.

3. Important notes
- Migration is idempotent and safe to re-run.
*/

DROP POLICY IF EXISTS "staff_insert_students" ON students;
CREATE POLICY "admin_insert_students" ON students FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "staff_update_students" ON students;
CREATE POLICY "admin_update_students" ON students FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "staff_delete_students" ON students;
CREATE POLICY "admin_delete_students" ON students FOR DELETE
  TO authenticated USING (
    is_admin()
    AND NOT EXISTS (
      SELECT 1
      FROM attendance
      JOIN events ON events.id = attendance.event_id
      WHERE attendance.student_id = students.id
        AND events.published_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "staff_insert_events" ON events;
CREATE POLICY "admin_insert_events" ON events FOR INSERT
  TO authenticated WITH CHECK (is_admin() AND published_at IS NULL);

DROP POLICY IF EXISTS "staff_update_unpublished_events" ON events;
CREATE POLICY "admin_update_unpublished_events" ON events FOR UPDATE
  TO authenticated USING (is_admin() AND published_at IS NULL) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_delete_unpublished_events" ON events;
CREATE POLICY "admin_delete_unpublished_events" ON events FOR DELETE
  TO authenticated USING (is_admin() AND published_at IS NULL);
