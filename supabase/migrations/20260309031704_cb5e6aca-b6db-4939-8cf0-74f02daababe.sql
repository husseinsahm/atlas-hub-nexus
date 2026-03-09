CREATE OR REPLACE FUNCTION public.create_default_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _default_plan_id uuid;
  _trial_days integer := 14;
  _default_slug text := 'free';
  _setting_val jsonb;
  _plan_name text;
BEGIN
  -- Read trial_duration_days from global_settings
  SELECT value INTO _setting_val FROM public.global_settings WHERE key = 'trial_duration_days';
  IF _setting_val IS NOT NULL THEN
    _trial_days := (_setting_val #>> '{}')::integer;
  END IF;

  -- Read default_plan_slug from global_settings
  SELECT value INTO _setting_val FROM public.global_settings WHERE key = 'default_plan_slug';
  IF _setting_val IS NOT NULL THEN
    _default_slug := _setting_val #>> '{}';
  END IF;

  -- Find the plan
  SELECT id, name INTO _default_plan_id, _plan_name FROM public.plans WHERE slug = _default_slug AND is_active = true LIMIT 1;

  -- Fallback to free plan if not found
  IF _default_plan_id IS NULL THEN
    SELECT id, name INTO _default_plan_id, _plan_name FROM public.plans WHERE slug = 'free' AND is_active = true LIMIT 1;
  END IF;

  IF _default_plan_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (company_id, plan_id, status, billing_cycle, trial_starts_at, trial_ends_at, current_period_start, current_period_end, payment_status)
    VALUES (
      NEW.id,
      _default_plan_id,
      'trialing',
      'monthly',
      now(),
      now() + (_trial_days || ' days')::interval,
      now(),
      now() + (_trial_days || ' days')::interval,
      'none'
    );

    -- Insert billing history record for trial start
    INSERT INTO public.billing_history (company_id, amount, currency, status, description, invoice_date)
    VALUES (
      NEW.id,
      0,
      'USD',
      'paid',
      'Free trial started - ' || COALESCE(_plan_name, 'Free'),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;