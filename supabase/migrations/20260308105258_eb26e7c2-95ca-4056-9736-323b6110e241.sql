
-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'lead_assigned', 'comment_added', 'trip_approval', 'follow_up_reminder', 'booking_status_change'
  title TEXT NOT NULL,
  message TEXT,
  entity_type TEXT, -- 'lead', 'trip', 'booking', 'customer'
  entity_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_reminder BOOLEAN NOT NULL DEFAULT false,
  reminder_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_company ON public.notifications(company_id);
CREATE INDEX idx_notifications_reminder ON public.notifications(user_id, is_reminder, reminder_at) WHERE is_reminder = true;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Company members can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (is_company_member(auth.uid(), company_id));

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can manage all notifications"
  ON public.notifications FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
