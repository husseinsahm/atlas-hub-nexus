
-- Feedback table for client interactions on shared trips
CREATE TABLE public.trip_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  feedback_type text NOT NULL DEFAULT 'comment',
  client_name text NOT NULL,
  client_email text,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trip_feedback ENABLE ROW LEVEL SECURITY;

-- Anyone can insert feedback (public page, no auth required)
CREATE POLICY "Anyone can insert trip feedback via share token"
  ON public.trip_feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_feedback.trip_id
      AND t.share_token IS NOT NULL
    )
  );

-- Anyone can view feedback for shared trips (needed on public page)
CREATE POLICY "Anyone can view feedback for shared trips"
  ON public.trip_feedback
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_feedback.trip_id
      AND t.share_token IS NOT NULL
    )
  );

-- Company members can view feedback for their trips
CREATE POLICY "Company members can view their trip feedback"
  ON public.trip_feedback
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_feedback.trip_id
      AND is_company_member(auth.uid(), t.company_id)
    )
  );

-- Company admins/agents can update feedback status
CREATE POLICY "Admins and agents can update trip feedback"
  ON public.trip_feedback
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_feedback.trip_id
      AND is_company_member(auth.uid(), t.company_id)
      AND get_company_role(auth.uid(), t.company_id) IN ('company_admin', 'agent')
    )
  );

-- Super admins can manage all feedback
CREATE POLICY "Super admins can manage all trip feedback"
  ON public.trip_feedback
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));
