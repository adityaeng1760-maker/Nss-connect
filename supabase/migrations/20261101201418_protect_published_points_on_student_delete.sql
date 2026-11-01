/*
# Protect published points when deleting students

1. Modified Tables
- `students`: the delete policy changed.

2. Security
- Students who have attendance at any published event can no longer be deleted.
- Deleting a student without published attendance still works and removes only their unpublished attendance.

3. Important notes
- This keeps published points lists correct after the fact.
- Migration is idempotent and safe to re-run.
*/

DROP POLICY IF EXISTS "staff_delete_students" ON students;
CREATE POLICY "staff_delete_students" ON students FOR DELETE
  TO authenticated USING (
    NOT EXISTS (
      SELECT 1
      FROM attendance
      JOIN events ON events.id = attendance.event_id
      WHERE attendance.student_id = students.id
        AND events.published_at IS NOT NULL
    )
  );
