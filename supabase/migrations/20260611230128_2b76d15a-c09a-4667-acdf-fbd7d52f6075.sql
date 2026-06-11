ALTER TABLE public.bookings 
  ADD COLUMN IF NOT EXISTS pax_breakdown jsonb DEFAULT '{"adults":0,"children":0,"infants":0}'::jsonb,
  ADD COLUMN IF NOT EXISTS markup_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rounding_step numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS group_discount_pct numeric DEFAULT 0;