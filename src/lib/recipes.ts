import { supabase } from "@/integrations/supabase/client";

/**
 * Structure of a saved recipe snapshot (client-data free).
 * Versioned via the parent recipe's `version` column.
 */
export interface RecipeStructure {
  schema_version: 1;
  title: string;
  description?: string | null;
  currency: string;
  total_days: number;
  pricing: {
    markup_pct: number;
    rounding_step: number;
    group_discount_pct: number;
  };
  days: Array<{
    day_number: number;
    title?: string | null;
    short_description?: string | null;
    description?: string | null;
    city?: string | null;
    pickup_location?: string | null;
    dropoff_location?: string | null;
    pickup_time?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    items: Array<{
      library_item_id?: string | null;
      category: string;
      custom_title?: string | null;
      custom_description?: string | null;
      start_time?: string | null;
      duration_minutes?: number | null;
      quantity: number;
      unit_price: number;
      total_price: number;
      currency: string;
      notes?: string | null;
      sort_order: number;
      metadata?: any;
    }>;
  }>;
  services: Array<{
    library_item_id?: string | null;
    service_type: string;
    title: string;
    description?: string | null;
    supplier_name?: string | null;
    location?: string | null;
    pickup_location?: string | null;
    dropoff_location?: string | null;
    quantity: number;
    unit_price: number;
    total_cost: number;
    currency: string;
    sort_order: number;
    metadata?: any;
  }>;
}

/** Read a booking + days + items + services and serialize to a recipe structure. */
export async function extractRecipeFromBooking(bookingId: string): Promise<RecipeStructure> {
  const { data: booking, error: be } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();
  if (be || !booking) throw be ?? new Error("Booking not found");

  const { data: days } = await supabase
    .from("booking_days")
    .select("*, booking_day_items(*)")
    .eq("booking_id", bookingId)
    .order("day_number", { ascending: true });

  const { data: services } = await supabase
    .from("booking_services")
    .select("*")
    .eq("booking_id", bookingId)
    .order("sort_order", { ascending: true });

  return {
    schema_version: 1,
    title: booking.title,
    description: booking.description,
    currency: booking.currency || "USD",
    total_days: booking.total_days || (days?.length ?? 1),
    pricing: {
      markup_pct: Number(booking.markup_pct || 0),
      rounding_step: Number(booking.rounding_step || 0),
      group_discount_pct: Number(booking.group_discount_pct || 0),
    },
    days: (days || []).map((d: any) => ({
      day_number: d.day_number,
      title: d.title,
      short_description: d.short_description,
      description: d.description,
      city: d.city,
      pickup_location: d.pickup_location,
      dropoff_location: d.dropoff_location,
      pickup_time: d.pickup_time,
      start_time: d.start_time,
      end_time: d.end_time,
      items: ((d.booking_day_items || []) as any[])
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((it) => ({
          library_item_id: it.library_item_id,
          category: it.category,
          custom_title: it.custom_title,
          custom_description: it.custom_description,
          start_time: it.start_time,
          duration_minutes: it.duration_minutes,
          quantity: it.quantity,
          unit_price: Number(it.unit_price || 0),
          total_price: Number(it.total_price || 0),
          currency: it.currency,
          notes: it.notes,
          sort_order: it.sort_order || 0,
          metadata: it.metadata,
        })),
    })),
    services: (services || []).map((s: any) => ({
      library_item_id: s.library_item_id,
      service_type: s.service_type,
      title: s.title,
      description: s.description,
      supplier_name: s.supplier_name,
      location: s.location,
      pickup_location: s.pickup_location,
      dropoff_location: s.dropoff_location,
      quantity: s.quantity,
      unit_price: Number(s.unit_price || 0),
      total_cost: Number(s.total_cost || 0),
      currency: s.currency,
      sort_order: s.sort_order || 0,
      metadata: s.metadata,
    })),
  };
}

/**
 * Create a new booking from a recipe.
 * Optionally seed customer details. Dates are intentionally left blank — the
 * agent picks arrival/departure once they have the client confirmation.
 */
export async function instantiateBookingFromRecipe(opts: {
  recipeId: string;
  companyId: string;
  userId: string;
  bookingNumber: string;
  customer?: {
    customer_id?: string | null;
    title_override?: string;
  };
}): Promise<{ id: string }> {
  const { data: recipe, error: re } = await supabase
    .from("booking_recipes")
    .select("*")
    .eq("id", opts.recipeId)
    .single();
  if (re || !recipe) throw re ?? new Error("Recipe not found");

  const structure = recipe.structure as unknown as RecipeStructure;

  // 1) Create the booking
  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .insert({
      booking_number: opts.bookingNumber,
      company_id: opts.companyId,
      title: opts.customer?.title_override || structure.title,
      description: structure.description,
      currency: structure.currency,
      total_days: structure.total_days,
      status: "tentative",
      adults: 1,
      children: 0,
      markup_pct: structure.pricing?.markup_pct ?? 0,
      rounding_step: structure.pricing?.rounding_step ?? 0,
      group_discount_pct: structure.pricing?.group_discount_pct ?? 0,
      customer_id: opts.customer?.customer_id ?? null,
      created_by: opts.userId,
      source: "recipe",
    })
    .select("id")
    .single();
  if (bErr || !booking) throw bErr ?? new Error("Failed to create booking");

  // 2) Insert days, then items per day
  for (const day of structure.days) {
    const { data: insertedDay, error: dErr } = await supabase
      .from("booking_days")
      .insert({
        booking_id: booking.id,
        day_number: day.day_number,
        title: day.title,
        short_description: day.short_description,
        description: day.description,
        city: day.city,
        pickup_location: day.pickup_location,
        dropoff_location: day.dropoff_location,
        pickup_time: day.pickup_time,
        start_time: day.start_time,
        end_time: day.end_time,
      })
      .select("id")
      .single();
    if (dErr || !insertedDay) continue;

    if (day.items.length > 0) {
      await supabase.from("booking_day_items").insert(
        day.items.map((it) => ({
          booking_day_id: insertedDay.id,
          library_item_id: it.library_item_id,
          category: it.category,
          custom_title: it.custom_title,
          custom_description: it.custom_description,
          start_time: it.start_time,
          duration_minutes: it.duration_minutes,
          quantity: it.quantity,
          unit_price: it.unit_price,
          total_price: it.total_price,
          currency: it.currency,
          notes: it.notes,
          sort_order: it.sort_order,
          metadata: it.metadata ?? {},
        })),
      );
    }
  }

  // 3) Insert services
  if (structure.services.length > 0) {
    await supabase.from("booking_services").insert(
      structure.services.map((s) => ({
        booking_id: booking.id,
        company_id: opts.companyId,
        library_item_id: s.library_item_id,
        service_type: s.service_type as any,
        title: s.title,
        description: s.description,
        supplier_name: s.supplier_name,
        location: s.location,
        pickup_location: s.pickup_location,
        dropoff_location: s.dropoff_location,
        quantity: s.quantity,
        unit_price: s.unit_price,
        total_cost: s.total_cost,
        currency: s.currency,
        sort_order: s.sort_order,
        metadata: s.metadata ?? {},
        created_by: opts.userId,
      })),
    );
  }

  // 4) Bump recipe usage
  await supabase
    .from("booking_recipes")
    .update({
      usage_count: (recipe.usage_count || 0) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", recipe.id);

  // 5) Log creation activity
  await supabase.from("booking_activities").insert({
    booking_id: booking.id,
    company_id: opts.companyId,
    activity_type: "created",
    title: `Booking created from recipe: ${recipe.name}`,
    user_id: opts.userId,
  });

  return booking;
}

/** Lightweight next-number generator. Reuses the same pattern used in BookingsPage. */
export async function generateBookingNumber(companyId: string): Promise<string> {
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  const next = (count ?? 0) + 1;
  return `BK-${String(next).padStart(5, "0")}`;
}
