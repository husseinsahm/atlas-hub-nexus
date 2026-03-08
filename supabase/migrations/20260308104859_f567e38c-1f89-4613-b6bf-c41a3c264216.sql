
-- Unified attachments table for leads, customers, trips, bookings
CREATE TABLE public.entity_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- 'lead', 'customer', 'trip', 'booking'
  entity_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  category TEXT NOT NULL DEFAULT 'other', -- passport, quotation, voucher, ticket, invoice, other
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_entity_attachments_entity ON public.entity_attachments(entity_type, entity_id);
CREATE INDEX idx_entity_attachments_company ON public.entity_attachments(company_id);

ALTER TABLE public.entity_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view attachments"
  ON public.entity_attachments FOR SELECT
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Company members can insert attachments"
  ON public.entity_attachments FOR INSERT
  WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = uploaded_by);

CREATE POLICY "Admins and uploaders can delete attachments"
  ON public.entity_attachments FOR DELETE
  USING (auth.uid() = uploaded_by OR get_company_role(auth.uid(), company_id) = 'company_admin');

CREATE POLICY "Super admins can manage all attachments"
  ON public.entity_attachments FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- Storage bucket for attachments (multi-tenant: company_id/entity_type/entity_id/filename)
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Company members can upload attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Company members can view attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Company members can delete attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'attachments'
    AND auth.role() = 'authenticated'
  );
