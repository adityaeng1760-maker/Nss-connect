/*
# Rename the staff role to member

1. Modified Tables
- `profiles.role`: values changed from staff to member. Admin is unchanged.

2. Automation
- New accounts now get the role member automatically.

3. Security
- The allowed role values are now admin and member. Access rules are unchanged because they check only for admin.

4. Important notes
- No data is removed. Existing staff accounts keep their access and show as member.
- Migration is idempotent and safe to re-run.
*/

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
UPDATE profiles SET role = 'member' WHERE role = 'staff';
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'member';
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'member'));

CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, role)
  VALUES (NEW.id, COALESCE(NEW.email, ''), 'member')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
