
-- Quotation status enum
CREATE TYPE public.quotation_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled');

-- Quotations table
CREATE TABLE public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  
  -- Amounts
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  deposit_amount NUMERIC DEFAULT 0,
  deposit_percentage NUMERIC DEFAULT 0,
  
  -- Terms
  payment_terms TEXT,
  validity_days INTEGER NOT NULL DEFAULT 14,
  valid_until DATE,
  terms_and_conditions TEXT,
  notes TEXT,
  client_notes TEXT,
  
  -- Status
  status quotation_status NOT NULL DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  
  -- Snapshot of trip data at time of quotation
  trip_snapshot JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_quotations_company ON public.quotations(company_id);
CREATE INDEX idx_quotations_trip ON public.quotations(trip_id);
CREATE INDEX idx_quotations_customer ON public.quotations(customer_id);
CREATE UNIQUE INDEX idx_quotations_number ON public.quotations(company_id, quotation_number);

-- Trigger for updated_at
CREATE TRIGGER update_quotations_updated_at
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view quotations"
  ON public.quotations FOR SELECT
  USING (is_company_member(auth.uid(), company_id) AND deleted_at IS NULL);

CREATE POLICY "Admins and agents can insert quotations"
  ON public.quotations FOR INSERT
  WITH CHECK (is_company_member(auth.uid(), company_id) AND get_company_role(auth.uid(), company_id) IN ('company_admin', 'agent'));

CREATE POLICY "Admins and agents can update quotations"
  ON public.quotations FOR UPDATE
  USING (is_company_member(auth.uid(), company_id) AND get_company_role(auth.uid(), company_id) IN ('company_admin', 'agent'));

CREATE POLICY "Super admins can manage all quotations"
  ON public.quotations FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- Add quotation_next_number to company_settings
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS quotation_prefix TEXT NOT NULL DEFAULT 'QTN',
  ADD COLUMN IF NOT EXISTS quotation_next_number INTEGER NOT NULL DEFAULT 1;
