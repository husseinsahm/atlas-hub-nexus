
DROP POLICY IF EXISTS "Admins can delete payment records" ON public.payment_records;

CREATE POLICY "Admins and agents can delete payment records"
  ON public.payment_records FOR DELETE
  USING (
    is_company_member(auth.uid(), company_id) 
    AND get_company_role(auth.uid(), company_id) IN ('company_admin'::app_role, 'agent'::app_role)
  );
