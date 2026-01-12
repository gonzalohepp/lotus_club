-- ==============================================================================
-- FIX RLS POLICIES FOR PROFILES AND AVATARS
-- ==============================================================================

-- 1. PROFILES TABLE
-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Remove existing policies to strictly reset them (optional, but safer to avoid conflicts if names match)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (
  auth.uid() = user_id
);

-- Policy: Users can update their own profile (e.g. avatar_url, phone)
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (
  auth.uid() = user_id
)
WITH CHECK (
  auth.uid() = user_id
);

-- Policy: Admins can view ALL profiles (assuming there's a way to distinguish admin)
-- If your role logic is inside `profiles.role`, this creates a recursive check if not careful.
-- Safer Approach for Admin:
-- If you use App Metadata (claims), check that.
-- If you use `profiles.role`:
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
USING (
  (select role from profiles where user_id = auth.uid()) = 'admin'
);

CREATE POLICY "Admins can update all profiles"
ON profiles FOR UPDATE
USING (
  (select role from profiles where user_id = auth.uid()) = 'admin'
);


-- 2. STORAGE (AVATARS)
-- Ensure the bucket exists (idempotent insert)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for storage.objects
DROP POLICY IF EXISTS "Avatar Public Read" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Owner Update" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Owner Delete" ON storage.objects;

-- Allow public read of avatars
CREATE POLICY "Avatar Public Read"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- Allow authenticated users to upload their own avatar
-- We can enforce folder structure as 'user_id/filename' if we want, but simple Auth check is usually enough for MVP
CREATE POLICY "Avatar Auth Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

-- Allow users to update/delete their own files
CREATE POLICY "Avatar Owner Update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid() = owner
);

CREATE POLICY "Avatar Owner Delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.uid() = owner
);
