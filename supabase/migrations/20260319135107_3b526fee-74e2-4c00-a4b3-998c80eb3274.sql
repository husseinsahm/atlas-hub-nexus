-- Robust soft delete for invoices to avoid RLS soft-delete pitfalls
-- and provide consistent auditing/debugging.

CREATE OR REPLACE FUNCTION public.soft_delete_invoice(_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invoice RECORD;
  _role app_role;
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT id, company_id, invoice_number, deleted_at
  INTO _invoice
  FROM public.invoices
  WHERE id = _invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF _invoice.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_deleted', true,
      'invoice_id', _invoice.id
    );
  END IF;

  _role := public.get_company_role(_user_id, _invoice.company_id);

  IF _role IS NULL OR _role NOT IN ('company_admin', 'agent', 'finance') THEN
    RAISE EXCEPTION 'Not allowed to delete invoices';
  END IF;

  UPDATE public.invoices
  SET deleted_at = now(),
      updated_at = now()
  WHERE id = _invoice_id;

  INSERT INTO public.audit_logs (
    action,
    entity_type,
    entity_id,
    user_id,
    company_id,
    old_data,
    new_data
  ) VALUES (
    'invoice_soft_delete',
    'invoice',
    _invoice_id,
    _user_id,
    _invoice.company_id,
    jsonb_build_object('deleted_at', NULL, 'invoice_number', _invoice.invoice_number),
    jsonb_build_object('deleted_at', now(), 'invoice_number', _invoice.invoice_number)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'invoice_id', _invoice_id,
    'role', _role,
    'invoice_number', _invoice.invoice_number
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_invoice(uuid) TO authenticated;