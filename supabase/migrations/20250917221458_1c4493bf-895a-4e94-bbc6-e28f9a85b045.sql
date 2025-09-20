-- Fix audit logs security vulnerability
-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Create a secure INSERT policy that only allows authenticated users to insert their own audit logs
-- This ensures audit logs can only be created by authenticated users for their own actions
CREATE POLICY "Users can insert their own audit logs" 
ON public.audit_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

-- Add additional security: Create a function to validate audit log entries
CREATE OR REPLACE FUNCTION public.validate_audit_log_entry()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure the user_id matches the current authenticated user
  IF NEW.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Audit log user_id must match authenticated user';
  END IF;
  
  -- Ensure required fields are present
  IF NEW.table_name IS NULL OR NEW.record_id IS NULL OR NEW.action IS NULL THEN
    RAISE EXCEPTION 'Audit log must have table_name, record_id, and action';
  END IF;
  
  -- Validate table_name against allowed tables
  IF NEW.table_name NOT IN ('bills', 'suppliers', 'banks', 'supplier_types') THEN
    RAISE EXCEPTION 'Invalid table_name for audit log';
  END IF;
  
  -- Validate action types
  IF NEW.action NOT IN ('status_update', 'create', 'update', 'delete') THEN
    RAISE EXCEPTION 'Invalid action type for audit log';
  END IF;
  
  -- Set created_at to current timestamp to prevent time manipulation
  NEW.created_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to validate audit log entries on insert
CREATE TRIGGER validate_audit_log_entry_trigger
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_audit_log_entry();