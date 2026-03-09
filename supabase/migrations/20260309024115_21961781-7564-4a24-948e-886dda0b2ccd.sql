
-- Create a function and trigger to auto-create a trial subscription for new companies
CREATE OR REPLACE FUNCTION public.create_default_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _free_plan_id uuid;
BEGIN
  SELECT id INTO _free_plan_id FROM public.plans WHERE slug = 'free' AND is_active = true LIMIT 1;
  IF _free_plan_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (company_id, plan_id, status, billing_cycle, trial_starts_at, trial_ends_at, current_period_start, current_period_end, payment_status)
    VALUES (
      NEW.id,
      _free_plan_id,
      'trialing',
      'monthly',
      now(),
      now() + interval '14 days',
      now(),
      now() + interval '14 days',
      'none'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Drop if exists to avoid conflicts
DROP TRIGGER IF EXISTS on_company_created_create_subscription ON public.companies;

CREATE TRIGGER on_company_created_create_subscription
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_subscription();
