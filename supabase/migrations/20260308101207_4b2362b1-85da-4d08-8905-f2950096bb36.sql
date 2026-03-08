
-- Trip status enum
CREATE TYPE public.trip_status AS ENUM (
  'draft', 'under_review', 'awaiting_approval', 'approved', 'converted', 'cancelled'
);

-- Main trips table
CREATE TABLE public.trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id),
  lead_id UUID REFERENCES public.leads(id),
  trip_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status trip_status NOT NULL DEFAULT 'draft',
  start_date DATE,
  end_date DATE,
  total_days INTEGER NOT NULL DEFAULT 1,
  adults INTEGER NOT NULL DEFAULT 1,
  children INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  total_cost NUMERIC DEFAULT 0,
  selling_price NUMERIC DEFAULT 0,
  profit_margin NUMERIC DEFAULT 0,
  cover_image_url TEXT,
  share_token UUID DEFAULT gen_random_uuid(),
  internal_notes TEXT,
  assigned_to UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Trip days
CREATE TABLE public.trip_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  title TEXT,
  description TEXT,
  city TEXT,
  date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id, day_number)
);

-- Trip day items (links to library_items)
CREATE TABLE public.trip_day_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_day_id UUID NOT NULL REFERENCES public.trip_days(id) ON DELETE CASCADE,
  library_item_id UUID REFERENCES public.library_items(id),
  custom_title TEXT,
  custom_description TEXT,
  category TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total_price NUMERIC DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  duration_minutes INTEGER,
  start_time TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_trips_company ON public.trips(company_id);
CREATE INDEX idx_trips_status ON public.trips(status);
CREATE INDEX idx_trips_customer ON public.trips(customer_id);
CREATE INDEX idx_trips_share_token ON public.trips(share_token);
CREATE INDEX idx_trip_days_trip ON public.trip_days(trip_id);
CREATE INDEX idx_trip_day_items_day ON public.trip_day_items(trip_day_id);

-- Triggers
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_trip_days_updated_at BEFORE UPDATE ON public.trip_days FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_trip_day_items_updated_at BEFORE UPDATE ON public.trip_day_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: trips
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view their trips" ON public.trips FOR SELECT
  USING (is_company_member(auth.uid(), company_id) AND deleted_at IS NULL);

CREATE POLICY "Admins and agents can insert trips" ON public.trips FOR INSERT
  WITH CHECK (is_company_member(auth.uid(), company_id) AND get_company_role(auth.uid(), company_id) IN ('company_admin', 'agent', 'operations'));

CREATE POLICY "Admins and agents can update trips" ON public.trips FOR UPDATE
  USING (is_company_member(auth.uid(), company_id) AND get_company_role(auth.uid(), company_id) IN ('company_admin', 'agent', 'operations'));

CREATE POLICY "Super admins can manage all trips" ON public.trips FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- Public share access for trips
CREATE POLICY "Anyone can view shared trips by token" ON public.trips FOR SELECT
  USING (share_token IS NOT NULL);

-- RLS: trip_days
ALTER TABLE public.trip_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view trip days" ON public.trip_days FOR SELECT
  USING (EXISTS (SELECT 1 FROM trips t WHERE t.id = trip_days.trip_id AND is_company_member(auth.uid(), t.company_id)));

CREATE POLICY "Admins and agents can insert trip days" ON public.trip_days FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM trips t WHERE t.id = trip_days.trip_id AND is_company_member(auth.uid(), t.company_id) AND get_company_role(auth.uid(), t.company_id) IN ('company_admin', 'agent', 'operations')));

CREATE POLICY "Admins and agents can update trip days" ON public.trip_days FOR UPDATE
  USING (EXISTS (SELECT 1 FROM trips t WHERE t.id = trip_days.trip_id AND is_company_member(auth.uid(), t.company_id) AND get_company_role(auth.uid(), t.company_id) IN ('company_admin', 'agent', 'operations')));

CREATE POLICY "Admins and agents can delete trip days" ON public.trip_days FOR DELETE
  USING (EXISTS (SELECT 1 FROM trips t WHERE t.id = trip_days.trip_id AND is_company_member(auth.uid(), t.company_id) AND get_company_role(auth.uid(), t.company_id) IN ('company_admin', 'agent', 'operations')));

CREATE POLICY "Super admins can manage all trip days" ON public.trip_days FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- RLS: trip_day_items
ALTER TABLE public.trip_day_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view trip day items" ON public.trip_day_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM trip_days td JOIN trips t ON t.id = td.trip_id WHERE td.id = trip_day_items.trip_day_id AND is_company_member(auth.uid(), t.company_id)));

CREATE POLICY "Admins and agents can insert trip day items" ON public.trip_day_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM trip_days td JOIN trips t ON t.id = td.trip_id WHERE td.id = trip_day_items.trip_day_id AND is_company_member(auth.uid(), t.company_id) AND get_company_role(auth.uid(), t.company_id) IN ('company_admin', 'agent', 'operations')));

CREATE POLICY "Admins and agents can update trip day items" ON public.trip_day_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM trip_days td JOIN trips t ON t.id = td.trip_id WHERE td.id = trip_day_items.trip_day_id AND is_company_member(auth.uid(), t.company_id) AND get_company_role(auth.uid(), t.company_id) IN ('company_admin', 'agent', 'operations')));

CREATE POLICY "Admins and agents can delete trip day items" ON public.trip_day_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM trip_days td JOIN trips t ON t.id = td.trip_id WHERE td.id = trip_day_items.trip_day_id AND is_company_member(auth.uid(), t.company_id) AND get_company_role(auth.uid(), t.company_id) IN ('company_admin', 'agent', 'operations')));

CREATE POLICY "Super admins can manage all trip day items" ON public.trip_day_items FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));
