
-- Internal comments table supporting leads, trips, and bookings
CREATE TABLE public.internal_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- 'lead', 'trip', 'booking'
  entity_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  parent_id UUID REFERENCES public.internal_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_internal_comments_entity ON public.internal_comments(entity_type, entity_id);
CREATE INDEX idx_internal_comments_company ON public.internal_comments(company_id);

ALTER TABLE public.internal_comments ENABLE ROW LEVEL SECURITY;

-- Company members can view comments for their company
CREATE POLICY "Company members can view internal comments"
  ON public.internal_comments FOR SELECT
  USING (is_company_member(auth.uid(), company_id));

-- Company members can insert comments
CREATE POLICY "Company members can insert internal comments"
  ON public.internal_comments FOR INSERT
  WITH CHECK (is_company_member(auth.uid(), company_id) AND auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update their own comments"
  ON public.internal_comments FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own comments, admins can delete any
CREATE POLICY "Users can delete their own comments"
  ON public.internal_comments FOR DELETE
  USING (auth.uid() = user_id OR get_company_role(auth.uid(), company_id) = 'company_admin');

-- Super admins can manage all
CREATE POLICY "Super admins can manage all internal comments"
  ON public.internal_comments FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));
