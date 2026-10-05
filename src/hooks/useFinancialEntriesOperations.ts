import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import { getLocalCompanies } from '@/hooks/useCompanyOperations';

export interface FinancialEntry {
  id: string;
  user_id: string;
  company_id: string;
  description: string;
  op_number?: string | null;
  amount: number;
  expected_date: string;
  received_date?: string | null;
  payment_method: string;
  status: string; // 'pending' | 'received' | 'cancelled'
  observation?: string | null;
  created_at: string;
  updated_at: string;
  companies?: {
    razao_social: string;
    cnpj: string;
  };
}

export interface FinancialEntryFormData {
  company_id: string;
  description: string;
  op_number?: string;
  amount: number;
  expected_date: string;
  received_date?: string;
  payment_method: string;
  status?: string;
  observation?: string;
}

const LOCAL_ENTRIES_KEY = 'adm_master_local_financial_entries';

export const getLocalFinancialEntries = (): FinancialEntry[] => {
  try {
    const raw = localStorage.getItem(LOCAL_ENTRIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveLocalFinancialEntries = (entries: FinancialEntry[]) => {
  try {
    localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('Error saving local entries:', e);
  }
};

export function useFinancialEntriesOperations() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { createAuditLog } = useAuditLog();

  const createEntry = async (formData: FinancialEntryFormData): Promise<FinancialEntry | null> => {
    if (isLoading) return null;
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Try Supabase insert
      if (user) {
        try {
          const { data, error } = await supabase
            .from('financial_entries')
            .insert({
              user_id: user.id,
              company_id: formData.company_id,
              description: formData.description,
              op_number: formData.op_number || null,
              amount: Number(formData.amount),
              expected_date: formData.expected_date,
              received_date: formData.status === 'received' ? (formData.received_date || formData.expected_date) : null,
              payment_method: formData.payment_method,
              status: formData.status || 'pending',
              observation: formData.observation || null
            })
            .select(`*, companies(razao_social, cnpj)`)
            .single();

          if (!error && data) {
            await createAuditLog('financial_entries', data.id, 'create', {}, {
              description: data.description,
              amount: data.amount,
              status: data.status
            });

            toast({
              title: "Entrada cadastrada",
              description: "A entrada financeira foi registrada com sucesso.",
            });

            return data;
          }
        } catch (dbError) {
          console.warn("Supabase entry insert failed, falling back to local storage", dbError);
        }
      }

      // Local storage fallback for financial_entries
      const allCompanies = getLocalCompanies();
      const linkedCompany = allCompanies.find(c => c.id === formData.company_id);

      const localEntry: FinancialEntry = {
        id: crypto.randomUUID(),
        user_id: user?.id || 'local-user',
        company_id: formData.company_id,
        description: formData.description,
        op_number: formData.op_number || null,
        amount: Number(formData.amount),
        expected_date: formData.expected_date,
        received_date: formData.status === 'received' ? (formData.received_date || formData.expected_date) : null,
        payment_method: formData.payment_method,
        status: formData.status || 'pending',
        observation: formData.observation || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        companies: linkedCompany ? {
          razao_social: linkedCompany.razao_social,
          cnpj: linkedCompany.cnpj
        } : undefined
      };

      const currentLocals = getLocalFinancialEntries();
      currentLocals.unshift(localEntry);
      saveLocalFinancialEntries(currentLocals);

      toast({
        title: "Entrada cadastrada com sucesso",
        description: "A entrada financeira foi registrada com sucesso.",
      });

      return localEntry;
    } catch (error: any) {
      console.error('Error creating financial entry:', error);
      toast({
        title: "Erro ao cadastrar entrada",
        description: error.message || "Não foi possível cadastrar a entrada financeira.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const updateEntry = async (entryId: string, formData: FinancialEntryFormData): Promise<FinancialEntry | null> => {
    if (isLoading) return null;
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        try {
          const { data, error } = await supabase
            .from('financial_entries')
            .update({
              company_id: formData.company_id,
              description: formData.description,
              op_number: formData.op_number || null,
              amount: Number(formData.amount),
              expected_date: formData.expected_date,
              received_date: formData.status === 'received' ? (formData.received_date || formData.expected_date) : (formData.received_date || null),
              payment_method: formData.payment_method,
              status: formData.status || 'pending',
              observation: formData.observation || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', entryId)
            .select(`*, companies(razao_social, cnpj)`)
            .single();

          if (!error && data) {
            await createAuditLog('financial_entries', entryId, 'update', {}, {
              description: data.description,
              amount: data.amount,
              status: data.status
            });

            toast({
              title: "Entrada atualizada",
              description: "Os dados da entrada foram salvos.",
            });

            return data;
          }
        } catch (e) {
          console.warn('Supabase entry update fallback to local', e);
        }
      }

      // Local storage fallback
      const locals = getLocalFinancialEntries();
      const index = locals.findIndex(e => e.id === entryId);
      if (index !== -1) {
        const allCompanies = getLocalCompanies();
        const linkedCompany = allCompanies.find(c => c.id === formData.company_id);

        const updatedLocal: FinancialEntry = {
          ...locals[index],
          company_id: formData.company_id,
          description: formData.description,
          op_number: formData.op_number || null,
          amount: Number(formData.amount),
          expected_date: formData.expected_date,
          received_date: formData.status === 'received' ? (formData.received_date || formData.expected_date) : (formData.received_date || null),
          payment_method: formData.payment_method,
          status: formData.status || locals[index].status || 'pending',
          observation: formData.observation || null,
          updated_at: new Date().toISOString(),
          companies: linkedCompany ? {
            razao_social: linkedCompany.razao_social,
            cnpj: linkedCompany.cnpj
          } : locals[index].companies
        };
        locals[index] = updatedLocal;
        saveLocalFinancialEntries(locals);

        toast({
          title: "Entrada atualizada",
          description: "Os dados foram salvos no armazenamento local.",
        });

        return updatedLocal;
      }

      throw new Error('Entrada financeira não encontrada');
    } catch (error: any) {
      console.error('Error updating financial entry:', error);
      toast({
        title: "Erro ao atualizar entrada",
        description: error.message || "Ocorreu um erro ao atualizar.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const markAsReceived = async (entryId: string, receivedDate: string): Promise<boolean> => {
    try {
      try {
        const { error } = await supabase
          .from('financial_entries')
          .update({
            status: 'received',
            received_date: receivedDate,
            updated_at: new Date().toISOString()
          })
          .eq('id', entryId);

        if (!error) {
          toast({
            title: "Entrada recebida!",
            description: "A entrada foi marcada como recebida e adicionada ao saldo do caixa.",
          });
          return true;
        }
      } catch (e) {
        console.warn('Supabase markAsReceived fallback to local', e);
      }

      // Local storage fallback
      const locals = getLocalFinancialEntries();
      const index = locals.findIndex(e => e.id === entryId);
      if (index !== -1) {
        locals[index].status = 'received';
        locals[index].received_date = receivedDate;
        locals[index].updated_at = new Date().toISOString();
        saveLocalFinancialEntries(locals);
      }

      toast({
        title: "Entrada recebida!",
        description: "A entrada foi marcada como recebida e adicionada ao saldo do caixa.",
      });
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive"
      });
      return false;
    }
  };

  const cancelEntry = async (entryId: string): Promise<boolean> => {
    try {
      try {
        const { error } = await supabase
          .from('financial_entries')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', entryId);

        if (!error) {
          toast({
            title: "Entrada cancelada",
            description: "A entrada financeira foi cancelada.",
          });
          return true;
        }
      } catch (e) {
        console.warn('Supabase cancelEntry fallback to local', e);
      }

      // Local storage fallback
      const locals = getLocalFinancialEntries();
      const index = locals.findIndex(e => e.id === entryId);
      if (index !== -1) {
        locals[index].status = 'cancelled';
        locals[index].updated_at = new Date().toISOString();
        saveLocalFinancialEntries(locals);
      }

      toast({
        title: "Entrada cancelada",
        description: "A entrada financeira foi cancelada.",
      });
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao cancelar entrada",
        description: error.message,
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteEntry = async (entryId: string): Promise<boolean> => {
    try {
      try {
        const { error } = await supabase
          .from('financial_entries')
          .delete()
          .eq('id', entryId);

        if (!error) {
          toast({
            title: "Entrada removida",
            description: "A entrada foi excluída do sistema.",
          });
        }
      } catch (e) {
        console.warn('Supabase deleteEntry fallback to local', e);
      }

      // Local storage fallback
      const locals = getLocalFinancialEntries();
      const filtered = locals.filter(e => e.id !== entryId);
      saveLocalFinancialEntries(filtered);

      toast({
        title: "Entrada removida",
        description: "A entrada foi excluída do sistema.",
      });
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao excluir entrada",
        description: error.message,
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    createEntry,
    updateEntry,
    markAsReceived,
    cancelEntry,
    deleteEntry,
    isLoading
  };
}
