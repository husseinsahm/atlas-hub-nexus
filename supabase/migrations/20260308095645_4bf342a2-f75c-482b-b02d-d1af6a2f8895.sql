
-- Lead status enum
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'planning', 'awaiting_client', 'won', 'lost');

-- Lead source enum
CREATE TYPE public.lead_source AS ENUM ('website', 'referral', 'social_media', 'walk_in', 'phone', 'email', 'partner', 'other');

-- Leads table
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  nationality text,
  travel_date date,
  adults integer NOT NULL DEFAULT 1,
  children integer NOT NULL DEFAULT 0,
  destinations jsonb DEFAULT '[]'::jsonb,
  budget_min numeric,
  budget_max numeric,
  budget_currency text NOT NULL DEFAULT 'USD',
  source lead_source NOT NULL DEFAULT 'other',
  status lead_status NOT NULL DEFAULT 'new',
  assigned_to uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Lead activities table
CREATE TABLE public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id uuid,
  activity_type text NOT NULL,
  description text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger for leads
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS policies for leads
CREATE POLICY "Company members can view their leads"
  ON public.leads FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id) AND deleted_at IS NULL);

CREATE POLICY "Company admins and agents can insert leads"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (
    is_company_member(auth.uid(), company_id)
    AND get_company_role(auth.uid(), company_id) IN ('company_admin', 'agent')
  );

CREATE POLICY "Company admins and agents can update leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (
    is_company_member(auth.uid(), company_id)
    AND get_company_role(auth.uid(), company_id) IN ('company_admin', 'agent')
  );

CREATE POLICY "Super admins can manage all leads"
  ON public.leads FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- RLS policies for lead_activities
CREATE POLICY "Company members can view lead activities"
  ON public.lead_activities FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_id AND is_company_member(auth.uid(), l.company_id)
    )
  );

CREATE POLICY "Company members can insert lead activities"
  ON public.lead_activities FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_id AND is_company_member(auth.uid(), l.company_id)
    )
  );

CREATE POLICY "Super admins can manage all lead activities"
  ON public.lead_activities FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Index for performance
CREATE INDEX idx_leads_company_status ON public.leads(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_assigned ON public.leads(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_lead_activities_lead ON public.lead_activities(lead_id);
