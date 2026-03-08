-- Fix the overly permissive company insert policy
DROP POLICY "Authenticated users can create companies" ON public.companies;

-- More restrictive: only allow users who don't already have a company membership to create one
-- This is used during the registration flow
CREATE POLICY "Authenticated users can register a company"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.company_memberships
      WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'super_admin')
  );