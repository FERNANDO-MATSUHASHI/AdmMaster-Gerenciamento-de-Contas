import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';

interface Bank {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export function useBankOperations() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { createAuditLog } = useAuditLog();

  /**
   * Creates a new bank with audit logging
   */
  const createBank = async (name: string): Promise<Bank | null> => {
    if (isLoading) return null;

    setIsLoading(true);

    try {
      // Check if user is authenticated
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Save bank to database
      const { data, error } = await supabase
        .from('banks')
        .insert({
          user_id: user.id,
          name: name,
        })
        .select()
        .single();

      if (error) throw error;

      // Create audit log entry
      await createAuditLog('banks', data.id, 'create', {}, { name: data.name });

      toast({
        title: "Banco cadastrado com sucesso!",
        description: "O banco foi registrado no sistema",
      });

      return data;

    } catch (error: any) {
      console.error('Error creating bank:', error);
      toast({
        title: "Erro ao cadastrar banco",
        description: error.message || "Ocorreu um erro ao cadastrar o banco",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Deletes a bank with audit logging
   */
  const deleteBank = async (bank: Bank): Promise<boolean> => {
    if (isLoading) return false;

    setIsLoading(true);

    try {
      // Delete bank from database
      const { error } = await supabase
        .from('banks')
        .delete()
        .eq('id', bank.id);

      if (error) throw error;

      // Create audit log entry
      await createAuditLog('banks', bank.id, 'delete', { name: bank.name }, {});

      toast({
        title: "Banco excluído",
        description: "O banco foi excluído com sucesso",
      });

      return true;

    } catch (error: any) {
      console.error('Error deleting bank:', error);
      toast({
        title: "Erro ao excluir banco",
        description: error.message || "Ocorreu um erro ao excluir o banco",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createBank,
    deleteBank,
    isLoading
  };
}