
DROP POLICY "Admins agents can update itinerary templates" ON public.itinerary_templates;

CREATE POLICY "Admins agents can update itinerary templates" ON public.itinerary_templates
FOR UPDATE TO authenticated
USING (
  is_company_member(auth.uid(), company_id) 
  AND get_company_role(auth.uid(), company_id) IN ('company_admin', 'agent', 'operations')
)
WITH CHECK (
  is_company_member(auth.uid(), company_id) 
  AND get_company_role(auth.uid(), company_id) IN ('company_admin', 'agent', 'operations')
);
