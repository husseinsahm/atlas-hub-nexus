
-- Customers table
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  secondary_phone text,
  nationality text,
  date_of_birth date,
  passport_number text,
  address text,
  city text,
  country text,
  preferences jsonb DEFAULT '[]'::jsonb,
  tags jsonb DEFAULT '[]'::jsonb,
  notes text,
  avatar_url text,
  source text DEFAULT 'direct',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Customer notes table (separate from lead activities)
CREATE TABLE public.customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id uuid,
  note_type text NOT NULL DEFAULT 'general',
  content text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Customer attachments
CREATE TABLE public.customer_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_attachments ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Customers RLS
CREATE POLICY "Company members can view their customers"
  ON public.customers FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id) AND deleted_at IS NULL);

CREATE POLICY "Admins and agents can insert customers"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (
    is_company_member(auth.uid(), company_id)
    AND get_company_role(auth.uid(), company_id) IN ('company_admin', 'agent')
  );

CREATE POLICY "Admins and agents can update customers"
  ON public.customers FOR UPDATE TO authenticated
  USING (
    is_company_member(auth.uid(), company_id)
    AND get_company_role(auth.uid(), company_id) IN ('company_admin', 'agent')
  );

CREATE POLICY "Super admins can manage all customers"
  ON public.customers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Customer notes RLS
CREATE POLICY "Company members can view customer notes"
  ON public.customer_notes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND is_company_member(auth.uid(), c.company_id)));

CREATE POLICY "Company members can insert customer notes"
  ON public.customer_notes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND is_company_member(auth.uid(), c.company_id)));

CREATE POLICY "Super admins can manage all customer notes"
  ON public.customer_notes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Customer attachments RLS
CREATE POLICY "Company members can view customer attachments"
  ON public.customer_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND is_company_member(auth.uid(), c.company_id)));

CREATE POLICY "Company members can insert customer attachments"
  ON public.customer_attachments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND is_company_member(auth.uid(), c.company_id)));

CREATE POLICY "Company members can delete customer attachments"
  ON public.customer_attachments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND get_company_role(auth.uid(), c.company_id) IN ('company_admin', 'agent')));

CREATE POLICY "Super admins can manage all customer attachments"
  ON public.customer_attachments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Indexes
CREATE INDEX idx_customers_company ON public.customers(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customer_notes_customer ON public.customer_notes(customer_id);
CREATE INDEX idx_customer_attachments_customer ON public.customer_attachments(customer_id);
