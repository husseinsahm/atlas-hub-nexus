-- Add 'viewed' and 'negotiating' to quotation_status enum
ALTER TYPE public.quotation_status ADD VALUE IF NOT EXISTS 'viewed' AFTER 'sent';
ALTER TYPE public.quotation_status ADD VALUE IF NOT EXISTS 'negotiating' AFTER 'viewed';