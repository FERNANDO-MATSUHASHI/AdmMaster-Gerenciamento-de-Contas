import { supabase } from '@/integrations/supabase/client';

interface AuditLogEntry {
  user_id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_values: Record<string, any>;
  new_values: Record<string, any>;
}

export function useAuditLog() {
  /**
   * Creates an audit log entry for database operations
   */
  const createAuditLog = async (
    tableName: 'bills' | 'suppliers' | 'banks' | 'supplier_types',
    recordId: string,
    action: 'status_update' | 'create' | 'update' | 'delete',
    oldValues: Record<string, any> = {},
    newValues: Record<string, any> = {}
  ): Promise<void> => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('Failed to get user for audit log:', userError);
        return;
      }

      const auditEntry: AuditLogEntry = {
        user_id: user.id,
        table_name: tableName,
        record_id: recordId,
        action,
        old_values: oldValues,
        new_values: newValues
      };

      const { error } = await supabase
        .from('audit_logs')
        .insert(auditEntry);

      if (error) {
        console.error('Failed to create audit log:', error);
        // Don't throw here - audit log failure shouldn't prevent the main operation
      }
    } catch (error) {
      console.error('Error creating audit log:', error);
    }
  };

  return {
    createAuditLog
  };
}