
-- Fix: restrict feedback insert to only bookings that have active share tokens
DROP POLICY "Anyone can insert booking feedback" ON public.booking_feedback;
CREATE POLICY "Anyone can insert booking feedback for shared bookings"
  ON public.booking_feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM booking_share_tokens bst
    WHERE bst.booking_id = booking_feedback.booking_id AND bst.is_active = true
    AND (bst.expires_at IS NULL OR bst.expires_at > now())
  ));
