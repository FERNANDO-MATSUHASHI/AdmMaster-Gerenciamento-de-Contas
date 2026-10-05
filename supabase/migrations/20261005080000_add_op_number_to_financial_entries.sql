-- Migration to add op_number to financial_entries
ALTER TABLE public.financial_entries ADD COLUMN IF NOT EXISTS op_number text;
