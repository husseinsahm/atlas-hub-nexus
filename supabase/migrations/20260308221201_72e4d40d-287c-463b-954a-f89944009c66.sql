
-- Allow company members to view profiles of other members in the same company
CREATE POLICY "Company members can view team profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_memberships cm1
    JOIN public.company_memberships cm2 ON cm1.company_id = cm2.company_id
    WHERE cm1.user_id = auth.uid()
      AND cm2.user_id = profiles.id
      AND cm1.is_active = true
      AND cm2.is_active = true
  )
);
