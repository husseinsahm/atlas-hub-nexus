
-- Trip revision history table
CREATE TABLE public.trip_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid,
  revision_number integer NOT NULL DEFAULT 1,
  action text NOT NULL DEFAULT 'update',
  summary text NOT NULL,
  note text,
  changes jsonb DEFAULT '{}'::jsonb,
  snapshot jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trip_revisions ENABLE ROW LEVEL SECURITY;

-- Company members can view revisions for their trips
CREATE POLICY "Company members can view trip revisions"
  ON public.trip_revisions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_revisions.trip_id
      AND is_company_member(auth.uid(), t.company_id)
    )
  );

-- Company members can insert revisions
CREATE POLICY "Company members can insert trip revisions"
  ON public.trip_revisions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_revisions.trip_id
      AND is_company_member(auth.uid(), t.company_id)
    )
  );

-- Super admins can manage all revisions
CREATE POLICY "Super admins can manage all trip revisions"
  ON public.trip_revisions
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Index for fast lookups
CREATE INDEX idx_trip_revisions_trip_id ON public.trip_revisions(trip_id, created_at DESC);
