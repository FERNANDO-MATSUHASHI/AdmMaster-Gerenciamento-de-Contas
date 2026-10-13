-- Migration to add discount and gross_amount to financial_entries
ALTER TABLE public.financial_entries ADD COLUMN IF NOT EXISTS discount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.financial_entries ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(12,2);
