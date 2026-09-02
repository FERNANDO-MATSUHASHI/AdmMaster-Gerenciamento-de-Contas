-- Function to get all bills due today across all users (bypassing RLS for system notification)
CREATE OR REPLACE FUNCTION public.get_bills_due_today()
RETURNS TABLE (
  id UUID,
  description TEXT,
  amount DECIMAL(10,2),
  due_date DATE,
  status TEXT,
  account_name TEXT,
  check_number TEXT,
  supplier_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.description,
    b.amount,
    b.due_date,
    b.status,
    b.account_name,
    b.check_number,
    s.name AS supplier_name
  FROM public.bills b
  LEFT JOIN public.suppliers s ON s.id = b.supplier_id
  WHERE b.due_date = CURRENT_DATE
    AND b.status = 'pending'
  ORDER BY b.amount DESC;
END;
$$;

-- Grant execution permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_bills_due_today() TO anon, authenticated, service_role;
