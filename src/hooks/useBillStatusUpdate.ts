import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { validateStatusTransition, type BillStatus } from '@/lib/billStatusValidation';
import { useToast } from '@/hooks/use-toast';
import { translateErrorMessage } from '@/lib/errorMessages';

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

  /**
   * Creates an audit log entry for the status change
   */
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
      // Don't throw here - audit log failure shouldn't prevent the status update
    }
  };

  /**
   * Updates bill status with validation and audit logging
   */
  const updateBillStatus = async (
    bill: Bill,
    newStatus: BillStatus,
    onSuccess?: () => void
  ): Promise<boolean> => {
    if (isUpdating) return false;

    setIsUpdating(true);

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const currentStatus = bill.status as BillStatus;
      
      // Validate status transition
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
      const { error: updateError } = await supabase
        .from('bills')
        .update({ status: newStatus })
        .eq('id', bill.id);

      if (updateError) throw updateError;

      // Create audit log entry
      await createAuditLog(bill, currentStatus, newStatus, user.id);

      // Show success message
      toast({
        title: "Sucesso",
        description: "Status da conta atualizado com sucesso!",
      });

      // Call success callback
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