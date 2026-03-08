
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS trip_type text DEFAULT null,
  ADD COLUMN IF NOT EXISTS urgency text DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS whatsapp text DEFAULT null;
