-- Add payment_proof_url column to bills table
ALTER TABLE public.bills 
ADD COLUMN payment_proof_url text;