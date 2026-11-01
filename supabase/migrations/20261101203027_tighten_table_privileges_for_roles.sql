/*
# Tighten table privileges for public and signed-in roles

1. Modified Tables
- `students`, `events`, `attendance`, `profiles`: privileges reset and re-granted to only what the app needs.

2. Security
- The public (anon) role no longer has any access to these tables.
- Signed-in users get only the actions their policies allow.
- Attendance: signed-in users can add only the event and student fields. The marked-by field is filled in by the database, so it cannot be forged.
- Profiles: signed-in users can read profiles, and only admins can change the role field. Email and other fields are read-only.

3. Important notes
- Row level security policies are unchanged; this migration narrows what those policies can reach.
- Migration is idempotent and safe to re-run.
*/

REVOKE ALL ON students, events, attendance, profiles FROM anon;
REVOKE ALL ON students, events, attendance, profiles FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON events TO authenticated;
GRANT SELECT, DELETE ON attendance TO authenticated;
GRANT INSERT (event_id, student_id) ON attendance TO authenticated;
GRANT SELECT ON profiles TO authenticated;
GRANT UPDATE (role) ON profiles TO authenticated;
