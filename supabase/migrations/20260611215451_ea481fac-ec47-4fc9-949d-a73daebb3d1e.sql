
-- Phase 1: Fleet Management foundation

CREATE TYPE public.vehicle_type AS ENUM ('bus', 'minibus', 'car', 'suv', 'van', 'boat', 'yacht', 'other');
CREATE TYPE public.vehicle_status AS ENUM ('available', 'assigned', 'maintenance', 'out_of_service');
CREATE TYPE public.driver_status AS ENUM ('available', 'on_trip', 'off_duty', 'on_leave');

-- VEHICLES
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  vehicle_type public.vehicle_type NOT NULL DEFAULT 'car',
  plate_number text,
  make text,
  model text,
  year integer,
  color text,
  capacity_passengers integer NOT NULL DEFAULT 4,
  capacity_luggage integer DEFAULT 0,
  status public.vehicle_status NOT NULL DEFAULT 'available',
  current_mileage_km numeric DEFAULT 0,
  daily_rate numeric DEFAULT 0,
  hourly_rate numeric DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  features jsonb DEFAULT '[]'::jsonb,
  images jsonb DEFAULT '[]'::jsonb,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view vehicles" ON public.vehicles FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert vehicles" ON public.vehicles FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can update vehicles" ON public.vehicles FOR UPDATE TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can delete vehicles" ON public.vehicles FOR DELETE TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE TRIGGER vehicles_set_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_vehicles_company ON public.vehicles(company_id);
CREATE INDEX idx_vehicles_status ON public.vehicles(company_id, status);


-- DRIVERS
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid,
  full_name text NOT NULL,
  phone text,
  email text,
  license_number text,
  license_expiry date,
  national_id text,
  date_of_birth date,
  hire_date date,
  status public.driver_status NOT NULL DEFAULT 'available',
  languages jsonb DEFAULT '[]'::jsonb,
  rating numeric DEFAULT 0,
  total_trips integer DEFAULT 0,
  daily_rate numeric DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  avatar_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view drivers" ON public.drivers FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert drivers" ON public.drivers FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can update drivers" ON public.drivers FOR UPDATE TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can delete drivers" ON public.drivers FOR DELETE TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE TRIGGER drivers_set_updated_at BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_drivers_company ON public.drivers(company_id);


-- VEHICLE DOCUMENTS (license, insurance, inspection)
CREATE TABLE public.vehicle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  doc_number text,
  issue_date date,
  expiry_date date,
  file_url text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_documents TO authenticated;
GRANT ALL ON public.vehicle_documents TO service_role;
ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view vehicle docs" ON public.vehicle_documents FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can manage vehicle docs" ON public.vehicle_documents FOR ALL TO authenticated
  USING (public.is_company_member(auth.uid(), company_id))
  WITH CHECK (public.is_company_member(auth.uid(), company_id));

CREATE TRIGGER vehicle_documents_set_updated_at BEFORE UPDATE ON public.vehicle_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_vehicle_docs_vehicle ON public.vehicle_documents(vehicle_id);


-- VEHICLE MAINTENANCE
CREATE TABLE public.vehicle_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  maintenance_type text NOT NULL,
  description text,
  service_date date NOT NULL,
  mileage_km numeric,
  cost numeric DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  next_service_date date,
  next_service_mileage_km numeric,
  provider text,
  invoice_url text,
  status text NOT NULL DEFAULT 'completed',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_maintenance TO authenticated;
GRANT ALL ON public.vehicle_maintenance TO service_role;
ALTER TABLE public.vehicle_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view maintenance" ON public.vehicle_maintenance FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can manage maintenance" ON public.vehicle_maintenance FOR ALL TO authenticated
  USING (public.is_company_member(auth.uid(), company_id))
  WITH CHECK (public.is_company_member(auth.uid(), company_id));

CREATE TRIGGER vehicle_maintenance_set_updated_at BEFORE UPDATE ON public.vehicle_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_maintenance_vehicle ON public.vehicle_maintenance(vehicle_id);


-- VEHICLE EXPENSES (fuel, fines, etc)
CREATE TABLE public.vehicle_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  expense_type text NOT NULL,
  description text,
  expense_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  receipt_url text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_expenses TO authenticated;
GRANT ALL ON public.vehicle_expenses TO service_role;
ALTER TABLE public.vehicle_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view expenses" ON public.vehicle_expenses FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can manage expenses" ON public.vehicle_expenses FOR ALL TO authenticated
  USING (public.is_company_member(auth.uid(), company_id))
  WITH CHECK (public.is_company_member(auth.uid(), company_id));

CREATE TRIGGER vehicle_expenses_set_updated_at BEFORE UPDATE ON public.vehicle_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_expenses_vehicle ON public.vehicle_expenses(vehicle_id);
CREATE INDEX idx_expenses_booking ON public.vehicle_expenses(booking_id);


-- SERVICE ASSIGNMENTS (link booking_service to vehicle + driver)
CREATE TABLE public.service_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  booking_service_id uuid REFERENCES public.booking_services(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  actual_start timestamptz,
  actual_end timestamptz,
  pickup_location text,
  dropoff_location text,
  passenger_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'scheduled',
  driver_payout numeric DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  internal_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_assignments TO authenticated;
GRANT ALL ON public.service_assignments TO service_role;
ALTER TABLE public.service_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view assignments" ON public.service_assignments FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can manage assignments" ON public.service_assignments FOR ALL TO authenticated
  USING (public.is_company_member(auth.uid(), company_id))
  WITH CHECK (public.is_company_member(auth.uid(), company_id));

CREATE TRIGGER service_assignments_set_updated_at BEFORE UPDATE ON public.service_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_assign_company_time ON public.service_assignments(company_id, scheduled_start);
CREATE INDEX idx_assign_vehicle_time ON public.service_assignments(vehicle_id, scheduled_start);
CREATE INDEX idx_assign_driver_time ON public.service_assignments(driver_id, scheduled_start);
CREATE INDEX idx_assign_booking ON public.service_assignments(booking_id);
