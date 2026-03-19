
-- Add invoice_id column to payment_records (nullable since existing records are booking-only)
ALTER TABLE public.payment_records ADD COLUMN invoice_id UUID REFERENCES public.invoices(id);

-- Make booking_id nullable so invoice-only payments work
ALTER TABLE public.payment_records ALTER COLUMN booking_id DROP NOT NULL;

-- Index for invoice payment lookups
CREATE INDEX idx_payment_records_invoice_id ON public.payment_records(invoice_id);
