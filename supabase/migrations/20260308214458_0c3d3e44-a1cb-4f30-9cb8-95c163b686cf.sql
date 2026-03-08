
-- Drop existing restrictive UPDATE policies and recreate as permissive

-- CUSTOMERS: Drop and recreate UPDATE policy as PERMISSIVE
DROP POLICY IF EXISTS "Admins and agents can update customers" ON public.customers;
CREATE POLICY "Admins and agents can update customers"
ON public.customers FOR UPDATE
TO authenticated
USING (
  is_company_member(auth.uid(), company_id)
  AND get_company_role(auth.uid(), company_id) = ANY (ARRAY['company_admin'::app_role, 'agent'::app_role])
)
WITH CHECK (
  is_company_member(auth.uid(), company_id)
  AND get_company_role(auth.uid(), company_id) = ANY (ARRAY['company_admin'::app_role, 'agent'::app_role])
);

-- LEADS: Drop and recreate UPDATE policy as PERMISSIVE
DROP POLICY IF EXISTS "Company admins and agents can update leads" ON public.leads;
CREATE POLICY "Company admins and agents can update leads"
ON public.leads FOR UPDATE
TO authenticated
USING (
  is_company_member(auth.uid(), company_id)
  AND get_company_role(auth.uid(), company_id) = ANY (ARRAY['company_admin'::app_role, 'agent'::app_role])
)
WITH CHECK (
  is_company_member(auth.uid(), company_id)
  AND get_company_role(auth.uid(), company_id) = ANY (ARRAY['company_admin'::app_role, 'agent'::app_role])
);
