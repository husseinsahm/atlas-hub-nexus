
-- Template Options (e.g., "3 Nights from Aswan", "4 Nights from Esna")
CREATE TABLE public.template_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.itinerary_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  duration_nights INTEGER NOT NULL DEFAULT 3,
  departure_from TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Template Inclusions/Exclusions
CREATE TABLE public.template_inclusions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.itinerary_templates(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'include',
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Template Gallery
CREATE TABLE public.template_gallery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.itinerary_templates(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Template Availability
CREATE TABLE public.template_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.itinerary_templates(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL,
  departure_from TEXT NOT NULL,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.template_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_inclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_availability ENABLE ROW LEVEL SECURITY;

-- Policies for template_options
CREATE POLICY "Company members can view template options" ON public.template_options FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.itinerary_templates t WHERE t.id = template_options.template_id AND is_company_member(auth.uid(), t.company_id))
);
CREATE POLICY "Admins agents can manage template options" ON public.template_options FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.itinerary_templates t WHERE t.id = template_options.template_id AND get_company_role(auth.uid(), t.company_id) IN ('company_admin', 'agent'))
);

-- Policies for template_inclusions
CREATE POLICY "Company members can view template inclusions" ON public.template_inclusions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.itinerary_templates t WHERE t.id = template_inclusions.template_id AND is_company_member(auth.uid(), t.company_id))
);
CREATE POLICY "Admins agents can manage template inclusions" ON public.template_inclusions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.itinerary_templates t WHERE t.id = template_inclusions.template_id AND get_company_role(auth.uid(), t.company_id) IN ('company_admin', 'agent'))
);

-- Policies for template_gallery
CREATE POLICY "Company members can view template gallery" ON public.template_gallery FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.itinerary_templates t WHERE t.id = template_gallery.template_id AND is_company_member(auth.uid(), t.company_id))
);
CREATE POLICY "Admins agents can manage template gallery" ON public.template_gallery FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.itinerary_templates t WHERE t.id = template_gallery.template_id AND get_company_role(auth.uid(), t.company_id) IN ('company_admin', 'agent'))
);

-- Policies for template_availability
CREATE POLICY "Company members can view template availability" ON public.template_availability FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.itinerary_templates t WHERE t.id = template_availability.template_id AND is_company_member(auth.uid(), t.company_id))
);
CREATE POLICY "Admins agents can manage template availability" ON public.template_availability FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.itinerary_templates t WHERE t.id = template_availability.template_id AND get_company_role(auth.uid(), t.company_id) IN ('company_admin', 'agent'))
);
