
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS markup_type text NOT NULL DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS markup_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_notes text,
  ADD COLUMN IF NOT EXISTS client_notes text;
