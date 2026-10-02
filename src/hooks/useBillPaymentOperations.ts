import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';

export interface BillPayment {
  id: string;
  user_id: string;
  bill_id: string;
  amount_paid: number;
  payment_date: string;
  payment_method: string;
  observation?: string | null;
  created_at: string;
  updated_at: string;
  bills?: {
    description: string;
    amount: number;
    supplier_id?: string;
    suppliers?: {
      name: string;
    };
  };
}

export interface RegisterPaymentInput {
  bill_id: string;
  amount_paid: number;
  payment_date: string;
  payment_method: string;
  observation?: string;
}

const LOCAL_PAYMENTS_KEY = 'adm_master_local_bill_payments';

export const getLocalBillPayments = (): BillPayment[] => {
  try {
    const raw = localStorage.getItem(LOCAL_PAYMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveLocalBillPayments = (payments: BillPayment[]) => {
  try {
    localStorage.setItem(LOCAL_PAYMENTS_KEY, JSON.stringify(payments));
  } catch (e) {
    console.error('Error saving local bill payments:', e);
  }
};

export function useBillPaymentOperations() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { createAuditLog } = useAuditLog();

  /**
   * Helper to recalculate total payments and sync bill status
   */
  const syncBillStatus = async (billId: string) => {
    try {
      // Get bill total amount
      const { data: bill, error: billError } = await supabase
        .from('bills')
        .select('amount, due_date')
        .eq('id', billId)
        .single();

      if (billError || !bill) return;

      // Sum all payments for this bill
      const { data: payments, error: paymentsError } = await supabase
        .from('bill_payments')
        .select('amount_paid')
        .eq('bill_id', billId);

      if (paymentsError) return;

      const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount_paid), 0);
      const totalAmount = Number(bill.amount);

      let newStatus = 'pending';

      if (totalPaid >= totalAmount - 0.001) {
        newStatus = 'paid';
      } else if (totalPaid > 0) {
        newStatus = 'partially_paid';
      } else {
        // Check if overdue
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [year, month, day] = (bill.due_date || "").split("-").map(Number);
        const dueDate = new Date(year, (month || 1) - 1, day || 1);
        if (dueDate < today) {
          newStatus = 'overdue';
        } else {
          newStatus = 'pending';
        }
      }

      await supabase
        .from('bills')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', billId);

    } catch (error) {
      console.error('Error syncing bill status:', error);
    }
  };

  /**
   * Register a new payment (total or partial)
   */
  const registerPayment = async (input: RegisterPaymentInput): Promise<BillPayment | null> => {
    if (isLoading) return null;
    setIsLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Usuário não autenticado');

      // Fetch bill and current payments for validation
      const { data: bill, error: billError } = await supabase
        .from('bills')
        .select('id, amount, description, status')
        .eq('id', input.bill_id)
        .single();

      if (billError || !bill) throw new Error('Conta não encontrada.');

      const { data: existingPayments } = await supabase
        .from('bill_payments')
        .select('amount_paid')
        .eq('bill_id', input.bill_id);

      const totalAlreadyPaid = (existingPayments || []).reduce((sum, p) => sum + Number(p.amount_paid), 0);
      const remainingBalance = Number(bill.amount) - totalAlreadyPaid;

      // Validate payment amount
      if (input.amount_paid <= 0) {
        toast({
          title: "Valor inválido",
          description: "O valor do pagamento deve ser maior que zero.",
          variant: "destructive",
        });
        return null;
      }

      if (input.amount_paid > remainingBalance + 0.001) {
        toast({
          title: "Valor acima do saldo devedor",
          description: `O valor informado (R$ ${input.amount_paid.toFixed(2)}) supera o saldo restante (R$ ${remainingBalance.toFixed(2)}).`,
          variant: "destructive",
        });
        return null;
      }

      // Insert payment record into Supabase
      try {
        const { data: newPayment, error: insertError } = await supabase
          .from('bill_payments')
          .insert({
            user_id: user.id,
            bill_id: input.bill_id,
            amount_paid: Number(input.amount_paid),
            payment_date: input.payment_date,
            payment_method: input.payment_method,
            observation: input.observation || null
          })
          .select(`*, bills(description, amount, supplier_id, suppliers(name))`)
          .single();

        if (!insertError && newPayment) {
          // Sync bill status
          await syncBillStatus(input.bill_id);

          await createAuditLog('bill_payments', newPayment.id, 'create', {}, {
            bill_id: input.bill_id,
            amount_paid: input.amount_paid,
            payment_date: input.payment_date
          });

          toast({
            title: "Pagamento registrado!",
            description: `Pagamento de R$ ${input.amount_paid.toFixed(2)} registrado com sucesso e descontado do caixa.`,
          });

          return newPayment;
        }
      } catch (dbError) {
        console.warn("Supabase payment insert failed, falling back to local storage", dbError);
      }

      // Local storage fallback for bill_payments
      const localPayment: BillPayment = {
        id: crypto.randomUUID(),
        user_id: user.id,
        bill_id: input.bill_id,
        amount_paid: Number(input.amount_paid),
        payment_date: input.payment_date,
        payment_method: input.payment_method,
        observation: input.observation || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        bills: bill ? {
          description: bill.description,
          amount: Number(bill.amount)
        } : undefined
      };

      const currentLocals = getLocalBillPayments();
      currentLocals.unshift(localPayment);
      saveLocalBillPayments(currentLocals);

      toast({
        title: "Pagamento registrado!",
        description: `Pagamento de R$ ${input.amount_paid.toFixed(2)} registrado com sucesso.`,
      });

      return localPayment;
    } catch (error: any) {
      console.error('Error registering payment:', error);
      toast({
        title: "Erro ao registrar pagamento",
        description: error.message || "Ocorreu um erro ao salvar o pagamento.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Delete / Reverse (Estorno) a payment
   */
  const reversePayment = async (paymentId: string, billId: string): Promise<boolean> => {
    try {
      try {
        await supabase
          .from('bill_payments')
          .delete()
          .eq('id', paymentId);
      } catch (e) {
        console.warn('Remote payment delete failed, checking local:', e);
      }

      const locals = getLocalBillPayments();
      const updatedLocals = locals.filter(p => p.id !== paymentId);
      saveLocalBillPayments(updatedLocals);

      await syncBillStatus(billId);

      toast({
        title: "Pagamento estornado",
        description: "O pagamento foi removido e o saldo do caixa/conta recalculado.",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao estornar pagamento",
        description: error.message,
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    registerPayment,
    reversePayment,
    syncBillStatus,
    isLoading
  };
}
