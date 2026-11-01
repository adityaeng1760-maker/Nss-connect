/*
# Add staff profiles with admin and staff roles

1. New Tables
- `profiles`: one row per signed-in account, with email, role (admin or staff), and created_at.

2. Automation
- A new account automatically gets a profile with the role staff.
- Existing accounts get a profile when this migration runs.
- The account adityaeng1760@gmail.com is set as the admin.

3. Security
- Row level security enabled on `profiles`.
- A signed-in user can read only their own profile. Admins can read all profiles.
- Only admins can change a role, and never their own.
- Users cannot create or delete profile rows directly.
- A helper function `is_admin()` checks the current user's role. It is callable only by signed-in users.
- Only the role column can be changed, and only through the policy above.

4. Important notes
- Migration is idempotent and safe to re-run.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, role)
  VALUES (NEW.id, COALESCE(NEW.email, ''), 'staff')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION handle_new_user_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_profile();

INSERT INTO profiles (id, email, role)
SELECT id, COALESCE(email, ''), 'staff' FROM auth.users
ON CONFLICT (id) DO NOTHING;

UPDATE profiles SET role = 'admin' WHERE email = 'adityaeng1760@gmail.com';

GRANT SELECT ON profiles TO authenticated;
GRANT UPDATE (role) ON profiles TO authenticated;

DROP POLICY IF EXISTS "select_own_or_admin_profiles" ON profiles;
CREATE POLICY "select_own_or_admin_profiles" ON profiles FOR SELECT
  TO authenticated USING (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "admin_update_other_profile_roles" ON profiles;
CREATE POLICY "admin_update_other_profile_roles" ON profiles FOR UPDATE
  TO authenticated
  USING (is_admin() AND id <> auth.uid())
  WITH CHECK (is_admin() AND id <> auth.uid());
