-- Add bill_type column to differentiate between 'conta' and 'despesa'
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS bill_type TEXT DEFAULT 'conta' CHECK (bill_type IN ('conta', 'despesa'));

-- Update all existing records to have bill_type = 'conta'
UPDATE public.bills SET bill_type = 'conta' WHERE bill_type IS NULL;
