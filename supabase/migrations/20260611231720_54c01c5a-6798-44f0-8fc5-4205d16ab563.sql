
CREATE TABLE public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  run_count integer NOT NULL DEFAULT 0,
  last_run_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automations TO authenticated;
GRANT ALL ON public.automations TO service_role;

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view automations"
  ON public.automations FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins agents manage automations insert"
  ON public.automations FOR INSERT TO authenticated
  WITH CHECK (public.get_company_role(auth.uid(), company_id) IN ('company_admin','agent'));

CREATE POLICY "Admins agents manage automations update"
  ON public.automations FOR UPDATE TO authenticated
  USING (public.get_company_role(auth.uid(), company_id) IN ('company_admin','agent'))
  WITH CHECK (public.get_company_role(auth.uid(), company_id) IN ('company_admin','agent'));

CREATE POLICY "Admins agents manage automations delete"
  ON public.automations FOR DELETE TO authenticated
  USING (public.get_company_role(auth.uid(), company_id) IN ('company_admin','agent'));

CREATE INDEX idx_automations_company_active ON public.automations(company_id, is_active);
CREATE INDEX idx_automations_trigger ON public.automations(company_id, trigger_type) WHERE is_active = true;

CREATE TRIGGER trg_automations_updated
  BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  trigger_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions_executed jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view automation runs"
  ON public.automation_runs FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Members can insert automation runs"
  ON public.automation_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(auth.uid(), company_id));

CREATE INDEX idx_automation_runs_automation ON public.automation_runs(automation_id, created_at DESC);
CREATE INDEX idx_automation_runs_company ON public.automation_runs(company_id, created_at DESC);
