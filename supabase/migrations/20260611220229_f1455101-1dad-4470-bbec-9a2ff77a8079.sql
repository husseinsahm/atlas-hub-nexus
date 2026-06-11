
-- Driver portal token
ALTER TABLE public.drivers
  ADD COLUMN share_token uuid UNIQUE DEFAULT gen_random_uuid();

UPDATE public.drivers SET share_token = gen_random_uuid() WHERE share_token IS NULL;

-- Driver trip logs (check-in, check-out, photos, signature)
CREATE TABLE public.driver_trip_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.service_assignments(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- check_in, check_out, fuel, incident, note
  event_at timestamptz NOT NULL DEFAULT now(),
  mileage_km numeric,
  fuel_amount numeric,
  fuel_cost numeric,
  currency text DEFAULT 'USD',
  photo_url text,
  signature_data text, -- base64 signature
  customer_signature_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.driver_trip_logs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_trip_logs TO authenticated;
GRANT ALL ON public.driver_trip_logs TO service_role;
ALTER TABLE public.driver_trip_logs ENABLE ROW LEVEL SECURITY;

-- staff see all their company's logs
CREATE POLICY "Members can view trip logs" ON public.driver_trip_logs FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can manage trip logs" ON public.driver_trip_logs FOR ALL TO authenticated
  USING (public.is_company_member(auth.uid(), company_id))
  WITH CHECK (public.is_company_member(auth.uid(), company_id));

-- anon: only insert (write-only via portal, no read needed from anon for logs)
CREATE POLICY "Public insert trip logs" ON public.driver_trip_logs FOR INSERT TO anon
  WITH CHECK (true);

CREATE INDEX idx_driver_logs_assignment ON public.driver_trip_logs(assignment_id);
CREATE INDEX idx_driver_logs_driver ON public.driver_trip_logs(driver_id);

-- Anon read access for driver portal (lookup driver by token)
GRANT SELECT ON public.drivers TO anon;
GRANT SELECT ON public.service_assignments TO anon;
GRANT SELECT ON public.vehicles TO anon;
GRANT SELECT ON public.bookings TO anon;

-- RLS: anon can read driver row by knowing the share_token (we filter in query by share_token)
CREATE POLICY "Public driver lookup by token" ON public.drivers FOR SELECT TO anon
  USING (share_token IS NOT NULL);

-- anon can read assignments assigned to any driver (filtered in query by driver_id matching token)
-- We need a security-definer function to safely scope
CREATE OR REPLACE FUNCTION public.get_driver_by_token(_token uuid)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  full_name text,
  phone text,
  status public.driver_status,
  rating numeric,
  total_trips integer,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, company_id, full_name, phone, status, rating, total_trips, avatar_url
  FROM public.drivers
  WHERE share_token = _token AND deleted_at IS NULL AND is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_driver_by_token(uuid) TO anon, authenticated;

-- Function to list driver assignments via token (today + upcoming)
CREATE OR REPLACE FUNCTION public.get_driver_assignments(_token uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE (
  id uuid,
  booking_id uuid,
  booking_number text,
  booking_title text,
  vehicle_id uuid,
  vehicle_name text,
  vehicle_plate text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  pickup_location text,
  dropoff_location text,
  passenger_count integer,
  status text,
  notes text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sa.id, sa.booking_id, b.booking_number, b.title,
    sa.vehicle_id, v.name, v.plate_number,
    sa.scheduled_start, sa.scheduled_end, sa.actual_start, sa.actual_end,
    sa.pickup_location, sa.dropoff_location, sa.passenger_count, sa.status, sa.notes
  FROM public.service_assignments sa
  JOIN public.drivers d ON d.id = sa.driver_id
  LEFT JOIN public.bookings b ON b.id = sa.booking_id
  LEFT JOIN public.vehicles v ON v.id = sa.vehicle_id
  WHERE d.share_token = _token
    AND d.is_active = true AND d.deleted_at IS NULL
    AND sa.scheduled_start >= _from
    AND sa.scheduled_start <= _to
  ORDER BY sa.scheduled_start ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_driver_assignments(uuid, timestamptz, timestamptz) TO anon, authenticated;

-- Function for anon driver to update assignment status + actual times
CREATE OR REPLACE FUNCTION public.driver_update_assignment(
  _token uuid,
  _assignment_id uuid,
  _new_status text,
  _actual_start timestamptz DEFAULT NULL,
  _actual_end timestamptz DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _driver_id uuid;
BEGIN
  SELECT id INTO _driver_id FROM public.drivers
    WHERE share_token = _token AND is_active = true AND deleted_at IS NULL;
  IF _driver_id IS NULL THEN
    RAISE EXCEPTION 'Invalid driver token';
  END IF;

  UPDATE public.service_assignments
  SET status = COALESCE(_new_status, status),
      actual_start = COALESCE(_actual_start, actual_start),
      actual_end = COALESCE(_actual_end, actual_end),
      updated_at = now()
  WHERE id = _assignment_id AND driver_id = _driver_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.driver_update_assignment(uuid, uuid, text, timestamptz, timestamptz) TO anon, authenticated;
