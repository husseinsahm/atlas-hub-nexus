
-- Create a security definer function for soft-deleting leads
CREATE OR REPLACE FUNCTION public.soft_delete_lead(_lead_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _user_role app_role;
BEGIN
  -- Get the lead's company_id
  SELECT company_id INTO _company_id FROM public.leads WHERE id = _lead_id AND deleted_at IS NULL;
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;
  
  -- Check user is admin or agent in that company
  _user_role := get_company_role(auth.uid(), _company_id);
  IF _user_role IS NULL OR _user_role NOT IN ('company_admin', 'agent') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  UPDATE public.leads SET deleted_at = now(), updated_at = now() WHERE id = _lead_id;
  RETURN true;
END;
$$;

-- Create a security definer function for soft-deleting customers
CREATE OR REPLACE FUNCTION public.soft_delete_customer(_customer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _user_role app_role;
BEGIN
  SELECT company_id INTO _company_id FROM public.customers WHERE id = _customer_id AND deleted_at IS NULL;
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;
  
  _user_role := get_company_role(auth.uid(), _company_id);
  IF _user_role IS NULL OR _user_role NOT IN ('company_admin', 'agent') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  UPDATE public.customers SET deleted_at = now(), updated_at = now() WHERE id = _customer_id;
  RETURN true;
END;
$$;
