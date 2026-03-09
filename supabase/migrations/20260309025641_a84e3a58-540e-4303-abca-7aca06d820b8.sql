
-- Add RLS policy for plans: regular users can read active plans
CREATE POLICY "Authenticated users can read active plans"
  ON public.plans FOR SELECT
  TO authenticated
  USING (is_active = true AND deleted_at IS NULL);
