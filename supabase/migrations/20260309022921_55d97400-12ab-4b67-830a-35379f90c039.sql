
-- Create billing_history table
CREATE TABLE public.billing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  invoice_date timestamp with time zone NOT NULL DEFAULT now(),
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  description text,
  payment_method text,
  pdf_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Company admins can view billing history"
  ON public.billing_history FOR SELECT
  TO authenticated
  USING (get_company_role(auth.uid(), company_id) = 'company_admin'::app_role);

CREATE POLICY "Super admins can manage all billing history"
  ON public.billing_history FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));
