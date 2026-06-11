DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_day_items; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_activities; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_comments; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.booking_day_items REPLICA IDENTITY FULL;
ALTER TABLE public.booking_activities REPLICA IDENTITY FULL;
ALTER TABLE public.internal_comments REPLICA IDENTITY FULL;