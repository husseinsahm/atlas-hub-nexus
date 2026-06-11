
CREATE TABLE public.booking_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  source_booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES public.booking_recipes(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  structure jsonb NOT NULL DEFAULT '{}'::jsonb,
  destination text,
  duration_days integer,
  tags text[] DEFAULT '{}',
  usage_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_recipes TO authenticated;
GRANT ALL ON public.booking_recipes TO service_role;

ALTER TABLE public.booking_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view recipes"
  ON public.booking_recipes FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id) AND deleted_at IS NULL);

CREATE POLICY "Members can create recipes"
  ON public.booking_recipes FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Members can update recipes"
  ON public.booking_recipes FOR UPDATE TO authenticated
  USING (public.is_company_member(auth.uid(), company_id))
  WITH CHECK (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins can delete recipes"
  ON public.booking_recipes FOR DELETE TO authenticated
  USING (public.get_company_role(auth.uid(), company_id) IN ('company_admin','agent'));

CREATE INDEX idx_booking_recipes_company ON public.booking_recipes(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_booking_recipes_usage ON public.booking_recipes(company_id, last_used_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_booking_recipes_updated
  BEFORE UPDATE ON public.booking_recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
