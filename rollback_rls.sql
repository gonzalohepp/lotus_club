-- ==============================================================================
-- EMERGENCY ROLLBACK / FIX FOR RLS POLICIES
-- ==============================================================================

-- 1. Disable RLS temporarily to confirm this fixes access (optional, but let's just make policies permissive)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop the problematic recursion policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- 2. APPLY PERMISSIVE POLICIES (Restore functionality)

-- Allow ANY authenticated user to VIEW ALL profiles
-- This ensures the Admin check (which queries role) always succeeds, and the Layout loads data.
CREATE POLICY "Allow all authenticated to view profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- Allow users to UPDATE their OWN profile (for avatar/data)
CREATE POLICY "Allow users to update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. STORAGE POLICIES (Keep these as they looked correct, but ensure they are set)
-- (We assume the bucket 'avatars' exists)

DROP POLICY IF EXISTS "Avatar Public Read" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Owner Update" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Owner Delete" ON storage.objects;

CREATE POLICY "Avatar Public Read"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

CREATE POLICY "Avatar Auth Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

CREATE POLICY "Avatar Owner Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'avatars' AND auth.uid() = owner );
