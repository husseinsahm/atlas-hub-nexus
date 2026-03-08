
-- Create lead_followups table
CREATE TABLE public.lead_followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  followup_type TEXT NOT NULL DEFAULT 'call',
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_to UUID,
  description TEXT,
  expected_outcome TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_pattern TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_followups ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Company members can view lead followups"
  ON public.lead_followups FOR SELECT
  TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins and agents can insert lead followups"
  ON public.lead_followups FOR INSERT
  TO authenticated
  WITH CHECK (
    is_company_member(auth.uid(), company_id)
    AND get_company_role(auth.uid(), company_id) IN ('company_admin', 'agent')
  );

CREATE POLICY "Admins and agents can update lead followups"
  ON public.lead_followups FOR UPDATE
  TO authenticated
  USING (
    is_company_member(auth.uid(), company_id)
    AND get_company_role(auth.uid(), company_id) IN ('company_admin', 'agent')
  );

CREATE POLICY "Admins and agents can delete lead followups"
  ON public.lead_followups FOR DELETE
  TO authenticated
  USING (
    is_company_member(auth.uid(), company_id)
    AND get_company_role(auth.uid(), company_id) IN ('company_admin', 'agent')
  );

CREATE POLICY "Super admins manage all lead followups"
  ON public.lead_followups FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Updated at trigger
CREATE TRIGGER update_lead_followups_updated_at
  BEFORE UPDATE ON public.lead_followups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
