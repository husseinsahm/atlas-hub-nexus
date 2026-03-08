
CREATE TABLE public.payment_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL DEFAULT 'cash',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_number TEXT,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view payment records"
  ON public.payment_records FOR SELECT
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins agents finance can insert payment records"
  ON public.payment_records FOR INSERT
  WITH CHECK (
    is_company_member(auth.uid(), company_id)
    AND get_company_role(auth.uid(), company_id) = ANY(ARRAY['company_admin'::app_role, 'agent'::app_role, 'finance'::app_role])
  );

CREATE POLICY "Admins can delete payment records"
  ON public.payment_records FOR DELETE
  USING (get_company_role(auth.uid(), company_id) = 'company_admin'::app_role);

CREATE POLICY "Super admins can manage all payment records"
  ON public.payment_records FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));
