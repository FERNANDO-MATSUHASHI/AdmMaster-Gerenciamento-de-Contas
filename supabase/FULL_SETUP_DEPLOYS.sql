-- =========================================================================
-- SCRIPT DE EXECUÇÃO SUPABASE - CRIAÇÃO DE TABELAS PARA PRODUÇÃO / DEPLOY
-- Copie e cole este código no SQL Editor do seu painel Supabase e clique em "Run"
-- =========================================================================

-- 1. Tabela de Empresas (Companies / Clientes)
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  cnpj TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'Users can view their own companies') THEN
    CREATE POLICY "Users can view their own companies" ON public.companies FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'Users can insert their own companies') THEN
    CREATE POLICY "Users can insert their own companies" ON public.companies FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'Users can update their own companies') THEN
    CREATE POLICY "Users can update their own companies" ON public.companies FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'Users can delete their own companies') THEN
    CREATE POLICY "Users can delete their own companies" ON public.companies FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Tabela de Entradas Financeiras (Caixa)
CREATE TABLE IF NOT EXISTS public.financial_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  op_number TEXT,
  amount NUMERIC(12,2) NOT NULL,
  expected_date DATE NOT NULL,
  received_date DATE,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'cancelled')),
  observation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Garantir coluna op_number se a tabela já existir
ALTER TABLE public.financial_entries ADD COLUMN IF NOT EXISTS op_number TEXT;

ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financial_entries' AND policyname = 'Users can view their own financial_entries') THEN
    CREATE POLICY "Users can view their own financial_entries" ON public.financial_entries FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financial_entries' AND policyname = 'Users can insert their own financial_entries') THEN
    CREATE POLICY "Users can insert their own financial_entries" ON public.financial_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financial_entries' AND policyname = 'Users can update their own financial_entries') THEN
    CREATE POLICY "Users can update their own financial_entries" ON public.financial_entries FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financial_entries' AND policyname = 'Users can delete their own financial_entries') THEN
    CREATE POLICY "Users can delete their own financial_entries" ON public.financial_entries FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 3. Tabela de Pagamentos de Contas (Bill Payments)
CREATE TABLE IF NOT EXISTS public.bill_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  amount_paid NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT NOT NULL,
  observation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bill_payments' AND policyname = 'Users can view their own bill_payments') THEN
    CREATE POLICY "Users can view their own bill_payments" ON public.bill_payments FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bill_payments' AND policyname = 'Users can insert their own bill_payments') THEN
    CREATE POLICY "Users can insert their own bill_payments" ON public.bill_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bill_payments' AND policyname = 'Users can update their own bill_payments') THEN
    CREATE POLICY "Users can update their own bill_payments" ON public.bill_payments FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bill_payments' AND policyname = 'Users can delete their own bill_payments') THEN
    CREATE POLICY "Users can delete their own bill_payments" ON public.bill_payments FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Tabela de Configurações de Caixa (Cash Settings)
CREATE TABLE IF NOT EXISTS public.cash_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE DEFAULT auth.uid(),
  initial_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  reference_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cash_settings' AND policyname = 'Users can view their own cash_settings') THEN
    CREATE POLICY "Users can view their own cash_settings" ON public.cash_settings FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cash_settings' AND policyname = 'Users can insert their own cash_settings') THEN
    CREATE POLICY "Users can insert their own cash_settings" ON public.cash_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cash_settings' AND policyname = 'Users can update their own cash_settings') THEN
    CREATE POLICY "Users can update their own cash_settings" ON public.cash_settings FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cash_settings' AND policyname = 'Users can delete their own cash_settings') THEN
    CREATE POLICY "Users can delete their own cash_settings" ON public.cash_settings FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
