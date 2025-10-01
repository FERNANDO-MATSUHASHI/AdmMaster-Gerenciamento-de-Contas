-- Create storage bucket for bill attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('bill-attachments', 'bill-attachments', false);

-- Create storage policies for bill attachments
CREATE POLICY "Users can view their own bill attachments" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'bill-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own bill attachments" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'bill-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own bill attachments" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'bill-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own bill attachments" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'bill-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add attachment_url column to bills table to store file references
ALTER TABLE public.bills ADD COLUMN attachment_url TEXT;