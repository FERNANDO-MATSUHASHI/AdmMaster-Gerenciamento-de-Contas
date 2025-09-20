-- Create banks table
CREATE TABLE public.banks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own banks" 
ON public.banks 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own banks" 
ON public.banks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own banks" 
ON public.banks 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own banks" 
ON public.banks 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_banks_updated_at
BEFORE UPDATE ON public.banks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add new fields to bills table for check information
ALTER TABLE public.bills 
ADD COLUMN payment_type TEXT DEFAULT 'conta',
ADD COLUMN bank_id UUID REFERENCES public.banks(id),
ADD COLUMN account_holder TEXT;