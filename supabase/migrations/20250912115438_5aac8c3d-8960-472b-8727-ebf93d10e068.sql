-- Create supplier_types table
CREATE TABLE IF NOT EXISTS public.supplier_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT supplier_types_user_name_unique UNIQUE (user_id, name)
);

-- Enable RLS
ALTER TABLE public.supplier_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY IF NOT EXISTS "Users can view their own supplier types"
ON public.supplier_types
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own supplier types"
ON public.supplier_types
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own supplier types"
ON public.supplier_types
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own supplier types"
ON public.supplier_types
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger to update updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_supplier_types_updated_at'
  ) THEN
    CREATE TRIGGER update_supplier_types_updated_at
    BEFORE UPDATE ON public.supplier_types
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- Add type_id to suppliers and index
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS type_id UUID REFERENCES public.supplier_types(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_type_id ON public.suppliers(type_id);
