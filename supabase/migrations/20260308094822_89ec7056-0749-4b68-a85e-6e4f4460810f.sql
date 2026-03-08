-- Company settings table for brand, numbering, preferences
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  logo_url text,
  tagline text,
  website text,
  default_language text NOT NULL DEFAULT 'en',
  default_currency text NOT NULL DEFAULT 'USD',
  supported_languages jsonb NOT NULL DEFAULT '["en"]'::jsonb,
  trip_prefix text NOT NULL DEFAULT 'TRP',
  trip_next_number integer NOT NULL DEFAULT 1,
  booking_prefix text NOT NULL DEFAULT 'BKG',
  booking_next_number integer NOT NULL DEFAULT 1,
  invoice_prefix text NOT NULL DEFAULT 'INV',
  invoice_next_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Updated at trigger
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company admins can manage their settings"
  ON public.company_settings FOR ALL
  TO authenticated
  USING (get_company_role(auth.uid(), company_id) = 'company_admin'::app_role);

CREATE POLICY "Company members can view settings"
  ON public.company_settings FOR SELECT
  TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Super admins can manage all settings"
  ON public.company_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Storage bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Company admins can upload company assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'company-assets');

CREATE POLICY "Anyone can view company assets"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'company-assets');

CREATE POLICY "Company admins can update company assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'company-assets');

CREATE POLICY "Company admins can delete company assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'company-assets');