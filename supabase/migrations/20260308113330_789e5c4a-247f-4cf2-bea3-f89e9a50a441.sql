-- =====================================================
-- BOOKING FILE ARCHITECTURE REFACTOR
-- =====================================================

-- 1. Service type enum
CREATE TYPE public.service_type AS ENUM (
  'hotel', 'transfer', 'tour', 'guide', 'meal', 'activity', 'other'
);

-- 2. Booking Services Table (hotels, transfers, tours, guides)
CREATE TABLE public.booking_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  library_item_id UUID REFERENCES public.library_items(id) ON DELETE SET NULL,
  
  -- Service details
  service_type service_type NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  description TEXT,
  supplier_name TEXT,
  supplier_contact TEXT,
  confirmation_number TEXT,
  
  -- Dates and timing
  service_date DATE,
  start_time TEXT,
  end_time TEXT,
  duration_minutes INTEGER,
  
  -- Location
  location TEXT,
  pickup_location TEXT,
  dropoff_location TEXT,
  
  -- Pricing
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  internal_notes TEXT,
  
  -- Sort and metadata
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Booking Travelers Table (separate from customer)
CREATE TABLE public.booking_travelers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Personal info
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT,
  nationality TEXT,
  
  -- Contact
  email TEXT,
  phone TEXT,
  
  -- Passport details
  passport_number TEXT,
  passport_expiry DATE,
  passport_country TEXT,
  
  -- Visa info
  visa_number TEXT,
  visa_expiry DATE,
  
  -- Travel preferences
  is_lead_traveler BOOLEAN DEFAULT false,
  is_adult BOOLEAN DEFAULT true,
  special_requirements TEXT,
  dietary_restrictions TEXT,
  room_preference TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Booking Days Table (itinerary within booking)
CREATE TABLE public.booking_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  
  day_number INTEGER NOT NULL,
  date DATE,
  title TEXT,
  description TEXT,
  city TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Booking Day Items Table
CREATE TABLE public.booking_day_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_day_id UUID NOT NULL REFERENCES public.booking_days(id) ON DELETE CASCADE,
  library_item_id UUID REFERENCES public.library_items(id) ON DELETE SET NULL,
  
  category TEXT NOT NULL,
  custom_title TEXT,
  custom_description TEXT,
  
  start_time TEXT,
  duration_minutes INTEGER,
  
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total_price NUMERIC DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Itinerary Templates Table (reusable)
CREATE TABLE public.itinerary_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  description TEXT,
  total_days INTEGER NOT NULL DEFAULT 1,
  
  destinations JSONB DEFAULT '[]'::jsonb,
  cover_image_url TEXT,
  
  is_active BOOLEAN DEFAULT true,
  tags JSONB DEFAULT '[]'::jsonb,
  
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 7. Template Days Table
CREATE TABLE public.template_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.itinerary_templates(id) ON DELETE CASCADE,
  
  day_number INTEGER NOT NULL,
  title TEXT,
  description TEXT,
  city TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Template Day Items Table
CREATE TABLE public.template_day_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_day_id UUID NOT NULL REFERENCES public.template_days(id) ON DELETE CASCADE,
  library_item_id UUID REFERENCES public.library_items(id) ON DELETE SET NULL,
  
  category TEXT NOT NULL,
  custom_title TEXT,
  custom_description TEXT,
  
  start_time TEXT,
  duration_minutes INTEGER,
  
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total_price NUMERIC DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add new columns to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'email',
ADD COLUMN IF NOT EXISTS arrival_date DATE,
ADD COLUMN IF NOT EXISTS departure_date DATE,
ADD COLUMN IF NOT EXISTS itinerary_notes TEXT,
ADD COLUMN IF NOT EXISTS service_notes TEXT;

-- Create indexes
CREATE INDEX idx_booking_services_booking ON public.booking_services(booking_id);
CREATE INDEX idx_booking_services_company ON public.booking_services(company_id);
CREATE INDEX idx_booking_travelers_booking ON public.booking_travelers(booking_id);
CREATE INDEX idx_booking_days_booking ON public.booking_days(booking_id);
CREATE INDEX idx_booking_day_items_day ON public.booking_day_items(booking_day_id);
CREATE INDEX idx_itinerary_templates_company ON public.itinerary_templates(company_id);
CREATE INDEX idx_template_days_template ON public.template_days(template_id);
CREATE INDEX idx_template_day_items_day ON public.template_day_items(template_day_id);

-- Enable RLS
ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_travelers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_day_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_day_items ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Booking Services Policies
CREATE POLICY "Company members can view booking services"
  ON public.booking_services FOR SELECT
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins agents ops can insert booking services"
  ON public.booking_services FOR INSERT
  WITH CHECK (
    is_company_member(auth.uid(), company_id) AND 
    get_company_role(auth.uid(), company_id) = ANY(ARRAY['company_admin', 'agent', 'operations']::app_role[])
  );

CREATE POLICY "Admins agents ops can update booking services"
  ON public.booking_services FOR UPDATE
  USING (
    is_company_member(auth.uid(), company_id) AND 
    get_company_role(auth.uid(), company_id) = ANY(ARRAY['company_admin', 'agent', 'operations']::app_role[])
  );

CREATE POLICY "Admins agents ops can delete booking services"
  ON public.booking_services FOR DELETE
  USING (
    is_company_member(auth.uid(), company_id) AND 
    get_company_role(auth.uid(), company_id) = ANY(ARRAY['company_admin', 'agent', 'operations']::app_role[])
  );

CREATE POLICY "Super admins manage all booking services"
  ON public.booking_services FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- Booking Travelers Policies
CREATE POLICY "Company members can view booking travelers"
  ON public.booking_travelers FOR SELECT
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins agents can insert booking travelers"
  ON public.booking_travelers FOR INSERT
  WITH CHECK (
    is_company_member(auth.uid(), company_id) AND 
    get_company_role(auth.uid(), company_id) = ANY(ARRAY['company_admin', 'agent', 'operations']::app_role[])
  );

CREATE POLICY "Admins agents can update booking travelers"
  ON public.booking_travelers FOR UPDATE
  USING (
    is_company_member(auth.uid(), company_id) AND 
    get_company_role(auth.uid(), company_id) = ANY(ARRAY['company_admin', 'agent', 'operations']::app_role[])
  );

CREATE POLICY "Admins agents can delete booking travelers"
  ON public.booking_travelers FOR DELETE
  USING (
    is_company_member(auth.uid(), company_id) AND 
    get_company_role(auth.uid(), company_id) = ANY(ARRAY['company_admin', 'agent', 'operations']::app_role[])
  );

CREATE POLICY "Super admins manage all booking travelers"
  ON public.booking_travelers FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- Booking Days Policies
CREATE POLICY "Company members can view booking days"
  ON public.booking_days FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b 
      WHERE b.id = booking_days.booking_id 
      AND is_company_member(auth.uid(), b.company_id)
    )
  );

CREATE POLICY "Admins agents ops can insert booking days"
  ON public.booking_days FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings b 
      WHERE b.id = booking_days.booking_id 
      AND is_company_member(auth.uid(), b.company_id)
      AND get_company_role(auth.uid(), b.company_id) = ANY(ARRAY['company_admin', 'agent', 'operations']::app_role[])
    )
  );

CREATE POLICY "Admins agents ops can update booking days"
  ON public.booking_days FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bookings b 
      WHERE b.id = booking_days.booking_id 
      AND is_company_member(auth.uid(), b.company_id)
      AND get_company_role(auth.uid(), b.company_id) = ANY(ARRAY['company_admin', 'agent', 'operations']::app_role[])
    )
  );

CREATE POLICY "Admins agents ops can delete booking days"
  ON public.booking_days FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM bookings b 
      WHERE b.id = booking_days.booking_id 
      AND is_company_member(auth.uid(), b.company_id)
      AND get_company_role(auth.uid(), b.company_id) = ANY(ARRAY['company_admin', 'agent', 'operations']::app_role[])
    )
  );

CREATE POLICY "Super admins manage all booking days"
  ON public.booking_days FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- Booking Day Items Policies
CREATE POLICY "Company members can view booking day items"
  ON public.booking_day_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM booking_days bd
      JOIN bookings b ON b.id = bd.booking_id
      WHERE bd.id = booking_day_items.booking_day_id
      AND is_company_member(auth.uid(), b.company_id)
    )
  );

CREATE POLICY "Admins agents ops can insert booking day items"
  ON public.booking_day_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM booking_days bd
      JOIN bookings b ON b.id = bd.booking_id
      WHERE bd.id = booking_day_items.booking_day_id
      AND is_company_member(auth.uid(), b.company_id)
      AND get_company_role(auth.uid(), b.company_id) = ANY(ARRAY['company_admin', 'agent', 'operations']::app_role[])
    )
  );

CREATE POLICY "Admins agents ops can update booking day items"
  ON public.booking_day_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM booking_days bd
      JOIN bookings b ON b.id = bd.booking_id
      WHERE bd.id = booking_day_items.booking_day_id
      AND is_company_member(auth.uid(), b.company_id)
      AND get_company_role(auth.uid(), b.company_id) = ANY(ARRAY['company_admin', 'agent', 'operations']::app_role[])
    )
  );

CREATE POLICY "Admins agents ops can delete booking day items"
  ON public.booking_day_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM booking_days bd
      JOIN bookings b ON b.id = bd.booking_id
      WHERE bd.id = booking_day_items.booking_day_id
      AND is_company_member(auth.uid(), b.company_id)
      AND get_company_role(auth.uid(), b.company_id) = ANY(ARRAY['company_admin', 'agent', 'operations']::app_role[])
    )
  );

CREATE POLICY "Super admins manage all booking day items"
  ON public.booking_day_items FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- Itinerary Templates Policies
CREATE POLICY "Company members can view itinerary templates"
  ON public.itinerary_templates FOR SELECT
  USING (is_company_member(auth.uid(), company_id) AND deleted_at IS NULL);

CREATE POLICY "Admins agents can insert itinerary templates"
  ON public.itinerary_templates FOR INSERT
  WITH CHECK (
    is_company_member(auth.uid(), company_id) AND 
    get_company_role(auth.uid(), company_id) = ANY(ARRAY['company_admin', 'agent', 'operations']::app_role[])
  );

CREATE POLICY "Admins agents can update itinerary templates"
  ON public.itinerary_templates FOR UPDATE
  USING (
    is_company_member(auth.uid(), company_id) AND 
    get_company_role(auth.uid(), company_id) = ANY(ARRAY['company_admin', 'agent', 'operations']::app_role[])
  );

CREATE POLICY "Super admins manage all itinerary templates"
  ON public.itinerary_templates FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- Template Days Policies
CREATE POLICY "Company members can view template days"
  ON public.template_days FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM itinerary_templates t 
      WHERE t.id = template_days.template_id 
      AND is_company_member(auth.uid(), t.company_id)
    )
  );

CREATE POLICY "Admins agents can insert template days"
  ON public.template_days FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM itinerary_templates t 
      WHERE t.id = template_days.template_id 
      AND is_company_member(auth.uid(), t.company_id)
      AND get_company_role(auth.uid(), t.company_id) = ANY(ARRAY['company_admin', 'agent', 'operations']::app_role[])
    )
  );

CREATE POLICY "Admins agents can update template days"
  ON public.template_days FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM itinerary_templates t 
      WHERE t.id = template_days.template_id 
      AND is_company_member(auth.uid(), t.company_id)
      AND get_company_role(auth.uid(), t.company_id) = ANY(ARRAY['company_admin', 'agent', 'operations']::app_role[])
    )
  );

CREATE POLICY "Admins agents can delete template days"
  ON public.template_days FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM itinerary_templates t 
      WHERE t.id = template_days.template_id 
      AND is_company_member(auth.uid(), t.company_id)
      AND get_company_role(auth.uid(), t.company_id) = ANY(ARRAY['company_admin', 'agent', 'operations']::app_role[])
    )
  );

CREATE POLICY "Super admins manage all template days"
  ON public.template_days FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- Template Day Items Policies
CREATE POLICY "Company members can view template day items"
  ON public.template_day_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM template_days td
      JOIN itinerary_templates t ON t.id = td.template_id
      WHERE td.id = template_day_items.template_day_id
      AND is_company_member(auth.uid(), t.company_id)
    )
  );

CREATE POLICY "Admins agents can insert template day items"
  ON public.template_day_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM template_days td
      JOIN itinerary_templates t ON t.id = td.template_id
      WHERE td.id = template_day_items.template_day_id
      AND is_company_member(auth.uid(), t.company_id)
      AND get_company_role(auth.uid(), t.company_id) = ANY(ARRAY['company_admin', 'agent', 'operations']::app_role[])
    )
  );

CREATE POLICY "Admins agents can update template day items"
  ON public.template_day_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM template_days td
      JOIN itinerary_templates t ON t.id = td.template_id
      WHERE td.id = template_day_items.template_day_id
      AND is_company_member(auth.uid(), t.company_id)
      AND get_company_role(auth.uid(), t.company_id) = ANY(ARRAY['company_admin', 'agent', 'operations']::app_role[])
    )
  );

CREATE POLICY "Admins agents can delete template day items"
  ON public.template_day_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM template_days td
      JOIN itinerary_templates t ON t.id = td.template_id
      WHERE td.id = template_day_items.template_day_id
      AND is_company_member(auth.uid(), t.company_id)
      AND get_company_role(auth.uid(), t.company_id) = ANY(ARRAY['company_admin', 'agent', 'operations']::app_role[])
    )
  );

CREATE POLICY "Super admins manage all template day items"
  ON public.template_day_items FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- Update triggers
CREATE TRIGGER update_booking_services_updated_at
  BEFORE UPDATE ON public.booking_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_booking_travelers_updated_at
  BEFORE UPDATE ON public.booking_travelers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_booking_days_updated_at
  BEFORE UPDATE ON public.booking_days
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_booking_day_items_updated_at
  BEFORE UPDATE ON public.booking_day_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_itinerary_templates_updated_at
  BEFORE UPDATE ON public.itinerary_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_template_days_updated_at
  BEFORE UPDATE ON public.template_days
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_template_day_items_updated_at
  BEFORE UPDATE ON public.template_day_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();