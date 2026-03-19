
-- Add invoice-specific settings columns to company_settings
ALTER TABLE public.company_settings 
  ADD COLUMN IF NOT EXISTS default_tax_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_payment_terms text DEFAULT 'Payment is due within 30 days of the invoice date.',
  ADD COLUMN IF NOT EXISTS default_invoice_currency text NOT NULL DEFAULT 'USD';
