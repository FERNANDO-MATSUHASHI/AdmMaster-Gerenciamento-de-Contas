-- Criar tabela para anexos por parcela
CREATE TABLE IF NOT EXISTS public.bill_installment_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL,
  installment_number INTEGER NOT NULL,
  attachment_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.bill_installment_attachments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own installment attachments" 
ON public.bill_installment_attachments 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own installment attachments" 
ON public.bill_installment_attachments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own installment attachments" 
ON public.bill_installment_attachments 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own installment attachments" 
ON public.bill_installment_attachments 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_bill_installment_attachments_updated_at
BEFORE UPDATE ON public.bill_installment_attachments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Atualizar políticas do bucket storage para permitir downloads autenticados
CREATE POLICY "Users can download their own bill attachments" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'bill-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);