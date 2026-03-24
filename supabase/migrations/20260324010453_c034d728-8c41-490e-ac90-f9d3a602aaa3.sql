CREATE OR REPLACE FUNCTION public.soft_delete_itinerary_template(_template_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _template RECORD;
  _role app_role;
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT id, company_id, title, deleted_at
  INTO _template
  FROM public.itinerary_templates
  WHERE id = _template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  IF _template.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_deleted', true,
      'template_id', _template.id
    );
  END IF;

  _role := public.get_company_role(_user_id, _template.company_id);

  IF _role IS NULL OR _role NOT IN ('company_admin', 'agent', 'operations') THEN
    RAISE EXCEPTION 'Not allowed to delete templates';
  END IF;

  UPDATE public.itinerary_templates
  SET deleted_at = now(),
      updated_at = now()
  WHERE id = _template_id;

  RETURN jsonb_build_object(
    'ok', true,
    'template_id', _template_id,
    'role', _role,
    'title', _template.title
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_itinerary_template(uuid) TO authenticated;