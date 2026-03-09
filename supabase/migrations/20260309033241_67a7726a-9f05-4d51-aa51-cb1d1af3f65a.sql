
-- Allow company admins to update their own subscription (for upgrades/downgrades)
CREATE POLICY "Company admins can update their subscription"
ON public.subscriptions
FOR UPDATE
TO authenticated
USING (get_company_role(auth.uid(), company_id) = 'company_admin'::app_role)
WITH CHECK (get_company_role(auth.uid(), company_id) = 'company_admin'::app_role);

-- Allow company admins to insert subscriptions for their company
CREATE POLICY "Company admins can insert subscription"
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (get_company_role(auth.uid(), company_id) = 'company_admin'::app_role);

-- Allow company admins to insert billing history records
CREATE POLICY "Company admins can insert billing history"
ON public.billing_history
FOR INSERT
TO authenticated
WITH CHECK (get_company_role(auth.uid(), company_id) = 'company_admin'::app_role);
