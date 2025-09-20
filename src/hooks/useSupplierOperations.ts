import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';

interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  type_id?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface SupplierFormData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  type_id?: string;
}

export function useSupplierOperations() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { createAuditLog } = useAuditLog();

  /**
   * Creates a new supplier with audit logging
   */
  const createSupplier = async (formData: SupplierFormData): Promise<Supplier | null> => {
    if (isLoading) return null;

    setIsLoading(true);

    try {
      // Check if user is authenticated
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Save supplier to database
      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          user_id: user.id,
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          type_id: formData.type_id || null
        })
        .select()
        .single();

      if (error) throw error;

      // Create audit log entry
      await createAuditLog('suppliers', data.id, 'create', {}, {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        type_id: data.type_id
      });

      toast({
        title: "Fornecedor cadastrado com sucesso!",
        description: "O fornecedor foi registrado no sistema",
      });

      return data;

    } catch (error: any) {
      console.error('Error creating supplier:', error);
      toast({
        title: "Erro ao cadastrar fornecedor",
        description: error.message || "Ocorreu um erro ao cadastrar o fornecedor",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Updates an existing supplier with audit logging
   */
  const updateSupplier = async (supplier: Supplier, formData: SupplierFormData): Promise<Supplier | null> => {
    if (isLoading) return null;

    setIsLoading(true);

    try {
      // Save original values for audit log
      const oldValues = {
        name: supplier.name,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        type_id: supplier.type_id
      };

      // Update supplier in database
      const { data, error } = await supabase
        .from('suppliers')
        .update({
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          type_id: formData.type_id || null
        })
        .eq('id', supplier.id)
        .select()
        .single();

      if (error) throw error;

      // Create audit log entry
      await createAuditLog('suppliers', supplier.id, 'update', oldValues, {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        type_id: data.type_id
      });

      toast({
        title: "Fornecedor atualizado com sucesso!",
        description: "O fornecedor foi atualizado no sistema",
      });

      return data;

    } catch (error: any) {
      console.error('Error updating supplier:', error);
      toast({
        title: "Erro ao atualizar fornecedor",
        description: error.message || "Ocorreu um erro ao atualizar o fornecedor",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Deletes a supplier with audit logging
   */
  const deleteSupplier = async (supplier: Supplier): Promise<boolean> => {
    if (isLoading) return false;

    setIsLoading(true);

    try {
      // Delete supplier from database
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', supplier.id);

      if (error) throw error;

      // Create audit log entry
      await createAuditLog('suppliers', supplier.id, 'delete', {
        name: supplier.name,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        type_id: supplier.type_id
      }, {});

      toast({
        title: "Fornecedor excluído",
        description: "O fornecedor foi removido do sistema",
      });

      return true;

    } catch (error: any) {
      console.error('Error deleting supplier:', error);
      toast({
        title: "Erro ao excluir fornecedor",
        description: error.message || "Não foi possível excluir o fornecedor",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createSupplier,
    updateSupplier,
    deleteSupplier,
    isLoading
  };
}