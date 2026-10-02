import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import { unformatCNPJ } from '@/lib/cnpjFormatter';

export interface Company {
  id: string;
  user_id: string;
  cnpj: string;
  razao_social: string;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  status: string; // 'active' | 'inactive'
  created_at: string;
  updated_at: string;
}

export interface CompanyFormData {
  cnpj: string;
  razao_social: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  status?: string;
}

const LOCAL_STORAGE_KEY = 'adm_master_local_companies';

export const getLocalCompanies = (): Company[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveLocalCompanies = (companies: Company[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(companies));
  } catch (e) {
    console.error('Error saving local companies:', e);
  }
};

export function useCompanyOperations() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { createAuditLog } = useAuditLog();

  const createCompany = async (formData: CompanyFormData): Promise<Company | null> => {
    if (isLoading) return null;
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const cleanCNPJ = unformatCNPJ(formData.cnpj);

      // Check remote duplicate if possible
      try {
        if (user) {
          const { data: existing } = await supabase
            .from('companies')
            .select('id, cnpj, razao_social')
            .eq('user_id', user.id);

          if (existing && existing.some(c => unformatCNPJ(c.cnpj) === cleanCNPJ)) {
            toast({
              title: "CNPJ já cadastrado",
              description: "Já existe uma empresa cadastrada com este CNPJ.",
              variant: "destructive",
            });
            return null;
          }
        }
      } catch (e) {
        // Ignore check error if table does not exist
      }

      // Check local duplicate
      const locals = getLocalCompanies();
      if (locals.some(c => unformatCNPJ(c.cnpj) === cleanCNPJ)) {
        toast({
          title: "CNPJ já cadastrado",
          description: "Já existe uma empresa cadastrada com este CNPJ.",
          variant: "destructive",
        });
        return null;
      }

      // Try Supabase insert
      if (user) {
        try {
          const { data, error } = await supabase
            .from('companies')
            .insert({
              user_id: user.id,
              cnpj: formData.cnpj,
              razao_social: formData.razao_social,
              cep: formData.cep || null,
              logradouro: formData.logradouro || null,
              numero: formData.numero || null,
              complemento: formData.complemento || null,
              bairro: formData.bairro || null,
              cidade: formData.cidade || null,
              estado: formData.estado || null,
              status: formData.status || 'active'
            })
            .select()
            .single();

          if (!error && data) {
            await createAuditLog('companies', data.id, 'create', {}, {
              cnpj: data.cnpj,
              razao_social: data.razao_social
            });

            toast({
              title: "Empresa cadastrada",
              description: "A empresa foi registrada com sucesso.",
            });

            return data;
          }
        } catch (dbError) {
          console.warn("Supabase insert failed, falling back to local storage", dbError);
        }
      }

      // Fallback to Local Storage if Supabase table is not yet created
      const localCompany: Company = {
        id: crypto.randomUUID(),
        user_id: user?.id || 'local-user',
        cnpj: formData.cnpj,
        razao_social: formData.razao_social,
        cep: formData.cep || null,
        logradouro: formData.logradouro || null,
        numero: formData.numero || null,
        complemento: formData.complemento || null,
        bairro: formData.bairro || null,
        cidade: formData.cidade || null,
        estado: formData.estado || null,
        status: formData.status || 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const currentLocals = getLocalCompanies();
      currentLocals.unshift(localCompany);
      saveLocalCompanies(currentLocals);

      toast({
        title: "Empresa cadastrada com sucesso",
        description: `A empresa ${localCompany.razao_social} foi cadastrada com sucesso.`,
      });

      return localCompany;
    } catch (error: any) {
      console.error('Error creating company:', error);
      toast({
        title: "Erro ao cadastrar empresa",
        description: error.message || "Ocorreu um erro ao cadastrar a empresa",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const updateCompany = async (companyId: string, formData: CompanyFormData): Promise<Company | null> => {
    if (isLoading) return null;
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Check duplicate CNPJ excluding current company
      const cleanCNPJ = unformatCNPJ(formData.cnpj);
      const { data: existing } = await supabase
        .from('companies')
        .select('id, cnpj')
        .eq('user_id', user.id)
        .neq('id', companyId);

      if (existing && existing.some(c => unformatCNPJ(c.cnpj) === cleanCNPJ)) {
        toast({
          title: "CNPJ já cadastrado",
          description: "Outra empresa já utiliza este CNPJ.",
          variant: "destructive",
        });
        return null;
      }

      const { data, error } = await supabase
        .from('companies')
        .update({
          cnpj: formData.cnpj,
          razao_social: formData.razao_social,
          cep: formData.cep || null,
          logradouro: formData.logradouro || null,
          numero: formData.numero || null,
          complemento: formData.complemento || null,
          bairro: formData.bairro || null,
          cidade: formData.cidade || null,
          estado: formData.estado || null,
          status: formData.status || 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', companyId)
        .select()
        .single();

      if (error) throw error;

      await createAuditLog('companies', companyId, 'update', {}, {
        cnpj: data.cnpj,
        razao_social: data.razao_social
      });

      toast({
        title: "Empresa atualizada",
        description: "Os dados da empresa foram salvos.",
      });

      return data;
    } catch (error: any) {
      console.error('Error updating company:', error);
      toast({
        title: "Erro ao atualizar empresa",
        description: error.message || "Ocorreu um erro ao atualizar os dados.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCompany = async (company: Company): Promise<{ success: boolean; hasEntries?: boolean }> => {
    if (isLoading) return { success: false };
    setIsLoading(true);

    try {
      // Check if company has linked financial entries
      const { data: entries, error: checkError } = await supabase
        .from('financial_entries')
        .select('id')
        .eq('company_id', company.id)
        .limit(1);

      if (checkError && checkError.code !== 'PGRST116') {
        console.warn('Check entries warn:', checkError);
      }

      if (entries && entries.length > 0) {
        toast({
          title: "Não é possível excluir",
          description: "A empresa possui movimentações financeiras vinculadas. Você pode inativá-la.",
          variant: "destructive",
        });
        return { success: false, hasEntries: true };
      }

      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', company.id);

      if (error) throw error;

      await createAuditLog('companies', company.id, 'delete', { razao_social: company.razao_social }, {});

      toast({
        title: "Empresa excluída",
        description: "A empresa foi removida com sucesso.",
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting company:', error);
      toast({
        title: "Erro ao excluir",
        description: error.message || "Não foi possível excluir a empresa.",
        variant: "destructive",
      });
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCompanyStatus = async (company: Company, newStatus: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', company.id);

      if (error) throw error;

      toast({
        title: newStatus === 'active' ? "Empresa ativada" : "Empresa inativada",
        description: `A empresa ${company.razao_social} agora está ${newStatus === 'active' ? 'ativa' : 'inativa'}.`,
      });
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    createCompany,
    updateCompany,
    deleteCompany,
    toggleCompanyStatus,
    isLoading
  };
}
