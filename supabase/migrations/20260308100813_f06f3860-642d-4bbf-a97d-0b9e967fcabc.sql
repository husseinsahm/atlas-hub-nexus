
-- Library item categories enum
CREATE TYPE public.library_category AS ENUM (
  'attraction', 'hotel', 'activity', 'transfer', 'meal', 'guide', 'template'
);

-- Main library_items table
CREATE TABLE public.library_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category library_category NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  city TEXT,
  country TEXT,
  duration_minutes INTEGER,
  price_amount NUMERIC DEFAULT 0,
  price_currency TEXT NOT NULL DEFAULT 'USD',
  price_type TEXT NOT NULL DEFAULT 'per_person',
  photos JSONB DEFAULT '[]'::jsonb,
  internal_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_template BOOLEAN NOT NULL DEFAULT false,
  tags JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_library_items_company ON public.library_items(company_id);
CREATE INDEX idx_library_items_category ON public.library_items(category);
CREATE INDEX idx_library_items_active ON public.library_items(is_active) WHERE deleted_at IS NULL;

-- Updated_at trigger
CREATE TRIGGER update_library_items_updated_at
  BEFORE UPDATE ON public.library_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view their library items"
  ON public.library_items FOR SELECT
  USING (is_company_member(auth.uid(), company_id) AND deleted_at IS NULL);

CREATE POLICY "Admins and agents can insert library items"
  ON public.library_items FOR INSERT
  WITH CHECK (
    is_company_member(auth.uid(), company_id)
    AND get_company_role(auth.uid(), company_id) IN ('company_admin', 'agent', 'operations')
  );

CREATE POLICY "Admins and agents can update library items"
  ON public.library_items FOR UPDATE
  USING (
    is_company_member(auth.uid(), company_id)
    AND get_company_role(auth.uid(), company_id) IN ('company_admin', 'agent', 'operations')
  );

CREATE POLICY "Super admins can manage all library items"
  ON public.library_items FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));
