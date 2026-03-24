
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotations_booking_id ON public.quotations(booking_id);
