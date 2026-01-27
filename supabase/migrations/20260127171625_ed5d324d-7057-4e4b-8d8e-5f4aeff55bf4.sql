-- Add image_url column to revenues table
ALTER TABLE public.revenues ADD COLUMN IF NOT EXISTS image_url text;

-- Create storage bucket for revenue images
INSERT INTO storage.buckets (id, name, public)
VALUES ('revenue-images', 'revenue-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to revenue-images bucket
CREATE POLICY "Authenticated users can upload revenue images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'revenue-images');

-- Allow anyone to view revenue images (public bucket)
CREATE POLICY "Anyone can view revenue images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'revenue-images');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete their own revenue images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'revenue-images' AND auth.uid()::text = (storage.foldername(name))[1]);