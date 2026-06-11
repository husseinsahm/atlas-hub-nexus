
ALTER TABLE public.booking_feedback ADD COLUMN IF NOT EXISTS booking_day_id uuid REFERENCES public.booking_days(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_booking_feedback_day ON public.booking_feedback(booking_day_id);

ALTER TABLE public.booking_attachments ADD COLUMN IF NOT EXISTS category text DEFAULT 'other';
ALTER TABLE public.booking_attachments ADD COLUMN IF NOT EXISTS is_client_upload boolean NOT NULL DEFAULT false;
ALTER TABLE public.booking_attachments ADD COLUMN IF NOT EXISTS client_uploader_name text;

CREATE POLICY "Anon can view client uploads via share token"
  ON public.booking_attachments FOR SELECT TO anon
  USING (
    is_client_upload = true AND EXISTS (
      SELECT 1 FROM public.booking_share_tokens bst
      WHERE bst.booking_id = booking_attachments.booking_id
        AND bst.is_active = true
        AND (bst.expires_at IS NULL OR bst.expires_at > now())
    )
  );
