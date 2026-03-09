
-- Create upgrade_requests table
CREATE TABLE public.upgrade_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id),
  requested_by uuid NOT NULL,
  requested_plan_id uuid NOT NULL REFERENCES public.plans(id),
  requested_billing_cycle text NOT NULL DEFAULT 'monthly',
  current_plan_id uuid REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_upgrade_requests_company ON public.upgrade_requests(company_id);
CREATE INDEX idx_upgrade_requests_status ON public.upgrade_requests(status);

-- Enable RLS
ALTER TABLE public.upgrade_requests ENABLE ROW LEVEL SECURITY;

-- Company admins can view their own requests
CREATE POLICY "Company admins can view their upgrade requests"
ON public.upgrade_requests FOR SELECT TO authenticated
USING (get_company_role(auth.uid(), company_id) = 'company_admin'::app_role);

-- Company admins can insert requests
CREATE POLICY "Company admins can submit upgrade requests"
ON public.upgrade_requests FOR INSERT TO authenticated
WITH CHECK (get_company_role(auth.uid(), company_id) = 'company_admin'::app_role AND auth.uid() = requested_by);

-- Super admins can manage all requests
CREATE POLICY "Super admins can manage all upgrade requests"
ON public.upgrade_requests FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Remove the direct update policy for company admins on subscriptions
DROP POLICY IF EXISTS "Company admins can update their subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Company admins can insert subscription" ON public.subscriptions;

-- Updated_at trigger
CREATE TRIGGER update_upgrade_requests_updated_at
  BEFORE UPDATE ON public.upgrade_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
