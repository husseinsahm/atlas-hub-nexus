
-- Booking status enum
CREATE TYPE public.booking_status AS ENUM ('tentative', 'confirmed', 'in_operation', 'completed', 'cancelled');

-- Bookings table
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number text NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,

  status booking_status NOT NULL DEFAULT 'tentative',
  title text NOT NULL,
  description text,

  -- Travelers
  adults integer NOT NULL DEFAULT 1,
  children integer NOT NULL DEFAULT 0,
  travelers jsonb DEFAULT '[]'::jsonb,

  -- Dates
  start_date date,
  end_date date,
  total_days integer NOT NULL DEFAULT 1,

  -- Financial
  currency text NOT NULL DEFAULT 'USD',
  total_cost numeric DEFAULT 0,
  selling_price numeric DEFAULT 0,
  amount_paid numeric DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid',

  -- Notes
  operations_notes text,
  internal_notes text,
  client_notes text,

  -- Meta
  assigned_to uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Booking activities (unified timeline)
CREATE TABLE public.booking_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  activity_type text NOT NULL DEFAULT 'note',
  title text NOT NULL,
  description text,
  user_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Booking attachments
CREATE TABLE public.booking_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_attachments ENABLE ROW LEVEL SECURITY;

-- Bookings policies
CREATE POLICY "Company members can view bookings"
  ON public.bookings FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id) AND deleted_at IS NULL);

CREATE POLICY "Admins and agents can insert bookings"
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id) AND get_company_role(auth.uid(), company_id) IN ('company_admin', 'agent', 'operations'));

CREATE POLICY "Admins and agents can update bookings"
  ON public.bookings FOR UPDATE TO authenticated
  USING (is_company_member(auth.uid(), company_id) AND get_company_role(auth.uid(), company_id) IN ('company_admin', 'agent', 'operations'));

CREATE POLICY "Super admins can manage all bookings"
  ON public.bookings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Booking activities policies
CREATE POLICY "Company members can view booking activities"
  ON public.booking_activities FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_activities.booking_id AND is_company_member(auth.uid(), b.company_id)));

CREATE POLICY "Company members can insert booking activities"
  ON public.booking_activities FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_activities.booking_id AND is_company_member(auth.uid(), b.company_id)));

CREATE POLICY "Super admins can manage all booking activities"
  ON public.booking_activities FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Booking attachments policies
CREATE POLICY "Company members can view booking attachments"
  ON public.booking_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_attachments.booking_id AND is_company_member(auth.uid(), b.company_id)));

CREATE POLICY "Company members can insert booking attachments"
  ON public.booking_attachments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_attachments.booking_id AND is_company_member(auth.uid(), b.company_id)));

CREATE POLICY "Admins can delete booking attachments"
  ON public.booking_attachments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_attachments.booking_id AND get_company_role(auth.uid(), b.company_id) IN ('company_admin', 'agent')));

CREATE POLICY "Super admins can manage all booking attachments"
  ON public.booking_attachments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Indexes
CREATE INDEX idx_bookings_company_id ON public.bookings(company_id);
CREATE INDEX idx_bookings_trip_id ON public.bookings(trip_id);
CREATE INDEX idx_booking_activities_booking_id ON public.booking_activities(booking_id, created_at DESC);
