-- Add trial_starts_at and payment_status to subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_starts_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';

-- Add comment for future Stripe integration
COMMENT ON COLUMN public.subscriptions.payment_status IS 'pending, paid, failed, refunded — prepared for Stripe';
COMMENT ON COLUMN public.subscriptions.stripe_customer_id IS 'Stripe customer ID — for future integration';
COMMENT ON COLUMN public.subscriptions.stripe_subscription_id IS 'Stripe subscription ID — for future integration';