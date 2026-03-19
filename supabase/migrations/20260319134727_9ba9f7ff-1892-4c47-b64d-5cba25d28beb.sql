-- Fix: The SELECT policy filters deleted_at IS NULL, which means
-- after a soft-delete UPDATE (setting deleted_at), the updated row
-- no longer passes the SELECT policy. Postgres requires updated rows
-- to pass both USING and WITH CHECK. Since WITH CHECK defaults to USING
-- on the UPDATE policy, and the SELECT policy also filters, we need
-- an explicit WITH CHECK on the UPDATE policy.

-- Drop and recreate the UPDATE policy with explicit WITH CHECK
DROP POLICY IF EXISTS "Admins and agents can update invoices" ON public.invoices;

CREATE POLICY "Admins and agents can update invoices"
ON public.invoices
FOR UPDATE
TO authenticated
USING (
  is_company_member(auth.uid(), company_id)
  AND get_company_role(auth.uid(), company_id) = ANY (ARRAY['company_admin'::app_role, 'agent'::app_role, 'finance'::app_role])
)
WITH CHECK (
  is_company_member(auth.uid(), company_id)
  AND get_company_role(auth.uid(), company_id) = ANY (ARRAY['company_admin'::app_role, 'agent'::app_role, 'finance'::app_role])
);