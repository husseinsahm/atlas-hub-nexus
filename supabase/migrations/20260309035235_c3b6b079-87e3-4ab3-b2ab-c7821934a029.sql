
-- Create booking share tokens table
CREATE TABLE public.booking_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_by uuid,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.booking_share_tokens ENABLE ROW LEVEL SECURITY;

-- Company members can view their share tokens
CREATE POLICY "Company members can view share tokens"
  ON public.booking_share_tokens FOR SELECT
  TO authenticated
  USING (is_company_member(auth.uid(), company_id));

-- Admins and agents can create share tokens
CREATE POLICY "Admins agents can insert share tokens"
  ON public.booking_share_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    is_company_member(auth.uid(), company_id)
    AND get_company_role(auth.uid(), company_id) IN ('company_admin', 'agent')
  );

-- Admins and agents can update (deactivate) share tokens
CREATE POLICY "Admins agents can update share tokens"
  ON public.booking_share_tokens FOR UPDATE
  TO authenticated
  USING (
    is_company_member(auth.uid(), company_id)
    AND get_company_role(auth.uid(), company_id) IN ('company_admin', 'agent')
  );

-- Super admins full access
CREATE POLICY "Super admins manage all share tokens"
  ON public.booking_share_tokens FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Public: anyone can read active tokens (for the shared page)
CREATE POLICY "Public can read active share tokens"
  ON public.booking_share_tokens FOR SELECT
  TO anon
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Also allow authenticated users to read for shared page
CREATE POLICY "Authenticated can read active share tokens"
  ON public.booking_share_tokens FOR SELECT
  TO authenticated
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Create booking_feedback table for client feedback
CREATE TABLE public.booking_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  feedback_type text NOT NULL DEFAULT 'comment',
  client_name text NOT NULL,
  client_email text,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_feedback ENABLE ROW LEVEL SECURITY;

-- Anyone can insert feedback (public page)
CREATE POLICY "Anyone can insert booking feedback"
  ON public.booking_feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Company members can view feedback for their bookings
CREATE POLICY "Company members can view booking feedback"
  ON public.booking_feedback FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bookings b WHERE b.id = booking_feedback.booking_id AND is_company_member(auth.uid(), b.company_id)
  ));

-- Super admins full access
CREATE POLICY "Super admins manage all booking feedback"
  ON public.booking_feedback FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Anon can read feedback for display on shared page
CREATE POLICY "Anon can read booking feedback"
  ON public.booking_feedback FOR SELECT
  TO anon
  USING (true);

-- Allow anon to read bookings by joining through share tokens
CREATE POLICY "Anon can read shared bookings"
  ON public.bookings FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1 FROM booking_share_tokens bst
    WHERE bst.booking_id = bookings.id AND bst.is_active = true
    AND (bst.expires_at IS NULL OR bst.expires_at > now())
  ));

-- Allow anon to read booking_days for shared bookings
CREATE POLICY "Anon can read shared booking days"
  ON public.booking_days FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1 FROM booking_share_tokens bst
    WHERE bst.booking_id = booking_days.booking_id AND bst.is_active = true
    AND (bst.expires_at IS NULL OR bst.expires_at > now())
  ));

-- Allow anon to read booking_day_items for shared bookings
CREATE POLICY "Anon can read shared booking day items"
  ON public.booking_day_items FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1 FROM booking_days bd
    JOIN booking_share_tokens bst ON bst.booking_id = bd.booking_id
    WHERE bd.id = booking_day_items.booking_day_id AND bst.is_active = true
    AND (bst.expires_at IS NULL OR bst.expires_at > now())
  ));

-- Allow anon to read companies for shared bookings (logo, name)
CREATE POLICY "Anon can read companies for shared bookings"
  ON public.companies FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1 FROM booking_share_tokens bst
    JOIN bookings b ON b.id = bst.booking_id
    WHERE b.company_id = companies.id AND bst.is_active = true
  ));

-- Allow anon to read company_settings for shared bookings
CREATE POLICY "Anon can read company settings for shared bookings"
  ON public.company_settings FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1 FROM booking_share_tokens bst
    JOIN bookings b ON b.id = bst.booking_id
    WHERE b.company_id = company_settings.company_id AND bst.is_active = true
  ));
