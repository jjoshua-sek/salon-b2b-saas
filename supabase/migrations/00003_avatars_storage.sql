-- ============================================================
-- Storage bucket: avatars
-- Public read, per-user write (files stored under {user_id}/...)
-- Safe to re-run.
-- ============================================================

-- 1. Create (or update) the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,                                        -- public SELECT via CDN URL
  2097152,                                     -- 2 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Drop any previous versions of these policies so this file is re-runnable
DROP POLICY IF EXISTS "Avatars: public read"   ON storage.objects;
DROP POLICY IF EXISTS "Avatars: owner insert"  ON storage.objects;
DROP POLICY IF EXISTS "Avatars: owner update"  ON storage.objects;
DROP POLICY IF EXISTS "Avatars: owner delete"  ON storage.objects;

-- 3. Policies
-- Anyone can read avatar objects (the bucket is public anyway, but the
-- policy is required when RLS is enabled on storage.objects).
CREATE POLICY "Avatars: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated users can only write under a folder matching their own uid.
-- storage.foldername(name) splits the object path on '/' — [1] is the first
-- segment, which we require to equal the caller's uid.
CREATE POLICY "Avatars: owner insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Avatars: owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Avatars: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
