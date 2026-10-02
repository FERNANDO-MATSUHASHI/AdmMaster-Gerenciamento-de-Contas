import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { validateStatusTransition, type BillStatus } from '@/lib/billStatusValidation';
import { useToast } from '@/hooks/use-toast';
import { translateErrorMessage } from '@/lib/errorMessages';
import { getLocalBillPayments, saveLocalBillPayments } from '@/hooks/useBillPaymentOperations';
import { format } from 'date-fns';

interface Bill {
  id: string;
  status: BillStatus;
  description: string;
  amount: number;
  [key: string]: any;
}

interface AuditLogEntry {
  user_id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_values: Record<string, any>;
  new_values: Record<string, any>;
}

export function useBillStatusUpdate() {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const createAuditLog = async (
    bill: Bill,
    oldStatus: BillStatus,
    newStatus: BillStatus,
    userId: string
  ): Promise<void> => {
    const auditEntry: AuditLogEntry = {
      user_id: userId,
      table_name: 'bills',
      record_id: bill.id,
      action: 'status_update',
      old_values: { status: oldStatus },
      new_values: { status: newStatus }
    };

    const { error } = await supabase
      .from('audit_logs')
      .insert(auditEntry);

    if (error) {
      console.error('Failed to create audit log:', error);
    }
  };

  /**
   * Syncs bill payment record in bill_payments when status changes to paid / un-paid
   */
  const syncPaymentForStatus = async (bill: Bill, newStatus: BillStatus, userId: string) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const paymentDate = bill.payment_date || bill.paid_at || todayStr;
    const paymentMethod = bill.payment_type || bill.payment_method || 'Pix';

    if (newStatus === 'paid') {
      // 1. Try remote insert into bill_payments
      try {
        const { data: existing } = await supabase
          .from('bill_payments')
          .select('id')
          .eq('bill_id', bill.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from('bill_payments').insert({
            user_id: userId,
            bill_id: bill.id,
            amount_paid: Number(bill.amount),
            payment_date: paymentDate,
            payment_method: paymentMethod
          });
        }
      } catch (e) {
        console.warn('Error syncing remote bill payment on status update:', e);
      }

      // 2. Sync local bill_payments
      const localPayments = getLocalBillPayments();
      if (!localPayments.some(lp => lp.bill_id === bill.id)) {
        localPayments.unshift({
          id: crypto.randomUUID(),
          user_id: userId,
          bill_id: bill.id,
          amount_paid: Number(bill.amount),
          payment_date: paymentDate,
          payment_method: paymentMethod,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          bills: {
            description: bill.description,
            amount: Number(bill.amount)
          }
        });
        saveLocalBillPayments(localPayments);
      }
    } else if (newStatus === 'pending' || newStatus === 'overdue') {
      // If status reverted to pending/overdue, remove corresponding payment entries
      try {
        await supabase
          .from('bill_payments')
          .delete()
          .eq('bill_id', bill.id);
      } catch (e) {
        console.warn('Error deleting remote bill_payments on revert:', e);
      }

      const localPayments = getLocalBillPayments();
      const updatedLocals = localPayments.filter(lp => lp.bill_id !== bill.id);
      saveLocalBillPayments(updatedLocals);
    }
  };

  /**
   * Updates bill status with validation, audit logging, and cash payment sync
   */
  const updateBillStatus = async (
    bill: Bill,
    newStatus: BillStatus,
    onSuccess?: () => void
  ): Promise<boolean> => {
    if (isUpdating) return false;

    setIsUpdating(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      const userId = user?.id || 'local-user';

      const currentStatus = bill.status as BillStatus;
      
      const transition = validateStatusTransition(currentStatus, newStatus);
      if (!transition.isValid) {
        toast({
          title: "Transição inválida",
          description: transition.reason || "Esta alteração de status não é permitida",
          variant: "destructive",
        });
        return false;
      }

      // Update bill status in database
      if (user) {
        try {
          const { error: updateError } = await supabase
            .from('bills')
            .update({ status: newStatus })
            .eq('id', bill.id);

          if (updateError) throw updateError;

          await createAuditLog(bill, currentStatus, newStatus, user.id);
        } catch (dbErr) {
          console.warn('Remote status update failed, local fallback:', dbErr);
        }
      }

      // Sync payment record and cash register
      await syncPaymentForStatus(bill, newStatus, userId);

      toast({
        title: "Sucesso",
        description: "Status da conta atualizado com sucesso e sincronizado com o caixa!",
      });

      onSuccess?.();
      return true;

    } catch (error) {
      console.error('Error updating bill status:', error);
      toast({
        title: "Erro",
        description: translateErrorMessage(error),
        variant: "destructive",
      });
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    updateBillStatus,
    isUpdating
  };
}